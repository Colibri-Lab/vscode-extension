const cp = require('child_process');
const vscode = require('vscode');
const fs = require('fs');
const { __log, getWorkspacePath, replaceAll, readYaml, openFile } = require('./utils');
const glob = require('glob');

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
    let list = findStorageNames(path);

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

    vscode.window.showQuickPick(list)
        .then(function(libName) {
            __log.appendLine('Choosed: ' + libName);
            __log.appendLine('Downloading...');

            if(libName === vscode.l10n.t('Create new')) {
                createNewModule(context);
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

function replaceInPaths(startPath, replacements) {

    const result = fs.readdirSync(startPath, { withFileTypes: true });
    for(let r of result) {

        if(r.name === '.git') {
            continue;
        }

        let rr = r.name;
        const keys = Object.keys(replacements);
        for(const key of keys) {
            const value = replacements[key];
            rr = replaceAll(rr, key, value);
        }

        if(rr != r.name) {
            cp.execSync('mv "' + startPath + '/' + r.name + '" "' + startPath + '/' + rr + '"');
        }

        if(r.isDirectory()) {
            replaceInPaths(startPath + '/' + rr, replacements);
        }        

    }

}

function replaceInFiles(startPath, replacements) {
    const res = glob.sync(startPath + '/**/*', {
        dot: true,
        nodir: true
    });
    for(let r of res) {
        
        if(r.indexOf('.git') !== -1) {
            continue;
        }

        let content = fs.readFileSync(r).toString();

        const keys = Object.keys(replacements);
        for(const key of keys) {
            const value = replacements[key];
            content = replaceAll(content, key, value);
        }

        fs.writeFileSync(r, content);

    }
}

async function createNewModule(context) {

    const workspacePath = getWorkspacePath();
    const extensionPath = vscode.extensions.getExtension(context.extension.id).extensionUri.path;

    let moduleVendorAndName = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the module name:'), placeHolder: vscode.l10n.t('«vendor-name»/«module-name»'), ignoreFocusOut: true});
    let [moduleVendorName, moduleName] = moduleVendorAndName.split('/');    
    let moduleDescription = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the module description:'),placeHolder: vscode.l10n.t('Full description for your module'), ignoreFocusOut: true});
    let moduleClassName = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the module class Name:'), placeHolder: vscode.l10n.t('Without namespace, for example: MyClass, or Example. Please dont use the word «Module» in name...'), ignoreFocusOut: true});
    let moduleRepo = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the gitlab.colibrilab.pro repo url:'), placeHolder: vscode.l10n.t('Just the pathname, dont enter the domain name'), ignoreFocusOut: true});
    const result = await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {title: vscode.l10n.t('Is your module represents a website/application?'), placeHolder: vscode.l10n.t('Choose Yes if you plan to use module as startup for the application or website, No if your module will provide some functionality'), ignoreFocusOut: true});
    let projectStartsUp = result === vscode.l10n.t('Yes');

    let projectProdDomain = '';
    let projectTestDomain = '';
    let projectLocalDomain = '';
    if(projectStartsUp) {
        projectLocalDomain = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the project local domain:'), placeHolder: vscode.l10n.t('Enter the local domain if the module must be startable'), ignoreFocusOut: true});
        projectProdDomain = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the project production domain:'), placeHolder: vscode.l10n.t('Enter the production domain if the module must be startable'), ignoreFocusOut: true});
        projectTestDomain = await vscode.window.showInputBox({title: vscode.l10n.t('Enter the project test domain:'), placeHolder: vscode.l10n.t('Enter the test domain if the module must be startable'), ignoreFocusOut: true});
    }

    let path = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Choose the path where to place the module'),
    });
    let modulePath = path.pop().fsPath;

    if(!moduleVendorName || !moduleName || !moduleDescription || !moduleRepo || !moduleClassName || !modulePath) {
        vscode.window.showInformationMessage('Please enter the all properties');
    } else {
        
        moduleRepo = 'git@gitlab.colibrilab.pro:' + moduleRepo;
        let templatesPath = extensionPath + '/templates/module';
        
        let commandClone = 'cd ' + modulePath + ' && git clone ' + moduleRepo + ' ./';
        let commandCopy = 'cp -r -i ' + templatesPath + '/* ' + modulePath;
        let commandComposerConfig = 'cd ' + workspacePath + ' && composer config repositories.' + moduleName + ' path ' + modulePath;
        let commandComposerRequire = 'cd ' + workspacePath + ' && composer require ' + moduleVendorName + '/' + moduleName;
        let commandCommit = 'cd ' + workspacePath + ' && git commit -am \'Init commit\'';

        __log.appendLine('Module vendor name: ' + moduleVendorName);
        __log.appendLine('Module name: ' + moduleName);
        __log.appendLine('Module description: ' + moduleDescription);
        __log.appendLine('Module repo: ' + moduleRepo);
        __log.appendLine('Module class name: ' + moduleClassName);
        __log.appendLine('Module path: ' + modulePath);
        __log.appendLine('Project is starting up: ' + (projectStartsUp ? 'true' : 'false'));
        __log.appendLine('Project local domain: ' + projectLocalDomain);
        __log.appendLine('Project production domain: ' + projectProdDomain);
        __log.appendLine('Project testing domain: ' + projectTestDomain);

        __log.appendLine(cp.execSync(commandClone).toString());
        __log.appendLine(cp.execSync(commandCopy).toString());

        const replacements = {
            '{vendor-name}': moduleVendorName,
            '{module-name}': moduleName,
            '{module-description}': moduleDescription,
            '{class-name}': moduleClassName,
            '{project-starts-up}': (projectStartsUp ? 'true' : 'false'),
            '{project-local-domain}': projectLocalDomain,
            '{project-prod-domain}': projectProdDomain,
            '{project-test-domain}': projectTestDomain,
        };

        __log.appendLine('Replaceing variables...');
        replaceInPaths(modulePath, replacements);
        replaceInFiles(modulePath, replacements);

        __log.appendLine(cp.execSync(commandComposerConfig).toString());
        __log.appendLine(cp.execSync(commandComposerRequire).toString());

        __log.appendLine('Module successfuly created and attached to project...');
        __log.appendLine('See /vendor/' + moduleVendorName + '/' + moduleName + '/');

        const result = await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {title: vscode.l10n.t('Let\'s continue?'), placeHolder: vscode.l10n.t('There are a few variables left that can be adjusted'), ignoreFocusOut: true});
        let continueToVars = result === vscode.l10n.t('Yes');
        if(continueToVars) {

            let vars = {
                '{database-domain}': {type: 'text', title: vscode.l10n.t('Local database domain'), default: 'localhost'},
                '{database-name}': {type: 'text', title: vscode.l10n.t('Local database name'), default: moduleName},
                '{database-user}': {type: 'text', title: vscode.l10n.t('Local database user'), default: 'root'},
                '{database-password}': {type: 'text', title: vscode.l10n.t('Local database password'), default: ''},
                '{use-vault}': {type: 'yesno', title: vscode.l10n.t('Use Colibri vault to save passwords')},
                '{prod-vault-database-password}': {type: 'text', condition: 'data[\'{use-vault}\']', title: vscode.l10n.t('Vault key for PROD stage (database password)')},
                '{test-vault-database-password}': {type: 'text', condition: 'data[\'{use-vault}\']', title: vscode.l10n.t('Vault key for TEST stage (database password)')},
                '{prod-database-password}': {type: 'text', condition: '!data[\'{use-vault}\']', title: vscode.l10n.t('Production database password')},
                '{test-database-password}': {type: 'text', condition: '!data[\'{use-vault}\']', title: vscode.l10n.t('Test database password')},
                '{use-s3-fs}': {type: 'yesno', title: vscode.l10n.t('Use your own S3 file storage (i.e. Remote Media Library)')},
                '{s3-fs-test-domain}': {type: 'text', condition: 'data[\'{use-s3-fs}\']', title: vscode.l10n.t('S3 server domain for TEST stage')},
                '{s3-fs-prod-domain}': {type: 'text', condition: 'data[\'{use-s3-fs}\']', title: vscode.l10n.t('S3 server domain for PROD stage')},
                '{comet-server-address}': {type: 'text', title: vscode.l10n.t('Address for Colibri comet server, if you not using it, please leave as default'), default: 'comet.colibrilab.pro'},
                '{comet-server-port}': {type: 'text', title: vscode.l10n.t('Port for Colibri comet server, if you not using it, please leave as default'), default: '3005'},
            };

            let data = {};
            for(const variable of Object.keys(vars)) {
                const varData = vars[variable];

                let cont = true;
                if(varData.condition) {
                    eval('cont = ' + varData.condition + ';');
                }

                if(!cont) {
                    data[variable] = varData.type === 'yesno' ? false : '';
                    continue;
                }

                if(varData.type === 'yesno') {
                    const result = await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {title: varData.title, ignoreFocusOut: true});
                    data[variable] = result === vscode.l10n.t('Yes');
                }
                else if(varData.type === 'text') {
                    data[variable] = await vscode.window.showInputBox({title: varData.title, ignoreFocusOut: true, value: varData.default});
                }


            }
         
            __log.appendLine('Making changes to module files...');
            replaceInFiles(modulePath, data);
            
        }

        const commitResults = await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {title: vscode.l10n.t('Commit changes?'), placeHolder: vscode.l10n.t('Do you wish to commit changes now'), ignoreFocusOut: true});
        let commitResultsBool = commitResults === vscode.l10n.t('Yes');
        if(commitResultsBool) {
            __log.appendLine(cp.execSync(commandCommit).toString());
        }

        __log.appendLine('Job complete...');

    }

}

async function createController(context, e) {
    if(!e) {
        vscode.window.showInformationMessage(vscode.l10n.t('Please use this command in context menu of Controllers folder'));
        return;
    }

    let moduleName = '';
    let controllerName = '';
    let controllerDescription = '';
    const extensionPath = vscode.extensions.getExtension(context.extension.id).extensionUri.path;
    const templatesPath = extensionPath + '/templates/';

    const folderPath = e.fsPath;
    if(folderPath.indexOf('/vendor/') !== -1) {
        // модуль
        const p = folderPath.split('/vendor/')[1];
        const innerPath = p.split('/src/')[1];
        moduleName = innerPath.split('/')[0];

        controllerName = await vscode.window.showInputBox({title: vscode.l10n.t('Controller name:'), placeHolder: vscode.l10n.t('Enter controller name, without Controller word'), ignoreFocusOut: true});
        if(!controllerName) {
            return;
        }

        controllerDescription = await vscode.window.showInputBox({title: vscode.l10n.t('Controller description:'), placeHolder: vscode.l10n.t('Please, describe your controller'), ignoreFocusOut: true});

        let templateContent = fs.readFileSync(templatesPath + 'Controller.php') + '';
		templateContent = replaceAll(templateContent, /\{module-name\}/, moduleName);
		templateContent = replaceAll(templateContent, /\{controller-name\}/, controllerName);
		templateContent = replaceAll(templateContent, /\{controller-description\}/, controllerDescription);

        const fileName = folderPath + '/' + controllerName + 'Controller.php';
        fs.writeFileSync(fileName, templateContent);

        openFile(fileName);

        vscode.window.showInformationMessage(vscode.l10n.t('Controller file created!'));

    }
    else  {
        vscode.window.showInformationMessage(vscode.l10n.t('Can not create controller in application folder, please select module!'));
    }


}
async function createControllerAction(context, e) {

    let controllerActionName = '';
    let controllerActionDescription = '';
    const extensionPath = vscode.extensions.getExtension(context.extension.id).extensionUri.path;
    const templatesPath = extensionPath + '/templates/';
    const editor = vscode.window.activeTextEditor;

    if(!e && !editor) {
        vscode.window.showInformationMessage(vscode.l10n.t('Please use this command in editor context menu!'));
        return;
    }
    
    const folderPath = !e ? editor.document.uri.fsPath : e.fsPath;
    if(folderPath.indexOf('/vendor/') !== -1) {        

        controllerActionName = await vscode.window.showInputBox({title: vscode.l10n.t('Action name:'), placeHolder: vscode.l10n.t('Please, enter action name'), ignoreFocusOut: true});
        if(!controllerActionName) {
            return;
        }

        controllerActionDescription = await vscode.window.showInputBox({title: vscode.l10n.t('Action description:'), placeHolder: vscode.l10n.t('Please, describe your action'), ignoreFocusOut: true});

        let templateContent = fs.readFileSync(templatesPath + 'Action.php') + '';
        templateContent = replaceAll(templateContent, /\{controller-action-name\}/, controllerActionName);
		templateContent = replaceAll(templateContent, /\{controller-action-description\}/, controllerActionDescription);

        // модуль        
        const text = editor.document.getText();
        let lastLine = 0;
        const lines = text.split('\n');
        let index = 0;
        for(const line of lines) {
            if(line.trim() === '}') {
                lastLine = index;
            }
            index++;
        }

        editor.edit(builder => {
            builder.insert(new vscode.Position(lastLine, 0), templateContent + '\n');
        })

    }
    else  {
        vscode.window.showInformationMessage(vscode.l10n.t('Can not create action in application controller, please select module controller!'));
    }
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

function openPhpClass(context, data) {
    if(data.data.file) {
        openFile(data.data.file.path, data.data.file.line);
    } else if(data.data.method) {
        openFile(data.data.method.path, data.data.method.line);
    }

}


function findPhpDoc(lines, line) {
	if(lines[line - 1].indexOf('*/') === -1) {
		return '';
	}
	line--;

	let ret = [];
	while(lines[line].indexOf('/**') === -1) {
		ret.push(replaceAll(replaceAll(lines[line].trim(), '* ', ''), '*/', ''));
		line--;
	}

	return ret.reverse().join('\n');

}

function readPhp(path) {

	const content = fs.readFileSync(path).toString();
	const lines = content.split('\n');

	let className = '';
	let classParent = '';
	let classNameIndex = 0;
	let methods = {public: {}, private: {}, static: {}};
	let index = 0;
	for(const line of lines) {

		let match = /class\s([^\s]+)\sextends\s([^\s]+)/igm.exec(line);
		if(match && match.length > 0) {
			className = match[1];
			classParent = match[2];
			classNameIndex = index;
		}

		match = /static\sfunction\s([^\s\(]+).*/igm.exec(line);
		if(match && match.length > 0) {
			methods.static[match[1]] = {
				line: index,
				path: path,
				row: match[0],
				desc: findPhpDoc(lines, index)
			};
		}
		match = /private\sfunction\s([^\s\(]+).*/igm.exec(line);
		if(match && match.length > 0) {
			methods.private[match[1]] = {
				line: index,
				path: path,
				row: match[0],
				desc: findPhpDoc(lines, index)
			};
		}
		match = /public\sfunction\s([^\s\(]+).*/igm.exec(line);
		if(match && match.length > 0) {
			methods.public[match[1]] = {
				line: index,
				path: path,
				row: match[0],
				desc: findPhpDoc(lines, index)
			};
		}

		index++;
	}
	
	const ret = {};
	ret[className] = {
		name: className,
		path: path,
		line: classNameIndex,
		parent: classParent,
		methods: methods
	};

	return ret;

}

function findStorageNames(path) {

    path = path ? path : getWorkspacePath();
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

    return list;
}

function findStorageModels(path) {

    path = path ? path : getWorkspacePath();
    const appContent = readYaml(path + '/config/app.yaml');

    let modules = appContent.modules;
    if(typeof modules == 'string') {
        modules = replaceAll(modules, 'include(', '');
        modules = replaceAll(modules, ')', '');
        modules = readYaml(path + '/config/' + modules);
    }

    let storages = {};
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

                for(const storageName of Object.keys(module.config.databases.storages)) {
                    if(storageName.indexOf('__') === 0) {
                        continue;
                    }

                    let storage = module.config.databases.storages[storageName];
                    if(!storages[module.name]) {
                        storages[module.name] = {};;
                    } 

                    if(typeof storage === 'string') {
                        storage = readYaml(path + '/config/' + replaceAll(replaceAll(storage, ')', ''), 'include(', ''));
                    }

                    storages[module.name][storageName] = storage.models;
                }
    
            }    
        }
        catch(e) {}
    }

    return storages;
}


module.exports = {
    runMigrationScript,
    runModelsGenerator,
    runCreateProject,
    runDownloadModule,
    createController,
    createControllerAction,
    openPhpClass,
    readPhp,
    findStorageNames,
    findStorageModels
}