const { runInThisContext } = require('vm');
const vscode = require('vscode');

const {
    replaceAll,
    getModuleName,
    getLangFilePath,
    __langFilter,
    __languageMarkerRegularExpression,
    checkForColibriProject,
    getLanguages,
    loadYamlLangFile
} = require('./utils');

class CodelenceProvider {

    getRanges(document) {

        if(__langFilter.indexOf(document.languageId) === -1 || !checkForColibriProject(document)) {
            return [];
        }

        const ranges = [];
		const documentText = document.getText();
		let langFile = getLangFilePath(document);
		let moduleName = getModuleName(document);
        const yamlObject = loadYamlLangFile(langFile);
        if (!yamlObject) {
            return [];
        }

		let match;
		while ((match = __languageMarkerRegularExpression.exec(documentText))) {
			let text = match[1];
			let parts = replaceAll(replaceAll(text, '#{', ''), '}', '').split(';');
			let textKey = parts[0];
			
            if(moduleName && textKey.substring(0, moduleName.length + 1) !== moduleName.toLowerCase() + '-') {
				continue;
			}
            let textValue = parts[1];
            let valueObject = {};
            if(yamlObject[textKey]) {
                valueObject = yamlObject[textKey];
            }

			const line = document.lineAt(document.positionAt(match.index).line);
			const indexOf = line.text.indexOf(match[0]);
			const position = new vscode.Position(line.lineNumber, indexOf);
            const range = document.getWordRangeAtPosition(position, new RegExp(__languageMarkerRegularExpression));

            ranges.push({
                range: range,
                langFile,
                text,
                textKey,
                textValue,
                valueObject
            });
        }
        return ranges;
    }

	provideCodeLenses(document, token) {
		this.codeLenses = [];

        const languages = getLanguages();
        const ranges = this.getRanges(document);
        for(const range of ranges) {
            for(const langKey of Object.keys(languages)) {
                const lang = languages[langKey];

                this.codeLenses.push(new vscode.CodeLens(range.range, {
                    title: lang.desc.toUpperCase(),
                    tooltip: "Edit language text for «" + range.textKey + "» in «" + lang.desc.toUpperCase() + "»",
                    command: "colibri-ui.edit-lang-file",
                    arguments: [range.langFile, langKey, range.text, range.textKey, range.valueObject[langKey] ? range.valueObject[langKey] : '']
                }));	
            }
        }
		return this.codeLenses;
	}
}

module.exports = {
    CodelenceProvider
};