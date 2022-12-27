const vscode = require('vscode');
const fs = require('fs');
const {
    replaceAll,
    expand,
    checkWorkspace,
} = require('./utils');

/**
 */
function createNamespace() {
	// The code you place here will be executed every time your command is executed
	
    if(!checkWorkspace()) {
        return;
    }

	let choosedPath = '';
	let namespaceName = '';
	
	vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Select',
		canSelectFiles: false,
		canSelectFolders: true
	}).then(fileUri => {
		if (fileUri && fileUri[0]) {
			choosedPath = fileUri[0].path;
			choosedPath = fs.realpathSync(choosedPath + '/');
			return vscode.window.showInputBox({
				password: false,
				placeHolder: 'Enter namespace',
				value: ''
			});
		}
	}).then((input) => {
		namespaceName = input;
		const dirName = namespaceName.split('.').pop();
		fs.mkdirSync(choosedPath + '/' + dirName);

		let currentNamespace = fs.readFileSync(choosedPath + '/.js', {encoding:'utf8', flag:'r'});
		currentNamespace = currentNamespace.split(' = class ')[0];

		fs.writeFileSync(choosedPath + '/' + dirName + '/.js', currentNamespace + '.' + namespaceName + ' = class {};', {encoding:'utf8', flag:'w+'});
		vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
		vscode.window.showInformationMessage('Namespace created!');

	});
}

/**
 * Create a component
 * @param {vscode.ExtensionContext} context 
 */
function createComponent(context) {
	// The code you place here will be executed every time your command is executed
   
    if(!checkWorkspace()) {
        return;
    }

	let choosedPath = '';
	let className = '';
	let parentClass = '';
	let fileIndex = 1;

	vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Select',
		canSelectFiles: false,
		canSelectFolders: true
	}).then(fileUri => {
		if (fileUri && fileUri[0]) {
			choosedPath = fileUri[0].path;
			choosedPath = fs.realpathSync(choosedPath + '/');
			let jsFiles = [];
			const list = fs.readdirSync(choosedPath + '/');					
			list.forEach(uri => {             
				if(uri.indexOf('.js') !== -1) {
					jsFiles.push(uri);
				}
			});
			let lastFile = jsFiles.pop();

			if(lastFile === '.js') {
				// модуль, значит номер 1
			}
			else {
				const parts = lastFile.split('.');
				if(isFinite(parts[0])) {
					fileIndex = parseInt(parts[0]);
				}
			}

			let lastFileData = fs.readFileSync(choosedPath + '/' + lastFile, {encoding:'utf8', flag:'r'});
			lastFileData = lastFileData.split(' = class extends ')[0];
			lastFileData = lastFileData.trim();
			if(lastFileData) {
				let lastFileDataParts = lastFileData.split('.');
				lastFileDataParts.pop();
				className = lastFileDataParts.join('.');
			}
			return vscode.window.showInputBox({
				password: false,
				placeHolder: 'Input the class name with namespace',
				value: className + '.'
			});
		}
	}).then((input) => {
		className = input;
		return vscode.window.showInputBox({
			password: false,
			placeHolder: 'Input the parent class name with namespace',
			value: 'Colibri.UI.'
		});
	}).then(input => {
		parentClass = input;
		fileIndex++;

	
		const extensionPath = vscode.extensions.getExtension(context.extension.id).extensionUri.path;
		const templatesPath = extensionPath + '/templates/';
		let cssClassName = replaceAll(className, /\./, '-').toLowerCase();
		let languageTextPrefix = replaceAll(cssClassName, /app.modules./, '').toLowerCase();
		
		let jsContent = fs.readFileSync(templatesPath + 'template.js') + '';
		let htmlContent = fs.readFileSync(templatesPath + 'template.html') + '';
		let scssContent = fs.readFileSync(templatesPath + 'template.scss') + '';

		jsContent = replaceAll(jsContent, /\{className\}/, className);
		jsContent = replaceAll(jsContent, /\{parentClass\}/, parentClass);
		jsContent = replaceAll(jsContent, /\{cssClassName\}/, cssClassName);
		jsContent = replaceAll(jsContent, /\{languageTextPrefix\}/, languageTextPrefix);

		htmlContent = replaceAll(htmlContent, /\{className\}/, className);
		htmlContent = replaceAll(htmlContent, /\{parentClass\}/, parentClass);
		htmlContent = replaceAll(htmlContent, /\{cssClassName\}/, cssClassName);
		htmlContent = replaceAll(htmlContent, /\{languageTextPrefix\}/, languageTextPrefix);

		scssContent = replaceAll(scssContent, /\{className\}/, className);
		scssContent = replaceAll(scssContent, /\{parentClass\}/, parentClass);
		scssContent = replaceAll(scssContent, /\{cssClassName\}/, cssClassName);
		scssContent = replaceAll(scssContent, /\{languageTextPrefix\}/, languageTextPrefix);

		const fileName = className.split('.').pop();
		fs.writeFileSync(choosedPath + '/' + expand(fileIndex.toFixed(0), '0', 2) + '.' + fileName + '.js', jsContent, {encoding:'utf8', flag:'w+'});
		fs.writeFileSync(choosedPath + '/' + expand(fileIndex.toFixed(0), '0', 2) + '.' + fileName + '.html', htmlContent, {encoding:'utf8', flag:'w+'});
		fs.writeFileSync(choosedPath + '/' + expand(fileIndex.toFixed(0), '0', 2) + '.' + fileName + '.scss', scssContent, {encoding:'utf8', flag:'w+'});

		vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');

		vscode.window.showInformationMessage('Component created!');
	});

}


module.exports = {
    createNamespace,
    createComponent
}