'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.HttpError = exports.enc = exports.middlewares = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
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
		console.log(`not found: ${ctx.url}`);
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
			.listen(port, hostname)
			.once('listening', () => {
				if (this.server) {
					const addr = this.server?.address();
					if (!addr) {
						return;
					}
					if (typeof addr === 'object') {
						console.log(`Server listening on: ${addr.address}:${addr.port}`);
					} else {
						console.log(`Server listening on: ${addr}`);
					}
				}
			});
		console.log(`Current work dir: ${(0, tools_1.getRootDir)()}`);
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
		renew,
		domain,
		suffix,
		accessHandler,
		privilegeHandler,
		permissionHandler,
		env = {},
		staticDir,
		staticPath,
		templateDir,
		controllerDir,
		controllerPath,
		controllers,
		routers,
		apiDocPath,
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
			port: port,
			hostname: hostname || undefined,
		});
		app.use(index_1.session, {
			serverKey: serverKey,
			cookieName: cookieName,
			maxAge: maxAge,
			expireCheck: expireCheck,
			intervalCheck: intervalCheck,
			renew: renew,
			domain: domain,
		});
		if (
			typeof accessHandler === 'function' ||
			typeof privilegeHandler === 'function' ||
			typeof permissionHandler === 'function'
		) {
			app.use(index_1.security, {
				accessHandler: accessHandler,
				privilegeHandler: privilegeHandler,
				permissionHandler: permissionHandler,
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
			controllers,
			routers,
			apiDocPath: apiDocPath,
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
const tools_1 = require('./utils/tools');
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
