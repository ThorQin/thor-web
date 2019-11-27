const
	// eslint-disable-next-line no-unused-vars
	Context = require('../context'),
	path = require('path'),
	tools = require('../utils/tool'),
	time = require('../utils/time'),
	mime = require('mime'),
	fs = require('fs').promises;

function defaultSuffix() {
	let suffix = [
		'txt',
		'htm',
		'html',
		'css',
		'js',
		'eot',
		'otf',
		'woff',
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


/**
 * @typedef StaticOptions
 * @property {string} baseDir Root directory of static resources.
 * @property {string} rootPath Root url path of static resource.
 * @property {string[]} suffix Which suffix can be visit as static resource.
 * @property {number} cachedFileSize File can be cached when size less this setting, default is 1MB (1024 * 1024).
 */
/**
 * @param {StaticOptions} options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
function create({baseDir = null, rootPath = '/', suffix = null, cachedFileSize = 1024 * 1024} = {}) {
	if (!rootPath) {
		rootPath = '/';
	}
	if (!rootPath.endsWith('/')) {
		rootPath += '/';
	}

	if (!baseDir) {
		baseDir = path.resolve(path.dirname(require.main.filename), 'www');
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

	async function* write(f, buffer, ctx) {
		for (;;) {
			let result = await f.read(buffer, 0, 4096);
			if (result.bytesRead > 0) {
				if (result.buffer.length != result.bytesRead) {
					await ctx.write(result.buffer.slice(0, result.bytesRead));
				} else {
					await ctx.write(result.buffer);
				}
				yield result.bytesRead;
			} else {
				break;
			}
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
				let file = baseDir + page;
				let stat = await tools.fileStat(file);
				if (stat.isFile) {
					if (ctx.method === 'HEAD') {
						ctx.writeHead(200, {
							'Content-Type': mime,
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
						let lastTime = time.parseDate(modifySince);
						if (lastTime) {
							if (time.parseDate(stat.ctime.toUTCString()).getTime() <= lastTime.getTime()) {
								await ctx.notModified();
								return true;
							}
						}
					}

					let mime = getMimeType(m[1]);
					if (cache.has(file)) {
						let cachedFile = cache.get(file);
						if (cachedFile.mtime >= stat.mtime) {
							ctx.writeHead(200, {'Cache-Control':'no-cache', 'Content-Type': mime, 'Last-Modified': stat.mtime.toUTCString()});
							await ctx.end(cachedFile.data);
							return true;
						} else {
							cache.delete(file);
						}
					}

					let f;
					try {
						f = await fs.open(file);
						if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
							let data = await f.readFile();
							cache.set(file, {mtime: stat.mtime, data: data});
							ctx.writeHead(200, {'Cache-Control':'no-cache', 'Content-Type': mime, 'Last-Modified': stat.mtime.toUTCString()});
							await ctx.end(data);
							return true;
						} else {
							ctx.writeHead(200, {'Cache-Control':'no-cache', 'Content-Type': mime, 'Last-Modified': stat.mtime.toUTCString()});
							let buffer = Buffer.alloc(4096);
							for await (let _ of write(f, buffer, ctx)) {
								// console.log(`write size: ${size}`);
							}
							await ctx.end();
							return true;
						}
					} finally {
						if (f) {
							await f.close();
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

module.exports ={
	create: create,
	defaultSuffix: defaultSuffix
};
