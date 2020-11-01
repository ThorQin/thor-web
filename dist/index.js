import http from 'http';
import Context from './context';
import { session, staticServer, controller, bodyParser, security, template } from './middleware/index';
async function processRequest(app, req, rsp, middlewares) {
    async function* exec(ctx, req, rsp) {
        for (let m of middlewares) {
            yield m(ctx, req, rsp);
        }
    }
    let ctx = new Context(req, rsp);
    ctx.app = app;
    try {
        for await (let result of exec(ctx, req, rsp)) {
            if (result) {
                return;
            }
        }
        ctx.errorNotFound();
    }
    catch (e) {
        console.error(e);
        if (process.env.NODE_ENV == 'prodction') {
            ctx.errorUnknown();
        }
        else {
            ctx.errorUnknown(e);
        }
    }
}
class App {
    constructor() {
        this.server = null;
        this.middlewares = [];
    }
    /**
     * Add some middlewares.
     * @param middleware Middleware or array of middlewares.
     */
    use(...middleware) {
        if (middleware instanceof Array) {
            this.middlewares = this.middlewares.concat(...middleware);
        }
        return this;
    }
    start(port = 8080, hostname) {
        this.server = http
            .createServer((req, rsp) => {
            try {
                processRequest(this, req, rsp, this.middlewares);
            }
            catch (e) {
                console.error('processRequest exception: ', e);
            }
        })
            .listen(port, hostname);
        console.log(`Server listening at: ${port}`);
        return this;
    }
    stop() {
        this.server && this.server.close();
        return this;
    }
    /**
     * Instead use App constructor to create a server instance,
     * this function create a simple server instance that add most commonly used middlewares to the instance.
     * @typedef StartOptions
     * @prop {number} port
     * @prop {string} hostname
     * @prop {string} cookieName Session name
     * @prop {number} maxAge Session max age
     * @prop {string} domain Session cookie domain
     * @prop {string} serverKey
     * @prop {string[]} suffix Extra supported static file suffix
     * @prop {function} securityHandler Security handler function
     * @prop {object} env
     *
     * @param {StartOptions} options
     * @returns {App} App instance
     */
    static start(options = {
        port: 8080,
        hostname: undefined,
        cookieName: undefined,
        serverKey: undefined,
        maxAge: 1800,
        domain: undefined,
        suffix: undefined,
        securityHandler: undefined,
        env: {},
    }) {
        if (!options) {
            options = {
                port: 8080,
            };
        }
        let app = new App();
        let middlewares = [
            session.create({
                serverKey: options.serverKey,
                cookieName: options.cookieName,
                maxAge: options.maxAge || 1800,
                domain: options.domain,
            }),
            staticServer.create({
                suffix: options.suffix,
            }),
            bodyParser.create(),
            template.create(),
            controller.create(),
        ];
        if (typeof options.securityHandler === 'function') {
            middlewares.splice(1, 0, security.create(options.securityHandler));
        }
        app.use(...middlewares);
        if (options.env) {
            for (let k in options.env) {
                if (!app[k]) {
                    app[k] = options.env[k];
                }
            }
        }
        app.start(options.port || 8080, options.hostname || undefined);
        return app;
    }
}
import enc from './utils/enc.js';
export const middlewares = {
    session,
    staticServer,
    controller,
    bodyParser,
    security,
    template,
};
export { enc };
export default App;
