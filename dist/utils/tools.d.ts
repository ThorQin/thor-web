/// <reference types="node" />
import { PathLike } from 'fs';
import { OutgoingHttpHeaders } from 'http';
import { Transform, TransformCallback } from 'stream';
export interface FileStat {
	isFile: boolean;
	size: number;
	mtime: Date | null;
	ctime: Date | null;
}
export declare function fileStat(file: PathLike): Promise<FileStat>;
export declare function isFile(file: PathLike): Promise<boolean>;
export declare function getRootDir(): string;
export declare class Counter extends Transform {
	size: number;
	_transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void;
}
declare const _default: {
	getRootDir: typeof getRootDir;
	fileStat: typeof fileStat;
	isFile: typeof isFile;
};
export default _default;
export declare function normalizeHeaders(headers: OutgoingHttpHeaders): OutgoingHttpHeaders;
export declare function beautifyHeaders(headers: OutgoingHttpHeaders): OutgoingHttpHeaders;
