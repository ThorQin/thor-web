import { promises as fs } from 'fs';
import path from 'path';
import tools from '../utils/tools.js';
import tpl from 'thor-tpl';

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
		baseDir = path.resolve(tools.getRootDir(), 'templates');
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
		ctx.render = async function(file, data, returnText = false) {
			if (!await tools.isFile(path.join(baseDir, file))) {
				if (returnText) {
					throw new Error(`Template file not found! ${file}`);
				} else {
					await ctx.errorNotFound();
				}
				return;
			}
			let html = await renderFile(file, data);
			if (returnText) {
				return html;
			} else {
				await ctx.sendHtml(html);
			}
		};
		return false;
	};
}

export default {
	create
}
