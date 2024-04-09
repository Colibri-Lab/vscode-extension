/**
 * {description}
 * @class
 * @extends {parentClass}
 * @memberof {namespaceName}
 */
{className} = class extends {parentClass} {
    
    /**
     * @constructor
     * @param {string} name name of component
     * @param {Element|Colibri.UI.component} container container of component
     */
    constructor(name, container) {
        /* создаем компонент и передаем шаблон */
        super(name, container, Colibri.UI.Templates['{className}']);
        this.AddClass('{cssClassName}');


    }

}