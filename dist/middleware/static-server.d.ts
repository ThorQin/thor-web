import { Middleware } from '../defs.js';
declare function defaultSuffix(): string[];
declare type StaticOptions = {
    /**
     * Root directory of static resources.
     */
    baseDir?: string;
    /**
     * Root url path of static resource.
     */
    rootPath?: string;
    /**
     * Which suffix(extra) can be visit as static resource.
     */
    suffix?: string[];
    /**
     * File will be cached when size less this setting, default is 1MB (1024 * 1024).
     */
    cachedFileSize?: number;
    /**
     * File will be gziped when size larger then this setting, default is 50K (50 * 1024)
     */
    enableGzipSize?: number;
};
/**
 * Create static resource middleware
 * @param param0 Options for create static server.
 */
declare function create({ baseDir, rootPath, suffix, cachedFileSize, enableGzipSize, }?: StaticOptions): Middleware;
declare const _default: {
    create: typeof create;
    defaultSuffix: typeof defaultSuffix;
};
export default _default;
