import iconv from 'iconv-lite';
import fs, { promises as pfs } from 'fs';
import { Schema, ValidationError } from 'thor-validation';
import {
	BasicBodyParser,
	FieldPart,
	MiddlewareFactory,
	FilePart,
	PartInfo,
	PartInfo2,
	MultipartOption,
} from '../types';
import Context from '../context';
import http from 'http';
import internal, { pipeline } from 'stream';
import { promisify } from 'util';
import busboy from 'busboy';
import { v1 as uuidv1 } from 'uuid';
import Path from 'path';
import { HttpError } from './controller';

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 10;

const pipe = promisify(pipeline);

class BufferStream extends internal.Writable {
	buffer = Buffer.alloc(0);
	_write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		callback(null);
	}
}

async function generateFile(storeDir: string): Promise<string> {
	const id = uuidv1().replace(/-/g, '');
	const path = Path.join(
		storeDir,
		id.substring(0, 6).replace(/.{3}/g, function (v) {
			return v + '/';
		})
	);
	await pfs.mkdir(path, { recursive: true });
	return path + id.substring(6) + '.data';
}

function generateParts(
	ctx: Context,
	req: http.IncomingMessage,
	options: MultipartOption
): AsyncIterator<FilePart | FieldPart> {
	const bb = busboy({
		defParamCharset: 'utf-8',
		headers: req.headers,
		limits: options,
	});
	const result: (FilePart | FieldPart)[] = [];
	let error: unknown = null;
	let done = false;
	let cb: (() => void) | null = null;
	bb.on('error', (err: unknown) => {
		error = err;
		cb?.();
	});
	bb.on('field', (name: string, value: string, info: busboy.FieldInfo) => {
		result.push({
			type: 'field',
			name,
			encoding: info.encoding,
			mimeType: info.mimeType,
			value,
		} as FieldPart);
		cb?.();
	});
	bb.on('file', (name: string, stream: internal.Readable, info: busboy.FileInfo) => {
		result.push({
			type: 'file',
			name,
			encoding: info.encoding,
			mimeType: info.mimeType,
			filename: info.filename,
			stream,
		} as FilePart);
		cb?.();
	});
	bb.on('close', () => {
		done = true;
		cb?.();
	});
	req.pipe(bb);
	return {
		next(): Promise<IteratorResult<FilePart | FieldPart>> {
			return new Promise<IteratorResult<FilePart | FieldPart>>((resolve, reject) => {
				function checkYield() {
					if (error) {
						reject(error);
						return true;
					} else if (result.length > 0) {
						resolve({
							value: result.shift(),
						} as IteratorYieldResult<FilePart | FieldPart>);
						return true;
					} else if (done) {
						resolve({
							done,
						} as IteratorReturnResult<FilePart | FieldPart>);
						return true;
					} else {
						return false;
					}
				}
				if (!checkYield()) {
					cb = () => {
						cb = null;
						checkYield();
					};
				}
			});
		},
	};
}

const ONLY_ONCE = 'Body can only be read once!';

function isFieldPart(part: PartInfo2): part is FieldPart {
	return part.type === 'field';
}

function createParser(ctx: Context, req: http.IncomingMessage): BasicBodyParser {
	let readed = false;
	// let cl = req.headers['content-length'];
	return {
		isJSON() {
			const ct = req.headers['content-type'] || '';
			return /^\s*application\/json\s*(;.+)?/i.test(ct);
		},
		isForm() {
			const ct = req.headers['content-type'] || '';
			return /^\s*application\/x-www-form-urlencoded\s*(;.+)?/i.test(ct);
		},
		isMultipart() {
			const ct = req.headers['content-type'] || '';
			return /^\s*multipart\/form-data\s*(;.+)?/i.test(ct);
		},
		getCharset() {
			const ct = req.headers['content-type'] || '';
			const m = /;\s*charset=([^;]+)/i.exec(ct);
			return (m && m[1]) || 'utf-8';
		},
		getMultipartBoundary() {
			const ct = req.headers['content-type'] || '';
			const m = /;\s*boundary=([^;]+)/i.exec(ct);
			return (m && m[1]) || null;
		},
		raw(): Promise<Buffer> {
			if (readed) {
				return Promise.reject(ONLY_ONCE);
			}
			readed = true;
			let buffer = Buffer.alloc(0);
			return new Promise(function (resolve, reject) {
				req.on('data', (chunk) => {
					buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
				});
				req.on('error', (err) => {
					reject(err);
				});
				req.on('end', () => {
					resolve(buffer);
				});
			});
		},
		async text() {
			const charset = this.getCharset();
			const buffer = await this.raw();
			return iconv.decode(buffer, charset, {
				stripBOM: true,
				defaultEncoding: 'utf-8',
			});
		},
		async json(schema?: Schema) {
			if (!this.isJSON()) {
				throw new ValidationError('Not a valid JSON data.');
			}
			const charset = this.getCharset();
			const buffer = await this.raw();
			let val;
			try {
				const jsonStr = iconv.decode(buffer, charset, {
					stripBOM: true,
					defaultEncoding: 'utf-8',
				});
				val = JSON.parse(jsonStr);
			} catch (e) {
				throw new ValidationError(`Not a valid JSON data: ${e}`);
			}
			if (schema instanceof Object && typeof schema.validate === 'function') {
				schema.validate(val);
			}
			return val;
		},
		async form(): Promise<URLSearchParams> {
			if (!this.isForm()) {
				return Promise.reject('Not a form data.');
			}
			const charset = this.getCharset();
			const buffer = await this.raw();
			const formStr = iconv.decode(buffer, charset, {
				stripBOM: true,
				defaultEncoding: 'utf-8',
			});
			return new URLSearchParams(formStr);
		},
		multipart2(options: MultipartOption = {}): AsyncIterable<FilePart | FieldPart> {
			if (readed) {
				throw new Error(ONLY_ONCE);
			}
			readed = true;
			if (!this.isMultipart()) {
				throw new Error('Not a multipart data!');
			}
			options.fileSize = options.fileSize ?? DEFAULT_MAX_FILE_SIZE;
			return {
				[Symbol.asyncIterator]() {
					return generateParts(ctx, req, options);
				},
			};
		},
		async multipart(storeDir: string | null = null, maxFileLength = DEFAULT_MAX_FILE_SIZE): Promise<PartInfo[]> {
			const parts: PartInfo[] = [];
			if (typeof storeDir === 'string') {
				if (!storeDir.endsWith('/')) {
					storeDir += '/';
				}
			} else {
				storeDir = null;
			}
			const limitReached: string[] = [];
			for await (const part of this.multipart2({
				fileSize: maxFileLength,
				breakOnFileSizeLimitReached: true,
			})) {
				if (isFieldPart(part)) {
					parts.push({
						length: 0,
						name: part.name,
						value: part.value,
						contentType: part.mimeType,
						charset: part.encoding,
					});
				} else {
					if (storeDir) {
						const file = await generateFile(storeDir);
						const outFileStream = fs.createWriteStream(file);
						await pipe(part.stream, outFileStream);
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						if ((part.stream as any).truncated) {
							limitReached.push(part.filename);
						}
						const size = (await pfs.stat(file)).size;
						parts.push({
							length: size,
							name: part.name,
							filename: part.filename,
							contentType: part.mimeType,
							charset: part.encoding,
							file,
						});
					} else {
						const memStream = new BufferStream();
						await pipe(part.stream, memStream);
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						if ((part.stream as any).truncated) {
							limitReached.push(part.filename);
						}
						parts.push({
							length: memStream.buffer.length,
							name: part.name,
							filename: part.filename,
							contentType: part.mimeType,
							charset: part.encoding,
							buffer: memStream.buffer,
						});
					}
				}
			}
			if (limitReached.length > 0) {
				throw new HttpError(413, 'File size limit reached: ' + limitReached);
			}
			return parts;
		},
	};
}

/**
 * Create body-parser middleware.
 */
class BodyParserFactory implements MiddlewareFactory<undefined> {
	create() {
		return async function (ctx: Context, req: http.IncomingMessage) {
			ctx.body = createParser(ctx, req);
			return false;
		};
	}
}

const bodyParser = new BodyParserFactory();
export default bodyParser;
