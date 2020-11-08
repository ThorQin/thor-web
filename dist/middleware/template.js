/**
 * @typedef {import('../context').default} Context
 */
import { promises as fs } from 'fs';
import path from 'path';
import tools from '../utils/tools.js';
import { renderAsync, compile } from 'thor-tpl';
class TemplateFactory {
	create({ baseDir, isDebug = false } = {}) {
		const cache = {};
		if (!baseDir) {
			baseDir = path.resolve(tools.getRootDir(), 'templates');
		}
		async function renderFile(file, data) {
			if (typeof file !== 'string') {
				throw new Error('Invalid parameter: need input file path!');
			}
			file = path.join(baseDir, file);
			const dir = path.dirname(file);
			const basename = path.basename(file);
			const jsFile = path.join(dir, basename) + '.js';
			const options = {
				fn: {
					include: async (file, data) => {
						file = (file + '').trim().replace(/\\/g, '/');
						if (file.startsWith('/')) {
							return await renderFile(file, data);
						} else {
							file = path.join(dir, file);
							return await renderFile(file, data);
						}
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
				return await renderAsync(await fnPromise, data, options);
			} else {
				if (process.env.NODE_ENV !== 'development') {
					console.log('compile template: ', file);
					fnPromise = new Promise((resolve, reject) => {
						fs.readFile(file, 'utf8')
							.then((content) => {
								try {
									const fn = compile(content, options);
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
					return await renderAsync(await fnPromise, data, options);
				} else {
					const content = await fs.readFile(file, 'utf8');
					return await renderAsync(content, data, options);
				}
			}
		}
		return async function (ctx) {
			ctx.render = async function (file, data, returnText = false) {
				if (!(await tools.isFile(path.join(baseDir, file)))) {
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
export default templateFactory;
