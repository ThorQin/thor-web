/// <reference types="node" />
import http from 'http';
import {
	Middleware,
	Application,
	AccessHandler,
	MiddlewareFactory,
	PrivilegeHandler,
	MiddlewareOptions,
} from './types';
declare type StartOptions = {
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
	env?: {
		[key: string]: unknown;
	};
	staticDir?: string;
	staticPath?: string;
	templateDir?: string;
	controllerDir?: string;
	controllerPath?: string;
	wsDir?: string;
	wsPath?: string;
	wsMaxMessageSize?: number;
};
declare class App implements Application {
	middlewares: Middleware[];
	server: http.Server | null;
	[key: string]: unknown;
	constructor();
	use<T extends MiddlewareFactory<O>, O extends MiddlewareOptions>(factory: T, options?: O): this;
	start({ port, hostname }?: StartOptions): this;
	stop(): this;
	/**
	 * Instead use App constructor to create a server instance,
	 * this function create a simple server instance that add most commonly used middlewares to the instance.
	 * @param options
	 * @returns App instance
	 */
	static start({
		port,
		hostname,
		cookieName,
		serverKey,
		maxAge,
		expireCheck,
		intervalCheck,
		domain,
		suffix,
		accessHandler,
		privilegeHandler,
		env,
		staticDir,
		staticPath,
		templateDir,
		controllerDir,
		controllerPath,
		wsDir,
		wsPath,
		wsMaxMessageSize,
	}?: StartOptions): App;
}
import enc from './utils/enc.js';
import { HttpError } from './middleware/controller';
import { TimeCheck } from './middleware/session';
export declare const middlewares: {
	[key: string]: MiddlewareFactory<MiddlewareOptions>;
};
export { enc, HttpError };
export default App;
