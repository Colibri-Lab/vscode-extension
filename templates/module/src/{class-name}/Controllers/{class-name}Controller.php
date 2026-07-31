<?php

namespace App\Modules\{class-name}\Controllers;

use App\Modules\{class-name}\Module;
use Colibri\App;
use Colibri\Web\Controller as WebController;
use Colibri\Web\PayloadCopy;
use Colibri\Web\RequestCollection;

/**
 * {class-name} main controller
 * @class
 * @extends WebController
 */
class {class-name}Controller extends WebController
{

    
    /**
     * Module settings
     * @param RequestCollection $get данные GET
     * @param RequestCollection $post данные POST
     * @param mixed $payload данные payload обьекта переданного через POST/PUT
     * @return object
     */
    public function Settings(RequestCollection $get, RequestCollection $post, ? PayloadCopy $payload = null): object
    {
        return $this->Finish(
            200,
            'Result message',
            Module::Instance()->GetSettings(),
            'utf-8'
        );

    }

}