/// <reference types="node" />
import http from 'http';
import { Application } from './defs';
declare type SendFileOption = {
    statusCode?: number;
    contentType?: string;
    headers?: {
        [key: string]: string;
    };
    filename?: string;
    inline?: boolean;
    gzip?: boolean;
};
export default class Context {
    req: http.IncomingMessage;
    rsp: http.ServerResponse;
    url: string;
    ip?: string;
    method: string;
    path: string;
    query: string;
    params: URLSearchParams;
    app?: Application;
    constructor(req: http.IncomingMessage, rsp: http.ServerResponse);
    getRequestHeader(key?: string | null): string | http.IncomingHttpHeaders | string[] | undefined;
    getResponseHeader(key?: string | null): string | number | string[] | http.OutgoingHttpHeaders | undefined;
    setResponseHeader(key: string, value: string | number | readonly string[]): this;
    writeHead(statusCode: number, reasonPhrase?: string, headers?: http.OutgoingHttpHeaders): this;
    writeHead(statusCode: number, headers?: http.OutgoingHttpHeaders): this;
    getRequestCookies(): {
        [idx: string]: string;
    };
    supportGZip(): boolean | undefined;
    /**
     * Set response cookie
     * @param name Cookie name
     * @param value Cookie value
     * @param options Cookie options: HttpOnly, Exprie, Domain, Path
     */
    setResponseCookie(name: string, value: string, options: {
        [key: string]: string;
    }): this;
    /**
     * Remove response cookie
     * @param name Cookie name
     */
    removeResponseCookie(name: string): void;
    getResponseCookies(): string[];
    write(buffer: string | Buffer): Promise<void>;
    /**
     * Send content to client
     * @param {string|Buffer} data
     */
    send(data: string | Buffer, contentType?: string): Promise<void>;
    /**
     * Send HTML content to client
     * @param {string} html
     */
    sendHtml(html: string): Promise<void>;
    /**
     * Send JSON content to client
     * @param {any} obj
     */
    sendJson(obj: any): Promise<void>;
    /**
     * @param {string} file File path
     * @param {SendFileOption} options File download options
     */
    sendFile(file: string, options: SendFileOption): Promise<void>;
    /**
     * Send 302 redirection
     * @param url Redirection URL
     */
    redirect(url: string): Promise<void>;
    /**
     * Send 401 need authentication
     * @param {string} domain Http basic authentication domain name
     */
    needBasicAuth(domain: string): Promise<void>;
    /**
     * Verify http basic authentication
     * @param authCallback Callback handler function
     */
    checkBasicAuth(authCallback: (username: string, password: string) => boolean): boolean;
    notModified(): Promise<void>;
    /**
     * Send 400 bad request
     * @param {string} message
     */
    errorBadRequest(message?: null): Promise<void>;
    /**
     * Send 401 need authenticate
     */
    errorNeedAuth(): Promise<void>;
    /**
     * Send 401 Authenticate failed
     */
    errorAuthFailed(): Promise<void>;
    /**
     * Send 403 forbidden
     */
    errorForbidden(): Promise<void>;
    /**
     * Send 404 not found
     */
    errorNotFound(): Promise<void>;
    /**
     * Send 405 bad method
     */
    errorBadMethod(): Promise<void>;
    errorTooLarge(): Promise<void>;
    /**
     * Send 500 unknown error
     * @param {string} message Error message
     */
    errorUnknown(message?: null): Promise<void>;
    /**
     * Send 500 unknown error
     * @param {number|string} code Default is 500
     * @param {string} message Default is 'Unexpected Server Error!'
     */
    error(code: number | undefined, message: string): Promise<void>;
    /**
     * Send data to client and finish response.
     * @param {string|Buffer} message
     */
    end(message?: string | Buffer | null): Promise<void>;
    /**
     * Close underlying socket connection
     */
    close(): void;
}
export {};
