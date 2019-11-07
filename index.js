const http = require('http');

class Context {
	constructor(req, rsp) {
		this.req = req;
		this.rsp = rsp;
		let url = new URL(req.url, 'http://localhost/');
		this.url = url;
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
	 * Send 400 bad request
	 * @param {string} message
	 */
	errorBadRequest() {
		return this.error(400, 'Bad Request!\n');
	}

	/**
	 * Send 401 need authenticate
	 */
	errorNeedAuth() {
		return this.error(401, 'Need Authentication!\n');
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
		return this.error(404, 'Not Found!\n');
	}

	/**
	 * Send 405 bad method
	 */
	errorBadMethod() {
		return this.error(405, 'Method Not Allowed!\n');
	}

	/**
	 * Send 500 unknown error
	 * @param {string} message Error message
	 */
	errorUnknown(message) {
		return this.error(500, `Unexpected Server Error: ${message}\n`);
	}

	/**
	 * Send 500 unknown error
	 * @param {number|string} code Default is 500
	 * @param {string} message Default is 'Unexpected Server Error!'
	 */
	error(code, message) {
		if (typeof message === 'undefined' || message === null) {
			if (typeof code === 'number') {
				message = 'Unexpected Server Error!\n';
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

module.exports = {
	App: App,
	middlewares: {
		session: require('./middleware/session'),
		static: require('./middleware/static'),
		controller: require('./middleware/controller'),
		bodyParser: require('./middleware/body-parser'),
		template: require('./middleware/template')
	},
	time: require('./utils/time')
};

