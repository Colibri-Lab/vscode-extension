const vscode = require('vscode');
const fs = require('fs');
const yaml = require('yaml');

const __langFilter = ['html', 'javascript', 'php'];
const __log = vscode.window.createOutputChannel("Colibri UI");
const __openedLangDocuments = new Map();
const __languageMarkerRegularExpression = new RegExp('#\{(.*?)\}', 'gmi');
const __langTextDecorationType = vscode.window.createTextEditorDecorationType({
	borderWidth: '1px',
	borderStyle: 'solid',
	borderSpacing: '2px',
	borderRadius: '3px',
	overviewRulerColor: '#302f00',
	overviewRulerLane: vscode.OverviewRulerLane.Right,
	light: {
		borderColor: '#555555'
	},
	dark: {
		borderColor: '#aaaaaa'
	}
});

function cleanVariables() {
    // __openedLangDocuments.clear();
} 

const replaceAll = function(string, from, to) {
    let s = string;
    let s1 = s.replace(from, to);
    while (s != s1) {
        s = s1;
        s1 = s.replace(from, to);
    }
    return s1;
}

const expand = function(string, c, l) {
    if (string.length >= l) {
        return string;
    } else {
        return c.repeat(l - string.length) + string;
    }
}

function findModulePath(path) {
	if(!path) {
		return null;
	}

	const parts = path.split('/');
	while(true) {
		parts.pop();
		if(parts.length === 0) {
			break;
		}
		if(
			fs.existsSync(parts.join('/') + '/Module.php') ||
			fs.existsSync(parts.join('/') + '/src/01.App.js')
		) {
			return parts.join('/');
		}
	}
	return null;
}

function findModuleLangFile(path) {
	const modulePath = findModulePath(path);
	if (!modulePath) {
		return null;
	}

	const confPath = modulePath + '/config-template/';
	const files = fs.readdirSync(confPath, {encoding:'utf8', withFileTypes: true});
	for(const file of files) {
		if(file.name.indexOf('-langtexts') !== -1 || file.name.indexOf('-texts') !== -1) {
			return confPath + file.name; 
		}
	}
	return null;
}

/**
 * 
 * @param {vscode.TextDocument|string} document 
 */
function getLangFilePath(document) {
	let fsPath = typeof document === 'string' ? document : document.uri.fsPath;
	let fsParts = fsPath.split('/');
	let fileName = fsParts.pop();
	if(fileName.indexOf('.php') !== -1) {
		return findModuleLangFile(fsPath);
	}
	else {
		fileName = replaceAll(fileName, '.html', '');
		fileName = replaceAll(fileName, '.js', '');
		fileName += '.lang';
		return fsParts.join('/') + '/' + fileName;	
	}
}

/**
 * 
 * @param {vscode.TextDocument} document 
 */
function getModuleName(document) {
	let modulePath = findModulePath(typeof document === 'string' ? document : document.uri.fsPath);
	if(!modulePath) {
		return null;
	}
	return modulePath.split('/').pop();
}

/**
 * @param {vscode.TextDocument|string} document 
 */
function loadYamlLangFile(document) {
	
	let langFile = typeof document === 'string' ? document : getLangFilePath(document);
	if (!langFile) {
		return null;
	}

	// if(__openedLangDocuments.has(langFile)) {
	// 	return __openedLangDocuments.get(langFile);
	// }

	let yamlContent = '';
	if(fs.existsSync(langFile)) {
		yamlContent = fs.readFileSync(langFile, {encoding:'utf8', flag:'r'});
	}
	
	let langsFileContent = yaml.parse(yamlContent);
	if(langsFileContent === null) {
		langsFileContent = {};
	}
	// __openedLangDocuments.set(langFile, langsFileContent);
	return langsFileContent;
}

/**
 * @param {vscode.TextDocument|string} document 
 * @param {Object} yamlObject 
 */
function saveYamlLangFile(document, yamlObject) {
	let langFile = typeof document === 'string' ? document : getLangFilePath(document);
	// __openedLangDocuments.set(langFile, yamlObject);
	if(Object.keys(yamlObject).length > 0) {
		let yamlContent = yaml.stringify(yamlObject);
		fs.writeFileSync(langFile, yamlContent, {encoding:'utf8', flag:'w+'});
		return true;
	}
	return false;
}

function getLanguages() {
    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/';
    const langModulePath = projectPath + 'vendor/colibri/lang/src/Lang/config-template/lang-langs.yaml';
    const langConfigContent = fs.readFileSync(langModulePath, {encoding:'utf8', flag:'r'});
    return yaml.parse(langConfigContent);
}

/**
 * 
 * @param {vscode.TextDocument|string} document 
 */
function checkForColibriProject(document) {

	const path = typeof document === 'string' ? document : document.uri.fsPath;
	__log.appendLine('Checking for document directory: ' + path);

	let projectPath = path + '/';    
    if(path && path.indexOf('/vendor/') !== -1) {
        projectPath = path.split('/vendor/')[0] + '/';
    } else if(path && path.indexOf('/App/') !== -1) {
        projectPath = path.split('/App/')[0] + '/';
	} else {
		__log.appendLine('Check complete: error');
		return false;
	}

	const isColibri = !!(fs.existsSync(projectPath + 'App') && 
		fs.existsSync(projectPath + 'config') && 
		fs.existsSync(projectPath + 'bin') && 
		fs.existsSync(projectPath + 'config/app.yaml') && 
		fs.existsSync(projectPath + 'vendor/colibri/ui') && 
		fs.existsSync(projectPath + 'vendor/colibri/core') && 
		fs.existsSync(projectPath + 'vendor/colibri/lang'));

	__log.appendLine('Check complete: ' + (isColibri ? 'ok' : 'error'));

	return isColibri;

}

/**
 * 
 */
function checkWorkspace() {
    for(const folder of vscode.workspace.workspaceFolders) {
		__log.appendLine('Checking for project directory: ' + folder.uri.fsPath);
        if(!checkForColibriProject(folder.uri.fsPath)) {
			__log.appendLine('Not a Colibri Project');
            return false;
        }
    }   
	__log.appendLine('Check complete');
    return true;
}

function checkIfEditorIsClosed() {
	return;
	// const keys = [];
	// vscode.window.tabGroups.all.flatMap(({ tabs }) => tabs.map(tab => {
	// 	keys.push(getLangFilePath(tab.input.uri.fsPath));
	// }));

	// __openedLangDocuments.forEach((value, key) => {
	// 	if(keys.indexOf(key) === -1) {
	// 		__openedLangDocuments.delete(key);
	// 	}
	// });
}

module.exports = {
	__langFilter,
    __languageMarkerRegularExpression,
    __openedLangDocuments,
    __langTextDecorationType,
	__log,
    replaceAll,
    expand,
    saveYamlLangFile,
    loadYamlLangFile,
    getModuleName,
    getLangFilePath,
    cleanVariables,
    checkForColibriProject,
    checkWorkspace,
    getLanguages,
	checkIfEditorIsClosed,

};