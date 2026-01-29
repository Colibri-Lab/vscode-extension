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

}