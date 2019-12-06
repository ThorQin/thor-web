const
	zlib = require('zlib'),
	crypto = require('crypto');

/**
 * Encrypt data
 * @param {string} key Base64 format server key
 * @param {any} value Any data will be enc
 * @returns {string} Encrypted data encoding with base64.
 */
exports.encrypt = function (key, value) {
	let serverKey = Buffer.from(key, 'base64');
	let s = JSON.stringify(value);
	let zipData = zlib.gzipSync(Buffer.from(s, 'utf-8'));
	let cipher = crypto.createCipheriv('aes-128-ecb', serverKey, '');
	cipher.setAutoPadding(true);
	let d1 = cipher.update(zipData);
	let d2 = cipher.final();
	let encData = Buffer.concat([d1, d2], d1.length + d2.length);
	return encData.toString('base64');
};

/**
 * Decrypt data
 * @param {string} key Base64 format server key
 * @param {string} base64data Encrypted base64 string
 * @returns {any} Decrypted data
 */
exports.decrypt = function (key, base64data) {
	let serverKey = Buffer.from(key, 'base64');
	let encData = Buffer.from(base64data, 'base64');
	let decipher = crypto.createDecipheriv('aes-128-ecb', serverKey, '');
	decipher.setAutoPadding(true);
	let d1 = decipher.update(encData);
	let d2 = decipher.final();
	let zipData = Buffer.concat([d1, d2], d1.length + d2.length);
	let rawData = zlib.gunzipSync(zipData).toString('utf8');
	return JSON.parse(rawData);
};
