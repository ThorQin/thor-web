'use strict';
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				Object.defineProperty(o, k2, {
					enumerable: true,
					get: function () {
						return m[k];
					},
				});
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, 'default', { enumerable: true, value: v });
		  }
		: function (o, v) {
				o['default'] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	function (mod) {
		if (mod && mod.__esModule) return mod;
		var result = {};
		if (mod != null)
			for (var k in mod)
				if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
		__setModuleDefault(result, mod);
		return result;
	};
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.defaultSuffix = void 0;
const fs_1 = require('fs');
const path_1 = __importDefault(require('path'));
const tools_1 = __importStar(require('../utils/tools'));
const thor_time_1 = __importDefault(require('thor-time'));
const mime_1 = __importDefault(require('mime'));
const zlib_1 = __importDefault(require('zlib'));
const stream_1 = __importDefault(require('stream'));
const util_1 = require('util');
const pipeline = (0, util_1.promisify)(stream_1.default.pipeline);
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
		'ico',
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
	return /^(txt|html?|css|js|json|xml)$/.test(suffix);
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
class StaticFactory {
	create(
		app,
		{
			baseDir,
			rootPath = '/',
			suffix,
			cachedFileSize = 1024 * 1024,
			enableGzipSize = 50 * 1024,
			mimeHeaders = {},
			fileHeaders = {},
		} = {}
	) {
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
		const zipedSizeCache = new Map();
		const fileSizeCache = new Map();
		async function loadCache(file, stat, canGzip) {
			const fd = await fs_1.promises.open(file, 'r');
			try {
				const data = await fd.readFile();
				const cacheItem = { mtime: stat.mtime?.getTime(), data: data, gzipData: null };
				if (stat.size >= enableGzipSize && canGzip) {
					const gziped = await gzip(data);
					cacheItem.gzipData = gziped;
				}
				return cacheItem;
			} finally {
				await fd.close();
			}
		}
		Object.keys(mimeHeaders).forEach((k) => {
			mimeHeaders[k] = (0, tools_1.normalizeHeaders)(mimeHeaders[k]);
		});
		Object.keys(fileHeaders).forEach((k) => {
			fileHeaders[k] = (0, tools_1.normalizeHeaders)(fileHeaders[k]);
		});
		function applyHeaders(page, contentType, outHeaders) {
			const mhs = mimeHeaders[contentType] ?? mimeHeaders['*'] ?? {};
			const fhs = fileHeaders[page] ?? {};
			return { ...mhs, ...fhs, ...outHeaders };
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
							ctx.writeHead(
								200,
								applyHeaders(page, contentType, {
									'content-type': contentType,
									'content-length': stat.size,
									'cache-control': 'no-cache',
									'last-modified': mtime.toUTCString(),
								})
							);
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
									await ctx.notModified(applyHeaders(page, contentType, {}));
									return true;
								}
							}
						}
						const cachedPromise = cache.get(file);
						if (cachedPromise) {
							let cachedFile;
							try {
								cachedFile = await cachedPromise;
							} catch (e) {
								cache.delete(file);
								throw e;
							}
							if (cachedFile.mtime && stat.mtime && cachedFile.mtime == stat.mtime.getTime()) {
								const canGzip = compressible(m[1]);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip && cachedFile.gzipData) {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': stat.mtime.toUTCString(),
											'content-encoding': 'gzip',
											'content-length': cachedFile.gzipData.byteLength,
											// 'Transfer-Encoding': 'chunked',
										})
									);
									// Send Gzip Data
									await ctx.end(cachedFile.gzipData);
								} else {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': stat.mtime.toUTCString(),
											'content-length': cachedFile.data.byteLength,
										})
									);
									await ctx.end(cachedFile.data);
								}
								return true;
							} else {
								cache.delete(file);
							}
						}
						let fileStream = null;
						try {
							const canGzip = compressible(m[1]);
							if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
								const promise = loadCache(file, stat, canGzip);
								cache.set(file, promise);
								const cacheItem = await promise;
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip && cacheItem.gzipData) {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': mtime.toUTCString(),
											'content-encoding': 'gzip',
											'content-length': cacheItem.gzipData.byteLength,
											// 'Transfer-Encoding': 'chunked',
										})
									);
									// Send Gzip Data
									await ctx.end(cacheItem.gzipData);
								} else {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': mtime.toUTCString(),
											'content-length': cacheItem.data.byteLength,
										})
									);
									await ctx.end(cacheItem.data);
								}
								return true;
							} else {
								fileStream = (0, fs_1.createReadStream)(file);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									const zstream = zlib_1.default.createGzip();
									const headers = {
										'cache-control': 'no-cache',
										'content-type': contentType,
										'last-modified': mtime.toUTCString(),
										'content-encoding': 'gzip',
									};
									const sizeInfo = zipedSizeCache.get(file);
									if (sizeInfo && sizeInfo.mtime == stat.mtime?.getTime()) {
										headers['content-length'] = sizeInfo.size;
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										await pipeline(fileStream, zstream, ctx.rsp);
									} else {
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										const sizeCounter = new tools_1.Counter();
										await pipeline(fileStream, zstream, sizeCounter, ctx.rsp);
										zipedSizeCache.set(file, { mtime: stat.mtime?.getTime(), size: sizeCounter.size });
									}
								} else {
									const headers = {
										'cache-control': 'no-cache',
										'content-type': contentType,
										'last-modified': mtime.toUTCString(),
									};
									const sizeInfo = fileSizeCache.get(file);
									if (sizeInfo && sizeInfo.mtime == stat.mtime?.getTime()) {
										headers['content-length'] = sizeInfo.size;
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										await pipeline(fileStream, ctx.rsp);
									} else {
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										const sizeCounter = new tools_1.Counter();
										await pipeline(fileStream, sizeCounter, ctx.rsp);
										fileSizeCache.set(file, { mtime: stat.mtime?.getTime(), size: sizeCounter.size });
									}
								}
								await ctx.end();
								return true;
							}
						} finally {
							if (fileStream) {
								fileStream.close();
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
