const cp = require('child_process');
const vscode = require('vscode');
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

function runCreateProject(context, e) {

    const workbenchConfig = vscode.workspace.getConfiguration();
    let command = workbenchConfig.get('colibrilab.create-project-command');

    vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Select the folder to create project'),
    }).then((path) => {

        command = replaceAll(command, '{project-dir}', path);

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
            const uri = vscode.Uri.parse('file://' + path, true);
            vscode.workspace.updateWorkspaceFolders(0, 0, {uri: uri, name: 'Colibri'});
        });

    });

}

module.exports = {
    runMigrationScript,
    runModelsGenerator,
    runCreateProject
}