// eslint-disable-next-line no-unused-vars
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

	/**
	 * Write response status code and headers
	 * @param {number} statusCode
	 * @param {string} reasonPhrase
	 * @param {http.OutgoingHttpHeaders} headers
	 */
	writeHead(...args) {
		this.rsp.writeHead(...args);
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
	 * Send 401 Authenticate failed
	 */
	errorAuthFailed() {
		return this.error(401, 'Authenticate failed!\n');
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
				if (message instanceof Buffer) {
					this.rsp.end(message, callback);
				} else {
					this.rsp.end(message, 'utf-8', callback);
				}
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

module.exports = Context;
