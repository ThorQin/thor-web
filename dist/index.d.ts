/// <reference types="node" />
import http from 'http';
import { Middleware, Application, SecurityHandler } from './defs';
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
        [key: string]: any;
    };
};
declare class App implements Application {
    middlewares: Middleware[];
    server: http.Server | null;
    [key: string]: any;
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
     * @typedef StartOptions
     * @prop {number} port
     * @prop {string} hostname
     * @prop {string} cookieName Session name
     * @prop {number} maxAge Session max age
     * @prop {string} domain Session cookie domain
     * @prop {string} serverKey
     * @prop {string[]} suffix Extra supported static file suffix
     * @prop {function} securityHandler Security handler function
     * @prop {object} env
     *
     * @param {StartOptions} options
     * @returns {App} App instance
     */
    static start(options?: StartOptions): App;
}
import enc from './utils/enc.js';
export declare const middlewares: {
    session: {
        create: ({ serverKey, cookieName, maxAge, validTime, renew, interval, domain, httpOnly, secure, sameSite, }?: {
            serverKey?: string | undefined;
            cookieName?: string | undefined;
            maxAge?: number | undefined;
            renew?: ((sessionInfo: any) => boolean) | undefined;
            validTime?: string | undefined;
            interval?: string | undefined;
            domain?: string | undefined;
            httpOnly?: boolean | undefined;
            secure?: boolean | undefined;
            sameSite?: "Lax" | "None" | "Strict" | undefined;
        }) => Middleware;
        generateKey: () => string;
    };
    staticServer: {
        create: ({ baseDir, rootPath, suffix, cachedFileSize, enableGzipSize, }?: {
            baseDir?: string | undefined;
            rootPath?: string | undefined;
            suffix?: string[] | undefined;
            cachedFileSize?: number | undefined;
            enableGzipSize?: number | undefined;
        }) => Middleware;
        defaultSuffix: () => string[];
    };
    controller: {
        create: ({ baseDir, rootPath }?: {
            baseDir: any;
            rootPath?: string | undefined;
        }) => (ctx: any, req: any, rsp: any) => Promise<boolean>;
    };
    bodyParser: {
        create: () => (ctx: any, req: any) => Promise<boolean>;
    };
    security: {
        create: (securityHandler: any) => Middleware;
    };
    template: {
        create: ({ baseDir, isDebug }?: {
            baseDir?: null | undefined;
            isDebug?: boolean | undefined;
        }) => (ctx: any) => Promise<boolean>;
    };
};
export { enc };
export default App;
