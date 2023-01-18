<?php

namespace App\Modules\{class-name}\Controllers;

use App\Modules\{class-name}\Module;
use Colibri\App;
use Colibri\Events\EventsContainer;
use Colibri\IO\FileSystem\File;
use Colibri\Utils\Cache\Bundle;
use Colibri\Utils\Debug;
use Colibri\Utils\ExtendedObject;
use Colibri\Web\RequestCollection;
use Colibri\Web\Controller as WebController;
use Colibri\Web\Templates\PhpTemplate;
use Colibri\Web\View;
use ScssPhp\ScssPhp\Compiler;
use ScssPhp\ScssPhp\OutputStyle;
use Colibri\Web\PayloadCopy;
use Colibri\Utils\Minifiers\Javascript as Minifier;

/**
 * Default controller
 */
class Controller extends WebController
{

    /**
     * Default action
     * @param RequestCollection $get данные GET
     * @param RequestCollection $post данные POST
     * @param mixed $payload данные payload обьекта переданного через POST/PUT
     * @return object
     */
    public function Index(RequestCollection $get, RequestCollection $post, ?PayloadCopy $payload = null): object
    {

        $module = App::$moduleManager->{class-name};

        $view = View::Create();
        $template = PhpTemplate::Create($module->modulePath . 'templates/index');

        $args = new ExtendedObject([
            'get' => $get,
            'post' => $post,
            'payload' => $payload
        ]);

        try {
            $html = $view->Render($template, $args);
        }
        catch (\Throwable $e) {
            $html = $e->getMessage() . ' ' . $e->getFile() . ' ' . $e->getLine();
        }

        return $this->Finish(
            200,
            $html,
            [],
            'utf-8'
        );
    }

    /**
     * Initializes bundle event handlers
     */
    private function _initDefaultBundleHandlers() 
    {
        App::$instance->HandleEvent(EventsContainer::BundleComplete, function ($event, $args) {
            try {
                if (in_array('scss', $args->exts)) {
                    $scss = new Compiler();
                    $scss->setOutputStyle(App::$isDev ? OutputStyle::EXPANDED : OutputStyle::COMPRESSED);
                    $args->content = $scss->compileString($args->content)->getCss();
                } elseif (in_array('js', $args->exts) && !App::$isDev) {
                    $args->content = Minifier::Minify($args->content);
                }
            } catch (\Throwable $e) {
                App::$log->emergency($e->getMessage() . ' ' . $e->getFile() . ' ' . $e->getLine());
            }
            return true;
        });

        App::$instance->HandleEvent(EventsContainer::BundleFile, function ($event, $args) {
            $file = new File($args->file);
            if ($file->extension !== 'html') {
                return true;
            }
            
            $componentName = $file->filename;
            if( preg_match('/ComponentName="([^"]*)"/i', $args->content, $matches) > 0) {
                $componentName = $matches[1];
            }

            $compiledContent = str_replace(
                ['\'', "\n", "\r", 'ComponentName="'.$componentName.'"'], 
                ['\\\'', "' + \n'", "", 'namespace="'.$componentName.'"'], 
                $args->content
            );

            $args->content = 'Colibri.UI.AddTemplate(\'' . $componentName . '\', ' . "\n" . '\'' . $compiledContent . '\');' . "\n";
            
            return true;
        });
    }

    /**
     * Generates a javascript and css bundles
     *
     * @param RequestCollection $get
     * @param RequestCollection $post
     * @param object|null $payload
     * @return object
     */
    public function Bundle(RequestCollection $get, RequestCollection $post, ? PayloadCopy $payload): object
    {

        $this->_initDefaultBundleHandlers();

        $langModule = App::$moduleManager->lang;
        $themeFile = null;
        $themeKey = '';

        if (App::$moduleManager->tools) {
            $themeFile = App::$moduleManager->tools->Theme(App::$domainKey);
            $themeKey = md5($themeFile);
        }

        if (!App::$request->server->commandline) {
            $jsBundle = Bundle::Automate(App::$domainKey, ($langModule ? $langModule->current . '.' : '') . 'assets.bundle.js', 'js', [
                ['path' => App::$moduleManager->auth->modulePath . '.Bundle/', 'exts' => ['js', 'html']],
            ]);
            $cssBundle = Bundle::Automate(App::$domainKey, ($langModule ? $langModule->current . '.' : '') . ($themeKey ? $themeKey . '.' : '') . 'assets.bundle.css', 'scss', [
                ['path' => App::$moduleManager->auth->modulePath . 'web/res/css/'],
                ['path' => App::$moduleManager->auth->modulePath . '.Bundle/'],
                ['path' => $themeFile],
            ], 'https://' . App::$request->host);

            return $this->Finish(
                200,
                'Bundle created successfuly',
                (object) [
                    'js' => str_replace('http://', 'https://', App::$request->address) . $jsBundle,
                    'css' => str_replace('http://', 'https://', App::$request->address) . $cssBundle
                ],
                'utf-8'
            );
        } else if ($langModule) {
            // bundle all languages
            $oldLangKey = $langModule->current;
            $langs = $langModule->Langs();
            foreach ($langs as $langKey => $langData) {
                $langModule->InitCurrent($langKey);
                Bundle::Automate(App::$domainKey, ($langKey . '.') . 'assets.bundle.js', 'js', [
                    ['path' => App::$moduleManager->auth->modulePath . '.Bundle/', 'exts' => ['js', 'html']],
                ]);
                Bundle::Automate(App::$domainKey, ($langKey . '.') . ($themeKey ? $themeKey . '.' : '') . 'assets.bundle.css', 'scss', [
                    ['path' => App::$moduleManager->auth->modulePath . 'web/res/css/'],
                    ['path' => App::$moduleManager->auth->modulePath . '.Bundle/'],
                    ['path' => $themeFile],
                ], 'https://' . App::$request->host);

            }
            $langModule->InitCurrent($oldLangKey);
            exit;
        } else {
            Bundle::Automate(App::$domainKey, 'assets.bundle.js', 'js', [
                ['path' => App::$moduleManager->auth->modulePath . '.Bundle/', 'exts' => ['js', 'html']],
            ]);
            Bundle::Automate(App::$domainKey, ($themeKey ? $themeKey . '.' : '') . 'assets.bundle.css', 'scss', [
                ['path' => App::$moduleManager->auth->modulePath . 'web/res/css/'],
                ['path' => App::$moduleManager->auth->modulePath . '.Bundle/'],
                ['path' => $themeFile],
            ], 'https://' . App::$request->host);
            exit;
        }
    }


}