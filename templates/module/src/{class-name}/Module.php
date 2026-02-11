<?php

/**
 * {module-description}
 *
 * @author Author Name <author.name@action-media.ru>
 * @copyright {year} {vendor}
 * @package App\Modules\{class-name}
 */
namespace App\Modules\{class-name};


use Colibri\Modules\Module as BaseModule;
use Colibri\Utils\Menu\Item;
use Colibri\App;
use Colibri\Utils\Logs\Logger;

/**
 * {module-description}
 * @package App\Modules\{class-name}
 *
 *
 */
class Module extends BaseModule
{

    /**
     * Module initialization
     * @return void
     */
    public function InitializeModule(): void
    {
        if(App::$domainKey === '{module-name}') {

            // Setting a language settings
            if(App::$moduleManager->{'lang'}) {
                App::$moduleManager->{'lang'}->InitCurrent(App::$request->cookie->{'{module-name}-lang'});
                App::$moduleManager->{'lang'}->SetUseCookie(false);    
                App::$moduleManager->{'lang'}->SetCookieDomain($this->Config('lang-cookie-domain', App::$request->host)->GetValue());
            }

        }
    }

    /**
     * Used in backend to generate menu items
     */
    public function GetTopmostMenu(bool $hideExecuteCommand = true): Item|array
    {
        return [

        ];

    }

    /**
     * Used in backend to get permissions
     */
    public function GetPermissions(): array
    {
        $permissions = parent::GetPermissions();
        $permissions['{module-name}'] = '#{{module-name}-permissions}';
        return $permissions;
    }

    /**
     * Used in Storages to backup data
     */
    public function Backup(Logger $logger, string $path)
    {

        $modulePath = $path . 'modules/{class-name}/';

        // $logger->debug('Exporting {storage-name}...');
        // $table = {storage-table-name}::LoadAll();
        // $table->ExportJson($modulePath . '{storage-name}.json');

    }

    public function GetSettings(): array
    {
        $ret = [];

        /** @var \App\Modules\Lang\Module $lang */
        $lang = App::$moduleManager->Get('lang');
        if($lang) {
    
            $langs = $lang->Langs();
            $ret['langs'] = $langs;
            $ret['lang-cookie-name'] = '{module-name}-lang';
            $ret['lang-cookie-domain'] = $lang->GetCookieDomain();
    
            $currentLang = $langs->{$lang->current};
            $ret['lang'] = (object) array_merge(['name' => $lang->current], (array) $currentLang);

        }

        return $ret;
    }
    

}