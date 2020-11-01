/// <reference types="node" />
import http from 'http';
import Context from './context';
export declare type Middleware = {
    (ctx?: Context, req?: http.IncomingMessage, rsp?: http.ServerResponse): Promise<boolean>;
};
export interface Application {
    start(port?: number, hostname?: string): this;
    stop(): this;
    use(...middleware: Middleware[]): this;
    [key: string]: any;
}
export interface SecurityHandlerParam {
    ctx: Context;
    resource?: string;
    resourceId?: string;
    action?: string;
}
export interface SecurityHandler {
    (param: SecurityHandlerParam): object | boolean | string | 'allow' | 'deny';
}
