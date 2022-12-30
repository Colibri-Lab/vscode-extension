const vscode = require('vscode');
const fs = require('fs');
const yaml = require('yaml');

const __langFilter = ['html', 'javascript', 'php'];
const __log = vscode.window.createOutputChannel("Colibri UI");
const __openedLangDocuments = new Map();
let __colibriUIComponents = new Map();
const __languageMarkerRegularExpression = new RegExp('#\{(.*?)\}', 'gmi');
const __componentRegularExpression = new RegExp('<[^>\/]+/?>', 'ig');
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

function getBundlePaths(workspacePath = null) {
	try {

		workspacePath = workspacePath ? workspacePath : getWorkspacePath();
		// ищем папки .Bundle 
		let items = [];

		const linkStat = fs.statSync(workspacePath);
		if(linkStat.isSymbolicLink()) {
			workspacePath = fs.readlinkSync(workspacePath);
			items = [...items, ...getBundlePaths(workspacePath)];		
		}
		else if(linkStat.isFile()) {
			return [];
		}

		const content = fs.readdirSync(workspacePath, {encoding: 'utf-8', withFileTypes: true});
		for(const item of content) {
			if(item.name === '.git' || item.isFile()) {
				continue;
			}
			
			if(item.isDirectory() || item.isSymbolicLink()) {
				if(item.name === '.Bundle') {
					return [workspacePath + '/' + item.name];
				}
				else {
					items = [	...items, ...getBundlePaths(workspacePath + '/' + item.name)];
				}
			}
		}
		return items;
	}
	catch(e) {
		__log.appendLine(e.toString());
		return [];		
	}
}

function extractNames(componentName, currentComponentName) {
	let currentComponentNameParts = currentComponentName.split('.');
	while(currentComponentNameParts.length > 0) {
		componentName = replaceAll(componentName, currentComponentNameParts.join('.') + '.', '');
		currentComponentNameParts.pop();
	}
	return componentName;
}

function getComponentName(document) {
	let currentComponentName = '';
	const path = typeof document === 'string' ? document : document.uri.fsPath;
	const content = fs.readFileSync(path).toString().split('\n');
	for(const line of content) {
		const matches = new RegExp('componentname="([^"]+)"', 'i').exec(line);
		if(matches.length > 0) {
			currentComponentName = replaceAll(replaceAll(matches[1], 'Colibri.UI.', ''), 'App.Modules.', '');
			break;
		}
	}
	return currentComponentName;
}

function getComponentAttributes(document, classesAndFiles) {
	const path = typeof document === 'string' ? document : document.uri.fsPath;
	const fullContent = fs.readFileSync(path).toString();
	const content = fullContent.split('\n');
	const classRex = new RegExp('([\\w\\.]+)\\s+?=\\s+?class extends\\s+?([\\w\\.]+)\\s+?{?', 'gim');

	let attrs = new Map();
	let classMatch;
	let className;
	let parentClassName;
	while( (classMatch = classRex.exec(fullContent)) ) {

		className = classMatch[1]
		parentClassName = classMatch[2];

		let foundParentClass = classesAndFiles.get(parentClassName)
		if(!foundParentClass) {
			classesAndFiles.forEach((value, key) => {
				if(value.fullName === parentClassName) {
					foundParentClass = value;
				}
			});
		}

		if(foundParentClass) {
			attrs = new Map([...attrs, ...getComponentAttributes(foundParentClass.file, classesAndFiles)]);
		}

	}

	for(const line of content) {
		const matches = new RegExp('set ([^\(]+)[\s+]?\\(.*\\)\\s+?{?', 'i').exec(line);
		if(matches && matches.length > 0) {
			attrs.set(matches[1], {
				file: path,
				fullName: className
			});
		}
	}
	return attrs;
	
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

function getWorkspacePath() {

	for(const folder of vscode.workspace.workspaceFolders) {
        if(!checkForColibriProject(folder.uri.fsPath)) {
            return folder.uri.fsPath;
        }
    }   
    return true;

}

function getColibriUIFolder(workspacePath = null) {
	workspacePath = workspacePath ? workspacePath : getWorkspacePath();
	return workspacePath + '/vendor/colibri/ui/src/06.UI/';
}

function enumerateColibriUIComponents(path = null) {

	__log.appendLine('Collecting components in ' + path);

	path = path ? path : getColibriUIFolder(path);

	let items = new Map();
	const files = fs.readdirSync(path, {encoding: 'utf-8', withFileTypes: true});
	for(const file of files) {
		if(file.isFile()) {
			if(file.name.indexOf('.js') === -1) {
				continue;
			}

			const content = fs.readFileSync(path + '/' + file.name).toString().split('\n');
			for(const s of content) {
				if(s.indexOf('= class extends') !== -1) {
					let className = s.split('= class extends')[0].trim();
					items.set(className, path + '/' + file.name);
				}
			}

		}
		else if(file.isDirectory()) {
			items = new Map([...items, ...enumerateColibriUIComponents(path + '/' + file.name)]);
		}
	}
	
	return items;
}

function getComponentNames(currentComponentName) {
	const classesAndFiles = new Map();
	const uiItems = enumerateColibriUIComponents();
	uiItems.forEach((value, key) => {
		const componentName = replaceAll(key, 'Colibri.UI.', '');
		classesAndFiles.set(componentName, {
			file: value,
			fullName: key
		});
	});

	const bundleItems = getBundlePaths();
	for(const item of bundleItems) {
		const itemClasses = enumerateColibriUIComponents(item);
		itemClasses.forEach((value, key) => {
			let componentName = replaceAll(replaceAll(key, 'Colibri.UI.', ''), 'App.Modules.', '');
			componentName = extractNames(componentName, currentComponentName);
			classesAndFiles.set(componentName, {
				file: value,
				fullName: key
			});
		});
	}
	return classesAndFiles;
}

module.exports = {
	__langFilter,
    __languageMarkerRegularExpression,
	__componentRegularExpression,
    __openedLangDocuments,
    __langTextDecorationType,
	__log,
	__colibriUIComponents,
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
	enumerateColibriUIComponents,
	getBundlePaths,
	getComponentName,
	extractNames,
	getComponentAttributes,
	getComponentNames,
};