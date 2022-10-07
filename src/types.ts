import http from 'http';
import { Schema } from 'thor-validation';
import Context from './context';
import { connection, request, server, Message, frame } from 'websocket';
import { Rule } from 'thor-validation';
import busboy from 'busboy';
import internal from 'stream';

export type WebSocketConnection = connection;
export type WebSocketRequest = request;
export type WebSocketServer = server;
export type WebSocketMessage = Message;
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

export interface PermissionHandlerParam {
	ctx: Context;
	account: string;
	permission: string;
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

export interface PermissionHandler {
	(param: PermissionHandlerParam): Promise<boolean>;
}

export interface PrivilegeCheck {
	(account: string, resource: string, resourceId?: string, action?: string): void;
}

export interface PermissionCheck {
	(account: string, permission: string): void;
}

export interface PartInfo {
	length: number;
	name: string;
	filename?: string;
	contentType: string;
	charset: string;
	file?: string;
	buffer?: Buffer;
	value?: string;
}

export interface PartInfo2 {
	type: 'field' | 'file';
	name: string;
	mimeType: string;
	encoding: string;
}

export interface FieldPart extends PartInfo2 {
	value: string;
}

export interface FilePart extends PartInfo2 {
	filename: string;
	stream: internal.Readable;
}

export interface MultipartOption extends busboy.Limits {
	breakOnFileSizeLimitReached?: boolean;
}

export interface BasicBodyParser {
	isJSON(): boolean;
	isForm(): boolean;
	isMultipart(): boolean;
	getCharset(): string;
	getMultipartBoundary(): string | null;
	raw(): Promise<Buffer>;
	text(): Promise<string>;
	json(schema?: Schema): Promise<unknown>;
	form(): Promise<URLSearchParams>;
	multipart2(options: MultipartOption): AsyncIterable<FilePart | FieldPart>;
	multipart: (storeDir?: string | null, maxFileLength?: number) => Promise<PartInfo[]>;
}

export interface SaveOptions {
	maxAge?: number;
	domain?: string;
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
}

export type SessionInfo = {
	createTime: number;
	accessTime: number;
	data: { [key: string]: unknown };
};

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
	createToken: (info: { accessTime: number; createTime: number; data: { [key: string]: unknown } }) => string;
}

export interface Controller {
	(ctx: Context, req: http.IncomingMessage, rsp: http.ServerResponse): Promise<unknown>;
	body?: Rule;
	params?: Rule;
	desc?: string;
	eventStream?: boolean;
}

export interface RouterDef {
	path: RegExp;
	method: string | null;
	fn: Controller;
	cacheable: boolean;
}

export interface SocketHandler {
	(connection: WebSocketConnection, app: Application): void;
}

export interface SocketHandlerV2 {
	(request: WebSocketRequest, app: Application): void;
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

export function isRenderContext(ctx: Context): ctx is RenderContext {
	return !!ctx.render;
}

export function isSessionContext(ctx: Context): ctx is SessionContext {
	return !!ctx.session;
}

export function isBodyContext(ctx: Context): ctx is BodyContext {
	return !!ctx.body;
}

export function isAppContext(ctx: Context): ctx is AppContext {
	return !!ctx.app;
}

export function isPrivilegeContext(ctx: Context): ctx is PrivilegeContext {
	return !!ctx.checkPrivilege;
}

export function isDefaultContext(ctx: Context): ctx is DefaultContext {
	return (
		isRenderContext(ctx) && isSessionContext(ctx) && isBodyContext(ctx) && isAppContext(ctx) && isPrivilegeContext(ctx)
	);
}
