import uuidv1 from 'uuid/v1';
import time from 'thor-time';
import zlib from 'zlib';
import crypto from 'crypto';
import { Middleware, MiddlewareFactory, SaveOptions, Session } from '../types';
import Context from '../context';

export type TimeCheck = {
	value: number;
	unit?: 'y' | 'M' | 'd' | 'h' | 'm' | 's' | 'ms';
	action?: 'renew' | 'logout';
};

export type SessionInfo = {
	createTime: number;
	accessTime: number;
	data: { [key: string]: unknown };
};

type SessionInfoOptions = {
	serverKey: Buffer;
	renew?: (sessionInfo: SessionInfo) => Promise<boolean>;
	expireCheck?: TimeCheck;
	intervalCheck?: TimeCheck;
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
			const checkValidTime = (time.add(sessionInfo.createTime, expireCheck.value, expireCheck.unit) as Date).getTime();
			if (now.getTime() >= checkValidTime) {
				if (expireCheck.action === 'renew') {
					needRenew = true;
				} else {
					return null;
				}
			}
		}

		if (intervalCheck) {
			const checkIntervalTime = (time.add(
				sessionInfo.accessTime,
				intervalCheck.value,
				intervalCheck.unit
			) as Date).getTime();
			if (now.getTime() >= checkIntervalTime) {
				if (intervalCheck.action === 'renew') {
					needRenew = true;
				} else {
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

export type SessionOptions = {
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
	renew?: (sessionInfo: unknown) => Promise<boolean>;
	expireCheck?: TimeCheck;
	intervalCheck?: TimeCheck;
	domain?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
};

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
		maxAge = -1,
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
	const session = {
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
				this.save();
			} else if (typeof key === 'string') {
				data[key] = value;
				this.save();
			}
		},
		remove: function (key: string) {
			delete data[key];
			this.save();
		},
		clear: function () {
			for (const k in data) {
				delete data[k];
			}
			this.save();
		},
		save: function (opt?: SaveOptions | number) {
			if (typeof opt === 'number') {
				opt = {
					maxAge: opt,
				} as SaveOptions;
			} else if (typeof opt !== 'object' || !opt) {
				opt = {} as SaveOptions;
			}
			const token = this.toString();
			const options: { [key: string]: string | number | null } = {};
			options['Max-Age'] = typeof opt.maxAge === 'number' ? opt.maxAge : maxAge;
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
			ctx.setResponseCookie(cookieName, token, options);
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
			ctx.setResponseCookie(cookieName, '', options);
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

class SessionFactory implements MiddlewareFactory {
	create({
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
	}: SessionOptions = {}): Middleware {
		const key = Buffer.from(serverKey, 'base64');

		return async function (ctx) {
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
				ctx.session.save();
			}

			return false;
		};
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
