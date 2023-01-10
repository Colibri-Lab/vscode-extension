
App.Modules.{class-name} = class extends Colibri.Modules.Module {

    /** @constructor */
    constructor() {
        super('{class-name}');
        
        // Uncomment this lines if you using an authorization
        // this.authorizationCookieName = 'cc-jwt'; - change the authorization cookie name
        // this.useAuthorizationCookie = true; - indicates using of authorization cookie in requests

    }

    InitializeModule() {
        super.InitializeModule();

        console.log('Initializing module {class-name}');
        
        this._store = App.Store.AddChild('app.{module-name}', {});
        
        // uncomment this line if you have enabled the Lang module
        // this._store.AddPathHandler('{module-name}.settings.params.lang', lang => { App.DateFormat = lang.dateformat; App.NumberFormat = lang.numberformat; });

        // Samples: Declaration of client side storage points
        // AddPathLoader('data path in storage (allways starts with module-name)', 'controller point (module:controller.action)')
        // AddPathLoader('data path in storage (allways starts with module-name)', () => this.Method()) - method must return Promise.resolve(controller response data)
        // this._store.AddPathLoader('{module-name}.settings', '{class-name}:{class-name}.Settings');
        // this._store.AddPathLoader('{module-name}.settings', () => this.MethodName(1, 20, filters, orders, and etc));


    }

    Render() {
        console.log('Rendering Module {class-name}');    

        // Render module content
        // Generate routing points
        // Sample: 
        // App.Router.AddRoutePattern('/', (url, options, path) => {
        //     if(path.length == 0) {
        //         App.Router.Navigate('/{initial route point}', {}, false, true);
        //     }
        // });
        // App.Router.AddRoutePattern('/{some route}', (url, options, path) => {
        //    Some implementation 
        // });
    }

    RegisterEvents() {
        console.log('Registering module events for {class-name}');
    }

    RegisterEventHandlers() {
        console.log('Registering event handlers for {class-name}');
    }

    // Sample: 
    // Credits(page = 1, pagesize = 20, params = {}, returnPromise = false) {
    //     const promise = this.Call('Controller', 'Action', Object.assign(params, {page: page, pagesize: pagesize}));
    //     if(returnPromise) {
    //         return promise;
    //     }
    //     promise.then((response) => {
    //         this._store.Set('{data path in storage}', response.result);
    //     }).catch(error => {
    //         App.Notices.Add(new Colibri.UI.Notice(error.result));
    //         console.error(error);
    //     });
    // }



}

App.Modules.{class-name}.Icons = {};
App.Modules.{class-name}.Images = {};

App.Modules.{class-name}.Images.SampleImage = 'svg image oneline content';
App.Modules.{class-name}.Icons.SampleIcon = 'svg image oneline content';

const {class-name} = new App.Modules.{class-name}();

