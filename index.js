const http = require('http');

class Context {
	/**
	 * Construct Context
	 * @param {http.IncomingMessage} req
	 * @param {http.ServerResponse} rsp
	 */
	constructor(req, rsp) {
		this.req = req;
		this.rsp = rsp;
		let url = new URL(req.url, `http://${req.headers.host}/`);
		this.url = url.href;
		this.ip = req.connection.remoteAddress;
		this.method = req.method;
		this.path = url.pathname;
		this.query = url.search;
		this.params = url.searchParams;
	}

	getRequestHeader(key = null) {
		if (key) {
			return this.req.headers[key];
		} else {
			return this.req.headers;
		}
	}

	getResponseHeader(key = null) {
		if (key) {
			return this.rsp.getHeader(key);
		} else {
			return this.rsp.getHeaders();
		}
	}

	setResponseHeader(key, value) {
		this.rsp.setHeader(key, value);
	}

	getRequestCookies() {
		let cookies = {};
		this.req.headers.cookie && this.req.headers.cookie.split(';').forEach( cookie => {
			let eq = cookie.indexOf('=');
			if (eq >= 0) {
				cookies[cookie.substring(0, eq).trim()] = cookie.substring(eq + 1).trim();
			} else {
				cookies[''] = cookie.trim();
			}
		});
		return cookies;
	}

	/**
	 * Set response cookie
	 * @param {string} name Cookie name
	 * @param {string} value Cookie value
	 * @param {{[key:string]: string}} options Cookie options: HttpOnly, Exprie, Domain, Path
	 */
	setResponseCookie(name, value, options) {
		this.removeResponseCookie(this.rsp, name);
		let cookies = this.getResponseCookies(this.rsp);
		let cookie = name + '=' + value;
		if (options) {
			for (let k in options) {
				if (Object.prototype.hasOwnProperty.call(options, k)) {
					let v = options[k];
					cookie += '; ' + k + (v ? '=' + v : '');
				}
			}
		}
		cookies.push(cookie);
		this.rsp.setHeader('Set-Cookie', cookies);
	}

	/**
	 * Remove response cookie
	 * @param {string} name Cookie name
	 */
	removeResponseCookie(name) {
		let cookies = this.getResponseCookies(this.rsp);
		cookies = cookies.filter(c =>
			c.split(';').filter(p =>
				p.trim().startsWith(name+'=')
			).length == 0
		);
		this.rsp.setHeader('Set-Cookie', cookies);
	}

	getResponseCookies() {
		const headers = this.rsp.getHeaders();
		let cookies = [];
		if (headers) {
			for (let name in headers) {
				if (/^set-cookie$/i.test(name)) {
					let values = headers[name];
					if (typeof values === 'string') {
						cookies.push(values);
					} else if (values instanceof Array) {
						cookies = cookies.concat(...values);
					}
					break;
				}
			}
		}
		return cookies;
	}

	/**
	 * Write data to client
	 * @param {string|Buffer} buffer
	 */
	write(buffer) {
		if (buffer.length <= 0) {
			return Promise.resolve();
		}
		return new Promise( (resolve) => {
			this.rsp.write(buffer, () => {
				resolve();
			});
		});
	}

	/**
	 * Send text content to client
	 * @param {string} text
	 */
	sendText(text, contentType = 'text/plain; charset=utf-8') {
		this.rsp.writeHead(200, {
			'Content-Type': contentType
		});
		return this.end(text);
	}

	/**
	 * Send HTML content to client
	 * @param {string} html
	 */
	sendHtml(html) {
		return this.sendText(html, 'text/html; charset=utf-8');
	}

	/**
	 * Send JSON content to client
	 * @param {any} obj
	 */
	sendJson(obj) {
		return this.sendText(JSON.stringify(obj));
	}

	/**
	 * Send 302 redirection
	 * @param {string} url Redirection URL
	 */
	redirect(url) {
		this.rsp.writeHead(302, {
			'Location': url
		});
		return this.end();
	}

	/**
	 * Send 401 need authentication
	 * @param {string} domain Http basic authentication domain name
	 */
	needBasicAuth(domain) {
		this.rsp.writeHead(401, {
			'Content-Type': 'text/plain; charset=utf-8',
			'WWW-Authenticate': `Basic realm=${JSON.stringify(domain)}`
		});
		return this.end();
	}

	/**
	 * Verify http basic authentication
	 * @param {(username:string, password:string) => boolean} authCallback Callback handler function
	 */
	checkBasicAuth(authCallback) {
		let auth = this.getRequestHeader('authorization');
		if (!auth) {
			return false;
		} else {
			auth = auth.slice(6, auth.length);
			auth = Buffer.from(auth, 'base64').toString();
			let [username] = auth.split(':');
			let password = auth.substring(username.length + 1);
			if (typeof authCallback === 'function' && authCallback(username, password)) {
				return true;
			} else {
				return false;
			}
		}
	}

	/**
	 * Send 400 bad request
	 * @param {string} message
	 */
	errorBadRequest() {
		return this.error(400, 'Bad request!\n');
	}

	/**
	 * Send 401 need authenticate
	 */
	errorNeedAuth() {
		return this.error(401, 'Need authentication!\n');
	}

	/**
	 * Send 403 forbidden
	 */
	errorForbidden() {
		return this.error(403, 'Forbidden!\n');
	}

	/**
	 * Send 404 not found
	 */
	errorNotFound() {
		return this.error(404, 'Not found!\n');
	}

	/**
	 * Send 405 bad method
	 */
	errorBadMethod() {
		return this.error(405, 'Method not allowed!\n');
	}

	errorTooLarge() {
		return this.error(413, 'Request entity too large!\n');
	}

	/**
	 * Send 500 unknown error
	 * @param {string} message Error message
	 */
	errorUnknown(message) {
		return this.error(500, `Unexpected server error: ${message}\n`);
	}

	/**
	 * Send 500 unknown error
	 * @param {number|string} code Default is 500
	 * @param {string} message Default is 'Unexpected Server Error!'
	 */
	error(code, message) {
		if (typeof message === 'undefined' || message === null) {
			if (typeof code === 'number') {
				message = 'Unexpected server error!\n';
			}
		}
		this.rsp.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
		return this.end(message);
	}

	/**
	 * Send data to client and finish response.
	 * @param {string|Buffer} message
	 */
	end(message = null) {
		return new Promise((resolve, reject) => {
			function callback(err) {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			}
			if (message) {
				this.rsp.end(message, 'utf-8', callback);
			} else {
				this.rsp.end(callback);
			}
		});
	}

	/**
	 * Close underlying socket connection
	 */
	close() {
		this.req.connection.destroy();
	}
}

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
function simpleApp(port, serverKey = null, securityHandler = null, env = {}) {
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
	simpleApp: simpleApp,
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

