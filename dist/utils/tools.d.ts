/// <reference types="node" />
import { PathLike } from 'fs';
declare function fileStat(file: PathLike): Promise<{
    isFile: boolean;
    size: number;
    mtime: Date;
    ctime: Date;
} | {
    isFile: boolean;
    size: number;
    mtime: null;
    ctime: null;
}>;
declare function isFile(file: PathLike): Promise<boolean>;
declare function getRootDir(): string;
declare const _default: {
    fileStat: typeof fileStat;
    isFile: typeof isFile;
    getRootDir: typeof getRootDir;
};
export default _default;
