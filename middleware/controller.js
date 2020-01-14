const
	// eslint-disable-next-line no-unused-vars
	// Context = require('../context'),
	path = require('path'),
	tools = require('../utils/tool');

const API = {};
async function loadScript(baseDir, api) {
	let fn = API[api];
	if (fn) {
		return fn;
	}
	let file = baseDir + (api.endsWith('/') ? api + 'index' : api) + '.js';
	let stat = await tools.fileStat(file);
	if (stat.isFile) {
		fn = require(file);
		if (fn && (typeof fn === 'function' || typeof fn === 'object')) {
			//eslint-disable-next-line require-atomic-updates
			API[api] = fn;
			return fn;
		}
	}
	return null;
}

/**
 * @typedef ControllerOptions
 * @property {string} baseDir The root directory of the controllers.
 * @property {string} rootPath The root url path of the controllers.
 */
/**
 * Create controller middleware.
 * @param {ControllerOptions} options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
function create({baseDir, rootPath = '/'} = {}) {
	if (!rootPath) {
		rootPath = '/';
	}
	if (!rootPath.endsWith('/')) {
		rootPath += '/';
	}
	if (!baseDir) {
		baseDir = path.resolve(path.dirname(require.main.filename), 'controllers');
	} else if (baseDir.endsWith('/')) {
		baseDir = baseDir.substring(0, baseDir.length - 1);
	}

	return async function (ctx, req, rsp) {
		let page = ctx.path;
		if (!page.startsWith(rootPath)) {
			return false;
		}
		page = page.substring(rootPath.length - 1);
		let fn = await loadScript(baseDir, page);
		if (fn) {
			if (typeof fn !== 'function') {
				fn = fn[req.method.toLowerCase()];
			}
			if (fn) {
				try {
					let result = await fn(ctx, req, rsp);
					if (typeof result !== 'undefined') {
						await ctx.sendJson(result);
					} else if (!rsp.finished) {
						await ctx.end();
					}
				} catch (e) {
					if (!e || !e.handled) {
						console.error(`[${req.method} : ${page}] `, e);
						if (!rsp.finished) {
							if (e && e.message === 'ERR_HTTP_HEADERS_SENT') {
								await ctx.end();
							} else {
								if (process.env.NODE_ENV == 'prodction') {
									await ctx.error();
								} else {
									await ctx.errorUnknown(e);
								}
							}
						}
					}
				}
			} else {
				await ctx.errorBadMethod();
			}
			return true;
		} else {
			return false;
		}
	};
}

module.exports = {
	create: create
};
