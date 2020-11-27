'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = require('fs');
const path_1 = __importDefault(require('path'));
const tools_1 = __importDefault(require('../utils/tools'));
const thor_tpl_1 = require('thor-tpl');
class TemplateFactory {
	create(app, { baseDir, isDebug = false } = {}) {
		const cache = {};
		if (!baseDir) {
			baseDir = path_1.default.resolve(tools_1.default.getRootDir(), 'templates');
		}
		async function renderFile(file, data) {
			if (typeof file !== 'string') {
				throw new Error('Invalid parameter: need input file path!');
			}
			file = path_1.default.join(baseDir, file);
			const dir = path_1.default.dirname(file);
			const basename = path_1.default.basename(file);
			const jsFile = path_1.default.join(dir, basename) + '.js';
			const options = {
				fn: {
					include: async (file, data) => {
						file = (file + '').trim().replace(/\\/g, '/');
						return await renderFile(file, data);
					},
				},
				trace: (/*fn*/) => {
					if (isDebug) {
						console.log('compile template: ', jsFile);
					}
				},
			};
			let fnPromise = cache[file];
			if (fnPromise) {
				return await thor_tpl_1.renderAsync(await fnPromise, data, options);
			} else {
				if (process.env.NODE_ENV !== 'development') {
					console.log('compile template: ', file);
					fnPromise = new Promise((resolve, reject) => {
						fs_1.promises
							.readFile(file, 'utf8')
							.then((content) => {
								try {
									const fn = thor_tpl_1.compile(content, options);
									resolve(fn);
								} catch (e) {
									reject(e.message || e);
								}
							})
							.catch((cause) => {
								reject(cause);
							});
					});
					cache[file] = fnPromise;
					return await thor_tpl_1.renderAsync(await fnPromise, data, options);
				} else {
					const content = await fs_1.promises.readFile(file, 'utf8');
					return await thor_tpl_1.renderAsync(content, data, options);
				}
			}
		}
		return async function (ctx) {
			ctx.render = async function (file, data, returnText = false) {
				if (!(await tools_1.default.isFile(path_1.default.join(baseDir, file)))) {
					if (returnText) {
						throw new Error(`Template file not found! ${file}`);
					} else {
						await ctx.errorNotFound();
					}
					return;
				}
				const html = await renderFile(file, data);
				if (returnText) {
					return html;
				} else {
					await ctx.sendHtml(html);
				}
			};
			return false;
		};
	}
}
const templateFactory = new TemplateFactory();
exports.default = templateFactory;
//# sourceMappingURL=template.js.map
