import path from 'path';
import mime from 'mime';
import zlib from 'zlib';
import stream from 'stream';
import http from 'http';
import { promises as fs } from 'fs';
import { Application, BasicBodyParser, Renderer, Session } from './types';

async function* readFile(fd: fs.FileHandle, buffer: Buffer) {
	let rd = await fd.read(buffer, 0, buffer.length);
	while (rd.bytesRead > 0) {
		yield rd;
		rd = await fd.read(buffer, 0, buffer.length);
	}
}

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

function flushStream(stream: zlib.Gzip) {
	return new Promise((resolve) => {
		stream.flush(() => {
			resolve();
		});
	});
}

type SendFileOption = {
	statusCode?: number;
	contentType?: string;
	headers?: { [key: string]: string };
	filename?: string;
	inline?: boolean;
	gzip?: boolean;
};

interface PrivilegeHandler {
	(action: string, resource: string, resourceId: string, account: string): void;
}

export default class Context {
	req: http.IncomingMessage;
	rsp: http.ServerResponse;
	url: string;
	ip?: string;
	method: string;
	path: string;
	query: string;
	params: URLSearchParams;
	app?: Application;
	body?: BasicBodyParser;
	session?: Session;
	checkPrivilege?: PrivilegeHandler;
	render?: Renderer;

	constructor(req: http.IncomingMessage, rsp: http.ServerResponse) {
		this.req = req;
		this.rsp = rsp;
		const url = new URL(req.url || '', `http://${req.headers.host}/`);
		this.url = url.href;
		this.ip = req.connection.remoteAddress;
		this.method = req.method || 'GET';
		this.path = url.pathname;
		this.query = url.search;
		this.params = url.searchParams;
	}

	getRequestHeader(key: string | null = null): string | http.IncomingHttpHeaders | string[] | undefined {
		if (key) {
			return this.req.headers[key];
		} else {
			return this.req.headers;
		}
	}

	getResponseHeader(key: string | null = null): string | number | string[] | http.OutgoingHttpHeaders | undefined {
		if (key) {
			return this.rsp.getHeader(key);
		} else {
			return this.rsp.getHeaders();
		}
	}

	setResponseHeader(key: string, value: string | number | readonly string[]): this {
		this.rsp.setHeader(key, value);
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
	send(data: string | Buffer, contentType = 'text/plain; charset=utf-8'): Promise<void> {
		this.rsp.writeHead(200, {
			'Content-Type': contentType,
		});
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

	/**
	 * @param {string} file File path
	 * @param {SendFileOption} options File download options
	 */
	async sendFile(file: string, options: SendFileOption): Promise<void> {
		if (!options) {
			options = {};
		}
		if (typeof options.statusCode !== 'number' || isNaN(options.statusCode)) {
			options.statusCode = 200;
		}
		if (!options.filename) {
			options.filename = path.basename(file);
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

		const fd = await fs.open(file, 'r');
		try {
			const buffer = Buffer.alloc(4096);
			if (options.gzip) {
				hs['Content-Encoding'] = 'gzip';
				hs['Transfer-Encoding'] = 'chunked';
				this.rsp.writeHead(options.statusCode, hs);
				const zstream = zlib.createGzip();
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
		this.rsp.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
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
		this.req.connection.destroy(error);
	}
}
