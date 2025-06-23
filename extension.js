// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const {
	getCopilotCompletion
} = require('./copilot');

const { CodelenceProvider } = require('./CodeLenseProvider');
const {
	__languageMarkerRegularExpression,
	__langTextDecorationType,
	__log,
	cleanVariables,
	replaceAll,
	saveYamlLangFile,
	loadYamlLangFile,
	getModuleName,
	checkForColibriProject,
	__langFilter,
	checkWorkspace,
	reloadCompletionItems,
	hasLanguageModule,
	getPHPModules,
	getPhpModulesByVendor,
	hasColibriCore,
	getLanguages,
	getBundlePaths,
} = require('./utils');
const {
	createNamespace,
	createComponent,
	openComponent
} = require('./component');

const { Translate } = require('@google-cloud/translate').v2;

const { provideDefinitions, provideDeclarations, provideReferences, provideHover, provideHtmlCompletionItems, provideJavascriptCompletionItems, provideScssCompletionItems } = require('./Completion');
const { runModelsGenerator, runMigrationScript, runCreateProject, runDownloadModule, createController, createControllerAction, openPhpClass, findStorageModels } = require('./php-tools');
const { createTreeView, getTreeView, getTreeDataProvider, getPHPTreeDataProvider, createPHPTreeView, getPHPTreeView } = require('./tree');
const { default: axios } = require('axios');
const { exportTextsAction, importTextsAction } = require('./texts');

const fs = require('fs');
const path = require('path');

function triggerUpdateDecorations(activeEditor) {

	const text = activeEditor.document.getText();
	if (__langFilter.indexOf(activeEditor.document.languageId) === -1) {
		return;
	}

	let moduleName = getModuleName(activeEditor.document);
	// if(!moduleName) {
	// 	return;
	// }
	let langsFileContent = loadYamlLangFile(activeEditor.document);
	if (!langsFileContent) {
		return;
	}

	let match;
	let matches = [];
	while ((match = __languageMarkerRegularExpression.exec(text))) {
		const startPos = activeEditor.document.positionAt(match.index);
		const endPos = activeEditor.document.positionAt(match.index + match[0].length);
		const range = new vscode.Range(startPos, endPos);

		let text = match[1];
		let parts = replaceAll(replaceAll(text, '#{', ''), '}', '').split(';');
		let textKey = parts[0];

		// if(textKey.substring(0, moduleName.length + 1) !== moduleName.toLowerCase() + '-') {
		// 	continue;
		// }

		let message = [];
		if (langsFileContent[textKey]) {
			message.push('**' + textKey + '**');
			for (const langKey of Object.keys(langsFileContent[textKey])) {
				message.push('- **' + langKey + '**: ' + langsFileContent[textKey][langKey]);
			}

		}
		const decoration = { range: range, hoverMessage: message.join("\n\n") };
		matches.push(decoration);
	}
	activeEditor.setDecorations(__langTextDecorationType, matches);

}

/**
 * @param {vscode.TextDocument} document 
 */
function onActiveEditorTextChanged(document) {

	reloadCompletionItems();

	let content = document.getText();
	let langsFileContent = loadYamlLangFile(document);
	if (!langsFileContent) {
		return;
	}

	let moduleName = getModuleName(document);

	let match;
	while ((match = __languageMarkerRegularExpression.exec(content))) {
		// const startPos = activeEditor.document.positionAt(match.index)
		// const endPos = activeEditor.document.positionAt(match.index + match[0].length)
		// const range = new vscode.Range(startPos, endPos)

		let text = match[1];
		let parts = replaceAll(replaceAll(text, '#{', ''), '}', '').split(';');
		let textKey = parts[0];
		let textDefaultLangValue = parts[1];

		if (moduleName && textKey.substring(0, moduleName.length + 1) !== moduleName.toLowerCase() + '-') {
			continue;
		}

		if (!langsFileContent[textKey]) {
			langsFileContent[textKey] = {};
		}
		if (textDefaultLangValue) {
			langsFileContent[textKey]['ru'] = textDefaultLangValue;
		}
	}

	if (saveYamlLangFile(document, langsFileContent)) {
		// vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
	}

}

function onActivateEditorTextChangedEventHandler(event) {

	if (__langFilter.indexOf(event.document.languageId) !== -1 && checkForColibriProject(event.document)) {
		if (this._timer && this._timer > 0) {
			clearTimeout(this._timer);
		}
		this._timer = setTimeout(() => onActiveEditorTextChanged(event.document), 1000);
	}

}

async function selectComponentInTree(path, line = null) {
	let treeView = getTreeView();
	let dataProvider = getTreeDataProvider();
	if (treeView && treeView.visible) {
		const elementsPlacement = dataProvider.find(path);
		const component = elementsPlacement.pop();
		const selected = treeView.selection[0];

		for (const element of elementsPlacement) {
			if (element.collapsibleState !== vscode.TreeItemCollapsibleState.Expanded) {
				await treeView.reveal(element, { select: false, focus: false, expand: true });
				element.expand();
			}
		}

		if (!selected || selected.parent != component) {
			await treeView.reveal(component, line !== null ? { select: false, focus: false, expand: true } : { select: true });
			if (line !== null) {
				component.expand();
			}
		}

		if (line !== null) {
			let lines = {};
			lines['0'] = component;
			for (let [key, value] of component.children) {
				if (['template', 'styles'].indexOf(key) !== -1) { continue; }
				if (value.data.content && value.data.content.line) { lines[value.data.content.line] = value; }
			}

			let index = '0';
			for (let l in lines) {
				if (parseInt(l) <= line) {
					index = l;
				}
				else {
					break;
				}
			}
			await treeView.reveal(lines[index], { select: true });

		}

	}
}

function selectPhpInTree(path) {
	let phpTreeView = getPHPTreeView();
	let phpDataProvider = getPHPTreeDataProvider();
	if (phpTreeView && phpTreeView.visible) {
		if (path.indexOf('.php') === -1 && path.indexOf('/vendor/') === -1) {
			return;
		}

		let modulePath = path.split('/vendor/')[1];
		let moduleRealName = '';
		const modules = getPhpModulesByVendor();
		for (const module of Object.keys(modules)) {
			if (modulePath.indexOf(module) === 0) {
				moduleRealName = modules[module];
				break;
			}
		}
		if (!moduleRealName) {
			return;
		}

		let rootNode = phpDataProvider.module(moduleRealName);
		phpTreeView.reveal(rootNode, { select: false, focus: false, expand: true }).then(() => {
			if (path.indexOf('Controllers/') !== -1) {
				const controllersNode = phpDataProvider.findComponent(moduleRealName + '_Controllers');
				return phpTreeView.reveal(controllersNode, { select: false, focus: false, expand: true });
			} else if (path.indexOf('Models/') !== -1) {
				const modulesNode = phpDataProvider.findComponent(moduleRealName + '_Modules');
				return phpTreeView.reveal(modulesNode, { select: false, focus: false, expand: true });
			}
			return null;
		}).then(() => {
			if (path.indexOf('Controllers/') !== -1) {
				const component = phpDataProvider.findComponent(path);
				phpTreeView.reveal(component);
			} else if (path.indexOf('Models/') !== -1) {
				const storageModels = findStorageModels();
				const storages = storageModels[moduleRealName];
				let storageName = '';
				for (const storage of Object.keys(storages)) {
					if (path.indexOf(replaceAll(storages[storage].table, '\\', '/')) !== -1 || path.indexOf(replaceAll(storages[storage].row, '\\', '/')) !== -1) {
						storageName = storage;
						break;
					}
				}

				if (!storageName) {
					return null;
				}

				const component = phpDataProvider.findComponent(moduleRealName + '_storages_' + storageName);
				return phpTreeView.reveal(component, { select: false, focus: false, expand: true });

			}
		}).then(() => {
			const component = phpDataProvider.findComponent(path);
			phpTreeView.reveal(component);
		});



	}

}

/**
 * 
 * @param {vscode.TextEditor} editor 
 */
function onChangeActiveTextEditor(editor) {
	if (editor && __langFilter.indexOf(editor.document.languageId) !== -1 && checkForColibriProject(editor.document)) {
		onActiveEditorTextChanged(editor.document);
		triggerUpdateDecorations(editor);
		reloadCompletionItems();

		selectComponentInTree(editor.document.uri.fsPath, editor.selection.start.line);

		selectPhpInTree(editor.document.uri.fsPath);
	}
}

/**
 * 
 * @param {string} langFile 
 * @param {string} langKey 
 * @param {string} text 
 * @param {string} textKey 
 * @param {string} textValue 
 */
function changeLangFile(langFile, langKey, text, textKey, textValue) {
	const yamlObject = loadYamlLangFile(langFile);
	if (!yamlObject) {
		return;
	}

	vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Insert the text for «{0}» in «{1}»', [textKey, langKey]),
		placeHolder: vscode.l10n.t('Enter the translation text'),
		value: textValue
	}).then(input => {
		if (!input) {
			return;
		}
		textValue = input;
		if (!yamlObject[textKey]) {
			yamlObject[textKey] = {};
		}
		yamlObject[textKey][langKey] = textValue;
		saveYamlLangFile(langFile, yamlObject);
		onChangeActiveTextEditor(vscode.window.activeTextEditor);
	});
}

function translateLangFile(langFile, text, textKey, textObject) {

	const workbenchConfig = vscode.workspace.getConfiguration();
	let keyOfCloudTranslate = workbenchConfig.get('colibrilab.cloud-translate-key');
	if (!keyOfCloudTranslate) {
		vscode.window.showInformationMessage('Please provide google-translate key in your settings');
		return;
	}

	const yamlObject = loadYamlLangFile(langFile);
	if (!yamlObject) {
		return;
	}

	let languages = getLanguages();
	let list = [];

	const langKeys = Object.keys(languages);
	for (const l of langKeys) {
		list.push(l + ' -> ALL');
		for (const ll of langKeys) {
			list.push(l + ' -> ' + ll);
		}
	}

	vscode.window.showQuickPick(list).then(function (selection) {

		const langs = selection.split(' -> ');
		const lFrom = langs[0];
		const lTo = langs[1];

		const translate = new Translate({
			key: keyOfCloudTranslate
		});

		const text = textObject[lFrom];
		const target = lTo;

		if (target === 'ALL') {
			const promises = [];
			const langs = [];
			for (const ll of langKeys) {
				if (ll != lFrom) {
					langs.push(ll);
					promises.push(translate.translate(text, ll));
				}
			}
			Promise.all(promises).then(responses => {
				let index = 0;
				for (const response of responses) {
					const [translation] = response;
					yamlObject[textKey][langs[index]] = translation;
					index++;
				}
				saveYamlLangFile(langFile, yamlObject);
				onChangeActiveTextEditor(vscode.window.activeTextEditor);
			});
		} else {

			// Translates some text into Russian
			translate.translate(text, target).then(translations => {
				const [translation] = translations;

				yamlObject[textKey][lTo] = translation;
				saveYamlLangFile(langFile, yamlObject);
				onChangeActiveTextEditor(vscode.window.activeTextEditor);

			});
		}


	});

}

function onFileSystemChanged(e, context) {
	if (e.files) {
		for (const f of e.files) {
			let name = f.fsPath;
			if (name.indexOf('.js') !== -1 || name.indexOf('.html') !== -1) {
				getTreeDataProvider().refresh();
				break;
			} else if (name.indexOf('.php') !== -1) {
				getPHPTreeDataProvider().refresh();
				break;
			}
		}
	}
	else {
		let name = e.fileName;
		if (name.indexOf('.js') !== -1 || name.indexOf('.html') !== -1) {
			getTreeDataProvider().refresh();
		} else if (name.indexOf('.php') !== -1) {
			getPHPTreeDataProvider().refresh();
		}
	}
}

function createJsConfig() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) return;

	const rootPath = workspaceFolders[0].uri.fsPath;
	const jsconfigPath = path.join(rootPath, 'jsconfig.json');

	if(fs.existsSync(jsconfigPath)) {
		return;
	}

	const paths = getBundlePaths();
	const links = [];
	for(const path of paths) {
		links.push(replaceAll(path, rootPath + '/', '') + '/**/*.js');
	}
	links.push('vendor/colibri/ui/src/**/*.js');

	const jsconfig = {
		include: links,
		exclude: [
			"*.assets.*"
		]
	};

	try {
		fs.writeFileSync(jsconfigPath, JSON.stringify(jsconfig, null, 2), { encoding: 'utf8' });
		console.log('jsconfig.json создан или обновлён.');
	} catch (err) {
		console.error('Ошибка при создании jsconfig.json:', err);
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	try {

		// allways exists
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.create-project', (e) => runCreateProject(context, e)));

		__log.appendLine('Activating...');
		__log.appendLine('Checking workspace...');
		if (!checkWorkspace()) {
			__log.appendLine('This is not a Colibri.UI Project');
			__log.appendLine('Please, refer to the [dumentation](https://gitlab.repeatme.online/colibrilab/blank) for creating a project');
			return;
		}

		vscode.commands.executeCommand('setContext', 'colibrilab.isColibriWorkspace', true);
		vscode.commands.executeCommand('setContext', 'colibrilab.isColibriUIOnly', !hasColibriCore());

		__log.appendLine('Creating components tree');
		createTreeView(context);

		__log.appendLine('Creating php backend tree');
		createPHPTreeView(context);

		let treeView = getTreeView();
		treeView.onDidChangeVisibility((e) => {
			if (e.visible) {
				onChangeActiveTextEditor(vscode.window.activeTextEditor);
			}
		});

		let phpTreeView = getPHPTreeView();
		phpTreeView.onDidChangeVisibility((e) => {
			if (e.visible) {
				onChangeActiveTextEditor(vscode.window.activeTextEditor);
			}
		});

		vscode.workspace.onDidCreateFiles(e => onFileSystemChanged(e, context));
		vscode.workspace.onDidDeleteFiles(e => onFileSystemChanged(e, context));
		vscode.workspace.onDidSaveTextDocument(e => onFileSystemChanged(e, context));

		__log.appendLine('Registering events');

		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.create-component', (e) => createComponent(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.create-namespace', (e) => createNamespace(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.migrate', (e) => runMigrationScript(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.models-generate', (e) => runModelsGenerator(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.download-module', (e) => runDownloadModule(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.open-component', (e) => openComponent(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.open-phpclass', (e) => openPhpClass(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.create-controller', (e) => createController(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.create-controller-action', (e) => createControllerAction(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.export-texts', (e) => exportTextsAction(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.import-texts', (e) => importTextsAction(context, e)));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.refresh-tree', (e) => getTreeDataProvider().refresh()));
		context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.refresh-php-tree', (e) => getPHPTreeDataProvider().refresh()));

		if (hasLanguageModule()) {

			context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.edit-lang-file', (langFile, langKey, text, textKey, textValue) => changeLangFile(langFile, langKey, text, textKey, textValue)));
			context.subscriptions.push(vscode.commands.registerCommand('colibri-ui.translate-lang-file', (langFile, text, textKey, textObject) => translateLangFile(langFile, text, textKey, textObject)));
			context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => onActivateEditorTextChangedEventHandler(event)));
			vscode.window.onDidChangeActiveTextEditor((editor) => onChangeActiveTextEditor(editor));
			vscode.window.onDidChangeTextEditorSelection((e) => selectComponentInTree(e.textEditor.document.uri.fsPath, e.selections.length > 0 ? e.selections[0].start.line : null));
			onChangeActiveTextEditor(vscode.window.activeTextEditor);

			__log.appendLine('Registering codelence items...');
			const lenseProvider = new CodelenceProvider();
			vscode.languages.registerCodeLensProvider("html", lenseProvider);
			vscode.languages.registerCodeLensProvider("javascript", lenseProvider);
			vscode.languages.registerCodeLensProvider("php", lenseProvider);

		}
		else {
			__log.appendLine('Module Lang not found, please install to use multilangual abilities');
		}

		__log.appendLine('Loading class names...');
		reloadCompletionItems();

		__log.appendLine('Registering completion, definitions and declarations...');
		vscode.languages.setLanguageConfiguration('html', { wordPattern: /[^<\s]+/ });
		vscode.languages.registerCompletionItemProvider('html', { provideCompletionItems: provideHtmlCompletionItems });
		vscode.languages.registerDefinitionProvider('html', { provideDefinition: provideDefinitions });
		vscode.languages.registerDeclarationProvider('html', { provideDeclaration: provideDeclarations });
		vscode.languages.registerReferenceProvider('html', { provideReferences: provideReferences });
		vscode.languages.registerHoverProvider('html', { provideHover: provideHover });

		vscode.languages.registerCompletionItemProvider('javascript', { provideCompletionItems: provideJavascriptCompletionItems });
		vscode.languages.registerCompletionItemProvider('scss', { provideCompletionItems: provideScssCompletionItems });

		vscode.workspace.getConfiguration().update(
			'javascript.implicitProjectConfig.checkJs',
			true,
			vscode.ConfigurationTarget.Workspace
		);

		vscode.workspace.getConfiguration().update(
			'javascript.preferences.importModuleSpecifier',
			'relative',
			vscode.ConfigurationTarget.Workspace
		);

		createJsConfig();

		__log.appendLine('Success...');
	}
	catch (e) {
		console.log(e);
		__log.appendLine(e);
	}

}

// this method is called when your extension is deactivated
function deactivate() {
	cleanVariables();
}

module.exports = {
	activate,
	deactivate
}
