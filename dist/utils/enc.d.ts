/**
 * Encrypt data
 * @param key Base64 format server key
 * @param value Any data will be enc
 * @returns Encrypted data encoding with base64.
 */
declare function encrypt(key: string, value: unknown): string;
/**
 * Decrypt data
 * @param key Base64 format server key
 * @param base64data Encrypted base64 string
 * @returns Decrypted data
 */
declare function decrypt(key: string, base64data: string): unknown;
declare const _default: {
	encrypt: typeof encrypt;
	decrypt: typeof decrypt;
};
export default _default;
