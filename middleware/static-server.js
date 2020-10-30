/**
 * @typedef {import('../context').default} Context
 */
import {promises as fs} from 'fs';
import path from 'path';
import tools from '../utils/tools.js';
import time from 'thor-time';
import mime from 'mime';
import zlib from 'zlib';

function defaultSuffix() {
	let suffix = [
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
		'7z'
	];
	if (process.env.NODE_ENV === 'development') {
		suffix.push('map');
	}
	return suffix;
}

function getMimeType(suffix) {
	return mime.getType(suffix);
}

function compressible(suffix) {
	return /^(txt|html?|css|js|json)$/.test(suffix);
}

function gzip(buffer) {
	return new Promise(function (resolve, reject) {
		zlib.gzip(buffer, function(err, result) {
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
	return new Promise( (resolve) => {
		stream.write(buffer, () => {
			resolve();
		});
	});
}



/**
 * @typedef StaticOptions
 * @property {string} baseDir Root directory of static resources.
 * @property {string} rootPath Root url path of static resource.
 * @property {string[]} suffix Which suffix can be visit as static resource.
 * @property {number} cachedFileSize File can be cached when size less this setting, default is 1MB (1024 * 1024).
 * @property {number} enableGzipSize File can be gziped when size larger then this setting, default is 50K (50 * 1024)
 */
/**
 *
 * @param {StaticOptions} options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
function create({baseDir = null, rootPath = '/', suffix = null, cachedFileSize = 1024 * 1024, enableGzipSize = 50 * 1024} = {}) {
	if (!rootPath) {
		rootPath = '/';
	}
	if (!rootPath.endsWith('/')) {
		rootPath += '/';
	}

	if (!baseDir) {
		baseDir = path.resolve(tools.getRootDir(), 'www');
	} else if (baseDir.endsWith('/')) {
		baseDir = baseDir.substring(0, baseDir.length - 1);
	}

	let suffixSet;
	if (!suffix || !(suffix instanceof Array)) {
		suffixSet = new Set(defaultSuffix());
	} else {
		suffixSet = new Set(defaultSuffix().concat(...suffix));
	}
	let cache = new Map();

	/**
	 *
	 * @param {string} file Filename
	 * @param {{isFile: false, size: 0, mtime: null, ctime: null}} stat File stat info
	 * @param {boolean} canGzip
	 */
	async function loadCache(file, stat, canGzip) {
		let fd = await fs.open(file);
		try {
			let data = await fd.readFile();
			let cacheItem = {mtime: stat.mtime, data: data, gzipData: null};
			if (stat.size >= enableGzipSize && canGzip) {
				let gziped = await gzip(data);
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
		let m = /\.([a-z0-9]+)$/i.exec(page);
		if (m) {
			if (suffixSet.has(m[1])) {
				let contentType = getMimeType(m[1]);
				let file = baseDir + page;
				let stat = await tools.fileStat(file);
				if (stat.isFile) {
					if (ctx.method === 'HEAD') {
						ctx.writeHead(200, {
							'Content-Type': contentType,
							'Content-Length': stat.size,
							'Cache-Control':'no-cache',
							'Last-Modified': stat.mtime.toUTCString()
						});
						await ctx.end();
						return true;
					}

					if (ctx.method !== 'GET') {
						ctx.errorBadMethod();
						return true;
					}

					let modifySince = ctx.getRequestHeader('if-modified-since');
					if (modifySince) {
						let lastTime = time.parse(modifySince);
						if (lastTime) {
							if (time.parse(stat.mtime.toUTCString()).getTime() <= lastTime.getTime()) {
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
						if (cachedFile.mtime >= stat.mtime) {
							let canGzip = compressible(m[1]);
							if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
								ctx.writeHead(200, {
									'Cache-Control':'no-cache',
									'Content-Type': contentType,
									'Last-Modified': stat.mtime.toUTCString(),
									'Content-Encoding': 'gzip',
									'Transfer-Encoding': 'chunked'
								});
								// Send Gzip Data
								await ctx.end(cachedFile.gzipData);
							} else {
								ctx.writeHead(200, {'Cache-Control':'no-cache', 'Content-Type': contentType, 'Last-Modified': stat.mtime.toUTCString()});
								await ctx.end(cachedFile.data);
							}
							return true;
						} else {
							cache.delete(file);
						}
					}

					let fd = null;
					try {
						let canGzip = compressible(m[1]);
						if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
							let promise = loadCache(file, stat, canGzip);
							cache.set(file, promise);
							let cacheItem = await promise;
							if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
								ctx.writeHead(200, {
									'Cache-Control':'no-cache',
									'Content-Type': contentType,
									'Last-Modified': stat.mtime.toUTCString(),
									'Content-Encoding': 'gzip',
									'Transfer-Encoding': 'chunked'
								});
								// Send Gzip Data
								await ctx.end(cacheItem.gzipData);
							} else {
								ctx.writeHead(200, {'Cache-Control':'no-cache', 'Content-Type': contentType, 'Last-Modified': stat.mtime.toUTCString()});
								await ctx.end(cacheItem.data);
							}
							return true;
						} else {
							fd = await fs.open(file);
							let buffer = Buffer.alloc(4096);
							if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
								let zstream = zlib.createGzip();
								zstream.pipe(ctx.rsp);
								ctx.writeHead(200, {
									'Cache-Control':'no-cache',
									'Content-Type': contentType,
									'Last-Modified': stat.mtime.toUTCString(),
									'Content-Encoding': 'gzip',
									'Transfer-Encoding': 'chunked'
								});

								for await (let rd of readFile(fd, buffer)) {
									await writeStream(zstream, rd.buffer.slice(0, rd.bytesRead));
								}
								await flushStream(zstream);
							} else {
								ctx.writeHead(200, {'Cache-Control':'no-cache', 'Content-Type': contentType, 'Last-Modified': stat.mtime.toUTCString()});
								for await (let rd of readFile(fd, buffer)) {
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

export default {
	create, defaultSuffix
};
