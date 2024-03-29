import { v1 as uuidv1 } from 'uuid';
import time from 'thor-time';
import zlib from 'zlib';
import crypto from 'crypto';
import {
	Application,
	Middleware,
	MiddlewareFactory,
	MiddlewareOptions,
	SaveOptions,
	Session,
	SessionInfo,
} from '../types';
import Context from '../context';

export type TimeCheck = {
	value: number;
	unit?: 'y' | 'M' | 'd' | 'h' | 'm' | 's' | 'ms';
	action?: 'renew' | 'logout';
};

type SessionInfoOptions = {
	serverKey: Buffer;
	renew?: (sessionInfo: SessionInfo) => Promise<boolean>;
	expireCheck?: TimeCheck | null;
	intervalCheck?: TimeCheck | null;
};

async function getSessionInfo(
	content: string,
	{ serverKey, renew, expireCheck, intervalCheck }: SessionInfoOptions
): Promise<SessionInfo | null> {
	try {
		if (!content) {
			return null;
		}
		const encData = Buffer.from(content, 'base64');
		const decipher = crypto.createDecipheriv('aes-128-ecb', serverKey, '');
		decipher.setAutoPadding(true);
		const d1 = decipher.update(encData);
		const d2 = decipher.final();
		const zipData = Buffer.concat([d1, d2], d1.length + d2.length);
		const rawData = zlib.gunzipSync(zipData).toString('utf8');
		const sessionInfo = JSON.parse(rawData) as SessionInfo;
		if (!sessionInfo) {
			return null;
		}
		const now = time.now();
		let needRenew = false;
		if (expireCheck) {
			console.log('perform expire check ...');
			const checkValidTime = (time.add(sessionInfo.createTime, expireCheck.value, expireCheck.unit) as Date).getTime();
			if (now.getTime() >= checkValidTime) {
				if (expireCheck.action === 'renew') {
					needRenew = true;
				} else {
					console.warn('expire time has been reached!');
					return null;
				}
			}
		}

		if (intervalCheck) {
			const checkIntervalTime = (
				time.add(sessionInfo.accessTime, intervalCheck.value, intervalCheck.unit) as Date
			).getTime();
			if (now.getTime() >= checkIntervalTime) {
				if (intervalCheck.action === 'renew') {
					needRenew = true;
				} else {
					console.warn('interval time has been exceeded!');
					return null;
				}
			}
		}

		if (needRenew) {
			if (typeof renew === 'function') {
				if (await renew(sessionInfo)) {
					sessionInfo.createTime = now.getTime();
				} else {
					return null;
				}
			} else {
				return null;
			}
		}

		sessionInfo.accessTime = now.getTime();
		return sessionInfo;
	} catch (e) {
		return null;
	}
}

export interface SessionOptions extends MiddlewareOptions {
	/**
	 * Server key for AES128 encryption encoded by BASE64 (key = 16 bytes raw data -> base64)
	 */
	serverKey?: string;
	cookieName?: string;
	path?: string;
	/**
	 * value <= 0: delete cookie, value > 0: how long the cookie will be kept(in seconds)
	 */
	maxAge?: number;
	renew?: (sessionInfo: SessionInfo) => Promise<boolean>;
	expireCheck?: TimeCheck | null;
	intervalCheck?: TimeCheck | null;
	domain?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
}

interface CreateSessionOptions {
	serverKey: Buffer;
	cookieName: string;
	maxAge?: number;
	domain?: string;
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
	info?: SessionInfo | null;
}

function createSession(
	ctx: Context,
	{
		serverKey,
		cookieName,
		maxAge = 0,
		path = '/',
		domain,
		httpOnly = true,
		info = null,
		sameSite = 'Lax',
		secure = false,
	}: CreateSessionOptions
): Session {
	let data = info ? info.data : {};
	if (!(data instanceof Object)) {
		data = {};
	}
	const createTime = info ? info.createTime : new Date().getTime();
	const session: Session = {
		accessTime: new Date().getTime(),
		createTime: createTime,
		get: function (key: string) {
			return data[key];
		},
		set: function (key: string | { [idx: string]: unknown }, value: unknown) {
			if (key && key instanceof Object) {
				for (const k in key) {
					if (Object.prototype.hasOwnProperty.call(key, k)) {
						data[k] = key[k];
					}
				}
				!ctx.isWebSocket && this.save();
			} else if (typeof key === 'string') {
				data[key] = value;
				!ctx.isWebSocket && this.save();
			}
		},
		remove: function (key: string) {
			delete data[key];
			!ctx.isWebSocket && this.save();
		},
		clear: function () {
			for (const k in data) {
				delete data[k];
			}
			!ctx.isWebSocket && this.save();
		},
		save: function (opt?: SaveOptions | number) {
			if (typeof opt === 'number' && !isNaN(opt)) {
				opt = {
					maxAge: opt,
				} as SaveOptions;
			} else if (typeof opt !== 'object' || !opt) {
				opt = {} as SaveOptions;
			}
			const token = this.toString();
			const options: { [key: string]: string | number | null } = {};
			const age = typeof opt.maxAge === 'number' && !isNaN(opt.maxAge) ? opt.maxAge : maxAge;
			if (age != 0) {
				// '0' means session cookie
				options['Max-Age'] = age;
			}
			const dm = opt.domain || domain;
			if (dm) {
				options.Domain = dm;
			}
			options.Path = opt.path || path;
			if (typeof opt.httpOnly === 'boolean') {
				if (opt.httpOnly) {
					options['HttpOnly'] = null;
				}
			} else if (httpOnly) {
				options['HttpOnly'] = null;
			}
			if (typeof opt.secure === 'boolean') {
				if (opt.secure) {
					options['Secure'] = null;
				}
			} else if (secure) {
				options['Secure'] = null;
			}
			options.SameSite = opt.sameSite || sameSite;
			if (!ctx.isWebSocket) {
				ctx.setResponseCookie(cookieName, token, options);
			}
		},
		delete: function () {
			const options: { [key: string]: string | number | null } = {};
			options['Max-Age'] = 0;
			if (domain) {
				options.Domain = domain;
			}
			options.Path = path;
			if (httpOnly) {
				options['HttpOnly'] = null;
			}
			if (secure) {
				options['Secure'] = null;
			}
			options.SameSite = sameSite;
			if (!ctx.isWebSocket) {
				ctx.setResponseCookie(cookieName, '', options);
			}
		},
		toString: function (): string {
			const d = JSON.parse(JSON.stringify(this));
			d.data = data;
			const s = JSON.stringify(d);
			const zipData = zlib.gzipSync(Buffer.from(s, 'utf-8'));
			const cipher = crypto.createCipheriv('aes-128-ecb', serverKey, '');
			cipher.setAutoPadding(true);
			const d1 = cipher.update(zipData);
			const d2 = cipher.final();
			const encData = Buffer.concat([d1, d2], d1.length + d2.length);
			return encData.toString('base64');
		},
		createToken: function (info: { accessTime: number; createTime: number; data: { [key: string]: unknown } }): string {
			const s = JSON.stringify(info);
			const zipData = zlib.gzipSync(Buffer.from(s, 'utf-8'));
			const cipher = crypto.createCipheriv('aes-128-ecb', serverKey, '');
			cipher.setAutoPadding(true);
			const d1 = cipher.update(zipData);
			const d2 = cipher.final();
			const encData = Buffer.concat([d1, d2], d1.length + d2.length);
			return encData.toString('base64');
		},
	};

	Object.defineProperty(session, 'createTime', {
		writable: false,
		configurable: false,
	});
	Object.defineProperty(session, 'accessTime', {
		writable: false,
		configurable: false,
	});
	return session;
}

class SessionFactory implements MiddlewareFactory<SessionOptions> {
	create(
		app: Application,
		{
			serverKey = this.generateKey(),
			cookieName = 'app_token',
			maxAge = 1800,
			expireCheck,
			renew,
			intervalCheck = {
				value: 30,
				unit: 'm',
				action: 'logout',
			},
			domain,
			httpOnly = true,
			secure = false,
			sameSite = 'Lax',
		}: SessionOptions = {}
	): Middleware {
		const key = Buffer.from(serverKey, 'base64');

		const fn = async function (ctx: Context) {
			const cookies = ctx.getRequestCookies();
			const content = cookies && cookies[cookieName];
			let sessionInfo;
			if (content) {
				sessionInfo = await getSessionInfo(content, {
					serverKey: key,
					renew: renew,
					expireCheck: expireCheck,
					intervalCheck: intervalCheck,
				});
			}

			ctx.session = createSession(ctx, {
				info: sessionInfo,
				serverKey: key,
				cookieName: cookieName,
				maxAge: maxAge,
				domain: domain,
				httpOnly: httpOnly,
				secure: secure,
				sameSite: sameSite,
			});

			if (ctx.session) {
				if (!ctx.isWebSocket && ctx.method !== 'OPTIONS') {
					ctx.session.save();
				}
			}

			return false;
		};
		fn.supportWebSocket = true;
		return fn;
	}

	generateKey() {
		const id = uuidv1().replace(/-/g, '');
		const buffer = Buffer.from(id, 'hex');
		const key = buffer.toString('base64');
		return key;
	}
}

const sessionFactory = new SessionFactory();

export default sessionFactory;
