const vscode = require('vscode');

class DebugAdapter {

    /**
     * 
     * @param {vscode.DebugSession} session 
     */
    constructor(session) {
        /** @var {vscode.DebugSession} */
        this._session = session;
        this._brakepoints = new Set();
        
    }

    async onWillReceiveMessage(m) {
        if(m.type === 'request') {
            if(m.command === 'setBreakpoints') {
                this._brakepoints.add(m.arguments.source);
                console.log('onWillReceiveMessage', m.type, `> ${JSON.stringify(m, undefined, 2)}`);
            }
        }
        console.log('onWillReceiveMessage', m.type, `> ${JSON.stringify(m, undefined, 2)}`);
    }

    onDidSendMessage(m) {
        // console.log('onDidSendMessage', `< ${JSON.stringify(m, undefined, 2)}`);
    }
    onWillStartSession(m) {
        // console.log('onWillStartSession', `< ${JSON.stringify(m, undefined, 2)}`);
    }
    onError(m) {
        // console.log('onError', `< ${JSON.stringify(m, undefined, 2)}`);
    }
    onExit(m) {
        // console.log('onExit', `< ${JSON.stringify(m, undefined, 2)}`);
    }
    onWillStopSession(m) {
        // console.log('onWillStopSession', `< ${JSON.stringify(m, undefined, 2)}`);
    }

}

module.exports = {
    DebugAdapter
}