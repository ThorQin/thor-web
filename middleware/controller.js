const
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
 * Create controller middleware.
 * @param {string} baseDir The root directory of the controllers.
 * @returns {(ctx, req, rsp) => boolean}
 */
function create(baseDir) {

	if (!baseDir) {
		baseDir = path.resolve(path.dirname(require.main.filename), 'controllers');
	}

	return async function (ctx, req, rsp) {
		let fn = await loadScript(baseDir, ctx.path);
		if (fn) {
			if (typeof fn !== 'function') {
				fn = fn[req.method.toLowerCase()];
			}
			if (fn) {
				await fn(ctx, req, rsp);
				if (!rsp.finished) {
					await ctx.end();
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
