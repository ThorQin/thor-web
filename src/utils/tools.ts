import { PathLike, promises as fs } from 'fs';
import { OutgoingHttpHeaders } from 'http';
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

function getPathFromParam(): string | undefined {
	return process.argv.find((value, index) => !value.startsWith('-') && index > 0);
}

export function getRootDir(): string {
	const js = getPathFromParam();
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

export function normalizeHeaders(headers: OutgoingHttpHeaders): OutgoingHttpHeaders {
	const out: OutgoingHttpHeaders = {};
	Object.keys(headers).forEach((h) => {
		out[h.toLowerCase()] = headers[h];
	});
	return out;
}

export function beautifyHeaders(headers: OutgoingHttpHeaders): OutgoingHttpHeaders {
	const out: OutgoingHttpHeaders = {};
	Object.keys(headers).forEach((h) => {
		const k = h
			.trim()
			.toLowerCase()
			.replace(/(?<=^|-)./g, (c) => c.toUpperCase());
		out[k] = headers[h];
	});
	return out;
}
