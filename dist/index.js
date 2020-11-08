import http from 'http';
import Context from './context';
import { session, staticServer, controller, bodyParser, security, template } from './middleware/index';
async function processRequest(app, req, rsp, middlewares) {
	async function* exec(ctx, req, rsp) {
		for (const m of middlewares) {
			yield m(ctx, req, rsp);
		}
	}
	const ctx = new Context(req, rsp);
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
		this.server = http
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
	} = {}) {
		const app = new App();
		const middlewares = [
			session.create({
				serverKey: serverKey,
				cookieName: cookieName,
				maxAge: maxAge || 1800,
				domain: domain,
			}),
			staticServer.create({
				suffix: suffix,
			}),
			bodyParser.create(),
			template.create(),
			controller.create(),
		];
		if (typeof securityHandler === 'function') {
			middlewares.splice(1, 0, security.create(securityHandler));
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
