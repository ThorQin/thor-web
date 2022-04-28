import { PathLike, promises as fs } from 'fs';
import path from 'path';
import { Transform, TransformCallback } from 'stream';

export interface FileStat {
	isFile: boolean;
	size: number;
	mtime: Date | null;
	ctime: Date | null;
}

export async function fileStat(file: PathLike): Promise<FileStat> {
	try {
		const stat = await fs.stat(file);
		return { isFile: stat.isFile(), size: stat.size, mtime: stat.mtime, ctime: stat.ctime };
	} catch (e) {
		return { isFile: false, size: 0, mtime: null, ctime: null };
	}
}

export async function isFile(file: PathLike): Promise<boolean> {
	const stat = await fileStat(file);
	return stat.isFile;
}

export function getRootDir(): string {
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

export class Counter extends Transform {
	size = 0;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	_transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
		this.size += chunk.length;
		callback(null, chunk);
	}
}

export default {
	getRootDir: getRootDir,
	fileStat: fileStat,
	isFile: isFile,
};
