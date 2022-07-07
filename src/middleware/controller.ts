/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import tools from '../utils/tools';
import { ValidationError } from 'thor-validation';
import { SecurityError } from './security';
import { Application, Controller, RouterDef, Middleware, MiddlewareFactory } from '../types';
import fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import Context from '../context';
import { ApiEntry, ApiFolder, loadApi, renderDoc } from './docs';
import staticFactory from './static-server';

type ScriptDefinition = Controller | { [key: string]: Controller } | null;

export class HttpError extends Error {
	code: number;
	constructor(code: number, msg: string) {
		super(msg);
		this.code = code;
	}
}

export type ControllerType = Controller | { [key: string]: Controller };

export type ControllerCreateOptions = {
	baseDir?: string;
	rootPath?: string;
	controllers?: Record<string, ControllerType>;
	routers?: RouterDef[];
	apiDocPath?: string;
};

class ControllerFactory implements MiddlewareFactory<ControllerCreateOptions> {
	create(
		app: Application,
		{ baseDir, rootPath = '/', controllers, routers, apiDocPath }: ControllerCreateOptions = {}
	): Middleware {
		if (!rootPath) {
			rootPath = '/';
		}
		if (apiDocPath && apiDocPath.endsWith('/')) {
			apiDocPath = apiDocPath.substring(0, apiDocPath.length - 1);
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

		const ROUTER: RouterDef[] = [];
		function loadRouter(routerDir: string) {
			if (!fs.existsSync(routerDir)) {
				return;
			}
			if (!fs.statSync(routerDir).isDirectory()) {
				return;
			}
			fs.readdirSync(routerDir).forEach((f) => {
				const subFile = path.resolve(routerDir, f);
				const stat = fs.statSync(subFile);
				if (stat.isDirectory()) {
					loadRouter(subFile);
				} else if (stat.isFile() && f.endsWith('.js')) {
					import(subFile)
						.then((obj) => {
							if (obj.path instanceof RegExp) {
								['post', 'get', 'head', 'put', 'delete', 'options', 'trace', 'patch', 'default'].forEach((m) => {
									if (typeof obj[m] === 'function') {
										ROUTER.push({
											path: obj.path,
											method: m === 'default' ? null : m,
											fn: obj[m],
											cacheable: !!obj.cacheable,
										});
									}
								});
							}
						})
						.catch((cause) => {
							console.error(`Load module '${subFile}' failed: ${cause}`);
						});
				}
			});
		}
		loadRouter(baseDir + '.d');
		if (Array.isArray(routers)) {
			ROUTER.splice(0, 0, ...routers);
		}

		const API: { [key: string]: Promise<ScriptDefinition> } = {};
		if (controllers) {
			Object.entries(controllers).forEach(([k, v]) => {
				API[k] = Promise.resolve(v);
			});
		}
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

		let docs: (ApiFolder | ApiEntry)[];
		let docServer: Middleware;
		if (apiDocPath) {
			docs = loadApi(baseDir, rootPath);
			docServer = staticFactory.create(app, {
				baseDir: path.normalize(__dirname + '/../../html'),
				rootPath: apiDocPath,
			});
		}

		async function runFn(
			page: string,
			method: string,
			fn: Controller,
			ctx: Context,
			req: IncomingMessage,
			rsp: ServerResponse
		) {
			try {
				const result = await fn(ctx, req, rsp);
				if (typeof result !== 'undefined') {
					await ctx.sendJson(result);
				} else if (!rsp.writableEnded) {
					await ctx.end();
				}
			} catch (e: any) {
				if (!rsp.writableEnded) {
					if (e && e.message === 'ERR_HTTP_HEADERS_SENT') {
						console.error(`[${method} : ${page}] `, e);
						await ctx.end();
					} else {
						if (e && e.constructor && e.constructor.name === ValidationError.name) {
							console.error(`[${method} : ${page}] `, e);
							await ctx.errorBadRequest(e.message);
						} else if (e && e.constructor && e.constructor.name === SecurityError.name) {
							console.error(`[${method} : ${page}] `, e);
							await ctx.error(403, e.message);
						} else if (e && e.constructor && e.constructor.name === HttpError.name) {
							console.error(`[${method} : ${page}] `, e);
							await ctx.error(e.code, e.message);
						} else if (process.env.NODE_ENV !== 'development') {
							console.error(`[${method} : ${page}] `, e);
							await ctx.error();
						} else {
							console.error(`[${method} : ${page}] `, e);
							await ctx.errorUnknown(e);
						}
					}
				} else {
					console.error(`[${method} : ${page}] `, e);
				}
			}
		}

		const ROUTER_CACHE: { [key: string]: Controller } = {};

		async function runRouter(
			page: string,
			method: string,
			ctx: Context,
			req: IncomingMessage,
			rsp: ServerResponse
		): Promise<boolean> {
			const key = method + ':' + page;
			const fn = ROUTER_CACHE[key];
			if (typeof fn === 'function') {
				await runFn(page, method, fn, ctx, req, rsp);
				return true;
			}
			let findPath = false;
			for (let i = 0; i < ROUTER.length; i++) {
				const r = ROUTER[i];
				if (r.path.test(page)) {
					findPath = true;
					if (r.method === method || !r.method) {
						if (r.cacheable) {
							ROUTER_CACHE[key] = r.fn;
						}
						await runFn(page, method, r.fn, ctx, req, rsp);
						return true;
					}
				}
			}
			if (findPath) {
				await ctx.errorBadMethod();
				return true;
			} else {
				return false;
			}
		}

		return async function (ctx, req, rsp) {
			let page = ctx.path;
			if (docs && apiDocPath && (page === apiDocPath || page.startsWith(apiDocPath + '/'))) {
				await renderDoc(ctx, docs, docServer, apiDocPath);
				return true;
			}
			if (!page.startsWith(rootPath)) {
				return false;
			}
			page = page.substring(rootPath.length - 1);
			const method = ctx.method.toLowerCase();
			const obj = await loadScript(baseDir as string, page);
			let fn: Controller | null = null;
			if (obj) {
				if (typeof obj !== 'function') {
					fn = obj[method];
					if (typeof fn !== 'function') {
						fn = obj['default'];
					}
				} else {
					fn = obj;
				}
				if (typeof fn === 'function') {
					await runFn(page, method, fn, ctx, req, rsp);
				} else {
					if (!(await runRouter(page, method, ctx, req, rsp))) {
						await ctx.errorBadMethod();
					}
				}
				return true;
			} else {
				if (await runRouter(page, method, ctx, req, rsp)) {
					return true;
				} else {
					return false;
				}
			}
		};
	}
}

const controllerFactory = new ControllerFactory();
export default controllerFactory;
