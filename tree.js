const vscode = require('vscode');
const fs = require('fs');
const { replaceAll, getBundlePaths, enumerateColibriUIComponents, __getAttributeRegExp, __setAttributeRegExp, __constructorRegExp, __eventHandlersRegExp, __privateMethodsRegExp, __publicMethodsRegExp, __attributesRegExp, getWorkspacePath, readJson, getPHPModules, __staticMethodsRegExp } = require('./utils');
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
        
        this._paths = new Map();
        this.__loadComponentsTree();

    }
    
    /**
     * 
     * @param {string} path 
     * @returns {Data[]}
     */
    find(path) {
        let element = this._paths.get(path);
        let p = [element];
        while(element.parent != null) {
            p = [element.parent, ...p];
            element = element.parent;
        }
        return p;
    }

    refresh() {
        this._paths = new Map();
        this.__loadComponentsTree();
        this._onDidChangeTreeData.fire();
    }

    __setContent(key, value) {
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
        if(fs.existsSync(replaceAll(value.path, '.js', '.lang'))) {
            f.lang = replaceAll(value.path, '.js', '.lang');
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
            lang: f.lang ? {
                name: 'lang',
                line: 0,
                path: f.lang
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
            } else if(match = line.match(__staticMethodsRegExp)) {
                f.content.publicMethods.push({
                    name: match[1],
                    line: index
                });
            }

        }
        return f;
    
    }

    __loadComponentsTree() {

        if(this._components) {
            this._components.clear();
        }
        else {
            this._components = new Map();
        }

        if(this._paths) {
            this._paths.clear();
        }
        else {
            this._paths = new Map();
        }
        
        const iconprefix = vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Dark ? '-dark' : '-light';

        const insertChildsForFiles = (element) => {

            if(element.data.object.content.template) {    
                const node = new Data('Template', vscode.TreeItemCollapsibleState.None, {name: 'template', type: 'item', object: element.data.object, content: element.data.object.content.template, group: 'parts'}, element, 'colibri-ui.open-component');
                node.iconPath = this._path + '/images/template' + iconprefix + '.svg';
                node.tooltip = 'Component template';
                this._paths.set(element.data.object.content.template.path, node);
                element.children.set('template', node);
            }
            if(element.data.object.content.styles) {
                const node = new Data('Styles', vscode.TreeItemCollapsibleState.None, {name: 'styles', type: 'item', object: element.data.object, content: element.data.object.content.styles, group: 'parts'}, element, 'colibri-ui.open-component');
                node.iconPath = this._path + '/images/styles' + iconprefix + '.svg';
                node.tooltip = 'Component styles';
                this._paths.set(element.data.object.content.styles.path, node);
                element.children.set('styles', node);
            }
            if(element.data.object.content.lang) {
                const node = new Data('Text resources', vscode.TreeItemCollapsibleState.None, {name: 'lang', type: 'item', object: element.data.object, content: element.data.object.content.lang, group: 'parts'}, element, 'colibri-ui.open-component');
                node.iconPath = this._path + '/images/langs' + iconprefix + '.svg';
                node.tooltip = 'Component text resources';
                this._paths.set(element.data.object.content.lang.path, node);
                element.children.set('lang', node);
            }
            if(element.data.object.content.constructor) {
                const node = new Data('constructor', vscode.TreeItemCollapsibleState.None, {name: 'constructor', type: 'item', object: element.data.object, content: element.data.object.content.constructor, group: 'parts'}, element, 'colibri-ui.open-component');
                node.iconPath = this._path + '/images/constructor' + iconprefix + '.svg';
                node.tooltip = 'Constructor';
                element.children.set('constructor', node);
            }
            if(element.data.object.content.attributes_get.length > 0) {
                const content = element.data.object.content.attributes_get;
                for(const o of content) {
                    const node = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, group: 'attrs'}, element, 'colibri-ui.open-component');
                    node.iconPath = this._path + '/images/attributes_get' + iconprefix + '.svg';
                    node.tooltip = 'Attribute (get)';
                    element.children.set('attributes_get_' + o.name, node);
                }
            }
            if(element.data.object.content.attributes_set.length > 0) {
                const content = element.data.object.content.attributes_set;
                for(const o of content) {
                    const node = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, group: 'attrs'}, element, 'colibri-ui.open-component');
                    node.iconPath = this._path + '/images/attributes_set' + iconprefix + '.svg';
                    node.tooltip = 'Attribute (set)';
                    element.children.set('attributes_set_' + o.name, node);
                }
            }
            if(element.data.object.content.privateMethods.length > 0) {
                const content = element.data.object.content.privateMethods;
                for(const o of content) {
                    const node = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, group: 'methods'}, element, 'colibri-ui.open-component');
                    node.iconPath = this._path + '/images/privateMethods' + iconprefix + '.svg';
                    node.tooltip = 'Method (private)';
                    element.children.set('privateMethods_' + o.name, node);
                }
            }
            if(element.data.object.content.publicMethods.length > 0) {
                const content = element.data.object.content.publicMethods;
                for(const o of content) {
                    const node = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, group: 'methods'}, element, 'colibri-ui.open-component');
                    node.iconPath = this._path + '/images/publicMethods' + iconprefix + '.svg';
                    node.tooltip = 'Method (public)';
                    element.children.set('publicMethods_' + o.name, node);
                }
            }
            if(element.data.object.content.eventHandlers.length > 0) {
                const content = element.data.object.content.eventHandlers;
                for(const o of content) {
                    const node = new Data(o.name, vscode.TreeItemCollapsibleState.None, {name: o.name, type: 'item', object: element.data.object, content: o, group: 'handlers'}, element, 'colibri-ui.open-component');
                    node.iconPath = this._path + '/images/eventHandlers' + iconprefix + '.svg';
                    node.tooltip = 'Event handler';
                    element.children.set('eventHandlers_' + o.name, node);
                } 
            }


        }

        let colibriUIRootNode = null;
        const uiItems = enumerateColibriUIComponents();
        for(let [key, value] of uiItems) {
            value = this.__setContent(key, value);
            const isNamespace = value.file.indexOf('/.js') !== -1;

            if(key === 'Colibri.UI') {
                colibriUIRootNode = new Data('Colibri.UI', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Colibri.UI', type: 'folder', object: value, group: 'core'}, null, 'colibri-ui.open-component');
                colibriUIRootNode.tooltip = 'Colbri.UI - Core components';
                colibriUIRootNode.iconPath = this._path + '/images/module' + iconprefix + '.svg';
                this._components.set('Colibri.UI', colibriUIRootNode);
                this._paths.set(value.file, colibriUIRootNode);
                continue;
            }

            key = replaceAll(key, 'Colibri.UI.', '');
            const parts = key.split('.');
            if(parts.length === 1) {
                const componentNode = new Data(key, vscode.TreeItemCollapsibleState.Collapsed, {name: key, type: 'file', object: value, group: (isNamespace ? 'namespaces' : 'components')}, colibriUIRootNode, 'colibri-ui.open-component');
                componentNode.iconPath = this._path + '/images/' + (isNamespace ? 'namespace' : 'component') + iconprefix + '.svg';
                componentNode.tooltip = key + (isNamespace ? ' - Namespace' : ' - Component');
                insertChildsForFiles(componentNode);
                this._paths.set(value.file, componentNode);
                colibriUIRootNode.children.set(key, componentNode);
            }
            else {
                let parent = colibriUIRootNode;
                let componentName = parts.pop();
                for(const part of parts) {

                    if(!parent.children.has(part)) {
                        const namespaceNode = new Data(part, vscode.TreeItemCollapsibleState.Collapsed, {name: part, type: 'folder', group: 'namespaces'}, parent);
                        namespaceNode.tooltip = part + ' - Namespace';
                        namespaceNode.iconPath = this._path + '/images/namespace' + iconprefix + '.svg';
                        parent.children.set(part, namespaceNode);                    
                    }
                    parent = parent.children.get(part);
                    
                }

                const componentNode = new Data(componentName, vscode.TreeItemCollapsibleState.Collapsed, {name: componentName, type: 'file', object: value, group: (isNamespace ? 'namespaces' : 'components')}, parent, 'colibri-ui.open-component');
                componentNode.iconPath = this._path + '/images/' + (isNamespace ? 'namespace' : 'component') + iconprefix + '.svg';
                componentNode.tooltip = key + (isNamespace ? ' - Namespace' : ' - Component');
                parent.children.set(componentName, componentNode);
                this._paths.set(value.file, componentNode);
                insertChildsForFiles(componentNode);

            }
            

        }

        const bundleItems = getBundlePaths();
        for(const item of bundleItems) {
            const itemClasses = enumerateColibriUIComponents(item);
            for(let [key, value] of itemClasses) {

                key = replaceAll(key, 'App.Modules.', '');
                value = this.__setContent(key, value);
                const isNamespace = value.file.indexOf('/.js') !== -1;

                let parts = key.split('.');
                let moduleName = parts.splice(0, 1).pop();
                if(moduleName === 'Colibri') {
                    moduleName = 'Colibri.UI';
                    parts.splice(0, 1);
                }

                if(!this._components.has(moduleName)) {
                    const moduleRootNode = new Data(moduleName, vscode.TreeItemCollapsibleState.Collapsed, {name: moduleName, type: 'file', object: value, group: 'modules'}, null, 'colibri-ui.open-component');
                    moduleRootNode.tooltip = moduleName + ' - Module';
                    moduleRootNode.iconPath = this._path + '/images/module' + iconprefix + '.svg';
                    insertChildsForFiles(moduleRootNode);
                    this._paths.set(value.file, moduleRootNode);
                    this._components.set(moduleName, moduleRootNode);
                }

                let parent = this._components.get(moduleName);
                const componentName = parts.pop();
                for(const part of parts) {

                    if(!parent.children.has(part)) {
                        const namespaceNode = new Data(part, vscode.TreeItemCollapsibleState.Collapsed, {name: part, type: 'file', object: value, group: 'namespaces'}, parent, 'colibri-ui.open-component');
                        namespaceNode.tooltip = part + ' - Namespace';
                        namespaceNode.iconPath = this._path + '/images/namespace' + iconprefix + '.svg';
                        insertChildsForFiles(namespaceNode);
                        this._paths.set(value.file, namespaceNode);
                        parent.children.set(part, namespaceNode);
                    }
                    parent = parent.children.get(part);

                }

                if(componentName) {
                    const componentNode = new Data(componentName, vscode.TreeItemCollapsibleState.Collapsed, {name: componentName, type: 'file', object: value, group: (isNamespace ? 'namespaces' : 'components')}, parent, 'colibri-ui.open-component');
                    componentNode.iconPath = this._path + '/images/' + (isNamespace ? 'namespace' : 'component') + iconprefix + '.svg';
                    componentNode.tooltip = key + (isNamespace ? ' - Namespace' : ' - Component');
                    insertChildsForFiles(componentNode);
                    this._paths.set(value.file, componentNode);
                    parent.children.set(componentName, componentNode);
                }

            }
        }

    }

    getParent(element) {
        if(element && element.parent) {
            return element.parent;
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

        // отдельно ядро, отдельно каждый модуль, фильтруем
        let children = this._components;
        if(element) {
            children = element.children;
        } 

        let prefixes = {
            'core': '000',
            'parts': '001',
            'attrs': '002',
            'methods': '003',
            'handlers': '004',
            'components': '005',
            'namespaces': '006',
            'modules': '007'
        };
        let childs = Array.from(children, ([name, value]) => value);
        childs = childs.sort((a, b) => {
            let aprefix = prefixes[a.data.group];
            let bprefix = prefixes[b.data.group];

            if(aprefix + a.label > bprefix + b.label) return 1;
            else if(aprefix + a.label < bprefix + b.label) return -1;
            else return 0;
        });

        return childs;
    
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
        if(element && element.parent) {
            return element.parent;
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

            const item1 = new Data('Module', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Module', type: 'file', obj: moduleObject, file: moduleObject.moduleObject}, element, 'colibri-ui.open-phpclass');
            item1.tooltip = 'Module class\n\n' + moduleObject.moduleObject.desc;
            item1.iconPath = this._path + '/images/module-open' + iconprefix + '.svg';
            children.push(item1);   
            this._paths.set(moduleObject.moduleObject.path, item1);

            if(Object.keys(moduleObject.controllers).length > 0) {
                const item1 = new Data('Controllers', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Controllers', type: 'folder', moduleObject, list: moduleObject.controllers}, element);
                item1.tooltip = 'Module controllers';
                item1.iconPath = this._path + '/images/controllers' + iconprefix + '.svg';
                children.push(item1);   
                this._paths.set(element.data.name + '_Controllers', item1);
            }

            if(Object.keys(moduleObject.models).length > 0) {
                const item1 = new Data('Models', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Models', type: 'storages', obj: moduleObject, list: moduleObject.models}, element);
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
                
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.Collapsed, {name: item, type: 'storage', obj: moduleObject, file: fileObject}, element);
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
            const item1 = new Data(fileObject1.name + ': ' + fileObject1.parent, vscode.TreeItemCollapsibleState.Collapsed, {name: fileObject1.name, type: 'file', obj: moduleObject, file: fileObject1}, element, 'colibri-ui.open-phpclass');
            item1.tooltip = fileObject1.name + ' Table class';
            item1.iconPath = this._path + '/images/table' + iconprefix + '.svg';
            children.push(item1);
            this._paths.set(fileObject1.path, item1);

            const fileObject2 = file.row;
            const item2 = new Data(fileObject2.name + ': ' + fileObject2.parent, vscode.TreeItemCollapsibleState.Collapsed, {name: fileObject2.name, type: 'file', obj: moduleObject, file: fileObject2}, element, 'colibri-ui.open-phpclass');
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
                const item1 = new Data(item + ': ' + fileObject.parent, vscode.TreeItemCollapsibleState.Collapsed, {name: item, type: 'file', obj: moduleObject, file: fileObject}, element, 'colibri-ui.open-phpclass');
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
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.None, {name: item, type: 'method', obj: moduleObject, method: methodObject}, element, 'colibri-ui.open-phpclass');
                item1.tooltip = methodObject.row + '\n\n' + methodObject.desc;
                item1.iconPath = item === '__construct' ? this._path + '/images/constructor' + iconprefix + '.svg' : this._path + '/images/publicMethods' + iconprefix + '.svg';
                children.push(item1); 
            }
            for(const item of Object.keys(file.methods.private)) {
                const methodObject = file.methods.private[item];
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.None, {name: item, type: 'method', obj: moduleObject, method: methodObject}, element, 'colibri-ui.open-phpclass');
                item1.tooltip = methodObject.row + '\n\n' + methodObject.desc;
                item1.iconPath = this._path + '/images/privateMethods' + iconprefix + '.svg';
                children.push(item1); 
            }
            for(const item of Object.keys(file.methods.public)) {
                const methodObject = file.methods.public[item];
                const item1 = new Data(item, vscode.TreeItemCollapsibleState.None, {name: item, type: 'method', obj: moduleObject, method: methodObject}, element, 'colibri-ui.open-phpclass');
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
    constructor(label, collapsibleState, data, parent = null, commandId = undefined) {
      super(label, collapsibleState);
      this._data = data;
      this._parent = parent;
      this._children = new Map();
      if(commandId) {
        // It should be a command to execute
        this.command = {
            'command': commandId,
            'title': '',
            arguments: [this]
        };
      }
    }
    get parent() {
        return this._parent;
    }
    get data() {
        return this._data;
    }
    get children() {
        return this._children;
    }

    collapse() {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
    expand() {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
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
 * @returns {ColibriPHPBackendTreeProvider}
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
    __treeView.onDidCollapseElement(e => {
        e.element.collapse();
    });
    __treeView.onDidExpandElement(e => {
        e.element.expand();
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