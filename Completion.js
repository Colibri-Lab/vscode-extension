const vscode = require('vscode');
const { 
    __log, 
    __componentRegularExpression, 
    __completionItemsRegexp, 
    getComponentName, 
    getComponentNames, 
    getComponentAttributes 
} = require('./utils');

/**
 * 
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position 
 * @param {vscode.CancellationToken} token 
 * @param {vscode.CompletionContext} context 
 * @return ProviderResult<CompletionItem[] | CompletionList<...>>
 */
function provideHtmlCompletionItems(document, position, token, context) {
    __log.appendLine('Code completetion...');

    // position.character
    // position.line

    const range = document.getWordRangeAtPosition(position);
    const line = document.lineAt(position.line);

    const text = line.text;
    const character = position.character;

    let tagName = '';
    let matches1;
    while (matches1 = __componentRegularExpression.exec(text)) {
        if (character > matches1.index && character < matches1.index + matches1[0].length) {
            const foundTag = matches1[0];
            tagName = __completionItemsRegexp.exec(foundTag)[1];
        }
    }

    let currentComponentName = getComponentName(document);

    const classesAndFiles = getComponentNames(currentComponentName)

    __log.appendLine('Got components: ' + classesAndFiles.size);

    let componentAttrs = new Map();

    for (let [componentName, value] of classesAndFiles) {
        if (componentName === tagName || value.fullName === tagName) {
            // считаем что каждый класс в отдельном файле
            componentAttrs = getComponentAttributes(value.file, classesAndFiles);
            break; 
        }
    }

    const comps = [];

    if (componentAttrs.size > 0) {
        for (const [attr, value] of componentAttrs) {
            const simpleCompletion = new vscode.CompletionItem(attr + '=""');
            simpleCompletion.insertText = new vscode.SnippetString(attr + '="${1}"');
            const docs = new vscode.MarkdownString(vscode.l10n.t('Insert the attribute {0} for component {1} [link]({2}).', [attr, value.fullName, value.file]));
            docs.baseUri = vscode.Uri.parse(value.file);
            simpleCompletion.documentation = docs;
            comps.push(simpleCompletion);
        }
    }

    if (comps.length > 0) {
        return comps;
    }

    for (let [componentName, value] of classesAndFiles) {
        const simpleCompletion = new vscode.CompletionItem(componentName);
        simpleCompletion.insertText = new vscode.SnippetString('<' + componentName + ' shown="${1|true,false|}" name="${2}"></' + componentName + '>');
        const docs = new vscode.MarkdownString(vscode.l10n.t('Insert the component {0} [link]({1}).', [value.fullName, value.file]));
        docs.baseUri = vscode.Uri.parse(value.file);
        simpleCompletion.documentation = docs;
        comps.push(simpleCompletion);
    }

    return comps;
}

module.exports = {
    provideHtmlCompletionItems,
}