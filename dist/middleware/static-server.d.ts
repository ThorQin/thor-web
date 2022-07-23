/// <reference types="node" />
import { Application, Middleware, MiddlewareFactory } from '../types';
import { OutgoingHttpHeaders } from 'http';
export declare function defaultSuffix(): string[];
export declare type StaticOptions = {
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
	/**
	 * provide some extra response headers
	 */
	fileHeaders?: Record<string, OutgoingHttpHeaders>;
};
declare class StaticFactory implements MiddlewareFactory<StaticOptions> {
	create(
		app: Application,
		{ baseDir, rootPath, suffix, cachedFileSize, enableGzipSize, fileHeaders }?: StaticOptions
	): Middleware;
}
declare const staticFactory: StaticFactory;
export default staticFactory;
