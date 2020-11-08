import { promises as fs } from 'fs';
import path from 'path';
export async function fileStat(file) {
	try {
		const stat = await fs.stat(file);
		return { isFile: stat.isFile(), size: stat.size, mtime: stat.mtime, ctime: stat.ctime };
	} catch (e) {
		return { isFile: false, size: 0, mtime: null, ctime: null };
	}
}
export async function isFile(file) {
	const stat = await fileStat(file);
	return stat.isFile;
}
export function getRootDir() {
	const js = process.argv[1];
	if (!js) {
		return process.cwd();
	}
	if (/\.(c|m)?js$/.test(js)) {
		return js.substring(0, js.lastIndexOf(path.sep));
	} else {
		return js;
	}
}
export default {
	getRootDir: getRootDir,
	fileStat: fileStat,
	isFile: isFile,
};
