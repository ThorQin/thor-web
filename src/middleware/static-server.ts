import { promises as fs } from 'fs';
import path from 'path';
import tools, { FileStat } from '../utils/tools';
import time from 'thor-time';
import mime from 'mime';
import zlib from 'zlib';
import { Application, Middleware, MiddlewareFactory } from '../types';

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
	return /^(txt|html?|css|js|json)$/.test(suffix);
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

async function* readFile(fd: fs.FileHandle, buffer: Buffer) {
	let rd = await fd.read(buffer, 0, buffer.length);
	while (rd.bytesRead > 0) {
		yield rd;
		rd = await fd.read(buffer, 0, buffer.length);
	}
}

function flushStream(stream: zlib.Gzip): Promise<void> {
	return new Promise((resolve) => {
		stream.flush(() => {
			resolve();
		});
	});
}

function writeStream(stream: zlib.Gzip, buffer: Buffer): Promise<void> {
	if (buffer.length <= 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		stream.write(buffer, () => {
			resolve();
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
};

type CacheData = {
	mtime: Date | null;
	data: Buffer;
	gzipData: Buffer | null;
};

class StaticFactory implements MiddlewareFactory<StaticOptions> {
	create(
		app: Application,
		{ baseDir, rootPath = '/', suffix, cachedFileSize = 1024 * 1024, enableGzipSize = 50 * 1024 }: StaticOptions = {}
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

		async function loadCache(file: string, stat: FileStat, canGzip: boolean): Promise<CacheData> {
			const fd = await fs.open(file, 'r');
			try {
				const data = await fd.readFile();
				const cacheItem: CacheData = { mtime: stat.mtime, data: data, gzipData: null };
				if (stat.size >= enableGzipSize && canGzip) {
					const gziped = await gzip(data);
					cacheItem.gzipData = gziped;
				}
				return cacheItem;
			} finally {
				await fd.close();
			}
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
							ctx.writeHead(200, {
								'Content-Type': contentType,
								'Content-Length': stat.size,
								'Cache-Control': 'no-cache',
								'Last-Modified': mtime.toUTCString(),
							});
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
									await ctx.notModified();
									return true;
								}
							}
						}

						if (cache.has(file)) {
							let cachedFile;
							try {
								cachedFile = (await cache.get(file)) as CacheData;
							} catch (e) {
								cache.delete(file);
								throw e;
							}
							if (cachedFile.mtime && stat.mtime && cachedFile.mtime >= stat.mtime) {
								const canGzip = compressible(m[1]);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': stat.mtime.toUTCString(),
										'Content-Encoding': 'gzip',
										'Transfer-Encoding': 'chunked',
									});
									// Send Gzip Data
									await ctx.end(cachedFile.gzipData);
								} else {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': stat.mtime.toUTCString(),
									});
									await ctx.end(cachedFile.data);
								}
								return true;
							} else {
								cache.delete(file);
							}
						}

						let fd = null;
						try {
							const canGzip = compressible(m[1]);
							if (stat.size <= cachedFileSize && process.env.NODE_ENV !== 'development') {
								const promise = loadCache(file, stat, canGzip);
								cache.set(file, promise);
								const cacheItem = await promise;
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
										'Content-Encoding': 'gzip',
										'Transfer-Encoding': 'chunked',
									});
									// Send Gzip Data
									await ctx.end(cacheItem.gzipData);
								} else {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
									});
									await ctx.end(cacheItem.data);
								}
								return true;
							} else {
								fd = await fs.open(file, 'r');
								const buffer = Buffer.alloc(4096);
								if (ctx.supportGZip() && stat.size >= enableGzipSize && canGzip) {
									const zstream = zlib.createGzip();
									zstream.pipe(ctx.rsp);
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
										'Content-Encoding': 'gzip',
										'Transfer-Encoding': 'chunked',
									});

									for await (const rd of readFile(fd, buffer)) {
										await writeStream(zstream, rd.buffer.slice(0, rd.bytesRead));
									}
									await flushStream(zstream);
								} else {
									ctx.writeHead(200, {
										'Cache-Control': 'no-cache',
										'Content-Type': contentType,
										'Last-Modified': mtime.toUTCString(),
									});
									for await (const rd of readFile(fd, buffer)) {
										await ctx.write(rd.buffer.slice(0, rd.bytesRead));
									}
								}
								await ctx.end();
								return true;
							}
						} finally {
							if (fd) {
								await fd.close();
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
