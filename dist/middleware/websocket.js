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
const path_1 = __importDefault(require('path'));
const tools_1 = __importDefault(require('../utils/tools'));
const websocket_1 = require('websocket');
const http_1 = __importDefault(require('http'));
const context_1 = __importDefault(require('../context'));
const API = {};
function loadScript(baseDir, api) {
	let p = API[api];
	if (p) {
		return p;
	}
	p = new Promise((resolve) => {
		const modulePath = baseDir + (api.endsWith('/') ? api + 'index' : api);
		const jsFile = modulePath + '.js';
		// console.log(`jsFile: ${jsFile}`);
		// const mjsFile = modulePath + '.mjs';
		tools_1.default
			.fileStat(jsFile)
			.then((stat) => {
				if (stat.isFile) {
					Promise.resolve()
						.then(() => __importStar(require(modulePath)))
						.then((fn) => {
							if (fn && typeof fn === 'function') {
								return resolve(fn);
							} else if (fn && typeof fn === 'object' && typeof fn.default === 'function') {
								return resolve(fn.default);
							} else {
								console.error('Invalid WebSocket handler: must export a function');
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
async function processRequest(app, req, rsp, middlewares) {
	async function* exec(ctx, req, rsp) {
		for (const m of middlewares) {
			if (m.supportWebSocket) {
				yield m(ctx, req, rsp);
			}
		}
	}
	const ctx = new context_1.default(req, rsp);
	ctx.isWebSocket = true;
	ctx.app = app;
	try {
		for await (const result of exec(ctx, req, rsp)) {
			if (result) {
				return false;
			}
		}
		return true;
	} catch (e) {
		console.error(e);
		if (process.env.NODE_ENV == 'prodction') {
			ctx.errorUnknown();
		} else {
			ctx.errorUnknown(e);
		}
		return false;
	}
}
class WebSocketFactory {
	create(app, { baseDir, rootPath = '/', maxReceivedMessageSize } = {}) {
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
			baseDir = path_1.default.resolve(tools_1.default.getRootDir(), 'socket');
		} else {
			baseDir = path_1.default.resolve(baseDir);
		}
		if (baseDir.endsWith('/')) {
			baseDir = baseDir.substring(0, baseDir.length - 1);
		}
		if (!app.server) {
			return null;
		}
		const ws = new websocket_1.server({
			httpServer: app.server,
			maxReceivedMessageSize: maxReceivedMessageSize,
		});
		app.ws = ws;
		ws.on('request', async function (request) {
			const rsp = new http_1.default.ServerResponse(request.httpRequest);
			const result = await processRequest(app, request.httpRequest, rsp, app.middlewares);
			if (!result) {
				console.warn('WebSocket connection to ' + request.resource + ' was rejected!');
				request.reject();
				return;
			}
			let page = request.resource;
			if (!page.startsWith(rootPath)) {
				console.log(`invalid path: ${page}, should be starts with: ${rootPath}`);
				request.reject(404, 'Not Found');
				return;
			}
			page = page.substring(rootPath.length - 1);
			const fn = await loadScript(baseDir, page);
			if (typeof fn === 'function') {
				const connection = request.accept();
				fn(connection, app);
			} else {
				console.warn('WebSocket connection to ' + request.resource + ' was rejected: WS handler not found!');
				request.reject(404, 'Not Found');
			}
		});
		return null;
	}
}
const webSocketFactory = new WebSocketFactory();
exports.default = webSocketFactory;
//# sourceMappingURL=websocket.js.map
