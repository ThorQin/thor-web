import * as http from "http";
import * as querystring from "querystring";
import { Schema } from "thor-validation";

interface RequestCookies {
	readonly [name: string]: string
}

interface CookieOptions {
	readonly [name: string]: string;
	HttpOnly: 'true'|'false';
	Exprie: string;
	Domain: string;
	Path: string;
	Secure: 'true'|'false';
	SameSite: 'None'|'Lax'|'Strict';
}

interface BodyPart {
	buffer: Buffer;
	length: number;
	filename: string;
	file: string;
	name: string;
	contentType: string;
	charset: string;
}

interface BodyParser {
	isJSON: () => boolean;
	isForm: () => boolean;
	isMultipart: () => boolean;
	getCharset: () => string;
	getMultipartBoundary: () => string;
	raw(): Promise<Buffer>;
	text(): Promise<string>;
	/**
	 * Get JSON data and do validation if given the schema parameter.
	 * @param {Schema} schema
	 * @throws {ValidationError}
	 */
	json(schema?: Schema): Promise<any>;
	form(): Promise<querystring.ParsedUrlQuery>;
	multipart(storeDir: string, maxLength?: number): Promise<BodyPart[]>;
}

interface Session {
	accessTime: number;
	createTime: number;
	validTime: number;
	get(key: string): any;
	set(key: string, value: any): void;
	remove(key: string): void;
	clear(): void;
	save(maxAge?:number): void;
	delete(): void;
	toString(): string;
}

/**
 * Render page by template file
 */
interface RenderFunc {
	/**
	 * @param {string} file File path
	 * @param {any} data Data content to render
	 * @param {boolean} returnText If true, only return rendered content to caller instead send to client.
	 */
	(file: string, data: any, returnText: boolean): Promise<void|string>
	/**
	 * @param {string} file File path
	 * @param {any} data Data content to render
	 */
	(file: string, data: any): Promise<void>
}

interface SendFileOption {
	/**
	 * Default value is 200
	 */
	statusCode?: number;
	contentType?: string;
	headers?: {[key: string]: string};
	filename?: string;
	inline?: boolean;
}

interface Context {
	app: App;
	req: http.IncomingMessage;
	rsp: http.ServerResponse;
	url: string;
	ip: string;
	method: string;
	path: string;
	query: string;
	params: URLSearchParams;
	body?: BodyParser;
	session?: Session;
	render?: RenderFunc;
	getRequestHeader(key?: string): string|http.IncomingHttpHeaders;
	getResponseHeader(key?: string): string|http.OutgoingHttpHeaders;
	setResponseHeader(key: string, value: string|number|string[]): void;
	getRequestCookies(): RequestCookies;
	setResponseCookie(name: string, value: string, options: CookieOptions): void;
	removeResponseCookie(name: string): void;
	getResponseCookies(): string[];
	write(buffer: Buffer|string): Promise<void>;
	writeHead(statusCode: number, reasonPhrase?: string, headers?: http.OutgoingHttpHeaders): void;
	writeHead(statusCode: number, headers?: http.OutgoingHttpHeaders): void;
	/**
	 * Send text content to client.
	 * @param data Text data
	 * @param contentType content MIME type, default is 'text/plain;charset=utf-8'
	 */
	send(data: string, contentType?: string): Promise<void>;
	sendHtml(html: string): Promise<void>;
	sendJson(obj: any): Promise<void>;
	sendFile(file: string, options?: SendFileOption): Promise<void>;
	redirect(url: string): Promise<void>;
	needBasicAuth(domain: string): Promise<void>;
	checkBasicAuth(authCallback: (username: string, password: string) => boolean): boolean;
	errorBadRequest(): Promise<void>;
	errorNeedAuth(): Promise<void>;
	errorForbidden(): Promise<void>;
	errorNotFound(): Promise<void>;
	errorBadMethod(): Promise<void>;
	errorTooLarge(): Promise<void>;
	errorUnknown(message:string): Promise<void>;
	error(code: number, message: string): Promise<void>;
	end(message?: Buffer|string): Promise<void>;
	close(): void;
}

export interface Controller {
	(ctx: Context, req: http.IncomingMessage , rsp: http.ServerResponse): Promise<any>;
}

interface Middleware {
	(ctx: Context, req: http.IncomingMessage , rsp: http.ServerResponse): Promise<boolean>;
}

class App {
	use(...middleware: Middleware[]): App;
	/**
	 * Start web server
	 * @param port Default is 8080
	 */
	start(port?: number): void;
	stop(): void;
	/**
	 * Instead use App constructor to create a server instance,
	 * this function create a simple server instance that add most commonly used middlewares to the instance.
	 * @param {number} port Default is 8080
	 */
	static start(port?: number, serverKey?: string, securityHandler?: SecurityHandler, env?: ServerEnv): App;
	[index: string]: any;
}

interface SecurityHandlerParam {
	ctx:Context,
	username:string,
	passowrd:string,
	session: Session,
	cookie: RequestCookies,
	path: string,
	method: string,
	ip: string
}

interface SecurityHandler {
	(param: SecurityHandlerParam): boolean|string|'allow'|'deny'|'redirect:'|'auth:'
}

interface ServerEnv {
	[index: string]: any
}

export namespace enc {

	/**
	 * Encrypt data
	 * @param {string} key Base64 format server key
	 * @param {any} value Any data will be enc
	 * @returns {string} Encrypted data encoding with base64.
	 */
	function encrypt(key: string, value: any): string;

	/**
	 * Decrypt data
	 * @param {string} key Base64 format server key
	 * @param {string} base64data Encrypted base64 string
	 * @returns {any} Decrypted data
	 */
	function decrypt(key: string, base64data: string): any;
}

export namespace middlewares {

	module security {
		/**
		 * Create security middleware instance
		 */
		function create(securityHandler: SecurityHandler): Middleware;
	}

	module session {
		interface SessionData {
			[index: string]: any
		}

		interface SessionInfo {
			accessTime: number;
			createTime: number;
			validTime: number;
			info: SessionData;
		}

		interface SessionOptions {
			serverKey: string,
			cookieName?: string,
			/**
			 * Default: -1
			 */
			maxAge?: number,
			renew?: (info: SessionInfo) => Promise<boolean>,
			/**
			 * timespan (e.g. 1d,2h,3m,100s, etc..)
			 */
			validTime?: string,
			/**
			 * timespan (e.g. 1d,2h,3m,100s, etc..), default: '15d'
			 */
			interval?: string,
			domain?: string,
			/**
			 * Default true
			 */
			httpOnly?: boolean,
			/**
			 * Default false
			 */
			secure?: boolean,
			/**
			 * Default 'Lax'
			 */
			sameSite?: 'None' | 'Lax' | 'Strict'
		}
		/**
		 * Create distributed session middleware instance
		 */
		function create(options: SessionOptions): Middleware;

		/**
		 * Generate a new server key
		 */
		function generateKey(): string;
	}
	module staticServer {
		interface StaticOptions {
			/**
			 * Root directory of static resources.
			 */
			baseDir?: string;
			/**
			 * Root url path of static resource.
			 */
			rootPath?: string;
			/**
			 * Extra suffix can be visit as static resource.
			 */
			suffix?: string[];
			/**
			 * File can be cached when size less this setting, default is 1MB (1024*1024).
			 */
			cachedFileSize?: number;
		}
		/**
		 * Create static server middleware instance
		 */
		function create(options: StaticOptions): Middleware;
		/**
		 * Get default allowed suffix list
		 */
		function defaultSuffix(): string[];
	}
	module controller {
		interface ControllerOptions {
			baseDir?: string,
			/**
			 * Default is '/'
			 */
			rootPath?: string
		}
		/**
		 * Create js controller middleware instance
		 */
		function create(options: ControllerOptions): Middleware;
	}
	module bodyParser {
		/**
		 * Create body-parser middleware instance
		 */
		function create(): Middleware;
	}
	module template {
		interface TemplateOptions {
			baseDir?: string,
			/**
			 * Whether use debug mode, default false
			 */
			isDebug?: boolean
		}
		/**
		 * Create template renderer middleware instance
		 */
		function create(options: TemplateOptions): Middleware;
	}
}

export default App;
