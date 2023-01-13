const vscode = require('vscode');
const fs = require('fs');
const { __colibriUIComponents, enumerateColibriUIComponents, replaceAll, getBundlePaths, getWorkspacePath } = require('./utils');

class ColibriUIComponentsTreeProvider {

    /**
     * 
     * @param  {vscode.ExtensionContext} context 
     */
    constructor(context) {
		this._path = vscode.extensions.getExtension(context.extension.id).extensionUri.path;

        this._onDidChangeTreeData = new vscode.EventEmitter(); 
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    
        this._loadComponents();

    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    _loadComponents() {

        if(this._components) {
            this._components.clear();
        }
        else {
            this._components = new Map();
        }

        const uiItems = enumerateColibriUIComponents();
        uiItems.forEach((value, key) => {
            const f = {
                file: value.path,
                line: value.line,
                fullName: key
            };
            if(fs.existsSync(replaceAll(value.path, '.js', '.html'))) {
                f.html = replaceAll(value.path, '.js', '.html');
            }
            this._components.set(key, f);
        });
    
        const bundleItems = getBundlePaths();
        for(const item of bundleItems) {
            const itemClasses = enumerateColibriUIComponents(item);
            itemClasses.forEach((value, key) => {
                const f = {
                    file: value.path,
                    line: value.line,
                    fullName: key
                };
                if(fs.existsSync(replaceAll(value.path, '.js', '.html'))) {
                    f.html = replaceAll(value.path, '.js', '.html');
                }
                this._components.set(key, f);
            });
        }

    }

    getTreeItem(element) {
        return element;
    }

    /**
     * 
     * @param {vscode.TreeItem} element 
     * @returns 
     */
    getChildren(element) {

        // отдельно ядро, отдельно каждый модуль, фильтруем 
        if(!element) {
            
            const children = [];
            for(const [key, obj] of this._components) {      
                
                const item = new Data(key, vscode.TreeItemCollapsibleState.None, obj, 'colibri-ui.open-component');
                item.iconPath = this._path + '/images/component.svg';
                item.tooltip = key;
                children.push(item);    
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

module.exports = {
    ColibriUIComponentsTreeProvider,
    Data
}