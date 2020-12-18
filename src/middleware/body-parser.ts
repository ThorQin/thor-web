import qs from 'querystring';
import iconv from 'iconv-lite';
import uuidv1 from 'uuid/v1';
import fs from 'fs';
import { Schema, ValidationError } from 'thor-validation';
import { BasicBodyParser, MiddlewareFactory, PartInfo } from '../types';
import Context from '../context';
import http from 'http';

const STATE_BEGIN = 0;
const STATE_HEADER = 1;
const STATE_CONTENT = 2;

//const gb2utf8 = new Iconv('gb18030', 'utf8');
function decodeURIComponentGB(str: string): string {
	const buffer = Buffer.alloc(str.length);
	let state = 0;
	let len = 0;
	let v;
	for (let i = 0; i < str.length; i++) {
		const c = str[i];
		if (state === 0) {
			if (c === '%') {
				state = 1;
				v = '';
			} else {
				buffer.write(c, len);
				len++;
			}
		} else {
			v += c;
			if (state === 1) {
				state = 2;
			} else {
				buffer.writeUInt8(parseInt('0x' + v), len);
				len++;
				state = 0;
			}
		}
	}
	// return gb2utf8.convert(buffer.slice(0, len)).toString('utf-8');
	return iconv.decode(buffer.slice(0, len), 'gb18030');
}

type HeaderValue = {
	value: string;
	[key: string]: string | null;
};

type Headers = {
	[key: string]: HeaderValue;
};

function parseHeaderLine(headers: Headers, line: string): void {
	const arr = /^([^:]+)\s*:\s*([^;]+)(?:;(.+))?$/.exec(line);
	if (!arr) {
		return;
	}
	const key = arr[1].trim().toLowerCase();
	const value = arr[2].trim().toLowerCase();
	if (!key || !value) {
		return;
	}
	const values: HeaderValue = {
		value: value,
	};
	headers[key] = values;
	const params = arr[3];
	if (params) {
		const regex = /([^=;]+)=(?:"([^"]*)"|'([^']*)'|([^;]*))/g;
		let pair;
		while ((pair = regex.exec(params)) !== null) {
			const k = pair[1] ? pair[1].trim() : null;
			const str = pair[2] || pair[3] || pair[4] || null;
			if (!k) {
				continue;
			}
			let v;
			if (k.endsWith('*')) {
				// RFC 5987
				const m = /^(utf-8|iso-8859-1)'[^']*'(.+)$/i.exec(str || '');
				if (m == null) {
					continue;
				}
				if (m[1].trim() == 'utf-8') {
					v = decodeURIComponent(m[2]);
				} else {
					v = decodeURIComponentGB(m[2]);
				}
			} else {
				v = str;
			}
			values[k] = v;
		}
	}
}

function paserHeaders(lines: string[]): Headers {
	const headers: Headers = {};
	let line = null;
	for (const l of lines) {
		if (/^\s+/.test(l)) {
			if (line == null) {
				continue;
			}
			line += l.trim();
		} else {
			if (line !== null) {
				parseHeaderLine(headers, line);
			}
			line = l;
		}
	}
	if (line !== null) {
		parseHeaderLine(headers, line);
	}
	return headers;
}

function generateFile(storeDir: string): Promise<string> {
	const id = uuidv1().replace(/-/g, '');
	const path =
		storeDir +
		id.substring(0, 6).replace(/.{3}/g, function (v) {
			return v + '/';
		});
	return new Promise((resolve, reject) => {
		fs.mkdir(
			path,
			{
				recursive: true,
			},
			function (err) {
				if (err) {
					return reject(err);
				}
				const file = path + id.substring(6) + '.data';
				return resolve(file);
			}
		);
	});
}

type ParserOptions = {
	boundary: string | null;
	maxLength: number;
	storeDir: string | null;
	onPart: (partInfo: PartInfo) => void;
	onError: (err?: unknown) => void;
	onEnd: () => void;
	onEmpty: () => void;
};

type Pos = {
	pos: number;
	lead: number;
	eof: boolean;
};

function invalidStateError(): string {
	return 'internal error: invalid partInfo state.';
}

class Parser {
	push: (chunk: Buffer) => void;
	end: () => void;

	constructor({ boundary, maxLength, storeDir, onPart, onError, onEnd, onEmpty }: ParserOptions) {
		const boundaryBegin = '--' + boundary;
		const boundaryEnd = boundaryBegin + '--';
		let buffer = Buffer.alloc(0);
		let state = STATE_BEGIN;
		let lineBegin = 0;
		let headerLines: string[] = [];
		let partInfo: PartInfo | null = null;
		let lastPos = 0;
		let parsing = false;
		let finished = false;
		let prevChar = 0;
		let noMoreData = false;

		function nextReturn(): Pos | null {
			for (let i = lastPos; i < buffer.length; i++) {
				const c = buffer[i];
				if (c == 10) {
					const rt = { pos: i, lead: prevChar == 13 ? 1 : 0, eof: false };
					lastPos = i + 1;
					prevChar = c;
					return rt;
				} else {
					prevChar = c;
				}
			}
			lastPos = buffer.length;
			if (noMoreData) {
				return { pos: buffer.length, lead: 0, eof: true };
			} else {
				return null;
			}
		}

		function onBegin(lfPos: Pos): Promise<void> {
			const line = buffer.toString('ascii', lineBegin, lfPos.pos).trim();
			if (line !== boundaryBegin) {
				lineBegin = lfPos.pos + 1;
				return Promise.resolve();
			}
			partInfo = {
				length: 0,
				name: null,
				filename: null,
				contentType: null,
				charset: null,
				file: null,
				fd: undefined,
				buffer: null,
			};
			headerLines = [];
			state = STATE_HEADER;
			buffer = buffer.slice(lfPos.pos + 1);
			lastPos = 0;
			lineBegin = 0;
			return Promise.resolve();
		}

		function onHead(lfPos: Pos): Promise<void> {
			const line = buffer.toString('utf-8', lineBegin, lfPos.pos).trim();
			buffer = buffer.slice(lfPos.pos + 1);
			lastPos = 0;
			lineBegin = 0;
			if (!partInfo) {
				return Promise.reject(new Error('internal error: invalid partInfo state'));
			}
			if (line.length === 0) {
				// HEADER OVER
				const headers = paserHeaders(headerLines);
				state = STATE_CONTENT;
				const cd = headers['content-disposition'];
				if (cd) {
					partInfo.name = cd['name'] || null;
					const ct = headers['content-type'];
					if (ct) {
						partInfo.contentType = ct.value;
						partInfo.charset = ct.charset || null;
					}
					const filename = cd['filename*'] || cd['filename'] || null;
					partInfo.filename = filename;
					if (filename != null && storeDir) {
						return generateFile(storeDir).then(function (file) {
							if (partInfo) {
								partInfo.file = file;
							}
							return new Promise(function (resolve, reject) {
								if (partInfo && partInfo.file) {
									fs.open(partInfo.file, 'a', function (err, fd) {
										if (err) {
											reject(err);
											return;
										}
										if (partInfo) {
											partInfo.fd = fd;
											resolve();
										} else {
											reject(invalidStateError());
										}
									});
								} else {
									reject(invalidStateError());
								}
							});
						});
					} else {
						partInfo.buffer = Buffer.alloc(0);
						return Promise.resolve();
					}
				} else {
					partInfo.buffer = Buffer.alloc(0);
					return Promise.resolve();
				}
			} else {
				headerLines.push(line);
				return Promise.resolve();
			}
		}

		function onBody(lfPos: Pos) {
			if (!partInfo) {
				return Promise.reject(new Error(''));
			}

			const line = buffer.toString('ascii', lineBegin, lfPos.pos).trim();
			let writeBuffer: Buffer;
			if (line === boundaryEnd) {
				finished = true;
			}
			if (line === boundaryBegin || line === boundaryEnd) {
				writeBuffer = buffer.slice(0, lineBegin - (1 + lfPos.lead));
				buffer = buffer.slice(lineBegin);
				lastPos = 0;
				lineBegin = 0;
				state = STATE_BEGIN;
				partInfo.over = true;
			} else {
				writeBuffer = buffer.slice(0, lfPos.pos - lfPos.lead); // without newline
				buffer = buffer.slice(lfPos.pos - lfPos.lead);
				lineBegin = 1 + lfPos.lead;
				lastPos = 1 + lfPos.lead;
			}
			if (partInfo.fd) {
				return new Promise(function (resolve, reject) {
					if (!partInfo || !partInfo.fd) {
						reject(invalidStateError());
						return;
					}
					fs.write(partInfo.fd, writeBuffer, function (err) {
						if (!partInfo || !partInfo.fd) {
							reject(invalidStateError());
							return;
						}
						if (err) {
							if (partInfo && partInfo.fd) {
								fs.close(partInfo.fd, () => {
									// do nothing
								});
							}
							reject(err);
							return;
						}
						partInfo.length += writeBuffer.length;
						if (partInfo.length > maxLength) {
							reject('Exceed content size limitation!');
						} else if (partInfo.over) {
							delete partInfo.over;
							fs.close(partInfo.fd, function (err) {
								if (partInfo) {
									delete partInfo.fd;
								} else {
									reject(invalidStateError());
									return;
								}
								if (err) {
									reject(err);
									return;
								}
								onPart(partInfo);
								partInfo = null;
								resolve();
							});
						} else {
							resolve();
						}
					});
				});
			} else {
				partInfo.buffer = Buffer.concat(
					[partInfo.buffer as Buffer, writeBuffer],
					(partInfo.buffer as Buffer).length + writeBuffer.length
				);
				partInfo.length = partInfo.buffer.length;
				if (partInfo.length > maxLength) {
					return Promise.reject('Exceed content size limitation!');
				} else if (partInfo.over) {
					delete partInfo.over;
					onPart(partInfo);
					partInfo = null;
				}
				return Promise.resolve();
			}
		}

		async function* parseLoop() {
			let i;
			while ((i = nextReturn()) != null && !finished) {
				if (state === STATE_BEGIN) {
					yield onBegin(i);
				} else if (state === STATE_HEADER) {
					yield onHead(i);
				} else {
					yield onBody(i);
				}
				if (i.eof) {
					break;
				}
			}
		}

		async function parseBuffer() {
			if (!parsing) {
				parsing = true;
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of parseLoop());
				parsing = false;
				if (finished || noMoreData) {
					onEnd();
				} else {
					onEmpty();
				}
			} else {
				// console.log('reenter parseBuffer...');
			}
		}

		this.push = function (chunk) {
			buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
			parseBuffer().catch(function (err) {
				onError(err);
			});
		};

		this.end = function () {
			// console.log('data end');
			noMoreData = true;
			if (!finished && !parsing) {
				parseBuffer().catch(function (err) {
					onError(err);
				});
			}
		};
	}
}

function createParser(req: http.IncomingMessage): BasicBodyParser {
	let finished = false;
	// let cl = req.headers['content-length'];
	return {
		isJSON: function () {
			const ct = req.headers['content-type'] || '';
			return /^\s*application\/json\s*(;.+)?/i.test(ct);
		},
		isForm: function () {
			const ct = req.headers['content-type'] || '';
			return /^\s*application\/x-www-form-urlencoded\s*(;.+)?/i.test(ct);
		},
		isMultipart: function () {
			const ct = req.headers['content-type'] || '';
			return /^\s*multipart\/form-data\s*(;.+)?/i.test(ct);
		},
		getCharset: function () {
			const ct = req.headers['content-type'] || '';
			const m = /;\s*charset=([^;]+)/i.exec(ct);
			return (m && m[1]) || 'utf-8';
		},
		getMultipartBoundary: function () {
			const ct = req.headers['content-type'] || '';
			const m = /;\s*boundary=([^;]+)/i.exec(ct);
			return (m && m[1]) || null;
		},
		raw: function (): Promise<Buffer> {
			if (finished) {
				return Promise.reject('Body can only be read once!');
			}
			let buffer = Buffer.alloc(0);
			return new Promise(function (resolve, reject) {
				req.on('data', (chunk) => {
					buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
				});
				req.on('error', (err) => {
					finished = true;
					reject(err);
				});
				req.on('end', () => {
					finished = true;
					resolve(buffer);
				});
			});
		},
		text: function () {
			const charset = this.getCharset();
			return this.raw().then(function (buffer) {
				return iconv.decode(buffer, charset, {
					stripBOM: true,
					defaultEncoding: 'utf-8',
				});
			});
		},
		json: async function (schema?: Schema) {
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
				throw new ValidationError(`Not a valid JSON data: ${e.message}`);
			}
			if (schema instanceof Object && typeof schema.validate === 'function') {
				schema.validate(val);
			}
			return val;
		},
		form: function (): Promise<NodeJS.Dict<string | string[]>> {
			if (!this.isForm()) {
				return Promise.reject('Not a form data.');
			}
			const charset = this.getCharset();
			return this.raw().then(function (buffer) {
				return qs.parse(
					iconv.decode(buffer, charset, {
						stripBOM: true,
						defaultEncoding: 'utf-8',
					})
				);
			});
		},
		multipart: function (storeDir: string | null = null, maxLength = 1024 * 1024 * 10): Promise<PartInfo[]> {
			if (finished) {
				return Promise.reject('Body can only be read once!');
			}
			if (!this.isMultipart()) {
				return Promise.reject('Not a multipart data!');
			}
			if (typeof storeDir === 'string') {
				if (!storeDir.endsWith('/')) {
					storeDir += '/';
				}
			} else {
				storeDir = null;
			}

			const parts: PartInfo[] = [];
			return new Promise((resolve, reject) => {
				let empty = true;

				function readData() {
					if (empty) {
						const buffer = req.read();
						if (buffer != null) {
							empty = false;
							// console.log('push data: ', buffer.length);
							parser.push(buffer);
						}
					}
				}

				const parser = new Parser({
					boundary: this.getMultipartBoundary(),
					maxLength: maxLength,
					storeDir: storeDir,
					onPart: (part) => {
						// console.log('multipart onPart()');
						parts.push(part);
					},
					onError: (err) => {
						finished = true;
						// console.error(`multipart onError: ${err}`);
						reject(err);
					},
					onEnd: () => {
						finished = true;
						// console.log('multipart onEnd()');
						resolve(parts);
					},
					onEmpty: () => {
						empty = true;
						// console.log('multipart onEmpty()');
						readData();
					},
				});
				req.on('readable', () => {
					// console.log('on readable.');
					readData();
				});
				req.on('error', (err) => {
					// console.log('on req error:', err);
					finished = true;
					reject(err);
				});
				req.on('end', () => {
					// console.log('data upload end');
					parser.end();
				});
			});
		},
	};
}

/**
 * Create body-parser middleware.
 */
class BodyParserFactory implements MiddlewareFactory<undefined> {
	create() {
		return async function (ctx: Context, req: http.IncomingMessage) {
			ctx.body = createParser(req);
			return false;
		};
	}
}

const bodyParser = new BodyParserFactory();
export default bodyParser;
