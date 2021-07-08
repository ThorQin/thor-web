/// <reference types="node" />
import http from 'http';
import {
	Middleware,
	Application,
	AccessHandler,
	MiddlewareFactory,
	PrivilegeHandler,
	MiddlewareOptions,
	PermissionHandler,
	SessionInfo,
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
	env?: {
		[key: string]: unknown;
	};
	/**
	 * 静态资源物理存放位置
	 */
	staticDir?: string;
	/**
	 * 静态资源web访问路径
	 */
	staticPath?: string;
	/**
	 * 模板物理存放位置
	 */
	templateDir?: string;
	/**
	 * 接口物理存放位置
	 */
	controllerDir?: string;
	/**
	 * 接口web访问路径
	 */
	controllerPath?: string;
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
		renew,
		domain,
		suffix,
		accessHandler,
		privilegeHandler,
		permissionHandler,
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
