'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.getRootDir = exports.isFile = exports.fileStat = void 0;
const fs_1 = require('fs');
const path_1 = __importDefault(require('path'));
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
function getRootDir() {
	const js = process.argv[1];
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
exports.default = {
	getRootDir: getRootDir,
	fileStat: fileStat,
	isFile: isFile,
};
//# sourceMappingURL=tools.js.map
