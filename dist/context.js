import path from 'path';
import mime from 'mime';
import zlib from 'zlib';
import { promises as fs } from 'fs';
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
export default class Context {
    constructor(req, rsp) {
        this.req = req;
        this.rsp = rsp;
        let url = new URL(req.url || '', `http://${req.headers.host}/`);
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
        }
        else {
            return this.req.headers;
        }
    }
    getResponseHeader(key = null) {
        if (key) {
            return this.rsp.getHeader(key);
        }
        else {
            return this.rsp.getHeaders();
        }
    }
    setResponseHeader(key, value) {
        this.rsp.setHeader(key, value);
        return this;
    }
    writeHead(statusCode, ...args) {
        this.rsp.writeHead(statusCode, ...args);
        return this;
    }
    getRequestCookies() {
        let cookies = {};
        this.req.headers.cookie &&
            this.req.headers.cookie.split(';').forEach((cookie) => {
                let eq = cookie.indexOf('=');
                if (eq >= 0) {
                    cookies[cookie.substring(0, eq).trim()] = cookie.substring(eq + 1).trim();
                }
                else {
                    cookies[''] = cookie.trim();
                }
            });
        return cookies;
    }
    supportGZip() {
        let acceptEncoding = this.req.headers['accept-encoding'];
        if (!acceptEncoding) {
            return false;
        }
        if (typeof acceptEncoding === 'string') {
            return acceptEncoding.split(',').filter((ec) => ec.trim().toLowerCase() === 'gzip').length > 0;
        }
        else if (acceptEncoding instanceof Array) {
            return acceptEncoding
                .map((encodeing) => encodeing.split(',').filter((ec) => ec.trim().toLowerCase() === 'gzip').length > 0)
                .includes(true);
        }
    }
    /**
     * Set response cookie
     * @param name Cookie name
     * @param value Cookie value
     * @param options Cookie options: HttpOnly, Exprie, Domain, Path
     */
    setResponseCookie(name, value, options) {
        this.removeResponseCookie(name);
        let cookies = this.getResponseCookies();
        let cookie = name + '=' + value;
        if (options) {
            for (let k in options) {
                if (Object.prototype.hasOwnProperty.call(options, k)) {
                    let v = options[k];
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
                    }
                    else if (values instanceof Array) {
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
     * @param {string|Buffer} data
     */
    send(data, contentType = 'text/plain; charset=utf-8') {
        this.rsp.writeHead(200, {
            'Content-Type': contentType,
        });
        return this.end(data);
    }
    /**
     * Send HTML content to client
     * @param {string} html
     */
    sendHtml(html) {
        return this.send(html, 'text/html; charset=utf-8');
    }
    /**
     * Send JSON content to client
     * @param {any} obj
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
            options.filename = path.basename(file);
        }
        if (!/^[^/]+\/[^/]+$/.test(options.contentType || '')) {
            let ct = mime.getType(options.filename);
            options.contentType = ct || 'application/octet-stream';
        }
        let headers = options.headers || {};
        let hs = {};
        Object.keys(headers).forEach((k) => {
            let v = headers[k];
            let key = k.replace(/(?<=^|-)./g, (c) => c.toUpperCase());
            hs[key] = v;
        });
        hs['Content-Type'] = options.contentType || 'application/octet-stream';
        if (options.inline) {
            hs['Content-Disposition'] = 'inline';
        }
        else {
            hs['Content-Disposition'] = "attachment; filename*=utf-8''" + encodeURIComponent(options.filename);
        }
        let fd = await fs.open(file, 'r');
        try {
            let buffer = Buffer.alloc(4096);
            if (options.gzip) {
                hs['Content-Encoding'] = 'gzip';
                hs['Transfer-Encoding'] = 'chunked';
                this.rsp.writeHead(options.statusCode, hs);
                let zstream = zlib.createGzip();
                zstream.pipe(this.rsp);
                for await (let rd of readFile(fd, buffer)) {
                    // totalSize += rd.bytesRead;
                    // console.log(`Read: ${rd.bytesRead}, total: ${totalSize}`);
                    await writeStream(zstream, rd.buffer.slice(0, rd.bytesRead));
                }
                await flushStream(zstream);
            }
            else {
                this.rsp.writeHead(options.statusCode, hs);
                for await (let rd of readFile(fd, buffer)) {
                    // totalSize += rd.bytesRead;
                    // console.log(`Read: ${rd.bytesRead}, total: ${totalSize}`);
                    await this.write(rd.buffer.slice(0, rd.bytesRead));
                }
            }
        }
        finally {
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
        }
        else {
            auth = auth.slice(6, auth.length);
            auth = Buffer.from(auth, 'base64').toString();
            let [username] = auth.split(':');
            let password = auth.substring(username.length + 1);
            if (typeof authCallback === 'function' && authCallback(username, password)) {
                return true;
            }
            else {
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
            }
            else if (typeof code === 'string') {
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
     * @param {string|Buffer} message
     */
    end(message = null) {
        return new Promise((resolve, reject) => {
            function callback(err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            }
            if (message) {
                if (message instanceof Buffer) {
                    this.rsp.end(message, callback);
                }
                else {
                    this.rsp.end(message, 'utf-8', callback);
                }
            }
            else {
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
