const
	path = require('path'),
	tools = require('../utils/tool'),
	fs = require('fs').promises,
	tpl = require('thor-tpl');


/**
 * @typedef TemplateOptions
 * @property {string} baseDir The root directory of the controllers.
 * @property {boolean} isDebug Use debug mode
 */
/**
 * Create template render engin middleware.
 * @param {TemplateOptions} options
 * @returns {(ctx, req, rsp) => boolean}
 */
function create({baseDir = null, isDebug = false} = {}) {
	const cache = {};

	if (!baseDir) {
		baseDir = path.resolve(path.dirname(require.main.filename), 'templates');
	}

	async function renderFile(file, data) {
		if (typeof file !== 'string') {
			throw new Error('Invalid parameter: need input file path!');
		}
		file = path.join(baseDir, file);
		let dir = path.dirname(file);
		let basename = path.basename(file);
		let jsFile = path.join(dir, basename) + '.js';
		const options = {
			fn: {
				include: async (file, data) => {
					return await renderFile(dir, file, data);
				}
			},
			trace: (fn) => {
				if (isDebug) {
					console.log('compile template: ', jsFile);
				}
				if (process.env.NODE_ENV !== 'development') {
					cache[file] = fn;
				}
			}
		};
		let fn = cache[file];
		if (fn) {
			return await tpl.renderAsync(fn, data, options);
		} else {
			let content = await fs.readFile(file);
			return await tpl.renderAsync(content.toString(), data, options);
		}
	}

	return async function (ctx) {
		// eslint-disable-next-line require-atomic-updates
		ctx.render = async function(file, data) {
			if (!await tools.isFile(path.join(baseDir, file))) {
				await ctx.errorNotFound();
				return;
			}
			let html = await renderFile(file, data);
			await ctx.sendHtml(html);
		};
		return false;
	};
}

module.exports = {
	create: create
};
