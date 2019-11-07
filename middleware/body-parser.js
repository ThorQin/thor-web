
const qs = require('querystring');
const Iconv = require('iconv').Iconv;
const uuidv1 = require('uuid/v1');
const fs = require('fs');

const STATE_BEGIN = 0;
const STATE_HEADER = 1;
const STATE_CONTENT = 2;

const gb2utf8 = new Iconv('gb18030', 'utf8');
function decodeURIComponentGB(str) {
	let buffer = Buffer.alloc(str.length);
	let state = 0;
	let len = 0;
	let v;
	for (let i = 0; i < str.length; i++) {
		let c = str[i];
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
	return gb2utf8.convert(buffer.slice(0, len)).toString('utf-8');
}

function parseHeaderLine(headers, line) {
	let arr = /^([^:]+)\s*:\s*([^;]+)(?:;(.+))?$/.exec(line);
	if (!arr) {
		return;
	}
	let key = arr[1].trim().toLowerCase();
	let value = arr[2].trim().toLowerCase();
	if (!key || !value) {
		return;
	}
	let values = {
		value: value
	};
	headers[key] = values;
	let params = arr[3];
	if (params) {
		let regex = /([^=;]+)=(?:"([^"]*)"|'([^']*)'|([^;]*))/g;
		let pair;
		while ((pair = regex.exec(params)) !== null) {
			let k = pair[1] ? pair[1].trim() : null;
			let str = pair[2] || pair[3] || pair[4] || null;
			if (!k) {
				continue;
			}
			let v;
			if (k.endsWith('*')) { // RFC 5987
				let m = /^(utf-8|iso-8859-1)'[^']*'(.+)$/i.exec(str);
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

function paserHeaders(lines) {
	let headers = {};
	let line = null;
	for (let l of lines) {
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

function generateFile(storeDir) {
	let id = uuidv1().replace(/-/g,'');
	let path = storeDir + id.substring(0, 15).replace(/.{3}/g,function(v){return v+'/';});
	return new Promise((resolve, reject) => {
		fs.mkdir(path, {
			recursive: true
		}, function(err) {
			if (err) {
				return reject(err);
			}
			let file = path + id.substring(15) + '.data';
			return resolve(file);
		});
	});
}

function Parser({boundary, maxLength, storeDir, onPart, onError, onEnd, onEmpty}) {
	let boundaryBegin = '--' + boundary;
	let boundaryEnd = boundaryBegin + '--';
	let buffer = Buffer.alloc(0);
	let state = STATE_BEGIN;
	let lineBegin = 0;
	let headerLines = null;
	let partInfo = null;
	let lastPos = 0;
	let parsing = false;
	let finished = false;
	let prevChar = 0;
	let noMoreData = false;

	function nextReturn() {
		for (let i = lastPos; i < buffer.length; i++) {
			let c = buffer[i];
			if (c == 10) {
				let rt = { pos: i, lead: prevChar == 13 ? 1 : 0, eof: false };
				lastPos = i + 1;
				prevChar = c;
				return rt;
			} else {
				prevChar = c;
			}
		}
		lastPos = buffer.length;
		if (noMoreData) {
			return { pos: buffer.length, lead: 0, eof: true};
		} else {
			return null;
		}
	}

	function onBegin(lfPos) {
		let line = buffer.toString('ascii', lineBegin, lfPos.pos).trim();
		if (line !== boundaryBegin) {
			lineBegin = lfPos.pos + 1;
			return Promise.resolve();
		}
		partInfo = {};
		partInfo.length = 0;
		headerLines = [];
		state = STATE_HEADER;
		buffer = buffer.slice(lfPos.pos + 1);
		lastPos = 0;
		lineBegin = 0;
		return Promise.resolve();
	}

	function onHead(lfPos) {
		let line = buffer.toString('utf-8', lineBegin, lfPos.pos).trim();
		buffer = buffer.slice(lfPos.pos + 1);
		lastPos = 0;
		lineBegin = 0;
		if (line.length === 0) { // HEADER OVER
			let headers = paserHeaders(headerLines);
			state = STATE_CONTENT;
			let cd = headers['content-disposition'];
			if (cd) {
				partInfo.name = cd['name'] || null;
				let ct = headers['content-type'];
				if (ct) {
					partInfo.contentType = ct.value;
					partInfo.charset = ct.charset || null;
				}
				let filename = cd['filename*'] || cd['filename'] || null;
				partInfo.filename = filename;
				if (ct != null && storeDir) {
					return generateFile(storeDir).then(function(file) {
						partInfo.file = file;
						return new Promise(function(resolve, reject) {
							fs.open(partInfo.file, 'a', function(err, fd) {
								if (err) {
									reject(err);
									return;
								}
								partInfo.fd = fd;
								resolve();
							});
						});
					});
				} else {
					partInfo.buffer = Buffer.alloc(0);
					return Promise.resolve();
				}
			}
		} else {
			headerLines.push(line);
			return Promise.resolve();
		}
	}

	function onBody(lfPos) {
		let line = buffer.toString('ascii', lineBegin, lfPos.pos).trim();
		let writeBuffer;
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
				fs.write(partInfo.fd, writeBuffer, function(err) {
					if (err) {
						fs.close(partInfo.fd);
						reject(err);
						return;
					}
					partInfo.length += writeBuffer.length;
					if (partInfo.length > maxLength) {
						reject('Exceed content size limitation!');
					} else if (partInfo.over) {
						delete partInfo.over;
						fs.close(partInfo.fd, function(err) {
							delete partInfo.fd;
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
			partInfo.buffer = Buffer.concat([partInfo.buffer, writeBuffer], partInfo.buffer.length + writeBuffer.length);
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
		onEmpty();
	}

	async function parseBuffer() {
		if (!parsing) {
			parsing = true;
			for await (let _ of parseLoop());
			parsing = false;
			if (finished || noMoreData) {
				onEnd();
			}
		}
	}

	this.push = function(chunk) {
		// console.log('data push: ', chunk.length);
		buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
		parseBuffer().catch(function(err) {
			onError(err);
		});
	};

	this.end = function() {
		// console.log('data end');
		noMoreData = true;
		if (!parsing) {
			onEnd();
		}
	};

}

function createParser(req) {
	let finished = false;
	let cl = req.headers['content-length'];
	return {
		isJSON: function() {
			let ct = req.headers['content-type'];
			return (/^\s*application\/json\s*(;.+)?/i.test(ct));
		},
		isForm: function() {
			let ct = req.headers['content-type'];
			return (/^\s*application\/x-www-form-urlencoded\s*(;.+)?/i.test(ct));
		},
		isMultipart: function() {
			let ct = req.headers['content-type'];
			return (/^\s*multipart\/form-data\s*(;.+)?/i.test(ct));
		},
		getCharset: function() {
			let ct = req.headers['content-type'];
			let m = /;\s*charset=([^;]+)/i.exec(ct);
			return (m && m[1]) || 'utf-8';
		},
		getMultipartBoundary: function() {
			let ct = req.headers['content-type'];
			let m = /;\s*boundary=([^;]+)/i.exec(ct);
			return (m && m[1]) || null;
		},
		raw: function () {
			if (finished) {
				return Promise.reject('Body can only be read once!');
			}
			let buffer = Buffer.alloc(0);
			return new Promise(function(resolve, reject) {
				req.on('data', chunk => {
					buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
				});
				req.on('error', err => {
					finished = true;
					reject(err);
				});
				req.on('end', () => {
					finished = true;
					resolve(buffer);
				});
			});
		},
		text: function() {
			let charset = this.getCharset();
			return this.raw().then(function(buffer) {
				return buffer.toString(charset);
			});
		},
		json: function() {
			if (!this.isJSON()) {
				return Promise.reject('Not a JSON data.');
			}
			let charset = this.getCharset();
			return this.raw().then(function(buffer) {
				return JSON.parse(buffer.toString(charset));
			});
		},
		form: function() {
			if (!this.isForm()) {
				return Promise.reject('Not a form data.');
			}
			let charset = this.getCharset();
			return this.raw().then(function(buffer) {
				return qs.parse(buffer.toString(charset));
			});
		},
		multipart: function (storeDir, maxLength = 1024 * 1024 * 10) {
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
			let parts = [];
			return new Promise((resolve, reject) => {
				let parser = new Parser({
					boundary: this.getMultipartBoundary(),
					maxLength: maxLength,
					storeDir: storeDir,
					onPart: (part) => {
						parts.push(part);
					},
					onError: (err) => {
						finished = true;
						// console.log(`onError: ${err}`);
						reject(err);
					},
					onEnd: () => {
						finished = true;
						// console.log('onEnd()');
						resolve(parts);
					},
					onEmpty: () => {
						// console.log('onEmpty()');
						cl && req.resume();
					}
				});
				req.on('data', chunk => {
					parser.push(chunk);
					cl && req.pause();
				});
				req.on('error', err => {
					// console.log('on req error:', err);
					finished = true;
					reject(err);
				});
				req.on('end', () => {
					parser.end();
				});
			});
		}
	};
}

/**
 * Create body-parser middleware.
 */
function create() {
	return async function (ctx, req) {
		ctx.body = createParser(req);
		return false;
	};
}

module.exports = {
	create: create
};
