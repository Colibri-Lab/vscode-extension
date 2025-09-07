const vscode = require('vscode');
const fs = require('fs');
const {
	replaceAll,
	expand,
	getLangFilePath,
	__languageMarkerRegularExpression,
	loadYamlLangFile,
	saveYamlLangFile,
	getNamespaceName,
	openFile
} = require('./utils');
const { Data, getTreeDataProvider } = require('./tree');

/**
 * 
 * @param {string} choosedPath путь к папке где нужно создать компоненту
 * @param {vscode.ExtensionContext} context
 */
function createNamespaceProcess(choosedPath, context) {
	let namespaceName = '';

	choosedPath = fs.realpathSync(choosedPath + '/');
	const stat = fs.statSync(choosedPath);
	if (!stat.isDirectory()) {
		const parts = choosedPath.split('/');
		parts.pop();
		choosedPath = parts.join('/');
	}

	if(fs.existsSync(choosedPath + '/.js')) {
		let lastFileData = fs.readFileSync(choosedPath + '/.js', { encoding: 'utf8', flag: 'r' });
		lastFileData = lastFileData.split(' = class ')[0];
		lastFileData = lastFileData.trim();
		lastFileData = lastFileData.split('\n').pop();
		namespaceName = lastFileData;	
	}

	vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Enter namespace name in current namespace (without dublicating current)'),
		value: ''
	}).then((input) => {

		namespaceName = input;
		if(!namespaceName || namespaceName.indexOf('.') !== -1) {
			vscode.window.showInformationMessage(vscode.l10n.t('Attantion! Please enter the namespace name without parent or root namespace'));
			return null;
		}

		const dirName = namespaceName;
		if(fs.existsSync(choosedPath + '/' + dirName)) {
			vscode.window.showInformationMessage(vscode.l10n.t('Attantion! Namespace allready exists'));
			return null;
		}

		fs.mkdirSync(choosedPath + '/' + dirName);

		let currentNamespace = fs.readFileSync(choosedPath + '/.js', { encoding: 'utf8', flag: 'r' });
		currentNamespace = currentNamespace.split(' = class ')[0];
		currentNamespace = currentNamespace.split('\n').pop();
		currentNamespace = replaceAll(currentNamespace, '\n', '');

		vscode.window.showInputBox({
			password: false,
			title: vscode.l10n.t('Enter the description of class'),
			value: ''
		}).then(description => {
			
			fs.writeFileSync(choosedPath + '/' + dirName + '/.js', 
				'/**\n' + 
				' * ' + description + '\n' +
				' * @namespace\n' + 
				' * @memberof ' + currentNamespace + '\n' +
				' */\n' + 
				currentNamespace + '.' + namespaceName + ' = class {};', { encoding: 'utf8', flag: 'w+' });
			vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
			
			getTreeDataProvider().refresh();	
	
			vscode.window.showInformationMessage(vscode.l10n.t('Namespace created!'));
		});


	});
}

/**
 */
function createNamespace(context, e) {
	// The code you place here will be executed every time your command is executed

	if (!e) {
		vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Select',
			canSelectFiles: false,
			canSelectFolders: true
		}).then(fileUri => {
			if (fileUri && fileUri[0]) {
				createNamespaceProcess(fileUri[0].path, context);
			}
		});
	}
	else if(e instanceof Data) {
		createNamespaceProcess(e.data.object.file, context);
	}
	else {
		createNamespaceProcess(e.fsPath, context);
	}
}


/**
 * 
 * @param {string} choosedPath путь к папке где нужно создать компоненту
 * @param {vscode.ExtensionContext} context
 */
async function createCompnentProcess(choosedPath, context) {

	let className = '';
	let parentClass = '';
	let description = '';
	let fileIndex = 0;
	let isFile = false;

	choosedPath = fs.realpathSync(choosedPath + '/');
	const stat = fs.statSync(choosedPath);
	if (!stat.isDirectory()) {
		const parts = choosedPath.split('/');
		parts.pop();
		choosedPath = parts.join('/');
		isFile = true;
	}

	if(choosedPath.indexOf('/.Bundle') === -1 && choosedPath.indexOf('/UI') === -1) {
		return null
	}

	let jsFiles = [];
	const list = fs.readdirSync(choosedPath + '/');
	list.forEach(uri => {
		if (uri.indexOf('.js') !== -1) {
			jsFiles.push(uri);
		}
	});
	let firstFile = jsFiles.splice(0, 1)[0];
	let lastFile = jsFiles.pop() || firstFile;

	if (lastFile === '.js') {
		// модуль, значит номер 1
	}
	else {
		const parts = lastFile.split('.');
		if (isFinite(parts[0])) {
			fileIndex = parseInt(parts[0]);
		}
	}

	let lastFileData = '';
	if(firstFile === '.js') {
		// namespace exists
		lastFileData = fs.readFileSync(choosedPath + '/' + firstFile, { encoding: 'utf8', flag: 'r' });
		lastFileData = lastFileData.split(' = class ')[0];
		lastFileData = lastFileData.trim();
		className = lastFileData;
	}
	else {
		lastFileData = fs.readFileSync(choosedPath + '/' + lastFile, { encoding: 'utf8', flag: 'r' });
		lastFileData = lastFile === '.js' ? lastFileData.split(' = class ')[0] : lastFileData.split(' = class extends ')[0];
		lastFileData = lastFileData.trim();
		lastFileData = replaceAll(lastFileData, '\n', '');
		if (lastFileData && lastFile !== '.js') {
			let lastFileDataParts = lastFileData.split('.');
			lastFileDataParts.pop();
			className = lastFileDataParts.join('.');
		} else {
			className = lastFileData;
		}
	}

	className = className.split('\n').pop();
	className = replaceAll(className, '\n', '');

	className = await vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Input the class name with namespace'),
		value: className + '.'
	});

	if(!className) {
		return null;
	}

	let namespaceNames = className.split('.');
	namespaceNames.splice(namespaceNames.length - 1, 1);
	let namespaceName = namespaceNames.join('.');

	parentClass = await vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Input the parent class name with namespace'),
		value: 'Colibri.UI.'
	});

	if(!parentClass) {
		return null;
	}

	description = await vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Enter the description of class'),
		value: ''
	});

	if(!parentClass) {
		return null;
	}

	const parts = choosedPath.indexOf('UI/') !== -1 ? choosedPath.split('UI/') : choosedPath.split('.Bundle/');
	const bundlePath = parts[0] + (choosedPath.indexOf('UI/') !== -1 ? 'UI/' : '.Bundle/');

	let possibleNamespace = replaceAll(className, 'App.Modules.', '');
	const moduleName = possibleNamespace.split('.').splice(0, 1).pop();
	if(!fs.existsSync(bundlePath + '.js')) {
		// пишем что модуль не найден
		vscode.window.showInformationMessage(vscode.l10n.t('Module not found'));
		return null;
	}

	const moduleContent = fs.readFileSync(bundlePath + '.js').toString();
	if(choosedPath.indexOf('UI/') !== -1) {
			
	} else {
		if(moduleContent.indexOf('App.Modules.' + moduleName + ' = class extends Colibri.Modules.Module') === -1) {
			// попытка создать компоненту не в своем модуле;
			vscode.window.showInformationMessage(vscode.l10n.t('Incorrect module name'));
			return null;
		}	
	}
	
	possibleNamespace = replaceAll(possibleNamespace, moduleName + '.', '');
	const parts2 = possibleNamespace.split('.')
	parts2.pop();
	possibleNamespace = parts2.join('.');
	possibleNamespace = replaceAll(possibleNamespace, '.', '/');

	const listDir = (path) => {
		const dir = fs.opendirSync(path);
		let item;
		let ret = [];
		while(item = dir.readSync()) {
			ret.push(item.name);
		}
		return ret;
	} 
	
	let possibleNamespacePath = bundlePath;
	if(fs.existsSync(bundlePath + possibleNamespace)) {
		possibleNamespacePath = bundlePath + possibleNamespace;
	}
	
	for(const name of possibleNamespace.split('/')) {
		const dirList = listDir(possibleNamespacePath);
		for(const dirname of dirList) {
			if(name === dirname || new RegExp('^[0-9]+\.' + name + '$').test(dirname)) {
				possibleNamespacePath = possibleNamespacePath + '/' + dirname;
				break;
			}
		}
		
	}

	if(!fs.existsSync(possibleNamespacePath + '/.js')) {
		// нет такой области
		vscode.window.showInformationMessage(vscode.l10n.t('Namespace not found'));
		return null;
	}

	const namespaceContent = fs.readFileSync(possibleNamespacePath + '/.js').toString();
	if(choosedPath.indexOf('UI/') !== -1) {
			
	} else {
		if(namespaceContent.indexOf('App.Modules.' + moduleName + '.' + replaceAll(possibleNamespace, '/', '.') + ' = class ') === -1) {
			// нет такой области
			vscode.window.showInformationMessage(vscode.l10n.t('Namespace not found'));
			return null;
		}
	}

	fileIndex++;

	const fileName = className.split('.').pop();
	const fileIndexText = expand(fileIndex.toFixed(0), '0', 2);
	const componentFileName = possibleNamespacePath + '/' + fileIndexText + '.' + fileName;


	const extensionPath = vscode.extensions.getExtension(context.extension.id).extensionUri.path;
	const templatesPath = extensionPath + '/templates/component/';
	let cssClassName = replaceAll(className, /\./, '-').toLowerCase();
	let languageTextPrefix = replaceAll(cssClassName, /app.modules./, '').toLowerCase();

	let textContent = '';
	let newTextContent = '';
	let range, selection;
	if (isFile) {
		selection = vscode.window.activeTextEditor.selection;
		range = new vscode.Range(selection.start, selection.end);
		textContent = vscode.window.activeTextEditor.document.getText(range);
		newTextContent = '<{class-name} shown="true" name="{new-component-object-name}" />';
	}

	let jsContent = fs.readFileSync(templatesPath + 'template.js') + '';
	let htmlContent = fs.readFileSync(templatesPath + 'template.html') + '';
	let scssContent = fs.readFileSync(templatesPath + 'template.scss') + '';
	let langContent = fs.readFileSync(templatesPath + 'template.lang') + '';

	jsContent = replaceAll(jsContent, /\{className\}/, className);
	jsContent = replaceAll(jsContent, /\{description\}/, description);
	jsContent = replaceAll(jsContent, /\{parentClass\}/, parentClass);
	jsContent = replaceAll(jsContent, /\{namespaceName\}/, namespaceName);
	jsContent = replaceAll(jsContent, /\{cssClassName\}/, cssClassName);
	jsContent = replaceAll(jsContent, /\{languageTextPrefix\}/, languageTextPrefix);

	htmlContent = replaceAll(htmlContent, /\{className\}/, className);
	htmlContent = replaceAll(htmlContent, /\{parentClass\}/, parentClass);
	htmlContent = replaceAll(htmlContent, /\{cssClassName\}/, cssClassName);
	htmlContent = replaceAll(htmlContent, /\{languageTextPrefix\}/, languageTextPrefix);
	htmlContent = replaceAll(htmlContent, /\{textContent\}/, textContent);

	scssContent = replaceAll(scssContent, /\{className\}/, className);
	scssContent = replaceAll(scssContent, /\{parentClass\}/, parentClass);
	scssContent = replaceAll(scssContent, /\{cssClassName\}/, cssClassName);
	scssContent = replaceAll(scssContent, /\{languageTextPrefix\}/, languageTextPrefix);

	fs.writeFileSync(componentFileName + '.js', jsContent, { encoding: 'utf8', flag: 'w+' });
	fs.writeFileSync(componentFileName + '.html', htmlContent, { encoding: 'utf8', flag: 'w+' });
	fs.writeFileSync(componentFileName + '.scss', scssContent, { encoding: 'utf8', flag: 'w+' });
	fs.writeFileSync(componentFileName + '.lang', langContent, { encoding: 'utf8', flag: 'w+' });

	vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
	getTreeDataProvider().refresh();

	vscode.window.showInformationMessage('Component created!');

	if (isFile) {
		return Promise.resolve({
			selection: selection, text: newTextContent, className: className, componentFiles: {
				js: componentFileName + '.js',
				html: componentFileName + '.html',
				scss: componentFileName + '.scss',
				lang: componentFileName + '.lang'
			}, textPrefix: languageTextPrefix
		});
	}
	else {
		return null;
	}

}


/**
 * Create a component
 * @param {vscode.ExtensionContext} context 
 */
function createComponent(context, e) {
	// The code you place here will be executed every time your command is executed


	if (!e) {
		vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Select',
			canSelectFiles: false,
			canSelectFolders: true
		}).then(fileUri => {
			if (fileUri && fileUri[0]) {
				createCompnentProcess(fileUri[0].path, context);
			}
		});
	}
	else if(e instanceof Data) {
		createCompnentProcess(e.data.object.file, context);
	}
	else {
		createCompnentProcess(e.fsPath, context).then((creationContext) => {
			if (!creationContext) {
				return;
			}
			const selection = creationContext.selection;
			let text = creationContext.text;
			let componentFiles = creationContext.componentFiles;
			let languageTextPrefix = creationContext.textPrefix;
			let className = creationContext.className;

			const textEditor = vscode.window.activeTextEditor;
			const document = textEditor.document;

			const range = new vscode.Range(selection.start, selection.end);
			const oldText = document.getText(range);

			vscode.window.showInputBox({
				password: false,
				title: vscode.l10n.t('Input the new component object name'),
				value: ''
			}).then((input) => {


				// надо забрать языковые тексты
				const langFile = getLangFilePath(document);
				const yamlObject = loadYamlLangFile(langFile);
				const currentNamespace = getNamespaceName(document);
				const newLangContent = {};
				let match;
				while ((match = __languageMarkerRegularExpression.exec(oldText))) {
					let langText = match[1];
					let parts = replaceAll(replaceAll(langText, '#{', ''), '}', '').split(';');
					let textKey = parts[0];

					if (yamlObject[textKey]) {
						newLangContent[textKey] = Object.assign({}, yamlObject[textKey]);
						delete yamlObject[textKey];
					}

				}

				if (Object.keys(newLangContent).length > 0) {
					saveYamlLangFile(componentFiles.lang, newLangContent);
					saveYamlLangFile(langFile, yamlObject);
				}

				className = replaceAll(className, currentNamespace + '.', '');
				text = replaceAll(text, '{new-component-object-name}', input);
				text = replaceAll(text, '{class-name}', className);
				textEditor.edit((builder) => builder.replace(selection, text));
			});

		});

	}

}

/**
 * Create a component
 * @param {vscode.ExtensionContext} context
 * @param {Data} data 
 */
function openComponent(context, data) {	
	openFile(data.data.content && data.data.content.path ? data.data.content.path : data.data.object.file, data.data.content ? data.data.content.line : data.data.object.line);
}


module.exports = {
	createNamespace,
	createComponent,
	openComponent
}