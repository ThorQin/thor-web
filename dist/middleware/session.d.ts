import { Middleware, MiddlewareFactory } from '../types';
export declare type TimeCheck = {
	value: number;
	unit?: 'y' | 'M' | 'd' | 'h' | 'm' | 's' | 'ms';
	action?: 'renew' | 'logout';
};
export declare type SessionInfo = {
	createTime: number;
	accessTime: number;
	data: {
		[key: string]: unknown;
	};
};
export declare type SessionOptions = {
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
	renew?: (sessionInfo: unknown) => Promise<boolean>;
	expireCheck?: TimeCheck;
	intervalCheck?: TimeCheck;
	domain?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
};
declare class SessionFactory implements MiddlewareFactory {
	create({
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
	}?: SessionOptions): Middleware;
	generateKey(): string;
}
declare const sessionFactory: SessionFactory;
export default sessionFactory;
