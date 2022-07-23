import { createReadStream, promises as fs, ReadStream } from 'fs';
import path from 'path';
import tools, { Counter, FileStat, normalizeHeaders } from '../utils/tools';
import time from 'thor-time';
import mime from 'mime';
import zlib from 'zlib';
import stream from 'stream';
import { promisify } from 'util';
import { Application, Middleware, MiddlewareFactory } from '../types';
import { OutgoingHttpHeaders } from 'http';

const pipeline = promisify(stream.pipeline);

export function defaultSuffix(): string[] {
	const suffix = [
		'txt',
		'htm',
		'html',
		'css',
		'js',
		'json',
		'eot',
		'otf',
		'woff',
		'woff2',
		'ttf',
		'bmp',
		'ico',
		'gif',
		'png',
		'jpg',
		'jpeg',
		'tif',
		'tiff',
		'svg',
		'mp3',
		'mp4',
		'wav',
		'zip',
		'rar',
		'7z',
		'tar',
		'gz',
	];
	if (process.env.NODE_ENV === 'development') {
		suffix.push('map');
	}
	return suffix;
}

function getMimeType(suffix: string) {
	return mime.getType(suffix) || 'application/octet-stream';
}

function compressible(suffix: string) {
	return /^(txt|html?|css|js|json|xml)$/.test(suffix);
}

function gzip(buffer: Buffer): Promise<Buffer> {
	return new Promise(function (resolve, reject) {
		zlib.gzip(buffer, function (err, result) {
			if (err) {
				reject(err);
				return;
			}
			resolve(result);
		});
	});
}

export type StaticOptions = {
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
	 * provide some extra response headers by content type
	 */
	mimeHeaders?: Record<string, OutgoingHttpHeaders>;
	/**
	 * provide some extra response headers by url path
	 */
	fileHeaders?: Record<string, OutgoingHttpHeaders>;
};

type CacheData = {
	mtime?: number | null;
	data: Buffer;
	gzipData: Buffer | null;
};

type SizeCache = {
	mtime?: number | null;
	size: number;
};

class StaticFactory implements MiddlewareFactory<StaticOptions> {
	create(
		app: Application,
		{
			baseDir,
			rootPath = '/',
			suffix,
			cachedFileSize = 1024 * 1024,
			enableGzipSize = 50 * 1024,
			mimeHeaders = {},
			fileHeaders = {},
		}: StaticOptions = {}
	): Middleware {
		if (!rootPath) {
			rootPath = '/';
		}
		if (!rootPath.startsWith('/')) {
			rootPath = `/${rootPath}`;
		}
		if (!rootPath.endsWith('/')) {
			rootPath = `${rootPath}/`;
		}

		if (!baseDir) {
			baseDir = path.resolve(tools.getRootDir(), 'www');
		} else if (baseDir.endsWith('/')) {
			baseDir = baseDir.substring(0, baseDir.length - 1);
		}

		let suffixSet: Set<string>;
		if (!suffix || !(suffix instanceof Array)) {
			suffixSet = new Set(defaultSuffix());
		} else {
			suffixSet = new Set(defaultSuffix().concat(...suffix));
		}

		const cache = new Map<string, Promise<CacheData>>();
		const zipedSizeCache = new Map<string, SizeCache>();
		const fileSizeCache = new Map<string, SizeCache>();

		async function loadCache(file: string, stat: FileStat, canGzip: boolean): Promise<CacheData> {
			const fd = await fs.open(file, 'r');
			try {
				const data = await fd.readFile();
				const cacheItem: CacheData = { mtime: stat.mtime?.getTime(), data: data, gzipData: null };
				if (stat.size >= enableGzipSize && canGzip) {
					const gziped = await gzip(data);
					cacheItem.gzipData = gziped;
				}
				return cacheItem;
			} finally {
				await fd.close();
			}
		}

		Object.keys(mimeHeaders).forEach((k) => {
			mimeHeaders[k] = normalizeHeaders(mimeHeaders[k]);
		});

		Object.keys(fileHeaders).forEach((k) => {
			fileHeaders[k] = normalizeHeaders(fileHeaders[k]);
		});

		function applyHeaders(page: string, contentType: string, outHeaders: OutgoingHttpHeaders) {
			const mhs = mimeHeaders[contentType] ?? mimeHeaders['*'] ?? {};
			const fhs = fileHeaders[page] ?? {};
			return { ...mhs, ...fhs, ...outHeaders };
		}

		/**
		 * @param {Context} ctx
		 */
		return async function (ctx) {
			let page = ctx.path;
			if (!page.startsWith(rootPath)) {
				return false;
			}
			page = page.substring(rootPath.length - 1);

			if (page.endsWith('/')) {
				page += 'index.html';
			}

			const m = /\.([a-z0-9]+)$/i.exec(page);
			if (m) {
				if (suffixSet.has(m[1])) {
					const contentType = getMimeType(m[1]);
					const file = baseDir + page;
					const stat = await tools.fileStat(file);
					if (stat.isFile) {
						const mtime = stat.mtime as Date;
						if (ctx.method === 'HEAD') {
							ctx.writeHead(
								200,
								applyHeaders(page, contentType, {
									'content-type': contentType,
									'content-length': stat.size,
									'cache-control': 'no-cache',
									'last-modified': mtime.toUTCString(),
								})
							);
							await ctx.end();
							return true;
						}

						if (ctx.method !== 'GET') {
							ctx.errorBadMethod();
							return true;
						}

						const modifySince = ctx.getRequestHeader('if-modified-since');
						if (typeof modifySince === 'string') {
							const lastTime = time.parse(modifySince);
							if (lastTime) {
								const v = time.parse(mtime.toUTCString());
								if (v && v.getTime() <= lastTime.getTime()) {
									await ctx.notModified(applyHeaders(page, contentType, {}));
									return true;
								}
							}
						}

						const cachedPromise = cache.get(file);
						if (cachedPromise) {
							let cachedFile;
							try {
								cachedFile = (await cachedPromise) as CacheData;
							} catch (e) {
								cache.delete(file);
								throw e;
							}
							if (cachedFile.mtime && stat.mtime && cachedFile.mtime == stat.mtime.getTime()) {
								const canGzip = compressible(m[1]);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip && cachedFile.gzipData) {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': stat.mtime.toUTCString(),
											'content-encoding': 'gzip',
											'content-length': cachedFile.gzipData.byteLength,
											// 'Transfer-Encoding': 'chunked',
										})
									);
									// Send Gzip Data
									await ctx.end(cachedFile.gzipData);
								} else {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': stat.mtime.toUTCString(),
											'content-length': cachedFile.data.byteLength,
										})
									);
									await ctx.end(cachedFile.data);
								}
								return true;
							} else {
								cache.delete(file);
							}
						}

						let fileStream: ReadStream | null = null;
						try {
							const canGzip = compressible(m[1]);
							if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
								const promise = loadCache(file, stat, canGzip);
								cache.set(file, promise);
								const cacheItem = await promise;
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip && cacheItem.gzipData) {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': mtime.toUTCString(),
											'content-encoding': 'gzip',
											'content-length': cacheItem.gzipData.byteLength,
											// 'Transfer-Encoding': 'chunked',
										})
									);
									// Send Gzip Data
									await ctx.end(cacheItem.gzipData);
								} else {
									ctx.writeHead(
										200,
										applyHeaders(page, contentType, {
											'cache-control': 'no-cache',
											'content-type': contentType,
											'last-modified': mtime.toUTCString(),
											'content-length': cacheItem.data.byteLength,
										})
									);
									await ctx.end(cacheItem.data);
								}
								return true;
							} else {
								fileStream = createReadStream(file);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									const zstream = zlib.createGzip();
									const headers: { [key: string]: string | number } = {
										'cache-control': 'no-cache',
										'content-type': contentType,
										'last-modified': mtime.toUTCString(),
										'content-encoding': 'gzip',
									};
									const sizeInfo = zipedSizeCache.get(file);
									if (sizeInfo && sizeInfo.mtime == stat.mtime?.getTime()) {
										headers['content-length'] = sizeInfo.size;
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										await pipeline(fileStream, zstream, ctx.rsp);
									} else {
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										const sizeCounter = new Counter();
										await pipeline(fileStream, zstream, sizeCounter, ctx.rsp);
										zipedSizeCache.set(file, { mtime: stat.mtime?.getTime(), size: sizeCounter.size });
									}
								} else {
									const headers: { [key: string]: string | number } = {
										'cache-control': 'no-cache',
										'content-type': contentType,
										'last-modified': mtime.toUTCString(),
									};
									const sizeInfo = fileSizeCache.get(file);
									if (sizeInfo && sizeInfo.mtime == stat.mtime?.getTime()) {
										headers['content-length'] = sizeInfo.size;
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										await pipeline(fileStream, ctx.rsp);
									} else {
										ctx.writeHead(200, applyHeaders(page, contentType, headers));
										const sizeCounter = new Counter();
										await pipeline(fileStream, sizeCounter, ctx.rsp);
										fileSizeCache.set(file, { mtime: stat.mtime?.getTime(), size: sizeCounter.size });
									}
								}
								await ctx.end();
								return true;
							}
						} finally {
							if (fileStream) {
								fileStream.close();
							}
						}
					} else {
						cache.delete(file);
					}
				}
			}
			return false;
		};
	}
}

const staticFactory = new StaticFactory();

export default staticFactory;
