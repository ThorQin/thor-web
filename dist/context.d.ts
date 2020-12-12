/// <reference types="node" />
import http from 'http';
import { Application, BasicBodyParser, PrivilegeCheck, Renderer, Session } from './types';
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
	/**
	 * In upper case
	 */
	method: string;
	path: string;
	query: string;
	params: URLSearchParams;
	app?: Application;
	body?: BasicBodyParser;
	session?: Session;
	checkPrivilege?: PrivilegeCheck;
	render?: Renderer;
	isWebSocket: boolean;
	constructor(req: http.IncomingMessage, rsp: http.ServerResponse);
	getRequestHeader(key?: string | null): string | http.IncomingHttpHeaders | string[] | undefined;
	getResponseHeader(key?: string | null): string | number | string[] | http.OutgoingHttpHeaders | undefined;
	setResponseHeader(key: string, value: string | number | readonly string[]): this;
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
	error(code?: number, message?: string): Promise<void>;
	/**
	 * Send data to client and finish response.
	 */
	end(message?: string | Buffer | null): Promise<void>;
	/**
	 * Close underlying socket connection
	 */
	close(error?: Error): void;
}
export {};
