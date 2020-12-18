import http from 'http';
import Context from './context';
import {
	Middleware,
	Application,
	AccessHandler,
	MiddlewareFactory,
	PrivilegeHandler,
	MiddlewareOptions,
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
		ctx.errorNotFound();
	} catch (e) {
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
	 * 保存 Session 的 Cookie 的有效期，默认 1800 秒，设置为 -1 为永久保存
	 */
	maxAge?: number;
	/**
	 * 过期检查选项，判断 Session 首次建立时间是否超过规定值，以及超过后的要执行的动作
	 */
	expireCheck?: TimeCheck;
	/**
	 * 访问间隔检查选项，判断 Session 最后请求时间是否超过规定值，以及超过后的要执行的动作
	 */
	intervalCheck?: TimeCheck;
	domain?: string;
	serverKey?: string;
	suffix?: string[];
	accessHandler?: AccessHandler;
	privilegeHandler?: PrivilegeHandler;
	env?: { [key: string]: unknown };
	staticDir?: string;
	staticPath?: string;
	templateDir?: string;
	controllerDir?: string;
	controllerPath?: string;
	wsDir?: string;
	wsPath?: string;
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
			.listen(port, hostname);

		if (hostname) {
			console.log(`Server listening on: ${hostname}:${port}`);
		} else {
			console.log(`Server listening on: ${port}`);
		}
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
		domain,
		suffix,
		accessHandler,
		privilegeHandler,
		env = {},
		staticDir,
		staticPath,
		templateDir,
		controllerDir,
		controllerPath,
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
			port: port || 8080,
			hostname: hostname || undefined,
		});
		app.use(session, {
			serverKey: serverKey,
			cookieName: cookieName,
			maxAge: maxAge || 1800,
			expireCheck: expireCheck,
			intervalCheck: intervalCheck,
			domain: domain,
		});
		if (typeof accessHandler === 'function' || typeof privilegeHandler === 'function') {
			app.use(security, {
				accessHandler: accessHandler,
				privilegeHandler: privilegeHandler,
			});
		}
		app.use(staticServer, {
			suffix: suffix,
			baseDir: staticDir,
			rootPath: staticPath,
		});
		app.use(bodyParser);
		app.use(template, {
			baseDir: templateDir,
		});
		app.use(controller, {
			baseDir: controllerDir,
			rootPath: controllerPath,
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
import { HttpError } from './middleware/controller';
import { TimeCheck } from './middleware/session';

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

export { enc, HttpError };
export default App;
