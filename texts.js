const vscode = require('vscode');
const { getWorkspacePath, getLanguages, enumFiles, getPHPModules, readYaml, getPhpModulesByVendor, replaceAll } = require("./utils");
const yamlO = require('yaml');

function exportTextsAction(context, e) {
    
    const path = getWorkspacePath();
    let languages = getLanguages();

    let yaml = {};

	const langKeys = Object.keys(languages);
    vscode.window.showQuickPick(langKeys, {
        placeHolder: vscode.l10n.t('Select the language you want to export'),
    }).then(function(langFrom) {

        vscode.window.showInputBox({
            title: vscode.l10n.t('Insert the language key you want to add'),
        }).then(langTo => {

            let modules = getPHPModules();
            vscode.window.showQuickPick(Object.keys(modules), {
                ignoreFocusOut: true, canPickMany: true,
                placeHolder: vscode.l10n.t('Select the modules you want to export'),
            }).then((selectedModules) => {

                for(const m of selectedModules) {
                    
                    let modulePath = modules[m];
                    modulePath = modulePath.slice(0, 2) === './' ? path + modulePath.slice(1) : modulePath;

                    let files = enumFiles(modulePath, 'lang', true);
                    const moduleRelativePath = replaceAll(modulePath, path, '');
                    yaml[moduleRelativePath] = {};
                    for(const f of files) {
                        const filecontent = readYaml(f);
                        if (filecontent) {
                            const extracted = {};
                            for(const key in filecontent) {
                                extracted[key] = {};
                                extracted[key][langFrom] = filecontent[key][langFrom];
                                extracted[key][langTo] = filecontent[key][langTo] ?? '';
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

            });

            

        });

    });
    
}


function importTextsAction(context, e) {

    

}


module.exports = {
    exportTextsAction,
    importTextsAction
};