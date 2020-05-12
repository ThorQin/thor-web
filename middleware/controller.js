import path from 'path';
import tools from '../utils/tools.js';

const API = {};

function loadScript(baseDir, api) {
	let p = API[api];
	if (p) {
		return p;
	}
	p = new Promise((resolve, reject) => {
		let file = baseDir + (api.endsWith('/') ? api + 'index' : api) + '.mjs';
		tools.fileStat(file).then(stat => {
			if (stat.isFile) {
				// fn = require(file);
				import(file).then(fn => {
					if (fn && (typeof fn === 'function' || typeof fn === 'object')) {
						return resolve(fn);
					} else {
						console.error('Invalid API handler: must export a function or an object');
						resolve(null);
					}
				}).catch(cause => {
					console.error(`Load module failed: ${cause}`);
					resolve(null);
				});
			} else {
				resolve(null);
			}
		}.catch(cause => {
			console.error(`stat file failed: ${cause}`);
			resolve(null);
		});
	});
	API[api] = p;
	return p;
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
		baseDir = path.resolve(tools.getRootDir(), 'controllers');
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

export default {
	create
}
