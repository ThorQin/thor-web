'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.defaultSuffix = void 0;
const fs_1 = require('fs');
const path_1 = __importDefault(require('path'));
const tools_1 = __importDefault(require('../utils/tools'));
const thor_time_1 = __importDefault(require('thor-time'));
const mime_1 = __importDefault(require('mime'));
const zlib_1 = __importDefault(require('zlib'));
function defaultSuffix() {
	const suffix = [
		'txt',
		'htm',
		'html',
		'css',
		'js',
		'json',
		'eot',
		'otf',
		'woff',
		'woff2',
		'ttf',
		'bmp',
		'gif',
		'png',
		'jpg',
		'jpeg',
		'tif',
		'tiff',
		'svg',
		'mp3',
		'mp4',
		'wav',
		'zip',
		'rar',
		'7z',
		'tar',
		'gz',
	];
	if (process.env.NODE_ENV === 'development') {
		suffix.push('map');
	}
	return suffix;
}
exports.defaultSuffix = defaultSuffix;
function getMimeType(suffix) {
	return mime_1.default.getType(suffix) || 'application/octet-stream';
}
function compressible(suffix) {
	return /^(txt|html?|css|js|json)$/.test(suffix);
}
function gzip(buffer) {
	return new Promise(function (resolve, reject) {
		zlib_1.default.gzip(buffer, function (err, result) {
			if (err) {
				reject(err);
				return;
			}
			resolve(result);
		});
	});
}
async function* readFile(fd, buffer) {
	let rd = await fd.read(buffer, 0, buffer.length);
	while (rd.bytesRead > 0) {
		yield rd;
		rd = await fd.read(buffer, 0, buffer.length);
	}
}
function flushStream(stream) {
	return new Promise((resolve) => {
		stream.flush(() => {
			resolve();
		});
	});
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
class StaticFactory {
	create(app, { baseDir, rootPath = '/', suffix, cachedFileSize = 1024 * 1024, enableGzipSize = 50 * 1024 } = {}) {
		if (!rootPath) {
			rootPath = '/';
		}
		if (!rootPath.startsWith('/')) {
			rootPath = `/${rootPath}`;
		}
		if (!rootPath.endsWith('/')) {
			rootPath = `${rootPath}/`;
		}
		if (!baseDir) {
			baseDir = path_1.default.resolve(tools_1.default.getRootDir(), 'www');
		} else if (baseDir.endsWith('/')) {
			baseDir = baseDir.substring(0, baseDir.length - 1);
		}
		let suffixSet;
		if (!suffix || !(suffix instanceof Array)) {
			suffixSet = new Set(defaultSuffix());
		} else {
			suffixSet = new Set(defaultSuffix().concat(...suffix));
		}
		const cache = new Map();
		async function loadCache(file, stat, canGzip) {
			const fd = await fs_1.promises.open(file, 'r');
			try {
				const data = await fd.readFile();
				const cacheItem = { mtime: stat.mtime, data: data, gzipData: null };
				if (stat.size >= enableGzipSize && canGzip) {
					const gziped = await gzip(data);
					cacheItem.gzipData = gziped;
				}
				return cacheItem;
			} finally {
				await fd.close();
			}
		}
		/**
		 * @param {Context} ctx
		 */
		return async function (ctx) {
			let page = ctx.path;
			if (!page.startsWith(rootPath)) {
				return false;
			}
			page = page.substring(rootPath.length - 1);
			if (page.endsWith('/')) {
				page += 'index.html';
			}
			const m = /\.([a-z0-9]+)$/i.exec(page);
			if (m) {
				if (suffixSet.has(m[1])) {
					const contentType = getMimeType(m[1]);
					const file = baseDir + page;
					const stat = await tools_1.default.fileStat(file);
					if (stat.isFile) {
						const mtime = stat.mtime;
						if (ctx.method === 'HEAD') {
							ctx.writeHead(200, {
								'Content-Type': contentType,
								'Content-Length': stat.size,
								'Cache-Control': 'no-cache',
								'Last-Modified': mtime.toUTCString(),
							});
							await ctx.end();
							return true;
						}
						if (ctx.method !== 'GET') {
							ctx.errorBadMethod();
							return true;
						}
						const modifySince = ctx.getRequestHeader('if-modified-since');
						if (typeof modifySince === 'string') {
							const lastTime = thor_time_1.default.parse(modifySince);
							if (lastTime) {
								const v = thor_time_1.default.parse(mtime.toUTCString());
								if (v && v.getTime() <= lastTime.getTime()) {
									await ctx.notModified();
									return true;
								}
							}
						}
						if (cache.has(file)) {
							let cachedFile;
							try {
								cachedFile = await cache.get(file);
							} catch (e) {
								cache.delete(file);
								throw e;
							}
							if (cachedFile.mtime && stat.mtime && cachedFile.mtime >= stat.mtime) {
								const canGzip = compressible(m[1]);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': stat.mtime.toUTCString(),
										'Content-Encoding': 'gzip',
										'Transfer-Encoding': 'chunked',
									});
									// Send Gzip Data
									await ctx.end(cachedFile.gzipData);
								} else {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': stat.mtime.toUTCString(),
									});
									await ctx.end(cachedFile.data);
								}
								return true;
							} else {
								cache.delete(file);
							}
						}
						let fd = null;
						try {
							const canGzip = compressible(m[1]);
							if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
								const promise = loadCache(file, stat, canGzip);
								cache.set(file, promise);
								const cacheItem = await promise;
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
										'Content-Encoding': 'gzip',
										'Transfer-Encoding': 'chunked',
									});
									// Send Gzip Data
									await ctx.end(cacheItem.gzipData);
								} else {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
									});
									await ctx.end(cacheItem.data);
								}
								return true;
							} else {
								fd = await fs_1.promises.open(file, 'r');
								const buffer = Buffer.alloc(4096);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									const zstream = zlib_1.default.createGzip();
									zstream.pipe(ctx.rsp);
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
										'Content-Encoding': 'gzip',
										'Transfer-Encoding': 'chunked',
									});
									for await (const rd of readFile(fd, buffer)) {
										await writeStream(zstream, rd.buffer.slice(0, rd.bytesRead));
									}
									await flushStream(zstream);
								} else {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
									});
									for await (const rd of readFile(fd, buffer)) {
										await ctx.write(rd.buffer.slice(0, rd.bytesRead));
									}
								}
								await ctx.end();
								return true;
							}
						} finally {
							if (fd) {
								await fd.close();
							}
						}
					} else {
						cache.delete(file);
					}
				}
			}
			return false;
		};
	}
}
const staticFactory = new StaticFactory();
exports.default = staticFactory;
//# sourceMappingURL=static-server.js.map
