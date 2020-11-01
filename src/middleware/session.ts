import uuidv1 from 'uuid/v1.js';
import time from 'thor-time';
import zlib from 'zlib';
import crypto from 'crypto';
import { Middleware, MiddlewareFactory, Session } from '../defs';

function getTimeDef(str: string) {
	let info;
	const match = /^(\d+)([smhd])$/.exec(str);
	if (match == null) {
		info = {
			value: 30,
			unit: 'm',
		};
	} else {
		info = {
			value: parseInt(match[1]),
			unit: match[2],
		};
	}
	return info;
}

type Interval = {
	value: number;
	unit: string;
};

type SessionInfoOptions = {
	serverKey: string;
	renew: () => void;
	validTime: number;
	interval: Interval;
};

type SessionInfo = {
	createTime: number;
	validTime: number;
	accessTime: number;
	data: { [key: string]: unknown };
};

async function getSessionInfo(content: string, { serverKey, renew, validTime, interval }: SessionInfoOptions): Promise<SessionInfo | null> {
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
		if (!sessionInfo.validTime || now.getTime() < sessionInfo.validTime) {
			if (interval) {
				if (now < time.add(sessionInfo.accessTime, interval.value, interval.unit)) {
					return sessionInfo;
				} else {
					return null;
				}
			} else {
				return sessionInfo;
			}
		} else {
			if (typeof renew === 'function') {
				if (await renew(sessionInfo)) {
					sessionInfo.validTime = validTime ? time.add(now, validTime.value, validTime.unit).getTime() : null;
					return sessionInfo;
				} else {
					return null;
				}
			} else {
				return null;
			}
		}
	} catch (e) {
		return null;
	}
}

/**
 *
 * @param {Context} ctx
 */
function createSession(
	ctx,
	{
		serverKey,
		cookieName,
		maxAge = -1,
		validTime = null,
		path = '/',
		domain = null,
		httpOnly = true,
		info = null,
		sameSite = 'Lax',
		secure = false,
	}
): Session {
	let data = info ? info.data : {};
	if (!(data instanceof Object)) {
		data = {};
	}
	const createTime = info ? info.createTime : new Date().getTime();
	const session = {
		accessTime: new Date().getTime(),
		createTime: createTime,
		validTime: info
			? info.validTime
			: validTime
				? time.add(createTime, validTime.value, validTime.unit).getTime()
				: null,
		get: function (key) {
			return data[key];
		},
		set: function (key, value) {
			if (key instanceof Object && typeof value === 'undefined') {
				for (const k in key) {
					if (Object.prototype.hasOwnProperty.call(key, k)) {
						data[k] = key[k];
					}
				}
			} else {
				data[key] = value;
			}
			this.save();
		},
		remove: function (key) {
			delete data[key];
			this.save();
		},
		clear: function () {
			for (const k in data) {
				delete data[k];
			}
			this.save();
		},
		save: function (opt) {
			if (typeof opt === 'number') {
				opt = {
					maxAge: opt,
				};
			} else if (typeof opt !== 'object' || !opt) {
				opt = {};
			}
			const token = this.toString();
			const options = {};
			options['Max-Age'] = typeof opt.maxAge === 'number' ? opt.maxAge : maxAge;
			if (opt.domain || domain) {
				options.Domain = opt.domain || domain;
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
			const options = {};
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
		toString: function () {
			try {
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
			} catch (e) {
				console.log('Session toString() error: ', e.message || e + '', e.stack);
				return null;
			}
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

type SessionOptions = {
	/**
	 * Server key for AES128 encryption encoded by BASE64 (key = 16 bytes raw data -> base64)
	 */
	serverKey?: string;
	cookieName?: string;
	/**
	 * value <= 0: delete cookie, value > 0: how long the cookie will be kept(in seconds)
	 */
	maxAge?: number;
	renew?: (sessionInfo: any) => boolean;
	validTime?: string;
	interval?: string;
	domain?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'None' | 'Lax' | 'Strict';
};

class SessionFactory implements MiddlewareFactory {
	create({
		serverKey = generateKey(),
		cookieName = 'ez_app',
		maxAge = 1800,
		validTime,
		renew,
		interval = '15d',
		domain,
		httpOnly = true,
		secure = false,
		sameSite = 'Lax',
	}: SessionOptions = {}): Middleware {
		const key = Buffer.from(serverKey || generateKey(), 'base64');
		const _expire = validTime ? getTimeDef(validTime) : null;
		const _interval = interval ? getTimeDef(interval) : null;

		return async function (ctx, req) {
			req.cookies = ctx.getRequestCookies(req);
			const content = req.cookies && req.cookies[cookieName];
			const sessionInfo =
				content &&
				(await getSessionInfo(content, {
					serverKey: key,
					renew: renew,
					validTime: _expire,
					interval: _interval,
				}));

			ctx.session = createSession(ctx, {
				info: sessionInfo,
				serverKey: key,
				cookieName: cookieName,
				maxAge: maxAge,
				validTime: _expire,
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
