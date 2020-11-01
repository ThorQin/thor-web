import http from 'http';
import Context from './context';

export type Middleware = {
	(ctx: Context, req: http.IncomingMessage, rsp: http.ServerResponse): Promise<boolean>;
};

export interface MiddlewareFactory {
	create: (arg: never) => Middleware;
}

export interface Application {
	start(port?: number, hostname?: string): this;
	stop(): this;
	use(...middleware: Middleware[]): this;
	[key: string]: unknown;
}

export interface SecurityHandlerParam {
	ctx: Context;
	resource?: string;
	resourceId?: string;
	action?: string;
}

export interface SecurityHandler {
	(param: SecurityHandlerParam): Record<string, unknown> | boolean | string | 'allow' | 'deny';
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
	json: () => Promise<unknown>;
	form: () => Promise<NodeJS.Dict<string | string[]>>;
	multipart: (storeDir?: string | null, maxLength?: number) => Promise<PartInfo[]>;
}

export interface Session {
	accessTime: number;
	createTime: number;
	validTime: number;
	get: (key: string) => unknown;
	set: (key: string, value: unknown) => void;
	remove: (key: string) => void;
	clear: () => void;
	save: (opt: any) => void;
	delete: () => void;
	toString: () => string | null;
}
