'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
const uuid_1 = require('uuid');
const thor_time_1 = __importDefault(require('thor-time'));
const zlib_1 = __importDefault(require('zlib'));
const crypto_1 = __importDefault(require('crypto'));
async function getSessionInfo(content, { serverKey, renew, expireCheck, intervalCheck }) {
	try {
		if (!content) {
			return null;
		}
		const encData = Buffer.from(content, 'base64');
		const decipher = crypto_1.default.createDecipheriv('aes-128-ecb', serverKey, '');
		decipher.setAutoPadding(true);
		const d1 = decipher.update(encData);
		const d2 = decipher.final();
		const zipData = Buffer.concat([d1, d2], d1.length + d2.length);
		const rawData = zlib_1.default.gunzipSync(zipData).toString('utf8');
		const sessionInfo = JSON.parse(rawData);
		if (!sessionInfo) {
			return null;
		}
		const now = thor_time_1.default.now();
		let needRenew = false;
		if (expireCheck) {
			console.log('perform expire check ...');
			const checkValidTime = thor_time_1.default
				.add(sessionInfo.createTime, expireCheck.value, expireCheck.unit)
				.getTime();
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
			console.log('perform interval check ...');
			const checkIntervalTime = thor_time_1.default
				.add(sessionInfo.accessTime, intervalCheck.value, intervalCheck.unit)
				.getTime();
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
function createSession(
	ctx,
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
	}
) {
	let data = info ? info.data : {};
	if (!(data instanceof Object)) {
		data = {};
	}
	const createTime = info ? info.createTime : new Date().getTime();
	const session = {
		accessTime: new Date().getTime(),
		createTime: createTime,
		get: function (key) {
			return data[key];
		},
		set: function (key, value) {
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
		remove: function (key) {
			delete data[key];
			!ctx.isWebSocket && this.save();
		},
		clear: function () {
			for (const k in data) {
				delete data[k];
			}
			!ctx.isWebSocket && this.save();
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
			if (!ctx.isWebSocket) {
				ctx.setResponseCookie(cookieName, '', options);
			}
		},
		toString: function () {
			const d = JSON.parse(JSON.stringify(this));
			d.data = data;
			const s = JSON.stringify(d);
			const zipData = zlib_1.default.gzipSync(Buffer.from(s, 'utf-8'));
			const cipher = crypto_1.default.createCipheriv('aes-128-ecb', serverKey, '');
			cipher.setAutoPadding(true);
			const d1 = cipher.update(zipData);
			const d2 = cipher.final();
			const encData = Buffer.concat([d1, d2], d1.length + d2.length);
			return encData.toString('base64');
		},
		createToken: function (info) {
			const s = JSON.stringify(info);
			const zipData = zlib_1.default.gzipSync(Buffer.from(s, 'utf-8'));
			const cipher = crypto_1.default.createCipheriv('aes-128-ecb', serverKey, '');
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
class SessionFactory {
	create(
		app,
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
		} = {}
	) {
		const key = Buffer.from(serverKey, 'base64');
		const fn = async function (ctx) {
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
				if (!ctx.isWebSocket) {
					ctx.session.save();
				}
			}
			return false;
		};
		fn.supportWebSocket = true;
		return fn;
	}
	generateKey() {
		const id = uuid_1.v1().replace(/-/g, '');
		const buffer = Buffer.from(id, 'hex');
		const key = buffer.toString('base64');
		return key;
	}
}
const sessionFactory = new SessionFactory();
exports.default = sessionFactory;
//# sourceMappingURL=session.js.map
