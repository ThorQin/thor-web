'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.Counter = exports.getRootDir = exports.isFile = exports.fileStat = void 0;
const fs_1 = require('fs');
const path_1 = __importDefault(require('path'));
const stream_1 = require('stream');
async function fileStat(file) {
	try {
		const stat = await fs_1.promises.stat(file);
		return { isFile: stat.isFile(), size: stat.size, mtime: stat.mtime, ctime: stat.ctime };
	} catch (e) {
		return { isFile: false, size: 0, mtime: null, ctime: null };
	}
}
exports.fileStat = fileStat;
async function isFile(file) {
	const stat = await fileStat(file);
	return stat.isFile;
}
exports.isFile = isFile;
function getPathFromParam() {
	return process.argv.find((value, index) => !value.startsWith('-') && index > 0);
}
function getRootDir() {
	const js = getPathFromParam();
	if (!js) {
		return process.cwd();
	}
	if (/\.(c|m)?js$/.test(js)) {
		return js.substring(0, js.lastIndexOf(path_1.default.sep));
	} else {
		return js;
	}
}
exports.getRootDir = getRootDir;
class Counter extends stream_1.Transform {
	constructor() {
		super(...arguments);
		this.size = 0;
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	_transform(chunk, encoding, callback) {
		this.size += chunk.length;
		callback(null, chunk);
	}
}
exports.Counter = Counter;
exports.default = {
	getRootDir: getRootDir,
	fileStat: fileStat,
	isFile: isFile,
};
//# sourceMappingURL=tools.js.map
