const vscode = require('vscode');
const { getWorkspacePath, getLanguages, enumFiles, getPHPModules, readYaml, getPhpModulesByVendor, replaceAll, __log, saveYamlLangFile, loadYamlLangFile, showStatusBarSpinner, hideStatusBarSpinner, readYamlText, saveYamlLangText } = require("./utils");
const yamlO = require('yaml');
const fs = require('fs');
const OpenAI = require('openai').default;
const { prompt } = require('@copilot-extensions/preview-sdk');


async function translateWithCopilot(language, text) {

    const workbenchConfig = vscode.workspace.getConfiguration();
    let copilotToken = workbenchConfig.get('colibrilab.github-api-key');
    if (!copilotToken) {
        __log.appendLine('Please provide google-translate key in your settings');
        return;
    }

    const result = await prompt("Translate " + text + " to language " + language, { token: copilotToken });

    // Step 3: Run Copilot inline with your translation prompt
    return result.message?.content || null;

}

async function translateText(language, text) {

    const workbenchConfig = vscode.workspace.getConfiguration();
    let openaiApiKey = workbenchConfig.get('colibrilab.openai-api-key');
    if (!openaiApiKey) {
        __log.appendLine('Please provide google-translate key in your settings');
        return;
    }

    const client = new OpenAI({ apiKey: openaiApiKey });
    try {

        let languages = '';
        if (Array.isArray(language)) {
            const ll = [];
            for (const l of language) {
                ll.push(l);
            }
            languages = ll.join(',');
        } else {
            languages = language;
        }

        const response = await client.chat.completions.create({
            model: "gpt-5",
            messages: [
                { role: "system", content: "You are a helpful translator." },
                {
                    role: "user", content: "Translate " + text + " to language " + languages + ". Answer in JSON format, where key is the language, value is a translation. " +
                        "For example: {\"en\": \"...\", \"hy\": \"...\"}."
                }
            ]
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (e) {
        __log.appendLine('Error during translation: ' + e.message);
        return null;
    }
}

async function translateCurrentFileFromOneLangToAnother(context, e) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const text = document.getText();
    const yaml = readYamlText(text);
    let languages = getLanguages();
    const langKeys = Object.keys(languages);

    const langFrom = await vscode.window.showQuickPick(langKeys, { placeHolder: 'Select the language you want to translate from' });
    const langTo = await vscode.window.showQuickPick(langKeys, { placeHolder: 'Select the languages you want to translate to', canPickMany: true });

    if (!langFrom || !langTo) {
        return;
    }
    
    showStatusBarSpinner('Translating in progress, please wait...');

    for (const key in yaml) {
        showStatusBarSpinner('Translating key ' + key + ', please wait...');
        const responses = await translateText(langTo, yaml[key][langFrom]);
        for (const lang in responses) {
            yaml[key][lang] = responses[lang];
        }
    }

    hideStatusBarSpinner();

    editor.edit(editBuilder => {
        const lastLine = editor.document.lineCount - 1;
        const fullRange = new vscode.Range(
            0, 0,
            lastLine,
            editor.document.lineAt(lastLine).text.length
        );
        editBuilder.replace(fullRange, saveYamlLangText(yaml));
    });

}

async function translateAllTextsFromOneLangToAnother(context, e) {
    const path = getWorkspacePath();
    let languages = getLanguages();

    const langKeys = Object.keys(languages);
    const langFrom = await vscode.window.showQuickPick(langKeys, { placeHolder: vscode.l10n.t('Select the language you want translate from') });
    const langTo = await vscode.window.showQuickPick(langKeys, { placeHolder: vscode.l10n.t('Select the language you want to translate to') });

    if (!langFrom || !langTo) {
        return;
    }

    let files = enumFiles(path, 'lang', true);
    showStatusBarSpinner('Translating in progress, please wait...');

    for (const f of files) {
        const filecontent = readYaml(f);
        if (filecontent) {
            for (const key in filecontent) {
                if (filecontent[key][langFrom] === undefined) {
                    __log.appendLine('Language ' + langFrom + ' not found in file ' + f + ' for key ' + key);
                    continue;
                }

                if (filecontent[key][langTo] !== undefined) {
                    __log.appendLine('Language ' + langTo + ' already exists in file ' + f + ' for key ' + key);
                    continue;
                }

                const newText = await translateText(langTo, filecontent[key][langFrom]);
                if (!newText) {
                    break;
                }
                filecontent[key][langTo] = newText;

            }
            saveYamlLangFile(f, filecontent)
        }
    }

    hideStatusBarSpinner();

}

async function translateAllWithCopilot(context, e) {

    const path = getWorkspacePath();
    let languages = getLanguages();

    const langKeys = Object.keys(languages);
    const langFrom = await vscode.window.showQuickPick(langKeys, { placeHolder: vscode.l10n.t('Select the language you want translate from') });
    const langTo = await vscode.window.showQuickPick(langKeys, { placeHolder: vscode.l10n.t('Select the language you want to translate to') });

    if (!langFrom || !langTo) {
        return;
    }

    let files = enumFiles(path, 'lang', true);

    for (const f of files) {
        const filecontent = readYaml(f);
        if (filecontent) {
            for (const key in filecontent) {
                if (filecontent[key][langFrom] === undefined) {
                    __log.appendLine('Language ' + langFrom + ' not found in file ' + f + ' for key ' + key);
                    continue;
                }

                if (filecontent[key][langTo] !== undefined) {
                    __log.appendLine('Language ' + langTo + ' already exists in file ' + f + ' for key ' + key);
                    continue;
                }

                const newText = await translateWithCopilot(langTo, filecontent[key][langFrom]);
                if (!newText) {
                    break;
                }
                filecontent[key][langTo] = newText

            }
        }
        saveYamlLangFile(f, filecontent)
    }
}

async function findFilesWithoutLanguage(context, e) {
    const path = getWorkspacePath();
    let languages = getLanguages();

    const langKeys = Object.keys(languages);
    const langFrom = await vscode.window.showQuickPick(langKeys, { placeHolder: vscode.l10n.t('Select the language you want to search') });

    if(!langFrom) {
        return;
    }

    let files = enumFiles(path, 'lang', true);

    for (const f of files) {
        const filecontent = readYaml(f);
        if (filecontent) {
            let found = false;
            for (const key in filecontent) {
                if (filecontent[key][langFrom] === undefined) {
                    found = true;
                    break;
                }
            }
            if (found) {
                const doc = await vscode.workspace.openTextDocument(f);
                await vscode.window.showTextDocument(doc, {
                    preview: false
                });

            }
        }
    }

}

function exportTextsAction(context, e) {

    const path = getWorkspacePath();
    let languages = getLanguages();

    let yaml = {};

    showStatusBarSpinner('Exporting translations, please wait...');

    const langKeys = Object.keys(languages);
    vscode.window.showQuickPick(langKeys, {
        placeHolder: vscode.l10n.t('Select the language you want to export'),
    }).then(function (langFrom) {

        vscode.window.showQuickPick(langKeys, {
            placeHolder: vscode.l10n.t('Select the languages you want to add'),
            ignoreFocusOut: true, canPickMany: true,
        }).then(function (langTo) {

            let modules = {};
            if (fs.existsSync(path + '/yaml/lang-config.yaml')) {
                modules = readYaml(path + '/yaml/lang-config.yaml');
            } else {
                modules = getPHPModules(true);
            }

            vscode.window.showQuickPick(Object.keys(modules), {
                ignoreFocusOut: true, canPickMany: true,
                placeHolder: vscode.l10n.t('Select the modules you want to export'),
            }).then((selectedModules) => {

                for (const m of selectedModules) {

                    let modulePath = modules[m];
                    modulePath = modulePath.slice(-1) === '/' ? modulePath.slice(0, -1) : modulePath;
                    modulePath = modulePath.slice(0, 2) === './' ? path + modulePath.slice(1) : modulePath;

                    let files = enumFiles(modulePath, 'lang', true);
                    const moduleRelativePath = replaceAll(modulePath, path, '');
                    yaml[moduleRelativePath] = {};
                    for (const f of files) {
                        const filecontent = readYaml(f);
                        if (filecontent) {
                            const extracted = {};
                            for (const key in filecontent) {
                                if (filecontent[key][langFrom]) {
                                    extracted[key] = {};
                                    extracted[key][langFrom] = filecontent[key][langFrom];
                                    for (const l of langTo) {
                                        extracted[key][l] = filecontent[key][l] ?? '';
                                    }
                                }
                            }
                            const relativePath = replaceAll(f, path + moduleRelativePath, '');
                            yaml[moduleRelativePath][relativePath] = extracted;
                        }
                    }
                }

                vscode.workspace.openTextDocument({
                    language: 'yaml',
                    content: yamlO.stringify(yaml)
                });

                hideStatusBarSpinner();

            });



        });

    });

}


async function importTextsAction(context, e) {
    const path = getWorkspacePath();

    const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select a file',
        filters: {
            'Yaml files': ['lang', 'yaml', 'yml'],
        }
    });

    if (!files) {
        return;
    }

    const file = files[0];
    const yamlContent = loadYamlLangFile(file.fsPath);

    showStatusBarSpinner('Importing translations, please wait...');

    for (const modulePath in yamlContent) {

        const moduleCompletePath = path + modulePath;
        for (const filePath in yamlContent[modulePath]) {

            const fileCompletePath = moduleCompletePath + filePath;
            if (fs.existsSync(fileCompletePath)) {

                const yamlFileContent = loadYamlLangFile(fileCompletePath);

                for (const key in yamlContent[modulePath][filePath]) {

                    if (!yamlFileContent[key]) {
                        __log.appendLine('Key ' + key + ' not found in file ' + fileCompletePath + ', skipping...');
                    } else {
                        const langs = Object.keys(yamlContent[modulePath][filePath][key]);
                        const langFrom = langs[0];
                        for (let i = 1; i < langs.length; i++) {
                            const langTo = langs[i];
                            if (yamlFileContent[key][langFrom] === yamlContent[modulePath][filePath][key][langFrom]) {
                                yamlFileContent[key][langTo] = yamlContent[modulePath][filePath][key][langTo];
                            } else {
                                __log.appendLine('Key ' + key + ' in language ' + langFrom + ' in file ' + fileCompletePath + ' does not match with the imported file, skipping...');
                            }
                        }
                    }

                }

                saveYamlLangFile(fileCompletePath, yamlFileContent);


            } else {
                __log.appendLine('File ' + fileCompletePath + ' does not exist, skipping...');
                continue;
            }

        }

    }

    hideStatusBarSpinner();


}


module.exports = {
    exportTextsAction,
    importTextsAction,
    findFilesWithoutLanguage,
    translateAllTextsFromOneLangToAnother,
    translateAllWithCopilot,
    translateText,
    translateCurrentFileFromOneLangToAnother
};