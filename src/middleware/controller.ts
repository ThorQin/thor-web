import path from 'path';
import tools from '../utils/tools';
// import url from 'url';
import { ValidationError } from 'thor-validation';
import { SecurityError } from './security';
import { Controller, Middleware, MiddlewareFactory } from '../types';

type ScriptDefinition = Controller | { [key: string]: Controller } | null;

const API: { [key: string]: Promise<ScriptDefinition> } = {};

function loadScript(baseDir: string, api: string): Promise<ScriptDefinition> {
	let p = API[api];
	if (p) {
		return p;
	}
	p = new Promise((resolve) => {
		const modulePath = baseDir + (api.endsWith('/') ? api + 'index' : api);
		const jsFile = modulePath + '.js';
		// const mjsFile = modulePath + '.mjs';
		tools
			.fileStat(jsFile)
			.then((stat) => {
				if (stat.isFile) {
					// const fileUrl = url.pathToFileURL(modulePath);
					// console.log(fileUrl.toString());
					// import(fileUrl.toString())
					import(modulePath)
						.then((fn) => {
							if (fn && (typeof fn === 'function' || typeof fn === 'object')) {
								return resolve(fn);
							} else {
								console.error('Invalid API handler: must export a function or an object');
								resolve(null);
							}
						})
						.catch((cause) => {
							console.error(`Load module failed: ${cause}`);
							resolve(null);
						});
				} else {
					resolve(null);
				}
			})
			.catch((cause) => {
				console.error(`stat file failed: ${cause}`);
				resolve(null);
			});
	});
	if (process.env.NODE_ENV !== 'development') {
		API[api] = p;
	}
	return p;
}

export type ControllerCreateOptions = {
	baseDir?: string;
	rootPath?: string;
};

class ControllerFactory implements MiddlewareFactory {
	create({ baseDir, rootPath = '/' }: ControllerCreateOptions = {}): Middleware {
		if (!rootPath) {
			rootPath = '/';
		}
		if (!rootPath.startsWith('/')) {
			rootPath = `/${rootPath}`;
		}
		if (!rootPath.endsWith('/')) {
			rootPath = `${rootPath}/`;
		}
		if (!baseDir) {
			baseDir = path.resolve(tools.getRootDir(), 'controllers');
		} else {
			baseDir = path.resolve(baseDir);
		}
		if (baseDir.endsWith('/')) {
			baseDir = baseDir.substring(0, baseDir.length - 1);
		}
		return async function (ctx, req, rsp) {
			let page = ctx.path;
			if (!page.startsWith(rootPath)) {
				return false;
			}
			page = page.substring(rootPath.length - 1);
			let fn = await loadScript(baseDir as string, page);
			if (fn) {
				if (typeof fn !== 'function') {
					fn = fn[ctx.method.toLowerCase()];
				}
				if (fn) {
					try {
						const result = await fn(ctx, req, rsp);
						if (typeof result !== 'undefined') {
							await ctx.sendJson(result);
						} else if (!rsp.writableEnded) {
							await ctx.end();
						}
					} catch (e) {
						if (!e || !e.handled) {
							console.error(`[${req.method} : ${page}] `, e);
							if (!rsp.writableEnded) {
								if (e && e.message === 'ERR_HTTP_HEADERS_SENT') {
									await ctx.end();
								} else {
									if (e && e.constructor && e.constructor.name === ValidationError.name) {
										await ctx.errorBadRequest(e.message);
									} else if (e && e.constructor && e.constructor.name === SecurityError.name) {
										await ctx.error(403, e.message);
									} else if (process.env.NODE_ENV == 'prodction') {
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
				console.log(`> Execute handler: ${ctx.path} -> ${page}`);
				return true;
			} else {
				return false;
			}
		};
	}
}

const controllerFactory = new ControllerFactory();
export default controllerFactory;
