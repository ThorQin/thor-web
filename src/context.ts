import path from 'path';
import mime from 'mime';
import zlib from 'zlib';
import stream, { Readable } from 'stream';
import http from 'http';
import { createReadStream, access, PathLike, constants } from 'fs';
import { promisify } from 'util';
import { Application, BasicBodyParser, PermissionCheck, PrivilegeCheck, Renderer, Session } from './types';
import { Schema } from 'thor-validation';
import { HttpError } from './middleware/controller';

const pipeline = promisify(stream.pipeline);
const isReadableFile = function (path: PathLike): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		access(path, constants.F_OK | constants.R_OK, (err) => {
			if (err) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
};

function writeStream(stream: stream.Writable, buffer: Buffer | string): Promise<void> {
	if (buffer.length <= 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		stream.write(buffer, () => {
			resolve();
		});
	});
}

function getForwarded(req: http.IncomingMessage): { host: string | null; proto: string | null; port: string | null } {
	const forwarded = req.headers.forwarded;
	if (!forwarded || !/\s*[^=]+=[^;]+\s*(;\s*[^=]+=[^;]+\s*)/.test(forwarded)) {
		return { host: null, proto: null, port: null };
	}
	let proto: string;
	let m = /proto=([^;]+)/.exec(forwarded);
	if (m) {
		proto = m[1];
	} else {
		proto = 'http';
	}
	let host: string | null;
	let port: string | null;
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

function getXForwarded(req: http.IncomingMessage): { host: string | null; proto: string | null; port: string | null } {
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

function getAccessURL(req: http.IncomingMessage): URL {
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
	return new URL(req.url!, base);
}

export type SendFileOption = {
	statusCode?: number;
	contentType?: string;
	headers?: { [key: string]: string };
	filename?: string;
	inline?: boolean;
	gzip?: boolean;
};

export enum OriginType {
	PUBLIC,
	ANY,
}

export type CORSOptions = {
	/**
	 * 允许的跨站 http headers, 多个用逗号隔开
	 */
	allowHeaders?: string;
	/**
	 * 允许前端请求的任何 headers
	 */
	allowAnyHeaders?: boolean;
	/**
	 * 允许的跨站 http 方法, 多个用逗号隔开
	 */
	allowMethods?: string;
	/**
	 * 允许前端请求的任何 http 方法
	 */
	allowAnyMethods?: boolean;
	/**
	 * 本次跨站请求策略持续时间，默认：600 秒
	 */
	allowMaxAge?: number;
	/**
	 * 允许的发起源
	 */
	allowOrigin?: OriginType | string;
	/**
	 * 是否允许携带认证信息
	 */
	allowCredential?: boolean;
};

export default class Context {
	readonly req: http.IncomingMessage;
	readonly rsp: http.ServerResponse;
	readonly url: string;
	/**
	 * In upper case
	 */
	readonly method: string;
	readonly path: string;
	readonly query: string;
	readonly params: URLSearchParams;
	app?: Application;
	body?: BasicBodyParser;
	session?: Session;
	checkPrivilege?: PrivilegeCheck;
	checkPermission?: PermissionCheck;
	render?: Renderer;
	isWebSocket = false;

	constructor(req: http.IncomingMessage, rsp: http.ServerResponse) {
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

	get clientIP(): string | undefined {
		return this.req.socket.remoteAddress;
	}

	get clientPort(): number | undefined {
		return this.req.socket.remotePort;
	}

	get serverIP(): string | undefined {
		return this.req.socket.localAddress;
	}

	get serverPort(): number | undefined {
		return this.req.socket.localPort;
	}

	get accessUrl(): URL {
		return getAccessURL(this.req);
	}

	getParams(schema?: Schema): unknown {
		const param: { [key: string]: string | string[] } = {};
		Array.from(this.params.keys()).forEach((k) => {
			const v = this.params.getAll(k);
			param[k] = v.length === 1 ? v[0] : v;
		});
		if (schema instanceof Object && typeof schema.validate === 'function') {
			schema.validate(param);
		}
		return param;
	}

	getRequestHeader(key: string | null = null): string | http.IncomingHttpHeaders | string[] | undefined {
		if (key) {
			return this.req.headers[key.toLowerCase()];
		} else {
			return this.req.headers;
		}
	}

	getResponseHeader(key: string | null = null): string | number | string[] | http.OutgoingHttpHeaders | undefined {
		if (key) {
			return this.rsp.getHeader(key.toLowerCase());
		} else {
			return this.rsp.getHeaders();
		}
	}

	setResponseHeader(key: string, value: string | number | readonly string[]): this {
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
	}: CORSOptions = {}): this {
		let reqOrigin = this.getRequestHeader('origin') as string | null;
		if (reqOrigin) {
			reqOrigin += '';
			const reqMethods = this.getRequestHeader('access-control-request-method') as string | null;
			if (allowAnyMethods && reqMethods) {
				allowMethods += ',' + reqMethods;
			}
			if (allowMethods) {
				this.setResponseHeader('Access-Control-Allow-Methods', allowMethods);
			}
			const reqHeaders = this.getRequestHeader('access-control-request-headers') as string | string[] | null;
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

	writeHead(statusCode: number, reasonPhrase?: string, headers?: http.OutgoingHttpHeaders): this;
	writeHead(statusCode: number, headers?: http.OutgoingHttpHeaders): this;
	writeHead(statusCode: number, ...args: unknown[]): this {
		if (args.length === 0) {
			this.rsp.writeHead(statusCode);
		} else if (args.length === 1) {
			this.rsp.writeHead(statusCode, args[0] as http.OutgoingHttpHeaders);
		} else {
			this.rsp.writeHead(statusCode, args[0] as string, args[1] as http.OutgoingHttpHeaders);
		}
		return this;
	}

	getRequestCookies(): { [idx: string]: string } {
		const cookies: { [idx: string]: string } = {};
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

	supportGZip(): boolean {
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
	setResponseCookie(name: string, value: string, options: { [key: string]: string | number | null }): this {
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
	removeResponseCookie(name: string): this {
		let cookies = this.getResponseCookies();
		cookies = cookies.filter((c) => c.split(';').filter((p) => p.trim().startsWith(name + '=')).length == 0);
		this.rsp.setHeader('Set-Cookie', cookies);
		return this;
	}

	getResponseCookies(): string[] {
		const headers = this.rsp.getHeaders();
		let cookies: string[] = [];
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

	write(buffer: string | Buffer): Promise<void> {
		return writeStream(this.rsp, buffer);
	}

	/**
	 * Send content to client
	 */
	send(data: string | Buffer, contentType?: string): Promise<void> {
		const options: http.OutgoingHttpHeaders = {};
		if (!this.rsp.hasHeader('content-type')) {
			// eslint-disable-next-line prettier/prettier
			options['Content-Type'] = contentType ? contentType : typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/octet-stream';
		}
		this.rsp.writeHead(200, options);
		return this.end(data);
	}

	/**
	 * Send HTML content to client
	 */
	sendHtml(html: string): Promise<void> {
		return this.send(html, 'text/html; charset=utf-8');
	}

	/**
	 * Send JSON content to client
	 */
	sendJson(obj: unknown): Promise<void> {
		return this.send(JSON.stringify(obj), 'application/json; charset=utf-8');
	}

	/** Send file content to client
	 * @param {string | NodeJS.ReadableStream | Buffer} file File path
	 * @param {SendFileOption} options File download options
	 */
	async sendFile(file: string | NodeJS.ReadableStream | Buffer, options: SendFileOption): Promise<void> {
		if (!options) {
			options = {};
		}
		if (typeof options.statusCode !== 'number' || isNaN(options.statusCode)) {
			options.statusCode = 200;
		}
		if (!options.filename) {
			options.filename =
				typeof file === 'string'
					? path.basename(file)
					: `data.${mime.getExtension(options.contentType || 'application/octet-stream') ?? 'bin'}`;
		}
		if (!/^[^/]+\/[^/]+$/.test(options.contentType || '')) {
			const ct = mime.getType(options.filename);
			options.contentType = ct || 'application/octet-stream';
		}
		const headers = options.headers || {};
		const hs: { [key: string]: string } = {};
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
		hs['Transfer-Encoding'] = 'chunked';

		let fileStream: NodeJS.ReadableStream;
		if (typeof file === 'string') {
			if (!(await isReadableFile(file))) {
				throw new HttpError(404, 'File not found');
			}
			fileStream = createReadStream(file);
		} else if (file instanceof Readable) {
			fileStream = file;
		} else if (file instanceof Buffer) {
			fileStream = Readable.from(file);
		} else {
			throw new HttpError(404, 'Invalid parameters: only file path, readable stream and a buffer are accepted!');
		}
		try {
			if (options.gzip) {
				hs['Content-Encoding'] = 'gzip';
				this.rsp.writeHead(options.statusCode, hs);
				const zstream = zlib.createGzip();
				await pipeline(fileStream, zstream, this.rsp);
			} else {
				this.rsp.writeHead(options.statusCode, hs);
				await pipeline(fileStream, this.rsp);
			}
		} finally {
			await this.end();
		}
	}

	/**
	 * Send 302 redirection
	 * @param url Redirection URL
	 */
	redirect(url: string): Promise<void> {
		this.rsp.writeHead(302, {
			Location: url,
		});
		return this.end();
	}

	/**
	 * Send 401 need authentication
	 * @param {string} domain Http basic authentication domain name
	 */
	needBasicAuth(domain: string): Promise<void> {
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
	checkBasicAuth(authCallback: (username: string, password: string) => boolean): boolean {
		let auth = this.getRequestHeader('authorization');
		if (auth instanceof Array) {
			auth = auth[0];
		}
		if (!auth) {
			return false;
		} else {
			auth = (auth as string).slice(6, (auth as string).length);
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

	notModified(): Promise<void> {
		this.rsp.writeHead(304, 'Not Modified');
		return this.end();
	}

	/**
	 * Send 400 bad request
	 * @param {string} message
	 */
	errorBadRequest(message = null): Promise<void> {
		return this.error(400, `Bad request${message ? ': ' + message : '!'}\n`);
	}

	/**
	 * Send 401 need authenticate
	 */
	errorNeedAuth(): Promise<void> {
		return this.error(401, 'Need authentication!\n');
	}

	/**
	 * Send 401 Authenticate failed
	 */
	errorAuthFailed(): Promise<void> {
		return this.error(401, 'Authenticate failed!\n');
	}

	/**
	 * Send 403 forbidden
	 */
	errorForbidden(): Promise<void> {
		return this.error(403, 'Forbidden!\n');
	}

	/**
	 * Send 404 not found
	 */
	errorNotFound(): Promise<void> {
		return this.error(404, 'Not found!\n');
	}

	/**
	 * Send 405 bad method
	 */
	errorBadMethod(): Promise<void> {
		return this.error(405, 'Method not allowed!\n');
	}

	errorTooLarge(): Promise<void> {
		return this.error(413, 'Request entity too large!\n');
	}

	/**
	 * Send 500 unknown error
	 * @param {string} message Error message
	 */
	errorUnknown(message = null): Promise<void> {
		return this.error(500, `Unexpected server error${message ? ': ' + message : '!'}\n`);
	}

	/**
	 * Send 500 unknown error
	 * @param {number|string} code Default is 500
	 * @param {string} message Default is 'Unexpected Server Error!'
	 */
	error(code = 500, message?: string): Promise<void> {
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
		if (!this.rsp.headersSent) {
			this.rsp.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
		}
		return this.end(message);
	}

	/**
	 * Send data to client and finish response.
	 */
	end(message: string | Buffer | null = null): Promise<void> {
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
	close(error?: Error): void {
		this.req.socket.destroy(error);
	}
}
