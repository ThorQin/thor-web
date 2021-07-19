import { Application, Middleware, MiddlewareFactory, MiddlewareOptions, SessionInfo } from '../types';
export declare type TimeCheck = {
	value: number;
	unit?: 'y' | 'M' | 'd' | 'h' | 'm' | 's' | 'ms';
	action?: 'renew' | 'logout';
};
export interface SessionOptions extends MiddlewareOptions {
	/**
	 * Server key for AES128 encryption encoded by BASE64 (key = 16 bytes raw data -> base64)
	 */
	serverKey?: string;
	cookieName?: string;
	path?: string;
	/**
	 * value <= 0: delete cookie, value > 0: how long the cookie will be kept(in seconds)
	 */
	maxAge?: number;
	renew?: (sessionInfo: SessionInfo) => Promise<boolean>;
	expireCheck?: TimeCheck | null;
	intervalCheck?: TimeCheck | null;
	domain?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
}
declare class SessionFactory implements MiddlewareFactory<SessionOptions> {
	create(
		app: Application,
		{
			serverKey,
			cookieName,
			maxAge,
			expireCheck,
			renew,
			intervalCheck,
			domain,
			httpOnly,
			secure,
			sameSite,
		}?: SessionOptions
	): Middleware;
	generateKey(): string;
}
declare const sessionFactory: SessionFactory;
export default sessionFactory;
