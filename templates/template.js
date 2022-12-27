{className} = class extends {parentClass} {
    
    constructor(name, container) {
        /* создаем компонент и передаем шаблон */
        super(name, container, Colibri.UI.Templates['{className}']);
        this.AddClass('{cssClassName}');


    }

}