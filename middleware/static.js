const
	// eslint-disable-next-line no-unused-vars
	// Context = require('../context'),
	path = require('path'),
	tools = require('../utils/tool'),
	mime = require('mime'),
	fs = require('fs').promises;

function defaultSuffix() {
	return [
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
		'svg',
		'mp3',
		'mp4',
		'wav',
		'zip',
		'rar'
	];
}

function getMimeType(suffix) {
	return mime.getType(suffix);
}

/**
 *
 * @param {string} baseDir Root directory of static resources.
 * @param {string} rootPath Root url path of static resource.
 * @param {string[]} suffix Which suffix can be visit as static resource.
 * @param {number} cachedFileSize File can be cached when size less this setting.
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
function create(baseDir = null, rootPath = '/', suffix = null, cachedFileSize = 1024 * 100) {
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
				let mime = getMimeType(m[1]);
				if (cache.has(file)) {
					ctx.writeHead(200, { 'Content-Type': mime});
					await ctx.end(cache.get(file));
					return true;
				} else {
					let stat = await tools.fileStat(file);
					if (stat.isFile) {
						let f;
						try {
							f = await fs.open(file);
							if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
								let data = await f.readFile();
								cache.set(file, data);
								ctx.writeHead(200, { 'Content-Type': mime});
								await ctx.end(data);
								return true;
							} else {
								ctx.writeHead(200, { 'Content-Type': mime});
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
					}
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
