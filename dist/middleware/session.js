/**
 * @typedef {import('../context').default} Context
 */
import uuidv1 from 'uuid/v1.js';
import time from 'thor-time';
import zlib from 'zlib';
import crypto from 'crypto';
function getTimeDef(str) {
    let info;
    let match = /^(\d+)([smhd])$/.exec(str);
    if (match == null) {
        info = {
            value: 30,
            unit: 'm'
        };
    }
    else {
        info = {
            value: parseInt(match[1]),
            unit: match[2]
        };
    }
    return info;
}
async function getSessionInfo(content, { serverKey, renew, validTime, interval }) {
    try {
        if (!content) {
            return null;
        }
        let encData = Buffer.from(content, 'base64');
        let decipher = crypto.createDecipheriv('aes-128-ecb', serverKey, '');
        decipher.setAutoPadding(true);
        let d1 = decipher.update(encData);
        let d2 = decipher.final();
        let zipData = Buffer.concat([d1, d2], d1.length + d2.length);
        let rawData = zlib.gunzipSync(zipData).toString('utf8');
        let sessionInfo = JSON.parse(rawData);
        let now = time.now();
        if (!sessionInfo.validTime || now.getTime() < sessionInfo.validTime) {
            if (interval) {
                if (now < time.add(sessionInfo.accessTime, interval.value, interval.unit)) {
                    return sessionInfo;
                }
                else {
                    return null;
                }
            }
            else {
                return sessionInfo;
            }
        }
        else {
            if (typeof renew === 'function') {
                if (await renew(sessionInfo)) {
                    sessionInfo.validTime = validTime ? time.add(now, validTime.value, validTime.unit).getTime() : null;
                    return sessionInfo;
                }
                else {
                    return null;
                }
            }
            else {
                return null;
            }
        }
    }
    catch (e) {
        return null;
    }
}
/**
 *
 * @param {Context} ctx
 */
function createSession(ctx, { serverKey, cookieName, maxAge = -1, validTime = null, path = '/', domain = null, httpOnly = true, info = null, sameSite = 'Lax', secure = false }) {
    let data = info ? info.data : {};
    if (!(data instanceof Object)) {
        data = {};
    }
    let createTime = info ? info.createTime : new Date().getTime();
    let session = {
        accessTime: new Date().getTime(),
        createTime: createTime,
        validTime: info ? info.validTime : (validTime ? time.add(createTime, validTime.value, validTime.unit).getTime() : null),
        get: function (key) {
            return data[key];
        },
        set: function (key, value) {
            if (key instanceof Object && typeof value === 'undefined') {
                for (let k in key) {
                    if (Object.prototype.hasOwnProperty.call(key, k)) {
                        data[k] = key[k];
                    }
                }
            }
            else {
                data[key] = value;
            }
            this.save();
        },
        remove: function (key) {
            delete data[key];
            this.save();
        },
        clear: function () {
            for (let k in data) {
                delete data[k];
            }
            this.save();
        },
        save: function (opt) {
            if (typeof opt === 'number') {
                opt = {
                    maxAge: opt
                };
            }
            else if (typeof opt !== 'object' || !opt) {
                opt = {};
            }
            let token = this.toString();
            let options = {};
            options['Max-Age'] = typeof opt.maxAge === 'number' ? opt.maxAge : maxAge;
            if (opt.domain || domain) {
                options.Domain = opt.domain || domain;
            }
            options.Path = opt.path || path;
            if (typeof opt.httpOnly === 'boolean') {
                if (opt.httpOnly) {
                    options['HttpOnly'] = null;
                }
            }
            else if (httpOnly) {
                options['HttpOnly'] = null;
            }
            if (typeof opt.secure === 'boolean') {
                if (opt.secure) {
                    options['Secure'] = null;
                }
            }
            else if (secure) {
                options['Secure'] = null;
            }
            options.SameSite = opt.sameSite || sameSite;
            ctx.setResponseCookie(cookieName, token, options);
        },
        delete: function () {
            let options = {};
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
            }
            catch (e) {
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
    let key = buffer.toString('base64');
    return key;
}
/**
 * Create session manager middleware
 * @param {SessionOptions} options Options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
function create({ serverKey = generateKey(), cookieName = 'ez_app', maxAge = 1800, validTime, renew, interval = '15d', domain, httpOnly = true, secure = false, sameSite = 'Lax', } = {}) {
    let key = Buffer.from(serverKey || generateKey(), 'base64');
    let _expire = validTime ? getTimeDef(validTime) : null;
    let _interval = interval ? getTimeDef(interval) : null;
    return async function (ctx, req) {
        req.cookies = ctx.getRequestCookies(req);
        let content = req.cookies && req.cookies[cookieName];
        let sessionInfo = content && await getSessionInfo(content, {
            serverKey: key,
            renew: renew,
            validTime: _expire,
            interval: _interval
        });
        ctx.session = createSession(ctx, {
            info: sessionInfo,
            serverKey: key,
            cookieName: cookieName,
            maxAge: maxAge,
            validTime: _expire,
            domain: domain,
            httpOnly: httpOnly,
            secure: secure,
            sameSite: sameSite
        });
        if (ctx.session) {
            ctx.session.save();
        }
        return false;
    };
}
export default {
    create,
    generateKey
};
