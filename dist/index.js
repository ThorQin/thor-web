'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.enc = exports.middlewares = void 0;
const http_1 = __importDefault(require('http'));
const context_1 = __importDefault(require('./context'));
const index_1 = require('./middleware/index');
async function processRequest(app, req, rsp, middlewares) {
	async function* exec(ctx, req, rsp) {
		for (const m of middlewares) {
			yield m(ctx, req, rsp);
		}
	}
	const ctx = new context_1.default(req, rsp);
	ctx.app = app;
	try {
		for await (const result of exec(ctx, req, rsp)) {
			if (result) {
				return;
			}
		}
		ctx.errorNotFound();
	} catch (e) {
		console.error(e);
		if (process.env.NODE_ENV == 'prodction') {
			ctx.errorUnknown();
		} else {
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
		this.server = http_1.default
			.createServer((req, rsp) => {
				try {
					processRequest(this, req, rsp, this.middlewares);
				} catch (e) {
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
	 * @param options
	 * @returns App instance
	 */
	static start({
		port = 8080,
		hostname,
		cookieName,
		serverKey,
		maxAge = 1800,
		domain,
		suffix,
		securityHandler,
		env = {},
		staticDir,
		staticPath,
		templateDir,
		controllerDir,
		controllerPath,
	} = {}) {
		const app = new App();
		const middlewares = [
			index_1.session.create({
				serverKey: serverKey,
				cookieName: cookieName,
				maxAge: maxAge || 1800,
				domain: domain,
			}),
			index_1.staticServer.create({
				suffix: suffix,
				baseDir: staticDir,
				rootPath: staticPath,
			}),
			index_1.bodyParser.create(),
			index_1.template.create({
				baseDir: templateDir,
			}),
			index_1.controller.create({
				baseDir: controllerDir,
				rootPath: controllerPath,
			}),
		];
		if (typeof securityHandler === 'function') {
			middlewares.splice(1, 0, index_1.security.create(securityHandler));
		}
		app.use(...middlewares);
		if (env) {
			for (const k in env) {
				if (!app[k]) {
					app[k] = env[k];
				}
			}
		}
		app.start(port || 8080, hostname || undefined);
		return app;
	}
}
const enc_js_1 = __importDefault(require('./utils/enc.js'));
exports.enc = enc_js_1.default;
exports.middlewares = {
	session: index_1.session,
	staticServer: index_1.staticServer,
	controller: index_1.controller,
	bodyParser: index_1.bodyParser,
	security: index_1.security,
	template: index_1.template,
};
exports.default = App;
//# sourceMappingURL=index.js.map
