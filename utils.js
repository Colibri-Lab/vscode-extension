const vscode = require('vscode');
const fs = require('fs');
const yaml = require('yaml');

const __langFilter = ['html', 'javascript', 'php', 'scss'];
const __log = vscode.window.createOutputChannel("Colibri UI");
const __openedLangDocuments = new Map();
const __colibriUIComponents = new Map();


const __languageMarkerRegularExpression = /#{(.*?)}/gmi;
const __componentRegularExpression = /<[^>]+\/?>/gmi;
const __completionItemsRegexp = /<([A-z0-9.]+)/i;
const __componentNameRegExp = /componentname="([^"]+)"/i;
const __attributesRegExp = /([\w\.]+)\s+?=\s+?class extends\s+?([\w\.]+)\s*{?/gim;
const __setAttributeRegExp = /set ([^(]+)[s+]?\(.*\)\s*[^;][{\r]?/i;
const __getAttributeRegExp = /get ([^(]+)[s+]?\(.*\)\s*[^;][{\r]?/i;
const __constructorRegExp = /^\s\s\s\sconstructor[s+]?\(.*\)\s*[^;][{\r]?/i;
const __eventHandlersRegExp = /^\s\s\s\s__([^\s(]+)[s+]?\(.*\)\s*[^;][{\r]?/i;
const __privateMethodsRegExp = /^\s\s\s\s_([^\s(]+)[s+]?\(.*\)\s*[^;][{\r]?/i;
const __publicMethodsRegExp = /^\s\s\s\s([^\s(]+)[s+]?\(.*\)\s*[^;][{\r]?/i;
const __staticMethodsRegExp = /^\s\s\s\sstatic\s([^\s(]+)[s+]?\(.*\)\s*[^;][{\r]?/i;
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


function findJsDoc(lines, line) {
	if(lines[line - 1].indexOf('*/') === -1) {
		return '';
	}
	line--;

	let ret = [];
	while(lines[line].indexOf('/**') === -1) {
		ret.push(replaceAll(replaceAll(lines[line].trim(), '* ', ''), '*/', ''));
		line--;
	}

	return ret.reverse().join('\n');

}


function findPhpDoc(lines, line) {
	if(lines[line - 1].indexOf('*/') === -1) {
		return '';
	}
	line--;

	let ret = [];
	while(lines[line].indexOf('/**') === -1) {
		ret.push(replaceAll(replaceAll(lines[line].trim(), '* ', ''), '*/', ''));
		line--;
	}

	return ret.reverse().join('\n');

}

function cleanVariables() {
    // __openedLangDocuments.clear();
} 

const replaceAll = function(string, from, to) {
	if(!string) {
		return '';
	}
	
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

/**
 * Получает список языков
 * @returns object
 */
function getLanguages() {
	const workbenchConfig = vscode.workspace.getConfiguration();
	let languageModulePath = workbenchConfig.get('colibrilab.langs-config-path');
	if(!languageModulePath) {
		languageModulePath = 'vendor/colibri/lang/src/Lang/config-template/lang-langs.yaml';
	}

    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/';
    const langModulePath = projectPath + languageModulePath;
    const langConfigContent = fs.readFileSync(langModulePath, {encoding:'utf8', flag:'r'});
    return yaml.parse(langConfigContent);
}

/**
 * Воврашает список путей содержащих .Bundle
 * @param {string} workspacePath 
 * @returns 
 */
function getBundlePaths(workspacePath = null, returnRealPath = false) {
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
					let p = replaceAll(workspacePath + '/' + item.name, '//', '/');
					if(returnRealPath) {
						p = fs.realpathSync(p);
					}
					return [p];
				}
				else {
					// if(item.isSymbolicLink()) {
					// 	items = [	...items, ...getBundlePaths(fs.readlinkSync(workspacePath + '/' + item.name), returnRealPath)];
					// }
					// else {
						items = [	...items, ...getBundlePaths(workspacePath + '/' + item.name, returnRealPath)];
					//}
				}
			}
		}
		return items;
	}
	catch(e) {
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

/**
 * 
 * @param {vscode.TextDocument|string} document 
 * @returns 
 */
function getComponentName(document) {
	let currentComponentName = '';
	const path = typeof document === 'string' ? document : document.uri.fsPath;
	const content = fs.readFileSync(path).toString().split('\n');
	for(const line of content) {
		const matches = __componentNameRegExp.exec(line);
		if(matches.length > 0) {
			currentComponentName = replaceAll(replaceAll(matches[1], 'Colibri.UI.', ''), 'App.Modules.', '');
			break;
		}
	}
	return currentComponentName;
}

/**
 * 
 * @param {vscode.TextDocument|string} document 
 * @returns 
 */
function getNamespaceName(document) {
	const path = typeof document === 'string' ? document : document.uri.fsPath;
	const parts = path.split('/');
	parts.pop();
	const choosedPath = parts.join('/');
	let currentNamespace = fs.readFileSync(choosedPath + '/.js', {encoding:'utf8', flag:'r'});
	return currentNamespace.split(' = class ')[0];
}

function getComponentAttributes(document, classesAndFiles) {
	const path = typeof document === 'string' ? document : document.uri.fsPath;
	const fullContent = fs.readFileSync(path).toString();
	const content = fullContent.split('\n');

	let attrs = new Map();
	let className;
	let parentClassName;
	const classMatches = fullContent.matchAll(__attributesRegExp);
	for(const classMatch of classMatches) {
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
	
	let index = 0;
	for(const line of content) {
		const matches = __setAttributeRegExp.exec(line);
		if(matches && matches.length > 0) {
			let desc = findJsDoc(content, index);
			attrs.set(matches[1], {
				file: path,
				fullName: className,
				desc: desc
			});
		}
		index++;
	}
	return attrs;
	
}

/**
 * 
 * @param {vscode.TextDocument|string} document 
 */
function checkForColibriProject(document) {

	const path = typeof document === 'string' ? document : document.uri.fsPath;

	let projectPath = path + '/';    
    if(path && path.indexOf('/vendor/') !== -1) {
        projectPath = path.split('/vendor/')[0] + '/';
    } else if(path && path.indexOf('/App/') !== -1) {
        projectPath = path.split('/App/')[0] + '/';
	} else if(path && path.indexOf('/app/') !== -1) { // laravel
        projectPath = path.split('/app/')[0] + '/';
	}

	return !!((fs.existsSync(projectPath + 'App') || fs.existsSync(projectPath + 'app')) && 
		fs.existsSync(projectPath + 'config') && 
		fs.existsSync(projectPath + 'bin') && 
		(fs.existsSync(projectPath + 'config/app.yaml') || fs.existsSync(projectPath + 'config/app.php')) && 
		fs.existsSync(projectPath + 'vendor/colibri/ui'));
	
	//  &&  fs.existsSync(projectPath + 'vendor/colibri/core')
	//  &&  fs.existsSync(projectPath + 'vendor/colibri/lang'))

}

function hasLanguageModule() {

	for(const folder of vscode.workspace.workspaceFolders) {
		
		const path = folder.uri.fsPath;

		let projectPath = path + '/'; 
		if(path && path.indexOf('/vendor/') !== -1) {
			projectPath = path.split('/vendor/')[0] + '/';
		} else if(path && path.indexOf('/App/') !== -1) {
			projectPath = path.split('/App/')[0] + '/';
		}

		return fs.existsSync(projectPath + 'vendor/colibri/lang');

	} 

	return false;
}

/**
 * 
 */
function checkWorkspace() {
	try {
		for(const folder of vscode.workspace.workspaceFolders) {
			if(!checkForColibriProject(folder.uri.fsPath)) {
				return false;
			}
		}   
		return true;	
	}
	catch(e) {
		return false;
	}
}


/**
 * Возвращает путь проекта
 * @returns {string|null}
 */
function getWorkspacePath() {

	for(const folder of vscode.workspace.workspaceFolders) {
        if(checkForColibriProject(folder.uri.fsPath)) {
            return folder.uri.fsPath;
        }
    }   
    return null;

}

/**
 * Возвращает путь к основному списку компонентов
 * @param {string|null} workspacePath 
 * @returns {string}
 */
function getColibriUIFolder(workspacePath = null, returnRealPath = false) {
	workspacePath = workspacePath ? workspacePath : getWorkspacePath();
	return !returnRealPath ? workspacePath + '/vendor/colibri/ui/src/06.UI' : fs.realpathSync(workspacePath + '/vendor/colibri/ui/src/06.UI');
}

function enumerateColibriUIComponents(path = null) {
	path = path ? path : getColibriUIFolder(path);
	let items = new Map();
	const files = fs.readdirSync(path, {encoding: 'utf-8', withFileTypes: true});
	for(const file of files) {
		if(file.isFile()) {
			if(file.name.indexOf('.js') === -1) {
				continue;
			}

			const content = fs.readFileSync(path + '/' + file.name).toString().split('\n');
			let line = 0;
			for(const s of content) {
				if(s.indexOf('= class extends') !== -1) {
					let className = s.split('= class extends')[0].trim();
					items.set(className, {path: path + '/' + file.name, line: line});
				} else if(s.indexOf('= class {') !== -1) {
					let className = s.split('= class {')[0].trim();
					items.set(className, {path: path + '/' + file.name, line: line});
				}
				line++;
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
	for(const [key, value] of __colibriUIComponents) {
		const componentName = extractNames(key, currentComponentName);
		if(classesAndFiles.get(componentName)) {
			classesAndFiles.set(key, value);
		}
		else {
			classesAndFiles.set(componentName, value);
		}
	}
	return classesAndFiles;
}

function filterCompomentNames(possibleNames) {
	for(const [key, value] of __colibriUIComponents) {
		if( possibleNames.indexOf(key) !== -1) {
			return value;
		}
	}
	return null;
}

function reloadCompletionItems() {

	__colibriUIComponents.clear();
	

	const uiItems = enumerateColibriUIComponents();
	uiItems.forEach((value, key) => {
		const componentName = replaceAll(key, 'Colibri.UI.', '');
		const f = {
			file: value.path,
			line: value.line,
			fullName: key
		};
		if(fs.existsSync(replaceAll(value.path, '.js', '.html'))) {
			f.html = replaceAll(value.path, '.js', '.html');
		}
		__colibriUIComponents.set(componentName, f);
	});

	const bundleItems = getBundlePaths();
	for(const item of bundleItems) {
		const itemClasses = enumerateColibriUIComponents(item);
		itemClasses.forEach((value, key) => {
			let componentName = replaceAll(replaceAll(key, 'Colibri.UI.', ''), 'App.Modules.', '');
			
			const f = {
				file: value.path,
				line: value.line,
				fullName: key
			};
			if(fs.existsSync(replaceAll(value.path, '.js', '.html'))) {
				f.html = replaceAll(value.path, '.js', '.html');
			}
			__colibriUIComponents.set(componentName, f);
		});
	}
}

function readYaml(path) {
	const content = fs.readFileSync(path).toString();
    return yaml.parse(content);
}
function readJson(path) {
	const content = fs.readFileSync(path).toString();
    return JSON.parse(content);
}

function searchForCommentBlock(lines, line) {
	while(line > 0 && lines[line].indexOf('*/') === -1) line--;

	const commentblock = [];
	while(line > 0 && lines[line].indexOf('/**') === -1) {
		if(lines[line] !== '*/' && lines[line] !== '/**' && lines[line] !== '') {
			commentblock.push(lines[line].substring(3));
		}
		line--;
	}
	return commentblock;
}

function openFile(path, selectLine = null) {

	vscode.workspace.openTextDocument(vscode.Uri.file(path)).then((a) => {
		vscode.window.showTextDocument(a, 1, true).then(e => {
			if(selectLine !== null) {
				let range = e.document.lineAt(selectLine).range;			
				e.selection = new vscode.Selection(range.start, range.end);
				e.revealRange(range);
			}
		});
		
	}, (error) => {
		console.error(error);
	});
}

function getPHPModules() {
	const ret = {};
	const path = getWorkspacePath();
	let composerContent = JSON.parse(fs.readFileSync(path + '/composer.json').toString());
	if(composerContent.require) {
		const modules = Object.keys(composerContent.require);
		for(const moduleName of modules) {
			if(!fs.existsSync(path + '/vendor/' + moduleName + '/composer.json')) {
				continue;
			}

			const composer = readJson(path + '/vendor/' + moduleName + '/composer.json');
			if(composer && !!composer.require['colibri/core'] && fs.existsSync(path + '/vendor/' + moduleName + '/deploy.yml')) {
				// это вериятно модуль
				let modulePath = '';
				let moduleRealName = '';
				const psr4 = composer.autoload['psr-4'];
				const psr4keys = Object.keys(psr4);
				for(const psr4key of psr4keys) {
					if(psr4key.indexOf('App\\Modules\\') === 0) {
						modulePath = psr4[psr4key];
						moduleRealName = replaceAll(psr4key.split('App\\Modules\\')[1], '\\', '');
						break;
					}
				}
				if(moduleName && modulePath) {
					// это точно модуль
					ret[moduleRealName] = path + '/vendor/' + moduleName + '/' + modulePath;
				}
			}
		}
	}
	return ret;
}

function getPhpModulesByVendor() {
	const ret = {};
	const path = getWorkspacePath();
	let composerContent = JSON.parse(fs.readFileSync(path + '/composer.json').toString());
	if(composerContent.require) {
		const modules = Object.keys(composerContent.require);
		for(const moduleName of modules) {
			if(!fs.existsSync(path + '/vendor/' + moduleName + '/composer.json')) {
				continue;
			}

			const composer = readJson(path + '/vendor/' + moduleName + '/composer.json');
			if(composer && !!composer.require['colibri/core'] && fs.existsSync(path + '/vendor/' + moduleName + '/deploy.yml')) {
				// это вериятно модуль
				let modulePath = '';
				let moduleRealName = '';
				const psr4 = composer.autoload['psr-4'];
				const psr4keys = Object.keys(psr4);
				for(const psr4key of psr4keys) {
					if(psr4key.indexOf('App\\Modules\\') === 0) {
						modulePath = psr4[psr4key];
						moduleRealName = replaceAll(psr4key.split('App\\Modules\\')[1], '\\', '');
						break;
					}
				}
				if(moduleName && modulePath) {
					// это точно модуль
					ret[moduleName] = moduleRealName;
				}
			}
		}
	}
	return ret;
}

module.exports = {
	__langFilter,
    __languageMarkerRegularExpression,
	__componentRegularExpression,
    __openedLangDocuments,
    __langTextDecorationType,
	__completionItemsRegexp,
	__log,
	__colibriUIComponents,
	__attributesRegExp,
	__setAttributeRegExp,
	__getAttributeRegExp,
	__constructorRegExp,
	__eventHandlersRegExp,
	__privateMethodsRegExp,
	__publicMethodsRegExp,
	__staticMethodsRegExp,
	getPHPModules,
	readYaml,
	readJson,
	reloadCompletionItems,
	hasLanguageModule,
    replaceAll,
    expand,
    saveYamlLangFile,
    loadYamlLangFile,
    getModuleName,
	getPhpModulesByVendor,
    getLangFilePath,
    cleanVariables,
    checkForColibriProject,
    checkWorkspace,
    getLanguages,
	enumerateColibriUIComponents,
	getBundlePaths,
	getComponentName,
	getNamespaceName,
	extractNames,
	getComponentAttributes,
	getComponentNames,
	getColibriUIFolder,
	getWorkspacePath,
	filterCompomentNames,
	searchForCommentBlock,
	openFile,
	findJsDoc,
	findPhpDoc
};