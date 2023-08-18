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
    searchForCommentBlock,
    replaceAll,
    getWorkspacePath
} = require('./utils');
const { log } = require('console');
const { xml2json } = require('xml-js');


/**
 * 
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position 
 * @param {vscode.CancellationToken} token 
 * @param {vscode.CompletionContext} context 
 * @return ProviderResult<CompletionItem[] | CompletionList<...>>
 */
function provideHtmlCompletionItems(document, position, token, context) {
    return new Promise((resolve, reject) => {
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
        const nextChar = text.charAt(character);


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
                let c = '';
                if(value.choices) {
                    c = value.choices.join(',');
                }
                simpleCompletion.insertText = new vscode.SnippetString(attr + '="' + (c ? '${1|' + c + '|}' : '$1') + '"$0' + nextChar);
                const docs = new vscode.MarkdownString(value.desc + '\n\n' + vscode.l10n.t('Insert the attribute {0} for component {1} [link]({2}).', [attr, value.fullName, value.file]));
                docs.baseUri = vscode.Uri.parse(value.file);
                simpleCompletion.documentation = docs;
                comps.push(simpleCompletion);
            }
        }

        if (comps.length === 0) {
            
            for (let [componentName, value] of classesAndFiles) {
                const simpleCompletion = new vscode.CompletionItem(componentName);
                simpleCompletion.insertText = new vscode.SnippetString(isTag ? componentName : '<' + componentName + ' shown="true" name="$1">$0</' + componentName + '>' + nextChar);
                const docs = new vscode.MarkdownString(vscode.l10n.t('Insert the component {0} [link]({1}).', [value.fullName, value.file]));
                docs.baseUri = vscode.Uri.parse(value.file);
                simpleCompletion.documentation = docs;
                comps.push(simpleCompletion);
            }    
        }


        resolve(comps);
    });
    
}

function jsonToPaths(object, prefix = '', callback = null) {

    let list = [];

    for(const o of (object.elements || [])) {
        if(o.attributes && o.attributes.name) {
            list.push(callback ? callback(prefix + o.attributes.name) : prefix + o.attributes.name);
            list = list.concat(jsonToPaths(o, prefix + o.attributes.name + '/', callback));
        }
    }
    return list;
    
}

function provideJavascriptCompletionItems(document, position, token, context) {
    return new Promise((resolve, reject) => {
        __log.appendLine('Code completetion... ');
        
        // position.character
        // position.line
        
        const line = document.lineAt(position.line);    
        const text = line.text;
        if(text.trim() == 'child') {

            const fileName = replaceAll(document.fileName, '.js', '.html');
            const htmlContent = fs.readFileSync(fileName).toString();

            const json = xml2json(htmlContent, {
                ignoreComment: true,
                ignoreDoctype: true
            });
            
            let object = JSON.parse(json);
            object = object.elements[0];
            
            let list = jsonToPaths(object, '', (path) => {
                let name = replaceAll(path, '/', '_');
                name = name.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                const simpleCompletion = new vscode.CompletionItem('child ' + path);
                simpleCompletion.insertText = 'this._' + name + ' = this.Children(\'' + path + '\');\n';
                return simpleCompletion;
            });
            
            resolve(list);
        } else {
            reject([]);
        }

    });
}

function provideScssCompletionItems(document, position, token, context) {
    return new Promise((resolve, reject) => {
        __log.appendLine('Code completetion... ');
        const line = document.lineAt(position.line);    
        const text = line.text;
        if(text.trim() == 'theme') {
            const list = [];
            const workspacePath = getWorkspacePath();
            const themesPath = workspacePath + '/web/res/themes/';
            const content = fs.readdirSync(themesPath, {encoding: 'utf-8', withFileTypes: true});
            for(const item of content) {
                if(item.isDirectory() || item.isSymbolicLink()) {
                    continue;
                }
                
				if(item.name.indexOf('.scss') !== -1) {
                    const fileContent = fs.readFileSync(themesPath + item.name).toString();
                    const matches = /\$theme: "(.*)"/g.exec(fileContent);
                    const themeName = matches[1];
                    const simpleCompletion = new vscode.CompletionItem('theme ' + themeName);
                    simpleCompletion.insertText = '@if variable-exists($name: theme) and $theme == "' + themeName + '" {\n\t\n}\n';
                    list.push(simpleCompletion);
                }
            }    

            resolve(list);
        } else if(text.trim().substring(text.trim().length-1) === '$') {
            const list = [];
            let lindex = position.line;
            let l = document.lineAt(lindex).text;
            while(l && l.indexOf('@if variable-exists($name: theme) and $theme') === -1) {
                lindex--;
                l = document.lineAt(lindex).text;
            }

            let matches = /\$theme == "(.*)" \{/g.exec(l);
            let themeName = matches[1];

            const workspacePath = getWorkspacePath();
            let themeNameParts = themeName.split('-');
            const themeType = themeNameParts[themeNameParts.length - 1];
            themeNameParts.pop();
            themeName = themeNameParts.join('-');

            const themesPath = workspacePath + '/web/res/themes/' + themeName + '.' + themeType + '.scss';
            const content = fs.readFileSync(themesPath).toString();
            const lines = content.split('\n');
            for(const ll of lines) {
                if(ll.trim().startsWith('$')) {
                    // переменная
                    const matches = /\$(.*):.*/g.exec(ll);
                    if(matches[1] != 'theme') {
                        const simpleCompletion = new vscode.CompletionItem('$' + matches[1]);
                        simpleCompletion.insertText = '$' + matches[1] + ';';
                        list.push(simpleCompletion);
                    }

                }
            }

            resolve(list);
        } else if(text.indexOf('@include ') !== -1) {
            const list = [];
            let lindex = position.line;
            let l = document.lineAt(lindex).text;
            while(l && l.indexOf('@if variable-exists($name: theme) and $theme') === -1) {
                lindex--;
                l = document.lineAt(lindex).text;
            }

            let matches = /\$theme == "(.*)" \{/g.exec(l);
            let themeName = matches[1];

            const workspacePath = getWorkspacePath();
            let themeNameParts = themeName.split('-');
            const themeType = themeNameParts[themeNameParts.length - 1];
            themeNameParts.pop();
            themeName = themeNameParts.join('-');

            const themesPath = workspacePath + '/web/res/themes/' + themeName + '.' + themeType + '.scss';
            const content = fs.readFileSync(themesPath).toString();
            const lines = content.split('\n');
            for(const ll of lines) {
                if(ll.trim().startsWith('@mixin')) {
                    // переменная
                    const matches = /@mixin (.*)\{/g.exec(ll);

                    const simpleCompletion = new vscode.CompletionItem('@include ' + matches[1]);
                    simpleCompletion.insertText = matches[1] + ';';
                    list.push(simpleCompletion);

                }
            }

            resolve(list);

        } else {
            reject([]);
        }



    });
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
    provideJavascriptCompletionItems,
    provideScssCompletionItems,
    provideDefinitions,
    provideDeclarations,
    provideReferences,
    provideHover
    
}