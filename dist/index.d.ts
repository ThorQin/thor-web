/// <reference types="node" />
import http, { OutgoingHttpHeaders } from 'http';
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
declare type StartOptions = {
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
	}?: StartOptions): App;
}
import enc from './utils/enc.js';
import { ControllerType, HttpError } from './middleware/controller';
import { TimeCheck } from './middleware/session';
export declare const middlewares: {
	[key: string]: MiddlewareFactory<MiddlewareOptions>;
};
export declare const SHARED_ARRAY_BUFFER_SUPPORT_HEADERS: {
	'Cross-Origin-Opener-Policy': string;
	'Cross-Origin-Embedder-Policy': string;
};
export { enc, HttpError };
export default App;
