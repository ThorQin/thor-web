import path from 'path';
import tools from '../utils/tools';
import { Application, SocketHandler, Middleware, MiddlewareFactory } from '../types';
import { server as WebSocketServer } from 'websocket';
import http from 'http';
import Context from '../context';

type ScriptDefinition = SocketHandler | null;

const API: { [key: string]: Promise<ScriptDefinition> } = {};

function loadScript(baseDir: string, api: string): Promise<ScriptDefinition> {
	let p = API[api];
	if (p) {
		return p;
	}
	p = new Promise((resolve) => {
		const modulePath = baseDir + (api.endsWith('/') ? api + 'index' : api);
		const jsFile = modulePath + '.js';
		// console.log(`jsFile: ${jsFile}`);
		// const mjsFile = modulePath + '.mjs';
		tools
			.fileStat(jsFile)
			.then((stat) => {
				if (stat.isFile) {
					import(modulePath)
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

async function processRequest(
	app: Application,
	req: http.IncomingMessage,
	rsp: http.ServerResponse,
	middlewares: Middleware[]
) {
	async function* exec(ctx: Context, req: http.IncomingMessage, rsp: http.ServerResponse) {
		for (const m of middlewares) {
			if (m.supportWebSocket) {
				yield m(ctx, req, rsp);
			}
		}
	}
	const ctx = new Context(req, rsp);
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

export type WebSocketCreateOptions = {
	baseDir?: string;
	rootPath?: string;
	maxReceivedMessageSize?: number;
};

class WebSocketFactory implements MiddlewareFactory<WebSocketCreateOptions> {
	create(
		app: Application,
		{ baseDir, rootPath = '/', maxReceivedMessageSize }: WebSocketCreateOptions = {}
	): Middleware | null {
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
			baseDir = path.resolve(tools.getRootDir(), 'socket');
		} else {
			baseDir = path.resolve(baseDir);
		}
		if (baseDir.endsWith('/')) {
			baseDir = baseDir.substring(0, baseDir.length - 1);
		}
		if (!app.server) {
			return null;
		}

		const ws = new WebSocketServer({
			httpServer: app.server,
			maxReceivedMessageSize: maxReceivedMessageSize,
		});
		app.ws = ws;
		ws.on('request', async function (request) {
			const rsp = new http.ServerResponse(request.httpRequest);
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
			const fn = await loadScript(baseDir as string, page);
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
export default webSocketFactory;
