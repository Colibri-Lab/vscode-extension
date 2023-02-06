const vscode = require('vscode');
const fs = require('fs');
const { 
    __log, 
    __componentRegularExpression, 
    __completionItemsRegexp, 
    getComponentName, 
    getComponentNames, 
    getComponentAttributes, 
    filterCompomentNames,
    __attributesRegExp,
    searchForCommentBlock
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
    let isTag = false;
    if(range) {
        const tagPositionStart = new vscode.Position(range.start.line, range.start.character - 1);
        const tagPositionEnd = range.start;
        const tagRange = new vscode.Range(tagPositionStart, tagPositionEnd);
        isTag = document.getText(tagRange) === '<';
    }

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

    const classesAndFiles = getComponentNames(currentComponentName);

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
            const docs = new vscode.MarkdownString(value.desc + '\n\n' + vscode.l10n.t('Insert the attribute {0} for component {1} [link]({2}).', [attr, value.fullName, value.file]));
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
        simpleCompletion.insertText = new vscode.SnippetString(isTag ? componentName : '<' + componentName + ' shown="${1|true,false|}" name="${2}"></' + componentName + '>');
        const docs = new vscode.MarkdownString(vscode.l10n.t('Insert the component {0} [link]({1}).', [value.fullName, value.file]));
        docs.baseUri = vscode.Uri.parse(value.file);
        simpleCompletion.documentation = docs;
        comps.push(simpleCompletion);
    }

    return comps;
}

/**
 * 
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position 
 * @param {vscode.CancellationToken} token 
 * @return ProviderResult<CompletionItem[] | CompletionList<...>>
 */
function provideDefinitions(document, position, token) {

    const range = document.getWordRangeAtPosition(position);
    const text = document.getText(range);

    const currentComponentName = getComponentName(document);
    const parts = currentComponentName.split('.');
    const possibleNames = [];
    while(parts.length > 0) {
        possibleNames.push(parts.join('.') + '.' + text);
        parts.pop();
    }
    possibleNames.push(text);

    const classObject = filterCompomentNames(possibleNames);
    if(!classObject) {
        return null;
    }

    const locations = [new vscode.Location(vscode.Uri.file(classObject.file), new vscode.Position(classObject.line, 0))];
    if(classObject.html) {
        locations.push(new vscode.Location(vscode.Uri.file(classObject.html), new vscode.Position(classObject.line, 0)));
    }
    return locations;

}

function provideDeclarations(document, position, token) {
    const range = document.getWordRangeAtPosition(position);
    const text = document.getText(range);

    const currentComponentName = getComponentName(document);
    const parts = currentComponentName.split('.');
    const possibleNames = [];
    while(parts.length > 0) {
        possibleNames.push(parts.join('.') + '.' + text);
        parts.pop();
    }
    possibleNames.push(text);

    const classObject = filterCompomentNames(possibleNames);
    if(!classObject) {
        return null;
    }

    return new vscode.Location(vscode.Uri.file(classObject.file), new vscode.Position(classObject.line, 0));
    
}

function provideReferences(document, position, context, token) {
    const range = document.getWordRangeAtPosition(position);
    const text = document.getText(range);

    const currentComponentName = getComponentName(document);
    const parts = currentComponentName.split('.');
    const possibleNames = [];
    while(parts.length > 0) {
        possibleNames.push(parts.join('.') + '.' + text);
        parts.pop();
    }
    possibleNames.push(text);

    const classObject = filterCompomentNames(possibleNames);
    if(!classObject) {
        return null;
    }

    const locations = [new vscode.Location(vscode.Uri.file(classObject.file), new vscode.Position(classObject.line, 0))];
    if(classObject.html) {
        locations.push(new vscode.Location(vscode.Uri.file(classObject.html), new vscode.Position(classObject.line, 0)));
    }
    return locations;
}
function provideHover(document, position, token) {
    const range = document.getWordRangeAtPosition(position);
    const text = document.getText(range);

    const currentComponentName = getComponentName(document);
    const parts = currentComponentName.split('.');
    const possibleNames = [];
    while(parts.length > 0) {
        possibleNames.push(parts.join('.') + '.' + text);
        parts.pop();
    }
    possibleNames.push(text);

    const classObject = filterCompomentNames(possibleNames);
    if(!classObject) {
        return null;
    }

    const file = classObject.file;
    const content = fs.readFileSync(file).toString();
    const lines = content.split(/\n/);
    const line = lines[classObject.line];
    const matches = line.matchAll(__attributesRegExp); 
    const markdown = new vscode.MarkdownString();
    for(const match of matches) {
        const className = match[1].split('.').pop();
        markdown.appendMarkdown('# ' + className + '\n');
        const commentblock = searchForCommentBlock(lines, classObject.line);
        if(commentblock.length > 0) {
            let text = commentblock.join('\n');
            markdown.appendMarkdown('*Class comment*' + '\n');
            markdown.appendText(text);
        }
        markdown.appendCodeblock(match[0] + '\n ... \n}');

    }

    return new vscode.Hover(markdown);
}

module.exports = {
    provideHtmlCompletionItems,
    provideDefinitions,
    provideDeclarations,
    provideReferences,
    provideHover
    
}