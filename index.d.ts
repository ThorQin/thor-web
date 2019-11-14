import * as http from "http";
import * as querystring from "querystring";

export as namespace web

interface RequestCookies {
	readonly [name: string]: string
}

interface CookieOptions {
	readonly [name: string]: string;
	HttpOnly: 'true'|'false';
	Exprie: string;
	Domain: string;
	Path: string;
}

interface BodyPart {
	buffer: Buffer;
	length: number;
	filename: string;
	file: string;
	name: string;
	contentType: string?;
	charset: string?;
}

interface BodyParser {
	isJSON: () => boolean;
	isForm: () => boolean;
	isMultipart: () => boolean;
	getCharset: () => string;
	getMultipartBoundary: () => string;
	raw(): Promise<Buffer>;
	text(): Promise<string>;
	json(): Promise<any>;
	form(): Promise<querystring.ParsedUrlQuery>;
	multipart(storeDir: string, maxLength?: number): Promise<BodyPart[]>;
}

interface Session {
	accessTime: number;
	createTime: number;
	expireTime: number;
	get(key: string): any;
	set(key: string, value: any): void;
	remove(key: string): void;
	clear(): void;
	save(): void;
	delete(): void;
	toString(): string;
}

interface RenderFunc {
	(file: string, data: any): Promise<void>
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
	body: BodyParser = null;
	session: Session = null;
	render: RenderFunc = null;
	getRequestHeader(key: string = null): string|http.IncomingHttpHeaders;
	getResponseHeader(key: string = null): string|http.OutgoingHttpHeaders;
	setResponseHeader(key: string, value: string|number|string[]): void;
	getRequestCookies(): RequestCookies;
	setResponseCookie(name: string, value: string, options: CookieOptions): void;
	removeResponseCookie(name: string): void;
	getResponseCookies(): string[];
	write(buffer: Buffer|string): Promise<void>;
	sendText(text: string, contentType: string = 'text/plain; charset=utf-8'): Promise<void>;
	sendHtml(html: string): Promise<void>;
	sendJson(html: string): Promise<void>;
	redirect(url: string): Promise<void>;
	needBasicAuth(domain: string): Promise<void>;
	checkBasicAuth(authCallback: (username: string, password: string) => boolean): boolean;
	errorBadRequest(): Promise<void>;
	errorNeedAuth(): Promise<void>;
	errorForbidden(): Promise<void>;
	errorNotFound(): Promise<void>;
	errorBadMethod(): Promise<void>;
	errorTooLarge(): Promise<void>;
	errorUnknown(message): Promise<void>;
	error(code: number, message: string): Promise<void>;
	end(message: string = null): Promise<void>;
	close(): void;
}

interface Middleware {
	(ctx: Context, req: http.IncomingMessage , rsp: http.ServerResponse): Promise<boolean>;
}

class App {
	use(...middleware: Middleware[]): App;
	start(port: number): void;
	stop(): void;
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

/**
 * Instead use App constructor to create a server instance,
 * this function create a simple server instance that add most commonly used middlewares to the instance.
 */
function simpleApp(port: number, serverKey: string = null, securityHandler: SecurityHandler = null, env:ServerEnv = {}): App;

namespace time {
	function now(): Date;
	/**
	 * Input seconds and get a time description
	 */
	function timespan(seconds: number): string;

	/**
	 * Get the distance of dt2 compare to dt1 (dt2 - dt1) return in specified unit (d: day, h: hours, m: minutes, s: seconds, ms: milliseconds)
	 */
	function dateDiff(dt1:string|number|Date, dt2:string|number|Date, unit = 'd'): number;

	/**
	 * Get new date of dt add specified unit of values.
	 */
	function dateAdd(dt:string|number|Date, val: number, unit = 'd'): Date;

	/**
	 * Get day in year
	 */
	function dayOfYear(dt: Date): number;

	/**
	 * Get total days of month
	 */
	function totalDaysOfMonth(dt: Date): number;


	/**
	 * Parse string get date instance (
	 * try to parse format:
	 *		'yyyy-MM-dd HH:mm:ss'，
	 *		'yyyy-MM-dd',
	 *		'dd MMM yyyy',
	 *		'MMM dd, yyyy'
	 *		and ISO8601 format, etc..)
	 */
	function parseDate(dtStr: string|number|Date, format: string = null): Date;


	/**
	 * Convert date to string and output can be formated to ISO8601, RFC2822, RFC3339 or other customized format
	 * @param dt Input date
	 * @param dateFmt Format string, default is "yyyy-MM-ddTHH:mm:sszzz"
	 */
	function formatDate(dt:Date, dateFmt = 'yyyy-MM-ddTHH:mm:sszzz'): string;
}


namespace middlewares {

	interface SessionData {
		[index: string]: any
	}

	interface SessionInfo {
		accessTime: number;
		createTime: number;
		expireTime: number;
		info: SessionData;
	}

	interface SessionOptions {
		cookieName: string = 'ez_app',
		renew: (info: SessionInfo) => Promise<boolean> = null,
		expire: string = null,
		interval: string = '15d',
		domain: string = null,
		httpOnly: boolean = true
	}

	module security {
		/**
		 * Create security middleware instance
		 */
		function create(securityHandler: SecurityHandler): Middleware;
	}
	module session {
		/**
		 * Create distributed session middleware instance
		 */
		function create(serverKey: string = null, options: SessionOptions = {}): Middleware;

		/**
		 * Generate a new server key
		 */
		function generateKey(): string;
	}
	module static {
		/**
		 * Create static resources middleware instance
		 * @param baseDir Root directory of static resources.
		 * @param suffix Which suffix can be visit as static resource.
		 * @param cachedFileSize File can be cached when size less this setting.
		 */
		function create(baseDir: string, suffix: string[] = null, cachedFileSize = 1024 * 100): Middleware;
		/**
		 * Get default allowed suffix list
		 */
		function defaultSuffix(): string[];
	}
	module controller {
		/**
		 * Create js controller middleware instance
		 */
		function create(baseDir: string = null): Middleware;
	}
	module bodyParser {
		/**
		 * Create body-parser middleware instance
		 */
		function create(): Middleware;
	}
	module template {
		/**
		 * Create template renderer middleware instance
		 */
		function create(baseDir: string = null, isDebug = false): Middleware;
	}
}
