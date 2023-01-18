<?php
 
 
namespace App\Modules\{class-name};
 
class Installer
{

    private static function _loadConfig($file): ?array
    {
        return yaml_parse_file($file);
    }

    private static function _saveConfig($file, $config): void
    {
        yaml_emit_file($file, $config, \YAML_UTF8_ENCODING, \YAML_ANY_BREAK);
    }

    private static function _getMode($file): string
    {
        $appConfig = self::_loadConfig($file);
        return $appConfig['mode'];
    }

    private static function _injectIntoModuleConfig($file): void
    {

        $modules = self::_loadConfig($file);
        if(is_array($modules['entries'])) {
            foreach($modules['entries'] as $entry) {
                if($entry['name'] === '{class-name}') {
                    return;
                }
            }
        }
        else {
            $modules['entries'] = [];
        }

        $modules['entries'][] = [
            'name' => '{class-name}',
            'entry' => '\{class-name}\Module',
            'desc' => '{module-description}',
            'enabled' => true,
            'visible' => true,
            'for' => ['manage', '{module-name}'],
            'config' => 'include(/config/{module-name}.yaml)'
        ];

        self::_saveConfig($file, $modules);

    }

    private static function _injrectIntoDomains($file, $mode): void
    {
        $hosts = self::_loadConfig($file);
        if(isset($hosts['domains']['{module-name}'])) {
            return;
        }

        if($mode === 'local') {
            $hosts['domains']['{module-name}'] = ['{project-local-domain}'];
        }
        elseif ($mode === 'test') {
            $hosts['domains']['manage'] = array_merge($hosts['domains']['manage'], ['backend.{project-test-domain}']);
            $hosts['domains']['{module-name}'] = ['{project-test-domain}'];
            if('{use-s3-fs}' === 'true') {
                $hosts['services']['fs'] = '{s3-fs-test-domain}';
            }
        }
        elseif ($mode === 'prod') {
            // захватываем управление админкой
            // управляющий модуль должен быть один
            $hosts['domains']['manage'] = array_merge($hosts['domains']['manage'], ['backend.{project-prod-domain}']);
            $hosts['domains']['{module-name}'] = ['{project-prod-domain}'];
            if('{use-s3-fs}' === 'true') {
                $hosts['services']['fs'] = '{s3-fs-prod-domain}';
            }
        }

        self::_saveConfig($file, $hosts);
        
    }

    private static function _copyOrSymlink($mode, $pathFrom, $pathTo, $fileFrom, $fileTo): void 
    {
        print_r('Copying '.$mode.' '.$pathFrom.' '.$pathTo.' '.$fileFrom.' '.$fileTo."\n");
        if(!file_exists($pathFrom.$fileFrom)) {
            print_r('File '.$pathFrom.$fileFrom.' not exists'."\n");
            return;
        }

        if(file_exists($pathTo.$fileTo)) {
            print_r('File '.$pathTo.$fileTo.' exists'."\n");
            return;
        }

        if($mode === 'local') {
            shell_exec('ln -s '.realpath($pathFrom.$fileFrom).' '.$pathTo.($fileTo != $fileFrom ? $fileTo : ''));
        }
        else {
            shell_exec('cp -R '.realpath($pathFrom.$fileFrom).' '.$pathTo.$fileTo);
        }

        // если это исполняемый скрипт
        if(strstr($pathTo.$fileTo, '/bin/') !== false) {
            chmod($pathTo.$fileTo, 0777);
        }
    }

    private static function _findStoragesConfigFiles($configDir): array
    {
        $storagesConfigs = [];
        $files = scandir($configDir);
        foreach($files as $file) {
            if(!in_array($file, ['databases.yaml', '.', '..'])) {
                // Searching for databases.storages
                $config = self::_loadConfig($configDir.$file);
                if(isset($config['databases']['storages'])) {
                    $storagesConfigs[] = str_replace(')', '', str_replace('include(', '', $config['databases']['storages']));
                }
            }
        }
        return $storagesConfigs;
    }

    private static function _updateDatabaseConnection(string $configDir, string $mode): void
    {

        $databases = self::_loadConfig($configDir.'databases.yaml');
        
        // Updating database configuration
        $databases['access-points']['connections']['default_connection']['host'] = 'localhost';
        $databases['access-points']['connections']['default_connection']['user'] = '{module-name}';
        if($mode === 'prod') {
            // request from ColibriLab <vahan.grigoryan@gmail.com>
            if('{use-vault}' === 'true') {
                $databases['access-points']['connections']['default_connection']['password'] = 'vault({prod-vault-database-password})';
            }
            else {
                $databases['access-points']['connections']['default_connection']['password'] = '{prod-database-password}';
            }
        } else if($mode === 'test') {
            if('{use-vault}' === 'true') {
                $databases['access-points']['connections']['default_connection']['password'] = 'vault({test-vault-database-password})';
            }
            else {
                $databases['access-points']['connections']['default_connection']['password'] = '{test-database-password}';
            }
        }

        $databases['access-points']['points']['main']['database'] = '{module-name}';
        
        self::_saveConfig($configDir.'databases.yaml', $databases);
        $storagesConfigs = self::_findStoragesConfigFiles($configDir);
        foreach($storagesConfigs as $config) {
            $configData = self::_loadConfig($configDir.$config);
            if($configData) {
                foreach($configData as $storageName => $storageData) { 
                    if(is_string($configData[$storageName])) {
                        $sconfig = $configDir . str_replace(')', '', str_replace('include(', '', $configData[$storageName]));
                        $loadedConfig = self::_loadConfig($sconfig);
                        $loadedConfig['access-point'] = 'main';
                        self::_saveConfig($sconfig, $loadedConfig);
                    }
                    else {
                        $configData[$storageName]['access-point'] = 'main';
                    }
                }
            }
            self::_saveConfig($configDir.$config, $configData);
        }

    }

    private static function _injectDefaultSettings($file, $mode): void
    {

        $settings = self::_loadConfig($file);

        // следить за темой системы
        if(!isset($settings['screen']['theme'])) {
            $settings['screen'] = ['theme' => 'follow-device'];
        }
        if(!isset($settings['errors']['404'])) {
            $settings['errors'] = ['404' => '/e404/', '500' => '/e500/', '0' => '/e404'];
        }
        self::_saveConfig($file, $settings);

    }

    private static function _injectCometSettings($file, $mode): void
    {

        $settings = self::_loadConfig($file);

        $settings['host'] = '{comet-server-address}';
        $settings['port'] = '{comet-server-port}';

        self::_saveConfig($file, $settings);

    }
    
    private static function _injectMinifierSettings($file, $mode): void
    {

        $settings = self::_loadConfig($file);

        if($mode !== 'local' && $mode !== 'dev') {
            $settings['type'] = 'uglify';
            $settings['convert'] = true;
            $settings['command'] = '/usr/local/bin/uglifyjs --rename %s -o %s --compress --mangle --v8';
        }

        self::_saveConfig($file, $settings);

    }

 
    /**
     *
     * @param \Composer\Installer\PackageEvent $event
     * @return void
     */
    public static function PostPackageInstall($event)
    {
 
        print_r('Installing module «{module-description}» {class-name}'."\n");
 
        $vendorDir = $event->getComposer()->getConfig()->get('vendor-dir').'/';
        $operation = $event->getOperation();
        $installedPackage = $operation->getPackage();
        $targetDir = $installedPackage->getName();
        $path = $vendorDir.$targetDir;

        $configPath = $path.'/src/{class-name}/config-template/';
        $configDir = './config/';
 
        if(!file_exists($configDir.'app.yaml')) {
            print_r('Application configuration «app.yaml» found'."\n");
            return;
        }

        // берем точку входа
        $webRoot = \getenv('COLIBRI_WEBROOT');
        if(!$webRoot) {
            $webRoot = 'web'; 
        }
        $mode = self::_getMode($configDir.'app.yaml'); 
 
        // копируем конфиг
        print_r('Copying configuration files'."\n");
        self::_copyOrSymlink($mode, $configPath, $configDir, 'module-'.$mode.'.yaml', '{module-name}.yaml');
        self::_copyOrSymlink($mode, $configPath, $configDir, '{module-name}-storages.yaml', '{module-name}-storages.yaml');
        self::_copyOrSymlink($mode, $configPath, $configDir, '{module-name}-langtexts.yaml', '{module-name}-langtexts.yaml');
        
        print_r('Injecting module to configuration'."\n");
        self::_injectIntoModuleConfig($configDir.'modules.yaml');
        if({project-starts-up}) {
            self::_injrectIntoDomains($configDir.'hosts.yaml', $mode);
        }
        self::_injectDefaultSettings($configDir.'settings.yaml', $mode);
        self::_injectCometSettings($configDir.'comet.yaml', $mode);
        self::_injectMinifierSettings($configDir.'minifier.yaml', $mode);

        if($mode !== 'local') {
            print_r('Updating database settings'."\n");
            self::_updateDatabaseConnection($configDir, $mode);
        }

        print_r('Installing scripts'."\n");
        self::_copyOrSymlink($mode, $path.'/src/{class-name}/bin/', './bin/', '{module-name}-migrate.sh', '{module-name}-migrate.sh');
        self::_copyOrSymlink($mode, $path.'/src/{class-name}/bin/', './bin/', '{module-name}-bundle.sh', '{module-name}-bundle.sh');
        self::_copyOrSymlink($mode, $path.'/src/{class-name}/bin/', './bin/', '{module-name}-models-generate.sh', '{module-name}-models-generate.sh');

        print_r('Installing styles'."\n");
        // self::_copyOrSymlink($mode, $path.'/src/{class-name}/web/res/css/', './'.$webRoot.'/res/css/', '{module-name}-fonts.scss', '{module-name}-fonts.scss');
        // self::_copyOrSymlink($mode, $path.'/src/{class-name}/web/res/css/', './'.$webRoot.'/res/css/', '{module-name}-styles.scss', '{module-name}-styles.scss');

        print_r('Installing images'."\n");
        // self::_copyOrSymlink($mode, $path.'/src/{class-name}/web/res/img/', './'.$webRoot.'/res/img/', '{class-name}-noise.png', '{class-name}-noise.png');

        print_r('Installation complete'."\n");
 
    }
}