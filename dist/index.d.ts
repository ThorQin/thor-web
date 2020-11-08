/// <reference types="node" />
import http from 'http';
import { Middleware, Application, SecurityHandler, MiddlewareFactory } from './types';
declare type StartOptions = {
	port?: number;
	hostname?: string;
	cookieName?: string;
	maxAge?: number;
	domain?: string;
	serverKey?: string;
	suffix?: string[];
	securityHandler?: SecurityHandler;
	env?: {
		[key: string]: unknown;
	};
};
declare class App implements Application {
	middlewares: Middleware[];
	server: http.Server | null;
	[key: string]: unknown;
	constructor();
	/**
	 * Add some middlewares.
	 * @param middleware Middleware or array of middlewares.
	 */
	use(...middleware: Middleware[]): this;
	start(port?: number, hostname?: string): this;
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
		securityHandler,
		env,
	}?: StartOptions): App;
}
import enc from './utils/enc.js';
export declare const middlewares: {
	[key: string]: MiddlewareFactory;
};
export { enc };
export default App;
