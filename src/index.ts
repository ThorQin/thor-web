/* eslint-disable @typescript-eslint/no-explicit-any */
import http, { OutgoingHttpHeaders } from 'http';
import Context from './context';
import {
	Middleware,
	Application,
	AccessHandler,
	MiddlewareFactory,
	PrivilegeHandler,
	MiddlewareOptions,
	PermissionHandler,
	SessionInfo,
	RouterDef,
} from './types';
import { session, staticServer, controller, bodyParser, security, template, webSocket } from './middleware/index';

async function processRequest(
	app: Application,
	req: http.IncomingMessage,
	rsp: http.ServerResponse,
	middlewares: Middleware[]
) {
	async function* exec(ctx: Context, req: http.IncomingMessage, rsp: http.ServerResponse) {
		for (const m of middlewares) {
			yield m(ctx, req, rsp);
		}
	}
	const ctx = new Context(req, rsp);
	ctx.app = app;
	try {
		for await (const result of exec(ctx, req, rsp)) {
			if (result) {
				return;
			}
		}
		console.log(`not found: ${ctx.url}`);
		ctx.errorNotFound();
	} catch (e: any) {
		console.error(e);
		if (process.env.NODE_ENV == 'prodction') {
			ctx.errorUnknown();
		} else {
			ctx.errorUnknown(e);
		}
	}
}

type StartOptions = {
	port?: number;
	hostname?: string;
	cookieName?: string;
	/**
	 * 保存 Session 的 Cookie 的有效期（单位秒），默认 1800 秒，设置为 0 为会话 cookie (关闭浏览器丢失)，负数为立即过期（没什么意义），设置为永不过期请使用 Number.MAX_SAFE_INTEGER
	 */
	maxAge?: number;
	/**
	 * 过期检查选项，判断 Session 首次建立时间是否超过规定值，以及超过后的要执行的动作，默认不做任何检查
	 */
	expireCheck?: TimeCheck | null;
	/**
	 * 访问间隔检查选项，判断 Session 最后请求时间是否超过规定值，以及超过后的要执行的动作，默认超过30分钟空闲会注销登录，要禁用检查传入 null
	 */
	intervalCheck?: TimeCheck | null;
	renew?: (sessionInfo: SessionInfo) => Promise<boolean>;
	/**
	 * 限定 session 的访问域名
	 */
	domain?: string;
	serverKey?: string;
	/**
	 * 额外允许访问的静态资源文件后缀
	 */
	suffix?: string[];
	accessHandler?: AccessHandler;
	privilegeHandler?: PrivilegeHandler;
	permissionHandler?: PermissionHandler;
	env?: { [key: string]: unknown };
	/**
	 * 静态资源物理存放位置
	 */
	staticDir?: string;
	/**
	 * 静态资源web访问路径
	 */
	staticPath?: string;
	/**
	 * provide some extra response headers by file content type
	 */
	staticMimeHeaders?: Record<string, OutgoingHttpHeaders>;
	/**
	 * provide some extra response headers by url path
	 */
	staticFileHeaders?: Record<string, OutgoingHttpHeaders>;
	/**
	 * 模板物理存放位置
	 */
	templateDir?: string;
	/**
	 * 接口物理位置（自动扫描并加载接口模块）
	 */
	controllerDir?: string;
	/**
	 * 接口访问路径
	 */
	controllerPath?: string;
	/**
	 * 静态引入的接口模块
	 */
	controllers?: Record<string, ControllerType>;
	/**
	 * 静态引入的路由模块
	 */
	routers?: RouterDef[];
	/**
	 * 接口文档路径，不指定路径就不启用接口文档
	 */
	apiDocPath?: string;
	/**
	 * WebSocket handler 物理位置
	 */
	wsDir?: string;
	/**
	 * WebSocket 访问路径
	 */
	wsPath?: string;
	/**
	 * The maximum allowed aggregate message size (for fragmented messages) in bytes.
	 * @default 1MiB
	 */
	wsMaxMessageSize?: number;
};

class App implements Application {
	middlewares: Middleware[];
	server: http.Server | null = null;
	[key: string]: unknown;

	constructor() {
		this.middlewares = [];
	}

	use<T extends MiddlewareFactory<O>, O extends MiddlewareOptions>(factory: T, options?: O): this {
		if (!this.server) {
			throw new Error('Error: server not started!');
		}
		const middleware = factory.create(this, options);
		if (middleware) {
			this.middlewares.push(middleware);
		}
		return this;
	}

	start({ port = 8080, hostname }: StartOptions = {}): this {
		this.server = http
			.createServer((req, rsp) => {
				try {
					processRequest(this, req, rsp, this.middlewares);
				} catch (e) {
					console.error('processRequest exception: ', e);
				}
			})
			.listen(port, hostname)
			.once('listening', () => {
				if (this.server) {
					const addr = this.server?.address();
					if (!addr) {
						return;
					}
					if (typeof addr === 'object') {
						console.log(`Server listening on: ${addr.address}:${addr.port}`);
					} else {
						console.log(`Server listening on: ${addr}`);
					}
				}
			});
		console.log(`Current work dir: ${getRootDir()}`);
		return this;
	}

	stop(): this {
		this.server && this.server.close();
		return this;
	}

	/**
	 * Instead use App constructor to create a server instance,
	 * this function create a simple server instance that add most commonly used middlewares to the instance.
	 * @param options
	 * @returns App instance
	 */
	static start({
		port = 8080,
		hostname,
		cookieName,
		serverKey,
		maxAge = 1800,
		expireCheck,
		intervalCheck,
		renew,
		domain,
		suffix,
		accessHandler,
		privilegeHandler,
		permissionHandler,
		env = {},
		staticDir,
		staticPath,
		staticMimeHeaders,
		staticFileHeaders,
		templateDir,
		controllerDir,
		controllerPath,
		controllers,
		routers,
		apiDocPath,
		wsDir,
		wsPath,
		wsMaxMessageSize,
	}: StartOptions = {}): App {
		const app = new App();
		if (env) {
			for (const k in env) {
				if (!app[k]) {
					app[k] = env[k];
				}
			}
		}
		app.start({
			port: port,
			hostname: hostname || undefined,
		});
		app.use(session, {
			serverKey: serverKey,
			cookieName: cookieName,
			maxAge: maxAge,
			expireCheck: expireCheck,
			intervalCheck: intervalCheck,
			renew: renew,
			domain: domain,
		});
		if (
			typeof accessHandler === 'function' ||
			typeof privilegeHandler === 'function' ||
			typeof permissionHandler === 'function'
		) {
			app.use(security, {
				accessHandler: accessHandler,
				privilegeHandler: privilegeHandler,
				permissionHandler: permissionHandler,
			});
		}
		app.use(staticServer, {
			suffix: suffix,
			baseDir: staticDir,
			rootPath: staticPath,
			mimeHeaders: staticMimeHeaders,
			fileHeaders: staticFileHeaders,
		});
		app.use(bodyParser);
		app.use(template, {
			baseDir: templateDir,
		});
		app.use(controller, {
			baseDir: controllerDir,
			rootPath: controllerPath,
			controllers,
			routers,
			apiDocPath: apiDocPath,
		});
		app.use(webSocket, {
			baseDir: wsDir,
			rootPath: wsPath,
			maxReceivedMessageSize: wsMaxMessageSize,
		} as WebSocketCreateOptions);
		return app;
	}
}

import enc from './utils/enc.js';
import { WebSocketCreateOptions } from './middleware/websocket';
import { ControllerType, HttpError } from './middleware/controller';
import { TimeCheck } from './middleware/session';
import { getRootDir } from './utils/tools';

export const middlewares: {
	[key: string]: MiddlewareFactory<MiddlewareOptions>;
} = {
	session,
	staticServer,
	controller,
	bodyParser,
	security,
	template,
	webSocket,
};

export const SUPPORT_SHARED_ARRAY_BUFFER_HEADERS = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp',
};

export { enc, HttpError };
export default App;
