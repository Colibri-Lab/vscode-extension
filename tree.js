const vscode = require('vscode');
const fs = require('fs');
const { replaceAll, getBundlePaths, enumerateColibriUIComponents, __getAttributeRegExp, __setAttributeRegExp, __constructorRegExp, __eventHandlersRegExp, __privateMethodsRegExp, __publicMethodsRegExp, __attributesRegExp } = require('./utils');

let __treeDataProvider = null;
let __treeView = null;

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

        // отдельно ядро, отдельно каждый модуль, фильтруем 
        if(!element) {

            let children = [];
            const item1 = new Data('Colibri.UI', vscode.TreeItemCollapsibleState.Collapsed, {name: 'Colibri.UI', type: 'folder', parent: null});
            item1.tooltip = 'Colbri.UI - Core componentns';
            item1.iconPath = vscode.ThemeIcon.Folder;
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
                item2.iconPath = vscode.ThemeIcon.Folder;
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
                if(vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Dark) {
                    item.iconPath = this._path + '/images/component-dark.svg';
                }
                else {
                    item.iconPath = this._path + '/images/component-light.svg';
                }
                item.tooltip = key;
                this._paths.set(key, item);
                children.push(item);    
            }

            return children;
        } else if (element.data.type === 'class') {
            // это файл

            const iconprefix = vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Dark ? '-dark' : '-light';

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
 * @returns {ColibriUIComponentsTreeProvider}
 */
function getTreeDataProvider() {
    return __treeDataProvider;
}

function createTreeView(context) {
    __treeDataProvider = new ColibriUIComponentsTreeProvider(context);
    __treeView = vscode.window.createTreeView('colibriUIComponents', {
        treeDataProvider: __treeDataProvider,
        showCollapseAll: true
    });
}

module.exports = {
    ColibriUIComponentsTreeProvider,
    Data,
    createTreeView,
    getTreeView,
    getTreeDataProvider
}