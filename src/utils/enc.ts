import zlib from 'zlib';
import crypto from 'crypto';

/**
 * Encrypt data
 * @param key Base64 format server key
 * @param value Any data will be enc
 * @returns Encrypted data encoding with base64.
 */
function encrypt(key: string, value: any): string {
	const serverKey = Buffer.from(key, 'base64');
	const s = JSON.stringify(value);
	const zipData = zlib.gzipSync(Buffer.from(s, 'utf-8'));
	const cipher = crypto.createCipheriv('aes-128-ecb', serverKey, '');
	cipher.setAutoPadding(true);
	const d1 = cipher.update(zipData);
	const d2 = cipher.final();
	const encData = Buffer.concat([d1, d2], d1.length + d2.length);
	return encData.toString('base64');
}

/**
 * Decrypt data
 * @param key Base64 format server key
 * @param base64data Encrypted base64 string
 * @returns Decrypted data
 */
function decrypt(key: string, base64data: string): any {
	const serverKey = Buffer.from(key, 'base64');
	const encData = Buffer.from(base64data, 'base64');
	const decipher = crypto.createDecipheriv('aes-128-ecb', serverKey, '');
	decipher.setAutoPadding(true);
	const d1 = decipher.update(encData);
	const d2 = decipher.final();
	const zipData = Buffer.concat([d1, d2], d1.length + d2.length);
	const rawData = zlib.gunzipSync(zipData).toString('utf8');
	return JSON.parse(rawData);
}

export default {
	encrypt,
	decrypt,
};
