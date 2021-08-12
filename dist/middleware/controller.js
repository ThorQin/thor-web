'use strict';
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				Object.defineProperty(o, k2, {
					enumerable: true,
					get: function () {
						return m[k];
					},
				});
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, 'default', { enumerable: true, value: v });
		  }
		: function (o, v) {
				o['default'] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	function (mod) {
		if (mod && mod.__esModule) return mod;
		var result = {};
		if (mod != null)
			for (var k in mod)
				if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
		__setModuleDefault(result, mod);
		return result;
	};
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.HttpError = void 0;
const path_1 = __importDefault(require('path'));
const tools_1 = __importDefault(require('../utils/tools'));
// import url from 'url';
const thor_validation_1 = require('thor-validation');
const security_1 = require('./security');
const fs_1 = __importDefault(require('fs'));
class HttpError extends Error {
	constructor(code, msg) {
		super(msg);
		this.code = code;
	}
}
exports.HttpError = HttpError;
class ControllerFactory {
	create(app, { baseDir, rootPath = '/' } = {}) {
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
			baseDir = path_1.default.resolve(tools_1.default.getRootDir(), 'controllers');
		} else {
			baseDir = path_1.default.resolve(baseDir);
		}
		if (baseDir.endsWith('/')) {
			baseDir = baseDir.substring(0, baseDir.length - 1);
		}
		const ROUTER = [];
		function loadRouter(routerDir) {
			if (!fs_1.default.existsSync(routerDir)) {
				return;
			}
			if (!fs_1.default.statSync(routerDir).isDirectory()) {
				return;
			}
			fs_1.default.readdirSync(routerDir).forEach((f) => {
				const subFile = path_1.default.resolve(routerDir, f);
				const stat = fs_1.default.statSync(subFile);
				if (stat.isDirectory()) {
					loadRouter(subFile);
				} else if (stat.isFile() && f.endsWith('.js')) {
					Promise.resolve()
						.then(() => __importStar(require(subFile)))
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
		const API = {};
		function loadScript(baseDir, api) {
			let p = API[api];
			if (p) {
				return p;
			}
			p = new Promise((resolve) => {
				const modulePath = baseDir + (api.endsWith('/') ? api + 'index' : api);
				const jsFile = modulePath + '.js';
				// const mjsFile = modulePath + '.mjs';
				tools_1.default
					.fileStat(jsFile)
					.then((stat) => {
						if (stat.isFile) {
							// const fileUrl = url.pathToFileURL(modulePath);
							// console.log(fileUrl.toString());
							// import(fileUrl.toString())
							Promise.resolve()
								.then(() => __importStar(require(modulePath)))
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
		async function runFn(page, method, fn, ctx, req, rsp) {
			try {
				const result = await fn(ctx, req, rsp);
				if (typeof result !== 'undefined') {
					await ctx.sendJson(result);
				} else if (!rsp.writableEnded) {
					await ctx.end();
				}
			} catch (e) {
				if (!rsp.writableEnded) {
					if (e && e.message === 'ERR_HTTP_HEADERS_SENT') {
						console.error(`[${method} : ${page}] `, e);
						await ctx.end();
					} else {
						if (e && e.constructor && e.constructor.name === thor_validation_1.ValidationError.name) {
							console.error(`[${method} : ${page}] `, e);
							await ctx.errorBadRequest(e.message);
						} else if (e && e.constructor && e.constructor.name === security_1.SecurityError.name) {
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
		const ROUTER_CACHE = {};
		async function runRouter(page, method, ctx, req, rsp) {
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
			if (!page.startsWith(rootPath)) {
				return false;
			}
			page = page.substring(rootPath.length - 1);
			const method = ctx.method.toLowerCase();
			const obj = await loadScript(baseDir, page);
			let fn = null;
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
exports.default = controllerFactory;
//# sourceMappingURL=controller.js.map
