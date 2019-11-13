
const
	uuidv1 = require('uuid/v1'),
	time = require('../utils/time'),
	zlib = require('zlib'),
	crypto = require('crypto');

function getTimeDef(str) {
	let info;
	let match = /^(\d+)([smhd])$/.exec(str);
	if (match == null) {
		info = {
			value: 30,
			unit: 'm'
		};
	} else {
		info = {
			value: parseInt(match[1]),
			unit: match[2]
		};
	}
	return info;
}

async function getSessionInfo(content, { serverKey, renew, expire, interval }) {
	try {
		let encData = Buffer.from(content, 'base64');
		let decipher = crypto.createDecipheriv('aes-128-ecb', serverKey, '');
		decipher.setAutoPadding(true);
		let d1 = decipher.update(encData);
		let d2 = decipher.final();
		let zipData = Buffer.concat([d1, d2], d1.length + d2.length);
		let rawData = zlib.gunzipSync(zipData).toString('utf8');
		let sessionInfo = JSON.parse(rawData);
		let now = time.now();
		if (!sessionInfo.expireTime || now < sessionInfo.expireTime) {
			if (interval) {
				if (now < time.dateAdd(sessionInfo.accessTime, interval.value, interval.unit)) {
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
					sessionInfo.expireTime = expire ? time.dateAdd(now, expire.value, expire.unit).getTime() : null;
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

function createSession(ctx, { serverKey, cookieName, expire = null, domain = null, httpOnly = true, info = null }) {
	let data = info ? info.data : {};
	if (!(data instanceof Object)) {
		data = {};
	}
	let createTime = info ? info.createTime : new Date().getTime();
	let session = {
		accessTime: new Date().getTime(),
		createTime: createTime,
		expireTime: info ? info.expireTime : (expire ? time.dateAdd(createTime, expire.value, expire.unit).getTime() : null ),
		get: function(key) {
			return data[key];
		},
		set: function(key, value) {
			if (key instanceof Object && typeof value === 'undefined') {
				for (let k in key) {
					if (Object.prototype.hasOwnProperty.call(key, k)) {
						data[k] = key[k];
					}
				}
			} else {
				data[key] = value;
			}
			this.save();
		},
		remove: function(key) {
			delete data[key];
			this.save();
		},
		clear: function() {
			for (let k in data) {
				delete data[k];
			}
			this.save();
		},
		save: function() {
			let token = this.toString();
			let options = {};
			if (this.expireTime) {
				options.Expires = time.formatDate(this.expireTime, 'EEE, dd-MMM-yyyy HH:mm:ss Z').replace('Z', 'GMT');
			}
			if (domain) {
				options.Domain = domain;
			}
			if (httpOnly) {
				options['HttpOnly'] = null;
			}
			ctx.setResponseCookie(cookieName, token, options);
		},
		delete: function() {
			ctx.removeResponseCookie(cookieName);
		},
		toString: function() {
			try {
				let d = JSON.parse(JSON.stringify(this));
				d.data = data;
				let s = JSON.stringify(d);
				let zipData = zlib.gzipSync(Buffer.from(s, 'utf-8'));
				let cipher = crypto.createCipheriv('aes-128-ecb', serverKey, '');
				cipher.setAutoPadding(true);
				let d1 = cipher.update(zipData);
				let d2 = cipher.final();
				let encData = Buffer.concat([d1, d2], d1.length + d2.length);
				return encData.toString('base64');
			} catch (e) {
				console.log('Session toString() error: ', e.message || e + '', e.stack);
				return null;
			}
		}
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

function generateKey() {
	let id = uuidv1().replace(/-/g, '');
	let buffer = Buffer.from(id, 'hex');
	console.log(buffer.toString('base64'));
}

/**
 * Create session manager middleware
 * @param {string} serverKey Server key for AES128 encryption encoded by BASE64 (key = 16 bytes raw data -> base64)
 * @param {Object} options Options
 * @returns {(ctx, req, rsp) => boolean}
 */
function create(
	serverKey = generateKey(),
	{
		cookieName = 'ez_app',
		renew = null,
		expire = null,
		interval = '15d',
		domain = null,
		httpOnly = true
	} = {}) {
	let key = Buffer.from(serverKey, 'base64');
	let _expire = expire ? getTimeDef(expire) : null;
	let _interval = interval ? getTimeDef(interval) : null;

	return async function (ctx, req, rsp) {
		req.cookies = ctx.getRequestCookies(req);
		let content = req.cookies && req.cookies[cookieName];
		let sessionInfo = content && await getSessionInfo(content, {
			serverKey: key,
			cookieName: cookieName,
			renew: renew,
			expire: _expire,
			interval: _interval
		});

		// eslint-disable-next-line require-atomic-updates
		ctx.session = createSession(ctx, {
			info: sessionInfo,
			serverKey: key,
			cookieName: cookieName,
			expire: _expire,
			domain: domain,
			httpOnly: httpOnly
		});

		if (ctx.session) {
			ctx.session.save();
		}

		return false;
	};
}



module.exports = {
	create: create,
	generateKey: generateKey
};
