const vscode = require('vscode');
const fs = require('fs');
const {
	replaceAll,
	expand,
	getLangFilePath,
	__languageMarkerRegularExpression,
	loadYamlLangFile,
	saveYamlLangFile,
	getNamespaceName
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
		namespaceName = lastFileData;	
	}

	vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Enter namespace name in current parent'),
		value: namespaceName + '.'
	}).then((input) => {

		namespaceName = input;
		if(!namespaceName) {
			return null;
		}

		const dirName = namespaceName.split('.').pop();
		fs.mkdirSync(choosedPath + '/' + dirName);

		let currentNamespace = fs.readFileSync(choosedPath + '/.js', { encoding: 'utf8', flag: 'r' });
		currentNamespace = currentNamespace.split(' = class ')[0];

		fs.writeFileSync(choosedPath + '/' + dirName + '/.js', currentNamespace + '.' + namespaceName + ' = class {};', { encoding: 'utf8', flag: 'w+' });
		vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
		
		getTreeDataProvider().refresh();	

		vscode.window.showInformationMessage(vscode.l10n.t('Namespace created!'));

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
	else {
		createNamespaceProcess(e.fsPath, context);
	}
}


/**
 * 
 * @param {string} choosedPath путь к папке где нужно создать компоненту
 * @param {vscode.ExtensionContext} context
 * @returns {Thenable|null}
 */
function createCompnentProcess(choosedPath, context) {

	let className = '';
	let parentClass = '';
	let fileIndex = 1;
	let isFile = false;

	choosedPath = fs.realpathSync(choosedPath + '/');
	const stat = fs.statSync(choosedPath);
	if (!stat.isDirectory()) {
		const parts = choosedPath.split('/');
		parts.pop();
		choosedPath = parts.join('/');
		isFile = true;
	}

	let jsFiles = [];
	const list = fs.readdirSync(choosedPath + '/');
	list.forEach(uri => {
		if (uri.indexOf('.js') !== -1) {
			jsFiles.push(uri);
		}
	});
	let lastFile = jsFiles.pop();

	if (lastFile === '.js') {
		// модуль, значит номер 1
	}
	else {
		const parts = lastFile.split('.');
		if (isFinite(parts[0])) {
			fileIndex = parseInt(parts[0]);
		}
	}

	let lastFileData = fs.readFileSync(choosedPath + '/' + lastFile, { encoding: 'utf8', flag: 'r' });
	lastFileData = lastFile === '.js' ? lastFileData.split(' = class ')[0] : lastFileData.split(' = class extends ')[0];
	lastFileData = lastFileData.trim();
	if (lastFileData && lastFile !== '.js') {
		let lastFileDataParts = lastFileData.split('.');
		lastFileDataParts.pop();
		className = lastFileDataParts.join('.');
	} else {
		className = lastFileData;
	}

	return vscode.window.showInputBox({
		password: false,
		title: vscode.l10n.t('Input the class name with namespace'),
		value: className + '.'
	}).then((input) => {
		className = input;
		if(!className) {
			return null;
		}

		return vscode.window.showInputBox({
			password: false,
			title: vscode.l10n.t('Input the parent class name with namespace'),
			value: 'Colibri.UI.'
		});
	}).then(input => {
		parentClass = input;
		if(!parentClass) {
			return null;
		}

		fileIndex++;


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
		jsContent = replaceAll(jsContent, /\{parentClass\}/, parentClass);
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

		const fileName = className.split('.').pop();
		const fileIndexText = expand(fileIndex.toFixed(0), '0', 2);
		const componentFileName = choosedPath + '/' + fileIndexText + '.' + fileName;
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

	});

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
	
	vscode.workspace.openTextDocument(vscode.Uri.file(data.data.object.file)).then((a) => {
		vscode.window.showTextDocument(a, 1, false).then(e => {
			if(data.data.content) {
				let range = e.document.lineAt(data.data.content.line).range;			
				e.selection = new vscode.Selection(range.start, range.end);
				e.revealRange(range);
			}
			else {
				let range = e.document.lineAt(data.data.object.line).range;			
				e.selection = new vscode.Selection(range.start, range.end);
				e.revealRange(range);
			}
			
		});
		
	}, (error) => {
		console.error(error);
	})
}


module.exports = {
	createNamespace,
	createComponent,
	openComponent
}