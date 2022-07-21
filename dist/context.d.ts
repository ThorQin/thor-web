/// <reference types="node" />
import http from 'http';
import { Application, BasicBodyParser, PermissionCheck, PrivilegeCheck, Renderer, Session } from './types';
import { Schema } from 'thor-validation';
export declare type SendFileOption = {
	statusCode?: number;
	contentType?: string;
	headers?: {
		[key: string]: string;
	};
	filename?: string;
	inline?: boolean;
	gzip?: boolean;
};
export declare enum OriginType {
	PUBLIC = 0,
	ANY = 1,
}
export declare type CORSOptions = {
	/**
	 * 允许的跨站 http headers, 多个用逗号隔开
	 */
	allowHeaders?: string;
	/**
	 * 允许前端请求的任何 headers
	 */
	allowAnyHeaders?: boolean;
	/**
	 * 允许的跨站 http 方法, 多个用逗号隔开
	 */
	allowMethods?: string;
	/**
	 * 允许前端请求的任何 http 方法
	 */
	allowAnyMethods?: boolean;
	/**
	 * 本次跨站请求策略持续时间，默认：600 秒
	 */
	allowMaxAge?: number;
	/**
	 * 允许的发起源
	 */
	allowOrigin?: OriginType | string;
	/**
	 * 是否允许携带认证信息
	 */
	allowCredential?: boolean;
};
declare class EventStreamClient {
	context: Context;
	private heartbeat;
	private closed;
	constructor(context: Context, headers?: http.OutgoingHttpHeaders, heartbeatInterval?: number);
	sendEvent(event: string, data: string): Promise<void>;
	onClosed(callback: () => void): void;
	close(): void;
}
export default class Context {
	readonly req: http.IncomingMessage;
	readonly rsp: http.ServerResponse;
	readonly url: string;
	/**
	 * In upper case
	 */
	readonly method: string;
	readonly path: string;
	readonly query: string;
	readonly params: URLSearchParams;
	app?: Application;
	body?: BasicBodyParser;
	session?: Session;
	checkPrivilege?: PrivilegeCheck;
	checkPermission?: PermissionCheck;
	render?: Renderer;
	isWebSocket: boolean;
	constructor(req: http.IncomingMessage, rsp: http.ServerResponse);
	get clientIP(): string | undefined;
	get clientPort(): number | undefined;
	get serverIP(): string | undefined;
	get serverPort(): number | undefined;
	get accessUrl(): URL;
	getParams(schema?: Schema): unknown;
	getRequestHeader(key?: string | null): string | http.IncomingHttpHeaders | string[] | undefined;
	getResponseHeader(key?: string | null): string | number | string[] | http.OutgoingHttpHeaders | undefined;
	setResponseHeader(key: string, value: string | number | readonly string[]): this;
	enableCORS({
		allowMethods,
		allowAnyMethods,
		allowHeaders,
		allowAnyHeaders,
		allowMaxAge,
		allowOrigin,
		allowCredential,
	}?: CORSOptions): this;
	writeHead(statusCode: number, reasonPhrase?: string, headers?: http.OutgoingHttpHeaders): this;
	writeHead(statusCode: number, headers?: http.OutgoingHttpHeaders): this;
	getRequestCookies(): {
		[idx: string]: string;
	};
	supportGZip(): boolean;
	/**
	 * Set response cookie
	 * @param name Cookie name
	 * @param value Cookie value
	 * @param options Cookie options: HttpOnly, Exprie, Domain, Path
	 */
	setResponseCookie(
		name: string,
		value: string,
		options: {
			[key: string]: string | number | null;
		}
	): this;
	/**
	 * Remove response cookie
	 * @param name Cookie name
	 */
	removeResponseCookie(name: string): this;
	getResponseCookies(): string[];
	write(buffer: string | Buffer): Promise<void>;
	/**
	 * Send content to client
	 */
	send(data: string | Buffer, contentType?: string): Promise<void>;
	/**
	 * Send HTML content to client
	 */
	sendHtml(html: string): Promise<void>;
	/**
	 * Send JSON content to client
	 */
	sendJson(obj: unknown): Promise<void>;
	/** Send file content to client
	 * @param {string | NodeJS.ReadableStream | Buffer} file File path
	 * @param {SendFileOption} options File download options
	 */
	sendFile(file: string | NodeJS.ReadableStream | Buffer, options?: SendFileOption): Promise<void>;
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
	error(code?: number, message?: string): Promise<void>;
	/**
	 * Send data to client and finish response.
	 */
	end(message?: string | Buffer | null): Promise<void>;
	/**
	 * Close underlying socket connection
	 */
	close(error?: Error): void;
	eventStream(headers?: http.OutgoingHttpHeaders, heartbeatInterval?: number): EventStreamClient;
}
export {};
