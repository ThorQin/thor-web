'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.OriginType = void 0;
const path_1 = __importDefault(require('path'));
const mime_1 = __importDefault(require('mime'));
const zlib_1 = __importDefault(require('zlib'));
const fs_1 = require('fs');
async function* readFile(fd, buffer) {
	let rd = await fd.read(buffer, 0, buffer.length);
	while (rd.bytesRead > 0) {
		yield rd;
		rd = await fd.read(buffer, 0, buffer.length);
	}
}
function writeStream(stream, buffer) {
	if (buffer.length <= 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		stream.write(buffer, () => {
			resolve();
		});
	});
}
function flushStream(stream) {
	return new Promise((resolve) => {
		stream.flush(() => {
			resolve();
		});
	});
}
function getForwarded(req) {
	const forwarded = req.headers.forwarded;
	if (!forwarded || !/\s*[^=]+=[^;]+\s*(;\s*[^=]+=[^;]+\s*)/.test(forwarded)) {
		return { host: null, proto: null, port: null };
	}
	let proto;
	let m = /proto=([^;]+)/.exec(forwarded);
	if (m) {
		proto = m[1];
	} else {
		proto = 'http';
	}
	let host;
	let port;
	m = /host=([^;]+)/.exec(forwarded);
	if (m) {
		host = m[1].split(':')[0];
		port = m[1].split(':')[1];
	} else {
		host = null;
		port = proto === 'https' ? '443' : '80';
	}
	return { host, proto, port };
}
function getXForwarded(req) {
	let xHost = req.headers['x-forwarded-host'];
	if (xHost instanceof Array) {
		xHost = xHost[0];
	}
	// eslint-disable-next-line prefer-const
	let [host, port] = (xHost && xHost.split(':')) || [];
	let xProto = req.headers['x-forwarded-proto'];
	if (xProto instanceof Array) {
		xProto = xProto[0];
	}
	let xPort = req.headers['x-forwarded-port'];
	if (xPort instanceof Array) {
		xPort = xPort[0];
	}
	if (xPort) port = xPort;
	return { host, proto: xProto || null, port };
}
function getAccessURL(req) {
	const f = getForwarded(req);
	const xf = getXForwarded(req);
	const hh = req.headers.host;
	const [h, p] = (hh && hh.split(':')) || [];
	const useProxy = !!(f.host || xf.host);
	const proto = xf.proto || f.proto || 'http';
	const host = xf.host || f.host || h || req.socket.localAddress;
	const port = xf.port || f.port || p || (useProxy ? (proto === 'https' ? '443' : '80') : req.socket.localPort + '');
	const base = proto + '://' + host + ':' + port;
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return new URL(req.url, base);
}
var OriginType;
(function (OriginType) {
	OriginType[(OriginType['PUBLIC'] = 0)] = 'PUBLIC';
	OriginType[(OriginType['ANY'] = 1)] = 'ANY';
})((OriginType = exports.OriginType || (exports.OriginType = {})));
class Context {
	constructor(req, rsp) {
		this.isWebSocket = false;
		this.req = req;
		Object.defineProperty(this, 'req', {
			writable: false,
			configurable: false,
		});
		this.rsp = rsp;
		Object.defineProperty(this, 'rsp', {
			writable: false,
			configurable: false,
		});
		const url = new URL(
			req.url || '',
			`http://${req.headers.host || req.socket.localAddress + ':' + req.socket.localPort}/`
		);
		this.url = url.href;
		this.method = (req.method || 'GET').toUpperCase();
		Object.defineProperty(this, 'method', {
			writable: false,
			configurable: false,
		});
		this.path = url.pathname;
		Object.defineProperty(this, 'path', {
			writable: false,
			configurable: false,
		});
		this.query = url.search;
		Object.defineProperty(this, 'query', {
			writable: false,
			configurable: false,
		});
		this.params = url.searchParams;
		Object.defineProperty(this, 'params', {
			writable: false,
			configurable: false,
		});
	}
	get clientIP() {
		return this.req.socket.remoteAddress;
	}
	get clientPort() {
		return this.req.socket.remotePort;
	}
	get serverIP() {
		return this.req.socket.localAddress;
	}
	get serverPort() {
		return this.req.socket.localPort;
	}
	get accessUrl() {
		return getAccessURL(this.req);
	}
	getParams(schema) {
		const param = {};
		Array.from(this.params.keys()).forEach((k) => {
			const v = this.params.getAll(k);
			param[k] = v.length === 1 ? v[0] : v;
		});
		if (schema instanceof Object && typeof schema.validate === 'function') {
			schema.validate(param);
		}
		return param;
	}
	getRequestHeader(key = null) {
		if (key) {
			return this.req.headers[key.toLowerCase()];
		} else {
			return this.req.headers;
		}
	}
	getResponseHeader(key = null) {
		if (key) {
			return this.rsp.getHeader(key.toLowerCase());
		} else {
			return this.rsp.getHeaders();
		}
	}
	setResponseHeader(key, value) {
		this.rsp.setHeader(key, value);
		return this;
	}
	enableCORS({
		allowMethods = 'HEAD,GET,POST,PUT,DELETE,OPTIONS',
		allowAnyMethods = true,
		allowHeaders = 'Content-Type,Keep-Alive,User-Agent',
		allowAnyHeaders = true,
		allowMaxAge = 600,
		allowOrigin = OriginType.ANY,
		allowCredential = true,
	} = {}) {
		let reqOrigin = this.getRequestHeader('origin');
		if (reqOrigin) {
			reqOrigin += '';
			const reqMethods = this.getRequestHeader('access-control-request-method');
			if (allowAnyMethods && reqMethods) {
				allowMethods += ',' + reqMethods;
			}
			if (allowMethods) {
				this.setResponseHeader('Access-Control-Allow-Methods', allowMethods);
			}
			const reqHeaders = this.getRequestHeader('access-control-request-headers');
			if (allowAnyHeaders && reqHeaders) {
				allowHeaders += ',' + reqHeaders;
			}
			if (allowHeaders) {
				this.setResponseHeader('Access-Control-Allow-Headers', allowHeaders);
			}
			if (allowCredential) {
				this.setResponseHeader('Access-Control-Allow-Credentials', 'true');
			}
			if (typeof allowMaxAge === 'number' && allowMaxAge > 0) {
				this.setResponseHeader('Access-Control-Max-Age', allowMaxAge);
			}
			if (allowOrigin === OriginType.ANY) {
				this.setResponseHeader('Access-Control-Allow-Origin', reqOrigin);
				this.setResponseHeader('Vary', 'Origin');
			} else if (allowOrigin === OriginType.PUBLIC) {
				this.setResponseHeader('Access-Control-Allow-Origin', '*');
			} else if (typeof allowOrigin === 'string') {
				this.setResponseHeader('Access-Control-Allow-Origin', allowOrigin);
				this.setResponseHeader('Vary', 'Origin');
			}
		}
		return this;
	}
	writeHead(statusCode, ...args) {
		if (args.length === 0) {
			this.rsp.writeHead(statusCode);
		} else if (args.length === 1) {
			this.rsp.writeHead(statusCode, args[0]);
		} else {
			this.rsp.writeHead(statusCode, args[0], args[1]);
		}
		return this;
	}
	getRequestCookies() {
		const cookies = {};
		this.req.headers.cookie &&
			this.req.headers.cookie.split(';').forEach((cookie) => {
				const eq = cookie.indexOf('=');
				if (eq >= 0) {
					cookies[cookie.substring(0, eq).trim()] = cookie.substring(eq + 1).trim();
				} else {
					cookies[''] = cookie.trim();
				}
			});
		return cookies;
	}
	supportGZip() {
		const acceptEncoding = this.req.headers['accept-encoding'];
		if (!acceptEncoding) {
			return false;
		}
		if (typeof acceptEncoding === 'string') {
			return acceptEncoding.split(',').filter((ec) => ec.trim().toLowerCase() === 'gzip').length > 0;
		} else if (acceptEncoding instanceof Array) {
			return acceptEncoding
				.map((encodeing) => encodeing.split(',').filter((ec) => ec.trim().toLowerCase() === 'gzip').length > 0)
				.includes(true);
		} else return false;
	}
	/**
	 * Set response cookie
	 * @param name Cookie name
	 * @param value Cookie value
	 * @param options Cookie options: HttpOnly, Exprie, Domain, Path
	 */
	setResponseCookie(name, value, options) {
		this.removeResponseCookie(name);
		const cookies = this.getResponseCookies();
		let cookie = name + '=' + value;
		if (options) {
			for (const k in options) {
				if (Object.prototype.hasOwnProperty.call(options, k)) {
					const v = options[k];
					cookie += '; ' + k + (v !== undefined && v !== null ? '=' + v : '');
				}
			}
		}
		cookies.push(cookie);
		this.rsp.setHeader('Set-Cookie', cookies);
		return this;
	}
	/**
	 * Remove response cookie
	 * @param name Cookie name
	 */
	removeResponseCookie(name) {
		let cookies = this.getResponseCookies();
		cookies = cookies.filter((c) => c.split(';').filter((p) => p.trim().startsWith(name + '=')).length == 0);
		this.rsp.setHeader('Set-Cookie', cookies);
		return this;
	}
	getResponseCookies() {
		const headers = this.rsp.getHeaders();
		let cookies = [];
		if (headers) {
			for (const name in headers) {
				if (/^set-cookie$/i.test(name)) {
					const values = headers[name];
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
	write(buffer) {
		return writeStream(this.rsp, buffer);
	}
	/**
	 * Send content to client
	 */
	send(data, contentType) {
		this.rsp.writeHead(200, {
			// eslint-disable-next-line prettier/prettier
			'Content-Type': contentType
				? contentType
				: typeof data === 'string'
				? 'text/plain; charset=utf-8'
				: 'application/octet-stream',
		});
		return this.end(data);
	}
	/**
	 * Send HTML content to client
	 */
	sendHtml(html) {
		return this.send(html, 'text/html; charset=utf-8');
	}
	/**
	 * Send JSON content to client
	 */
	sendJson(obj) {
		return this.send(JSON.stringify(obj), 'application/json; charset=utf-8');
	}
	/**
	 * @param {string} file File path
	 * @param {SendFileOption} options File download options
	 */
	async sendFile(file, options) {
		if (!options) {
			options = {};
		}
		if (typeof options.statusCode !== 'number' || isNaN(options.statusCode)) {
			options.statusCode = 200;
		}
		if (!options.filename) {
			options.filename = path_1.default.basename(file);
		}
		if (!/^[^/]+\/[^/]+$/.test(options.contentType || '')) {
			const ct = mime_1.default.getType(options.filename);
			options.contentType = ct || 'application/octet-stream';
		}
		const headers = options.headers || {};
		const hs = {};
		Object.keys(headers).forEach((k) => {
			const v = headers[k];
			const key = k.replace(/(?<=^|-)./g, (c) => c.toUpperCase());
			hs[key] = v;
		});
		hs['Content-Type'] = options.contentType || 'application/octet-stream';
		if (options.inline) {
			hs['Content-Disposition'] = 'inline';
		} else {
			hs['Content-Disposition'] = "attachment; filename*=utf-8''" + encodeURIComponent(options.filename);
		}
		const fd = await fs_1.promises.open(file, 'r');
		try {
			const buffer = Buffer.alloc(4096);
			if (options.gzip) {
				hs['Content-Encoding'] = 'gzip';
				hs['Transfer-Encoding'] = 'chunked';
				this.rsp.writeHead(options.statusCode, hs);
				const zstream = zlib_1.default.createGzip();
				zstream.pipe(this.rsp);
				for await (const rd of readFile(fd, buffer)) {
					// totalSize += rd.bytesRead;
					// console.log(`Read: ${rd.bytesRead}, total: ${totalSize}`);
					await writeStream(zstream, rd.buffer.slice(0, rd.bytesRead));
				}
				await flushStream(zstream);
			} else {
				this.rsp.writeHead(options.statusCode, hs);
				for await (const rd of readFile(fd, buffer)) {
					// totalSize += rd.bytesRead;
					// console.log(`Read: ${rd.bytesRead}, total: ${totalSize}`);
					await this.write(rd.buffer.slice(0, rd.bytesRead));
				}
			}
		} finally {
			await fd.close();
		}
		await this.end();
	}
	/**
	 * Send 302 redirection
	 * @param url Redirection URL
	 */
	redirect(url) {
		this.rsp.writeHead(302, {
			Location: url,
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
			'WWW-Authenticate': `Basic realm=${JSON.stringify(domain)}`,
		});
		return this.end();
	}
	/**
	 * Verify http basic authentication
	 * @param authCallback Callback handler function
	 */
	checkBasicAuth(authCallback) {
		let auth = this.getRequestHeader('authorization');
		if (auth instanceof Array) {
			auth = auth[0];
		}
		if (!auth) {
			return false;
		} else {
			auth = auth.slice(6, auth.length);
			auth = Buffer.from(auth, 'base64').toString();
			const [username] = auth.split(':');
			const password = auth.substring(username.length + 1);
			if (typeof authCallback === 'function' && authCallback(username, password)) {
				return true;
			} else {
				return false;
			}
		}
	}
	notModified() {
		this.rsp.writeHead(304, 'Not Modified');
		return this.end();
	}
	/**
	 * Send 400 bad request
	 * @param {string} message
	 */
	errorBadRequest(message = null) {
		return this.error(400, `Bad request${message ? ': ' + message : '!'}\n`);
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
	errorUnknown(message = null) {
		return this.error(500, `Unexpected server error${message ? ': ' + message : '!'}\n`);
	}
	/**
	 * Send 500 unknown error
	 * @param {number|string} code Default is 500
	 * @param {string} message Default is 'Unexpected Server Error!'
	 */
	error(code = 500, message) {
		if (typeof message === 'undefined' || message === null) {
			if (typeof code === 'number') {
				message = 'Unexpected server error!\n';
			} else if (typeof code === 'string') {
				message = code;
				code = 500;
			}
		}
		if (typeof code !== 'number') {
			code = 500;
		}
		this.rsp.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
		return this.end(message);
	}
	/**
	 * Send data to client and finish response.
	 */
	end(message = null) {
		return new Promise((resolve) => {
			function callback() {
				resolve();
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
	close(error) {
		this.req.connection.destroy(error);
	}
}
exports.default = Context;
//# sourceMappingURL=context.js.map
