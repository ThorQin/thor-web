import { Middleware } from '../defs';
declare function generateKey(): string;
declare type SessionOptions = {
    /**
     * Server key for AES128 encryption encoded by BASE64 (key = 16 bytes raw data -> base64)
     */
    serverKey?: string;
    cookieName?: string;
    /**
     * value <= 0: delete cookie, value > 0: how long the cookie will be kept(in seconds)
     */
    maxAge?: number;
    renew?: (sessionInfo: any) => boolean;
    validTime?: string;
    interval?: string;
    domain?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'None' | 'Lax' | 'Strict';
};
/**
 * Create session manager middleware
 * @param {SessionOptions} options Options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
declare function create({ serverKey, cookieName, maxAge, validTime, renew, interval, domain, httpOnly, secure, sameSite, }?: SessionOptions): Middleware;
declare const _default: {
    create: typeof create;
    generateKey: typeof generateKey;
};
export default _default;
