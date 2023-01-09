const cp = require('child_process');
const vscode = require('vscode');
const fs = require('fs');
const { __log, getWorkspacePath, replaceAll, readYaml } = require('./utils');

function runMigrationScript(context, e) {
    const path = getWorkspacePath();
    const workbenchConfig = vscode.workspace.getConfiguration();
	let command = workbenchConfig.get('colibrilab.migrate-command');
    command = replaceAll(command, '{app-root}', path);
	cp.exec(command, (err, stdout, stderr) => {
        if (stdout.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
            stdout = replaceAll(stdout, '\033[0m\n', '');
            stdout = replaceAll(stdout, '\033[31m', '');
            stdout = replaceAll(stdout, '\033[32m', '');
            stdout = replaceAll(stdout, '\033[36m', '');
            stdout = replaceAll(stdout, '\n\n', '\n');
            __log.appendLine(stdout);
        }
        if (stderr.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
            __log.appendLine(stderr);
        }
        if (err) {
            __log.appendLine('error: ' + err);
        }
    });
}

function runModelsGenerator(context, e) {

    const path = getWorkspacePath();
    const workbenchConfig = vscode.workspace.getConfiguration();
    let command = workbenchConfig.get('colibrilab.models-generate-command');
    command = replaceAll(command, '{app-root}', path);
    
    const appContent = readYaml(path + '/config/app.yaml');

    let modules = appContent.modules;
    if(typeof modules == 'string') {
        modules = replaceAll(modules, 'include(', '');
        modules = replaceAll(modules, ')', '');
        modules = readYaml(path + '/config/' + modules);
    }

    let storages = [];
    for(const module of modules.entries) {

        if(typeof module.config == 'string') {
            module.config = replaceAll(module.config, 'include(', '');
            module.config = replaceAll(module.config, ')', '');
            module.config = readYaml(path + module.config);
        }

        try {
            if(module.config.databases.storages) {
                if(typeof module.config.databases.storages == 'string') {
                    module.config.databases.storages = replaceAll(module.config.databases.storages, 'include(', '');
                    module.config.databases.storages = replaceAll(module.config.databases.storages, ')', '');
                    module.config.databases.storages = readYaml(path + '/config/' + module.config.databases.storages);
                }
    
                storages = [...storages, ...Object.keys(module.config.databases.storages)];
            }    
        }
        catch(e) {}
    }

    let list = [];
    for(const storage of storages) {
        if(storage.substring(0, 2) !== '__') {
            list.push(storage);
        }
    }

    vscode.window.showQuickPick(list).then(function(storageName) {
        __log.appendLine('Choosed: ' + storageName);
        __log.appendLine('Generating models...');
        command = replaceAll(command, '{storage-name}', storageName);
        cp.exec(command, (err, stdout, stderr) => {
            
            if (stdout.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
                stdout = replaceAll(stdout, '\033[0m\n', '');
                stdout = replaceAll(stdout, '\033[31m', '');
                stdout = replaceAll(stdout, '\033[32m', '');
                stdout = replaceAll(stdout, '\033[36m', '');
                stdout = replaceAll(stdout, '\n\n', '\n');
                __log.appendLine(stdout);
            }
            if (stderr.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
                __log.appendLine(stderr);
            }
            if (err) {
                __log.appendLine('error: ' + err);
            }
        });
    });

    
}

function runDownloadModule(context, e) {

    const path = getWorkspacePath();
    const workbenchConfig = vscode.workspace.getConfiguration();
    let command = workbenchConfig.get('colibrilab.download-module-command');
    
    const appContent = readYaml(path + '/config/app.yaml');
    let composerContent = JSON.parse(fs.readFileSync(path + '/composer.json').toString());

    const downloadableModules = {
        "colibri/lang": vscode.l10n.t("Language support"),
        "colibri/sites": vscode.l10n.t("Sites and folders"),
        "colibri/tools": vscode.l10n.t("Tools"),
        "colibri/auth": vscode.l10n.t("Client authorization"),
        "colibri/security": vscode.l10n.t("Backend: Security module"),
        "colibri/mainframe": vscode.l10n.t("Backend: Mainframe"),
        "colibri/manage": vscode.l10n.t("Backend: Management"),
    };

    const downloadableLibraries = {
        "colibri/sphinx-api-client": vscode.l10n.t("Api Client for SphinxSearch"),
        "colibri/colibriauthclient": vscode.l10n.t("Api Client for Client Authorization Module"),
    }

    for(const module of Object.keys(composerContent.require)) {
        if(downloadableModules[module]) {
            delete downloadableModules[module]; 
        } else if(downloadableLibraries[module]) {
            delete downloadableLibraries[module];
        }
    }

    let list = [];
    for(const module of Object.keys(downloadableModules)) {
        list.push(module + ' (' +  downloadableModules[module] + ') - ' + vscode.l10n.t('Module'));
    }
    for(const lib of Object.keys(downloadableLibraries)) {
        list.push(lib + ' (' +  downloadableLibraries[lib] + ') - ' + vscode.l10n.t('Library'));
    }

    list.push(vscode.l10n.t('Create new'));

    vscode.window.showQuickPick(list).then(function(libName) {
        __log.appendLine('Choosed: ' + libName);
        __log.appendLine('Downloading...');

        if(libName === 'Create new') {
            createNewModule();
        }
        else {

            libName = libName.split(' (')[0];
            command = 'cd ' + path + ' && ' + replaceAll(command, '{module-vendor-and-name}', libName)
            const process = cp.exec(command, (err, stdout, stderr) => {
                
                if (stdout.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
                    stdout = replaceAll(stdout, '\033[0m\n', '');
                    stdout = replaceAll(stdout, '\033[31m', '');
                    stdout = replaceAll(stdout, '\033[32m', '');
                    stdout = replaceAll(stdout, '\033[36m', '');
                    stdout = replaceAll(stdout, '\n\n', '\n');
                    __log.appendLine(stdout);
                }
                if (stderr.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
                    __log.appendLine(stderr);
                }
                if (err) {
                    __log.appendLine('error: ' + err);
                }
            });
    
            process.addListener('close', (code, signal) => {
                __log.appendLine('Complete with code ' + code + '...');
            });
    
        }

        
    });

}

function createNewModule() {

    vscode.window.showInformationMessage('This feature is not implemented yet!');
    return;

    let moduleVendorAndName = '';
    let moduleDescription = '';
    let moduleClassName = '';
    let moduleRepo = '';
    let modulePath = '';

    vscode.window.showInputBox({
        title: vscode.l10n.t('Enter the module name:'),
        placeHolder: vscode.l10n.t('«vendor»/«module»'), 
    }).then((input) => {
        moduleVendorAndName = input;
        return vscode.window.showInputBox({
            title: vscode.l10n.t('Enter the module description:'),
            placeHolder: vscode.l10n.t('Full description for your module'), 
        });
    }).then((input) => {
        moduleDescription = input
        return vscode.window.showInputBox({
            title: vscode.l10n.t('Enter the module class Name:'),
            placeHolder: vscode.l10n.t('Without namespace, for example: MyClass, or Example. Please dont use the word «Module» in name...'), 
        });
    }).then((input) => {
        moduleClassName = input;
        return vscode.window.showInputBox({
            title: vscode.l10n.t('Enter the gitlab.colibrilab.pro repo url:'),
            placeHolder: vscode.l10n.t('Just the pathname, dont enter the domain name'), 
        });
    }).then((input) => {
        moduleRepo = input;
        return vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Choose the path where to place the module'),
        });
    }).then((value) => {
        /** @var {Array} value */
        let path = value.pop();
        modulePath = path.fsPath;
        return Promise.resolve();
    }).then(() => {

        if(!moduleVendorAndName || !moduleDescription || !moduleRepo || !moduleClassName || !modulePath) {
            vscode.window.showInformationMessage('Please enter the all properties');
        } else {

            // создаем модуль

        }

    });

}

function runCreateProject(context, e) {

    const workbenchConfig = vscode.workspace.getConfiguration();
    let command = workbenchConfig.get('colibrilab.create-project-command');

    vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Select the folder to create project'),
    }).then((value) => {
        /** @var {Array} value */
        let path = value.pop();
        const cpath = path.fsPath;
        command = replaceAll(command, '{project-dir}', cpath);

        const process = cp.exec(command, (err, stdout, stderr) => {
            
            if (stdout.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
                stdout = replaceAll(stdout, '\033[0m\n', '');
                stdout = replaceAll(stdout, '\033[31m', '');
                stdout = replaceAll(stdout, '\033[32m', '');
                stdout = replaceAll(stdout, '\033[36m', '');
                stdout = replaceAll(stdout, '\n\n', '\n');
                __log.appendLine(stdout);
            }
            if (stderr.substring(0, 'Xdebug:'.length) !== 'Xdebug:') {
                __log.appendLine(stderr);
            }
            if (err) {
                __log.appendLine('error: ' + err);
            }
        });

        process.addListener('close', (code, signal) => {
            vscode.commands.executeCommand("vscode.openFolder", path, false);
        });

    });

}

module.exports = {
    runMigrationScript,
    runModelsGenerator,
    runCreateProject,
    runDownloadModule
}