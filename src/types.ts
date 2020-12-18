import http from 'http';
import { Schema } from 'thor-validation';
import Context from './context';
import { connection, server, IMessage, frame } from 'websocket';

export type WebSocketConnection = connection;
export type WebSocketServer = server;
export type WebSocketMessage = IMessage;
export type WebSocketFrame = frame;

export type Middleware = {
	(ctx: Context, req: http.IncomingMessage, rsp: http.ServerResponse): Promise<boolean>;
	supportWebSocket?: boolean;
};

export interface MiddlewareFactory<T extends MiddlewareOptions | undefined> {
	create: (app: Application, arg?: T) => Middleware | null;
}

export interface StartOptions {
	port: number;
	hostname?: string;
	useWebSocket: boolean;
}

export interface MiddlewareOptions {
	[index: string]: unknown;
}
export interface Application {
	middlewares: Middleware[];
	server: http.Server | null;
	start(options?: StartOptions): this;
	stop(): this;
	use<T extends MiddlewareFactory<MiddlewareOptions>>(factory: T, options: MiddlewareOptions): this;
	ws?: WebSocketServer;
	[key: string]: unknown;
}

export interface PrivilegeHandlerParam {
	ctx: Context;
	account: string;
	resource: string;
	resourceId?: string;
	action?: string;
}

export interface AccessHandlerParam {
	ctx: Context;
	path: string;
	method: string;
}

export type CustomResult = {
	code?: number;
	body?: unknown;
	contentType?: 'text' | 'json' | 'html';
	headers?: { [key: string]: number | string | string[] };
};

export type RedirectResult = {
	action: 'redirect';
	url: string;
};

export type BasicAuthResult = {
	action: 'auth';
	domain: string;
};

export type AccessCheckResult = CustomResult | RedirectResult | BasicAuthResult | boolean;

export interface AccessHandler {
	(param: AccessHandlerParam): Promise<AccessCheckResult>;
}

export interface PrivilegeHandler {
	(param: PrivilegeHandlerParam): Promise<boolean>;
}

export interface PrivilegeCheck {
	(account: string, resource: string, resourceId?: string, action?: string): void;
}

export interface PartInfo {
	length: number;
	name: string | null;
	filename: string | null;
	contentType: string | null;
	charset: string | null;
	file: string | null;
	fd?: number;
	buffer: Buffer | null;
	over?: boolean;
}

export interface BasicBodyParser {
	isJSON: () => boolean;
	isForm: () => boolean;
	isMultipart: () => boolean;
	getCharset: () => string;
	getMultipartBoundary: () => string | null;
	raw: () => Promise<Buffer>;
	text: () => Promise<string>;
	json: (schema?: Schema) => Promise<unknown>;
	form: () => Promise<NodeJS.Dict<string | string[]>>;
	multipart: (storeDir?: string | null, maxLength?: number) => Promise<PartInfo[]>;
}

export interface SaveOptions {
	maxAge?: number;
	domain?: string;
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
}

export interface Session {
	accessTime: number;
	createTime: number;
	get: (key: string) => unknown;
	set: (key: string, value: unknown) => void;
	remove: (key: string) => void;
	clear: () => void;
	save: (opt?: SaveOptions | number) => void;
	delete: () => void;
	toString: () => string;
}

export interface Controller {
	(ctx: Context, req: http.IncomingMessage, rsp: http.ServerResponse): Promise<unknown>;
}

export interface SocketHandler {
	(connection: WebSocketConnection, app: Application): void;
}

export interface Renderer {
	(file: string, data: unknown, returnText?: boolean): Promise<string | void>;
}

export interface RenderContext extends Context {
	render: Renderer;
}

export interface SessionContext extends Context {
	session: Session;
}

export interface BodyContext extends Context {
	body: BasicBodyParser;
}

export interface AppContext extends Context {
	app: Application;
}

export interface PrivilegeContext extends Context {
	checkPrivilege: PrivilegeCheck;
}

export type DefaultContext = RenderContext & SessionContext & BodyContext & AppContext & PrivilegeContext;
