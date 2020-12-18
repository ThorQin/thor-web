'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.HttpError = exports.enc = exports.middlewares = void 0;
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
	use(factory, options) {
		if (!this.server) {
			throw new Error('Error: server not started!');
		}
		const middleware = factory.create(this, options);
		if (middleware) {
			this.middlewares.push(middleware);
		}
		return this;
	}
	start({ port = 8080, hostname } = {}) {
		this.server = http_1.default
			.createServer((req, rsp) => {
				try {
					processRequest(this, req, rsp, this.middlewares);
				} catch (e) {
					console.error('processRequest exception: ', e);
				}
			})
			.listen(port, hostname);
		if (hostname) {
			console.log(`Server listening on: ${hostname}:${port}`);
		} else {
			console.log(`Server listening on: ${port}`);
		}
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
		expireCheck,
		intervalCheck,
		domain,
		suffix,
		accessHandler,
		privilegeHandler,
		env = {},
		staticDir,
		staticPath,
		templateDir,
		controllerDir,
		controllerPath,
		wsDir,
		wsPath,
		wsMaxMessageSize,
	} = {}) {
		const app = new App();
		if (env) {
			for (const k in env) {
				if (!app[k]) {
					app[k] = env[k];
				}
			}
		}
		app.start({
			port: port || 8080,
			hostname: hostname || undefined,
		});
		app.use(index_1.session, {
			serverKey: serverKey,
			cookieName: cookieName,
			maxAge: maxAge || 1800,
			expireCheck: expireCheck,
			intervalCheck: intervalCheck,
			domain: domain,
		});
		if (typeof accessHandler === 'function' || typeof privilegeHandler === 'function') {
			app.use(index_1.security, {
				accessHandler: accessHandler,
				privilegeHandler: privilegeHandler,
			});
		}
		app.use(index_1.staticServer, {
			suffix: suffix,
			baseDir: staticDir,
			rootPath: staticPath,
		});
		app.use(index_1.bodyParser);
		app.use(index_1.template, {
			baseDir: templateDir,
		});
		app.use(index_1.controller, {
			baseDir: controllerDir,
			rootPath: controllerPath,
		});
		app.use(index_1.webSocket, {
			baseDir: wsDir,
			rootPath: wsPath,
			maxReceivedMessageSize: wsMaxMessageSize,
		});
		return app;
	}
}
const enc_js_1 = __importDefault(require('./utils/enc.js'));
exports.enc = enc_js_1.default;
const controller_1 = require('./middleware/controller');
Object.defineProperty(exports, 'HttpError', {
	enumerable: true,
	get: function () {
		return controller_1.HttpError;
	},
});
exports.middlewares = {
	session: index_1.session,
	staticServer: index_1.staticServer,
	controller: index_1.controller,
	bodyParser: index_1.bodyParser,
	security: index_1.security,
	template: index_1.template,
	webSocket: index_1.webSocket,
};
exports.default = App;
//# sourceMappingURL=index.js.map
