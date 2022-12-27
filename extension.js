// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');

const { CodelenceProvider } = require('./CodeLenseProvider');
const {
    __languageMarkerRegularExpression,
	__langTextDecorationType,
	cleanVariables,
    replaceAll,
    saveYamlLangFile,
    loadYamlLangFile,
    getModuleName,
	checkForColibriProject,
	checkIfEditorIsClosed,
	__langFilter
} = require('./utils');
const {
	createNamespace,
    createComponent
} = require('./component');


function triggerUpdateDecorations(activeEditor) {

	const text = activeEditor.document.getText();
	if(__langFilter.indexOf(activeEditor.document.languageId) === -1) {
		return;
	} 

	let moduleName = getModuleName(activeEditor.document);
	if(!moduleName) {
		return;
	}
	let langsFileContent = loadYamlLangFile(activeEditor.document);
	if(!langsFileContent) {
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

		if(textKey.substring(0, moduleName.length + 1) !== moduleName.toLowerCase() + '-') {
			continue;
		}

		let message = [];
		if(langsFileContent[textKey]) {
			message.push('**' + textKey + '**');
			for(const langKey of Object.keys(langsFileContent[textKey])) {
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

	let content = document.getText();
	let langsFileContent = loadYamlLangFile(document); 
	if(!langsFileContent) {
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

		if(textKey.substring(0, moduleName.length + 1) !== moduleName.toLowerCase() + '-') {
			continue;
		}

		if(!langsFileContent[textKey]) {
			langsFileContent[textKey] = {};
		}
		if(textDefaultLangValue) {
			langsFileContent[textKey]['ru'] = textDefaultLangValue;
		}
	}

	if(saveYamlLangFile(document, langsFileContent)) {
		vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
	}

}

function onActivateEditorTextChangedEventHandler(event) {
	
	if(__langFilter.indexOf(event.document.languageId) !== -1 && checkForColibriProject(event.document)) {
		if(this._timer && this._timer > 0) {
			clearTimeout(this._timer);
		}
		this._timer = setTimeout(() => onActiveEditorTextChanged(event.document), 1000);	
	}

}

function onChangeActiveTextEditor(editor) {
	if (editor && __langFilter.indexOf(editor.document.languageId) !== -1 && checkForColibriProject(editor.document)) {
		onActiveEditorTextChanged(editor.document);
		triggerUpdateDecorations(editor);
		checkIfEditorIsClosed();
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
	if(!yamlObject) {
		return;
	}
	
	vscode.window.showInputBox({
		password: false,
		title: 'Insert the text for «' + textKey + '» in «' + langKey + '»',
		placeHolder: 'Input the class name with namespace',
		value: textValue
	}).then(input => {
		if(!input) {
			return;
		}
		textValue = input;
		if(!yamlObject[textKey]) {
			yamlObject[textKey] = {};
		}
		yamlObject[textKey][langKey] = textValue;
		saveYamlLangFile(langFile, yamlObject);
		onChangeActiveTextEditor(vscode.window.activeTextEditor);
	});
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable1 = vscode.commands.registerCommand('colibri-ui.create-component', () => createComponent(context));
	const disposable2 = vscode.commands.registerCommand('colibri-ui.create-namespace', () => createNamespace());
	const disposable3 = vscode.commands.registerCommand('colibri-ui.edit-lang-file', (langFile, langKey, text, textKey, textValue) => changeLangFile(langFile, langKey, text, textKey, textValue));
	context.subscriptions.push(disposable1);
	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);

	const disposable4 = vscode.workspace.onDidChangeTextDocument((event) => onActivateEditorTextChangedEventHandler(event));
	context.subscriptions.push(disposable4);

	vscode.window.onDidChangeActiveTextEditor((editor) => onChangeActiveTextEditor(editor));
	onChangeActiveTextEditor(vscode.window.activeTextEditor);

	const lenseProvider = new CodelenceProvider();
	vscode.languages.registerCodeLensProvider("html", lenseProvider);
	vscode.languages.registerCodeLensProvider("javascript", lenseProvider);
	vscode.languages.registerCodeLensProvider("php", lenseProvider);
	
}

// this method is called when your extension is deactivated
function deactivate() {
	cleanVariables();
}

module.exports = {
	activate,
	deactivate
}
