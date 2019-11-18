const http = require('http');
const Context = require('./context');

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
	start(port) {
		this.server = http.createServer((req, rsp) => {
			processRequest(this, req, rsp, this.middlewares);
		}).listen(port);
		console.log(`Server running at http://127.0.0.1:${port}/`);
	}
	stop() {
		this.server && this.server.stop();
	}
}

const
	session = require('./middleware/session'),
	static = require('./middleware/static'),
	controller = require('./middleware/controller'),
	bodyParser = require('./middleware/body-parser'),
	security = require('./middleware/security'),
	template = require('./middleware/template');

/**
 * Instead use App constructor to create a server instance,
 * this function create a simple server instance that add most commonly used middlewares to the instance.
 * @param {string} serverKey Server key
 * @param {(param: {ctx:Context,username:string,passowrd:string,session,cookie,path: string,method: string,ip: string}) => boolean|'allow'|'deny'|'redirect:'|'auth:'} securityHandler Security handler function
 * @param {Object} env Any environment variables
 * @param {(ctx: Context) => boolean} securityHandler
 * @returns {App} App instance
 */
function start(port, serverKey = null, securityHandler = null, env = {}) {
	let app = new App();
	let middlewares = [
		session.create(serverKey),
		static.create(),
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

module.exports = {
	App: App,
	Context: Context,
	start: start,
	middlewares: {
		security: security,
		session: session,
		static: static,
		controller: controller,
		bodyParser: bodyParser,
		template: template
	},
	time: require('./utils/time')
};

