import http from 'http';
import Context from './context.js';
import {
	session,
	staticServer,
	controller,
	bodyParser,
	security,
	template
} from './middleware/index.js'

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
	} catch(e) {
		console.error(e);
		if (process.env.NODE_ENV == 'prodction') {
			ctx.error();
		} else {
			ctx.errorUnknown(e);
		}
	}
}

class App {
	constructor() {
		this.middlewares = [];
	}
	/**
	 * Add some middlewares.
	 * @param { ...Function } middleware Middleware or array of middlewares.
	 */
	use(...middleware) {
		if (middleware instanceof Array) {
			this.middlewares = this.middlewares.concat(...middleware);
		}
		return this;
	}
	start(port = 8080) {
		this.server = http.createServer((req, rsp) => {
			try {
				processRequest(this, req, rsp, this.middlewares);
			} catch (e) {
				console.error('processRequest exception: ', e);
			}
		}).listen(port);
		console.log(`Server running at http://127.0.0.1:${port}/`);
	}
	stop() {
		this.server && this.server.stop();
	}

	/**
	 * Instead use App constructor to create a server instance,
	 * this function create a simple server instance that add most commonly used middlewares to the instance.
	 * @param {number} [port = 8080] Listen port default 8080
	 * @param {string} serverKey Server key
	 * @param {(param: {ctx:Context,username:string,passowrd:string,session,cookie,path: string,method: string,ip: string}) => boolean|'allow'|'deny'|'redirect:'|'auth:'} securityHandler Security handler function
	 * @param {Object} env Any environment variables
	 * @returns {App} App instance
	 */
	static start(port = 8080, serverKey = null, securityHandler = null, env = {}) {
		let app = new App();
		let middlewares = [
			session.create({serverKey: serverKey}),
			staticServer.create(),
			bodyParser.create(),
			template.create(),
			controller.create()
		];
		if (typeof securityHandler === 'function') {
			middlewares.splice(1, 0, security.create(securityHandler));
		}
		app.use(
			...middlewares
		);
		if (env) {
			for (let k in env) {
				if (!app[k]) {
					app[k] = env[k];
				}
			}
		}
		app.start(port);
		return app;
	}
}



import time from './utils/time.js';
import enc from './utils/enc.js';

export const middlewares = {
	session,
	staticServer,
	controller,
	bodyParser,
	security,
	template
}

export { App, time, enc }
