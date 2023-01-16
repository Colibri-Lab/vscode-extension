const vscode = require('vscode');
const fs = require('fs');
const { replaceAll, getBundlePaths, enumerateColibriUIComponents, __getAttributeRegExp, __setAttributeRegExp, __constructorRegExp, __eventHandlersRegExp, __privateMethodsRegExp, __publicMethodsRegExp, __attributesRegExp, getWorkspacePath, readJson, getPHPModules } = require('./utils');
const glob = require('glob');
const { readPhp, findStorageModels } = require('./php-tools');


let __treeDataProvider = null;
let __phpTreeDataProvider = null;
let __treeView = null;
let __phpTreeView = null;

class ColibriUIComponentsTreeProvider {

    /**
     * 
     * @param  {vscode.ExtensionContext} context 
     */
    constructor(context) {
		this._path = vscode.extensions.getExtension(context.extension.id).extensionUri.path;

        this._onDidChangeTreeData = new vscode.EventEmitter(); 
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    
        this._core = null;
        this._roots = new Map();
        this._paths = new Map();
        this._loadComponents();

    }

    /**
     * 
     * @returns {vscode.TreeItem}
     */
    core() {
        return this._core;
    }

    /**
     * @param {string} name 
     * @returns {vscode.TreeItem}
     */
    module(name) {
        return this._roots.get(name);
    }

    find(path) {
        for(let [key, value] of this._components) {
            if(value.file === path) {
                return [key, value];
            }
        }
        return [null, null];
    }

    findComponent(key) {
        return this._paths.get(key);
    }

    refresh() {
        this._core = null;
        this._roots = new Map();
        this._paths = new Map();
        this._loadComponents();
        this._onDidChangeTreeData.fire();
    }

    _loadComponents() {
        if(this._components) {
            this._components.clear();
        }
        else {
            this._components = new Map();
        }

        const setContent = (key, value) => {
            const f = {
                file: value.path,
                line: value.line,
                fullName: key
            };
            if(fs.existsSync(replaceAll(value.path, '.js', '.html'))) {
                f.html = replaceAll(value.path, '.js', '.html');
            }
            if(fs.existsSync(replaceAll(value.path, '.js', '.scss'))) {
                f.styles = replaceAll(value.path, '.js', '.scss');
            }

            const content = fs.readFileSync(f.file).toString();
            const lines = content.split('\n');
            f.content = {
                template: f.html ? {
                    name: 'template',
                    line: 0,
                    path: f.html
                } : null,
                styles: f.styles ? {
                    name: 'styles',
                    line: 0,
                    path: f.styles
                } : null,
                constructor: null,
                attributes_get: [],
                attributes_set: [],
                eventHandlers: [],
                privateMethods: [],
                publicMethods: []
            };
            
            for(let index=f.line + 1; index<lines.length; index++) {
                let match;
                let line = lines[index];
                if(line.match(__attributesRegExp)) {
                    break;
                }

                if(match = line.match(__getAttributeRegExp)) {
                    f.content.attributes_get.push({
                        name: match[1],
                        line: index
                    });
                } else if(match = line.match(__setAttributeRegExp)) {
                    f.content.attributes_set.push({
                        name: match[1],
                        line: index
                    });
                } else if(match = line.match(__constructorRegExp)) {
                    f.content.constructor = {
                        name: 'constructor',
                        line: index
                    };
                } else if(match = line.match(__eventHandlersRegExp)) {
                    f.content.eventHandlers.push({
                        name: match[1],
                        line: index
                    });
                } else if(match = line.match(__privateMethodsRegExp)) {
                    f.content.privateMethods.push({
                        name: match[1],
                        line: index
                    });
                } else if(match = line.match(__publicMethodsRegExp)) {
                    f.content.publicMethods.push({
                        name: match[1],
                        line: index
                    });
                }

            }
            return f;
        }

        const uiItems = enumerateColibriUIComponents();
        uiItems.forEach((value, key) => {
            this._components.set(key, setContent(key, value));
        });
    
        const bundleItems = getBundlePaths();
        for(const item of bundleItems) {
            const itemClasses = enumerateColibriUIComponents(item);
            itemClasses.forEach((value, key) => {
                this._components.set(key, setContent(key, value));
            });
        }

    }

    getParent(element) {
        if(element.data && element.data.parent) {
            return element.data.parent;
        }
        return null;
    }

    getTreeItem(element) {
        return element;
    }

    /**
     * 
     * @param {Data} element 
     * @returns 
     */
    getChildren(element) {
        const iconprefix = vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Dark ? '-dark' : '-light';

        // отдельно ядро, отдельно каждый модуль, фильтруем 
        if(!element) {

            let children = [];
            const item1 = new Data('Colibri.UI', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Colibri.UI', type: 'folder', parent: null});
            item1.tooltip = 'Colbri.UI - Core componentns';
            item1.iconPath = this._path + '/images/module' + iconprefix + '.svg';
            this._core = item1;
            children.push(item1);    

            const modules = [];
            for(const [key, obj] of this._components) {

                if(key.indexOf('Colibri.UI') !== -1) {
                    continue;
                }

                const name = replaceAll(key, 'App.Modules.', '');
                const moduleName = name.split('.').splice(0, 1).pop();
                if(!moduleName) {
                    continue;
                }
                if(modules.indexOf(moduleName) !== -1) {
                    continue;
                }

                modules.push(moduleName);
                
                const item2 = new Data(replaceAll(moduleName, 'App.Modules.', ''), vscode.TreeItemCollapsibleState.Collapsed, {name: key, type: 'folder', parent: null});
                item2.iconPath = this._path + '/images/module' + iconprefix + '.svg';
                item2.tooltip = moduleName + ' - Module';
                this._roots.set(moduleName, item2);
                children.push(item2);    
                
            }            
            return children;
            
        } else if(element.data.type === 'folder') {
            
            const children = [];
            for(const [key, obj] of this._components) {
                
                if(key.indexOf(element.data.name) === -1) {
                    continue;
                }

                const item = new Data(replaceAll(replaceAll(key, 'Colibri.UI.', ''), 'App.Modules.', ''), vscode.TreeItemCollapsibleState.Collapsed, {type: 'class', object: obj, parent: element}, 'colibri-ui.open-component');
                item.iconPath = this._path + '/images/component' + iconprefix + '.svg';
                item.tooltip = key;
                this._paths.set(key, item);
                children.push(item);    
            }

            return children;
        } else if (element.data.type === 'class') {
            // это файл


            let children = [];
            if(element.data.object.content.template) {    
                const item2 = new Data('Template', vscode.TreeItemCollapsibleState.None, {name: 'template', type: 'item', object: element.data.object, content: element.data.object.content.template, parent: element}, 'colibri-ui.open-component');
                item2.iconPath = this._path + '/images/template' + iconprefix + '.svg';
                item2.tooltip = 'Component template';
                element.data.template = item2;
                children.push(item2);    
            }
            if(element.data.object.content.styles) {    
                const item2 = new Data('Styles', vscode.TreeItemCollapsibleState.None, {name: 'styles', type: 'item', object: element.data.object, content: element.data.object.content.styles, parent: element}, 'colibri-ui.open-component');
                item2.iconPath = this._path + '/images/styles' + iconprefix + '.svg';
                item2.tooltip = 'Component styles';
                element.data.styles = item2;
                children.push(item2);    
            }
            if(element.data.object.content.constructor) {    
                const item2 = new Data('constructor', vscode.TreeItemCollapsibleState.None, {name: 'constructor', type: 'item', object: element.data.object, content: element.data.object.content.constructor, parent: element}, 'colibri-ui.open-component');
                item2.iconPath = this._path + '/images/constructor' + iconprefix + '.svg';
                item2.tooltip = 'Constructor';
                children.push(item2);    
            }
            if(element.data.object.content.attributes_get.length > 0) {
                const content = element.data.object.content.attributes_get;
                for(const o of content) {
                    const item2 = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, parent: element}, 'colibri-ui.open-component');
                    item2.iconPath = this._path + '/images/attributes_get' + iconprefix + '.svg';
                    item2.tooltip = 'Attribute (get)';
                    children.push(item2);
                }
            }
            if(element.data.object.content.attributes_set.length > 0) {
                const content = element.data.object.content.attributes_set;
                for(const o of content) {
                    const item2 = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, parent: element}, 'colibri-ui.open-component');
                    item2.iconPath = this._path + '/images/attributes_set' + iconprefix + '.svg';
                    item2.tooltip = 'Attribute (set)';
                    children.push(item2);
                }
            }
            if(element.data.object.content.privateMethods.length > 0) {
                const content = element.data.object.content.privateMethods;
                for(const o of content) {
                    const item2 = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, parent: element}, 'colibri-ui.open-component');
                    item2.iconPath = this._path + '/images/privateMethods' + iconprefix + '.svg';
                    item2.tooltip = 'Method (private)';
                    children.push(item2);
                }
            }
            if(element.data.object.content.publicMethods.length > 0) {
                const content = element.data.object.content.publicMethods;
                for(const o of content) {
                    const item2 = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, parent: element}, 'colibri-ui.open-component');
                    item2.iconPath = this._path + '/images/publicMethods' + iconprefix + '.svg';
                    item2.tooltip = 'Method (public)';
                    children.push(item2);
                }
            }
            if(element.data.object.content.eventHandlers.length > 0) {
                const content = element.data.object.content.eventHandlers;
                for(const o of content) {
                    const item2 = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, parent: element}, 'colibri-ui.open-component');
                    item2.iconPath = this._path + '/images/eventHandlers' + iconprefix + '.svg';
                    item2.tooltip = 'Event handler';
                    children.push(item2);
                } 
            }
            return children;
        }

    }


}

class ColibriPHPBackendTreeProvider {

    /**
     * 
     * @param  {vscode.ExtensionContext} context 
     */
    constructor(context) {
		this._path = vscode.extensions.getExtension(context.extension.id).extensionUri.path;

        this._onDidChangeTreeData = new vscode.EventEmitter(); 
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    
        this._core = null;
        this._roots = new Map();
        this._paths = new Map();
        this._loadComponents();

    }


    /**
     * @param {string} name 
     * @returns {vscode.TreeItem}
     */
    module(name) {
        return this._roots.get(name);
    }

    findComponent(path) {
        return this._paths.get(path);
    }

    controllers(module) {
        
    }

    refresh() {
        this._core = null;
        this._roots = new Map();
        this._paths = new Map();
        this._loadComponents();
        this._onDidChangeTreeData.fire();
    }

    _loadComponents() {
        if(this._components) {
            this._components.clear();
        }
        else {
            this._components = new Map();
        }

        const modules = getPHPModules();
        const storages = findStorageModels();

        for(const moduleName of Object.keys(modules)) {
            const modulePath = modules[moduleName];
            const obj = {
                path: modulePath,
                moduleName: moduleName,
                moduleClass: modulePath + 'Module.php',
                moduleObject: readPhp(modulePath + 'Module.php')['Module'],
                controllersPath: modulePath + '/Controllers',
                modelsPath: modulePath + '/Models',
                templatesPath: modulePath + '/templates',
                controllers: {},
                models: storages[moduleName] || {},
                templates: {},
            };

            const controllers = glob.sync(obj.controllersPath + '**/*', {
                nodir: true
            });
            for(const controller of controllers) {
                obj.controllers = Object.assign(obj.controllers, readPhp(controller))
            }

            for(const storage of Object.keys(obj.models)) {
                const f1 = readPhp(modulePath + replaceAll(obj.models[storage].row, '\\', '/') + '.php');
                obj.models[storage].row = Object.values(f1)[0];
                const f2 = readPhp(modulePath + replaceAll(obj.models[storage].table, '\\', '/') + '.php');
                obj.models[storage].table = Object.values(f2)[0];
            }

            this._components.set(moduleName, obj);


        }
        
    }

    getParent(element) {
        if(element.data && element.data.parent) {
            return element.data.parent;
        }
        return null;
    }

    getTreeItem(element) {
        return element;
    }

    /**
     * 
     * @param {Data} element 
     * @returns 
     */
    getChildren(element) {
        const iconprefix = vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Dark ? '-dark' : '-light';

        // отдельно ядро, отдельно каждый модуль, фильтруем 
        if(!element) {
            const children = [];

            for(const [key, value] of this._components) {
                const item1 = new Data(key, vscode.TreeItemCollapsibleState.Collapsed, {name: key, type: 'module', parent: null, obj: value});
                item1.tooltip = key + ' Module \n\n' + value.moduleObject.desc;
                item1.iconPath = this._path + '/images/module' + iconprefix + '.svg';
                children.push(item1);        
                this._roots.set(key, item1);
            }

            return children;
            
        } else if(element.data.type === 'module') {
            
            const children = [];
            const moduleObject = element.data.obj;

            const item1 = new Data('Module', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Module', type: 'file', parent: element, obj: moduleObject, file: moduleObject.moduleObject}, 'colibri-ui.open-phpclass');
            item1.tooltip = 'Module class\n\n' + moduleObject.moduleObject.desc;
            item1.iconPath = this._path + '/images/module-open' + iconprefix + '.svg';
            children.push(item1);   
            this._paths.set(moduleObject.moduleObject.path, item1);

            if(Object.keys(moduleObject.controllers).length > 0) {
                const item1 = new Data('Controllers', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Controllers', type: 'folder', parent: element, obj: moduleObject, list: moduleObject.controllers});
                item1.tooltip = 'Module controllers';
                item1.iconPath = this._path + '/images/controllers' + iconprefix + '.svg';
                children.push(item1);   
                this._paths.set(element.data.name + '_Controllers', item1);
            }

            if(Object.keys(moduleObject.models).length > 0) {
                const item1 = new Data('Models', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Models', type: 'storages', parent: element, obj: moduleObject, list: moduleObject.models});
                item1.tooltip = 'Module models';
                item1.iconPath = this._path + '/images/models' + iconprefix + '.svg';
                children.push(item1);   
                this._paths.set(element.data.name + '_Modules', item1);
            }

            return children;
        } else if (element.data.type === 'storages') {
            // это файл
            const moduleObject = element.data.obj;
            const list = element.data.list;

            let children = [];
            for(const item of Object.keys(list)) {
                const fileObject = list[item];
                
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.Collapsed, {name: item, type: 'storage', parent: element, obj: moduleObject, file: fileObject});
                item1.tooltip = item + ' Storage';
                item1.iconPath = this._path + '/images/storage' + iconprefix + '.svg';
                children.push(item1); 
                this._paths.set(element.data.obj.moduleName + '_storages_' + item, item1);

            }

            return children;
        } else if (element.data.type === 'storage') {
            // это файл
            const moduleObject = element.data.obj;
            const file = element.data.file;

            let children = [];
            let fileObject1 = file.table;
            const item1 = new Data(fileObject1.name + ': ' + fileObject1.parent, vscode.TreeItemCollapsibleState.Collapsed, {name: fileObject1.name, type: 'file', parent: element, obj: moduleObject, file: fileObject1}, 'colibri-ui.open-phpclass');
            item1.tooltip = fileObject1.name + ' Table class';
            item1.iconPath = this._path + '/images/table' + iconprefix + '.svg';
            children.push(item1);
            this._paths.set(fileObject1.path, item1);

            const fileObject2 = file.row;
            const item2 = new Data(fileObject2.name + ': ' + fileObject2.parent, vscode.TreeItemCollapsibleState.Collapsed, {name: fileObject2.name, type: 'file', parent: element, obj: moduleObject, file: fileObject2}, 'colibri-ui.open-phpclass');
            item2.tooltip = fileObject2.name + ' Row class';
            item2.iconPath = this._path + '/images/row' + iconprefix + '.svg';
            children.push(item2);
            this._paths.set(fileObject2.path, item2);

            return children;
        } else if (element.data.type === 'folder') {
            // это файл
            const moduleObject = element.data.obj;
            const list = element.data.list;

            let children = [];
            for(const item of Object.keys(list)) {
                const fileObject = list[item];
                const item1 = new Data(item + ': ' + fileObject.parent, vscode.TreeItemCollapsibleState.Collapsed, {name: item, type: 'file', parent: element, obj: moduleObject, file: fileObject}, 'colibri-ui.open-phpclass');
                item1.tooltip = item + ' class\n\n' + fileObject.desc;
                item1.iconPath = element.data.name === 'Controllers' ? this._path + '/images/controller' + iconprefix + '.svg' : this._path + '/images/component' + iconprefix + '.svg';
                children.push(item1); 
                this._paths.set(fileObject.path, item1);
            }

            return children;
        } else if (element.data.type === 'file') {
            // это файл
            const moduleObject = element.data.obj;
            const file = element.data.file;
 
            let children = [];
            for(const item of Object.keys(file.methods.static)) {
                const methodObject = file.methods.static[item];
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.None, {name: item, type: 'method', parent: element, obj: moduleObject, method: methodObject}, 'colibri-ui.open-phpclass');
                item1.tooltip = methodObject.row + '\n\n' + methodObject.desc;
                item1.iconPath = item === '__construct' ? this._path + '/images/constructor' + iconprefix + '.svg' : this._path + '/images/publicMethods' + iconprefix + '.svg';
                children.push(item1); 
            }
            for(const item of Object.keys(file.methods.private)) {
                const methodObject = file.methods.private[item];
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.None, {name: item, type: 'method', parent: element, obj: moduleObject, method: methodObject}, 'colibri-ui.open-phpclass');
                item1.tooltip = methodObject.row + '\n\n' + methodObject.desc;
                item1.iconPath = this._path + '/images/privateMethods' + iconprefix + '.svg';
                children.push(item1); 
            }
            for(const item of Object.keys(file.methods.public)) {
                const methodObject = file.methods.public[item];
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.None, {name: item, type: 'method', parent: element, obj: moduleObject, method: methodObject}, 'colibri-ui.open-phpclass');
                item1.tooltip = methodObject.row + '\n\n' + methodObject.desc;
                item1.iconPath = this._path + '/images/publicMethods' + iconprefix + '.svg';
                children.push(item1); 
            }

            return children;
        }


        return [];
    }


}


class Data extends vscode.TreeItem {
    constructor(label, collapsibleState, data, commandId = undefined) {
      super(label, collapsibleState);
      this._data = data;
      if(commandId) {
        // It should be a command to execute
        this.command = {
            'command': commandId,
            'title': '',
            arguments: [this]
        };
      }
    }
    get data() {
        return this._data;
    }
}

/**
 * 
 * @returns {vscode.TreeView}
 */
function getTreeView() {
    return __treeView;
}

/**
 * 
 * @returns {vscode.TreeView}
 */
function getPHPTreeView() {
    return __phpTreeView;
}


/**
 * 
 * @returns {ColibriUIComponentsTreeProvider}
 */
function getTreeDataProvider() {
    return __treeDataProvider;
}

/**
 * 
 * @returns {ColibriUIComponentsTreeProvider}
 */
function getPHPTreeDataProvider() {
    return __phpTreeDataProvider;
}

function createTreeView(context) {
    __treeDataProvider = new ColibriUIComponentsTreeProvider(context);
    __treeView = vscode.window.createTreeView('colibriUIComponents', {
        treeDataProvider: __treeDataProvider,
        showCollapseAll: true
    });
}

function createPHPTreeView(context) {
    __phpTreeDataProvider = new ColibriPHPBackendTreeProvider(context);
    __phpTreeView = vscode.window.createTreeView('colibriPHPBackend', {
        treeDataProvider: __phpTreeDataProvider,
        showCollapseAll: true
    });
}

module.exports = {
    ColibriUIComponentsTreeProvider,
    ColibriPHPBackendTreeProvider,
    Data,
    createTreeView,
    createPHPTreeView,
    getTreeView,
    getPHPTreeView,
    getTreeDataProvider,
    getPHPTreeDataProvider
}