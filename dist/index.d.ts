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
	maxAge?: number;
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
	use<T extends MiddlewareFactory>(factory: T, options?: MiddlewareOptions): this;
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
export declare const middlewares: {
	[key: string]: MiddlewareFactory;
};
export { enc, HttpError };
export default App;
