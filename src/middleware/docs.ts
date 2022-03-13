import Context from '../context';
import fs from 'fs';
import path from 'path';
import { Rule } from 'thor-validation';
import { Middleware } from '../types';

const ORDER = {
	api: 1,
	folder: 0,
};

export interface ApiDefine {
	body?: Rule | string;
	query?: Rule | string;
	result?: Rule | string;
	title?: string;
	desc?: string;
}

interface ApiBase {
	type: 'api' | 'folder';
	name: string | RegExp;
	title?: string;
}

export interface ApiEntry extends ApiBase {
	type: 'api';
	path: string;
	methods: {
		[key: string]: ApiDefine;
	};
}

export interface ApiFolder extends ApiBase {
	type: 'folder';
	path: string;
	methods: {
		[key: string]: ApiDefine;
	};
	children: (ApiEntry | ApiFolder)[];
}

function loadEntry(apiFile: string, fullPath: string): ApiEntry | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		let module = require(apiFile);
		if (typeof module === 'function') {
			module = { default: module, title: module.title };
		}
		let apiName = path.basename(apiFile);
		apiName = apiName.substring(0, apiName.length - 3);
		const api: ApiEntry = {
			type: 'api',
			path: path.resolve(fullPath, apiName),
			title: typeof module.title === 'string' ? module.title : undefined,
			name: apiName,
			methods: {},
		};
		['post', 'get', 'head', 'put', 'delete', 'options', 'trace', 'patch', 'default'].forEach((m) => {
			const fn = module[m];
			if (typeof fn === 'function') {
				api.methods[m] = {
					body: fn.body,
					query: fn.query,
					result: fn.result,
					desc: fn.desc,
					title: fn.title,
				};
			}
		});
		return api;
	} catch {
		console.log(`Load api doc ' ${apiFile}' failed, ignored.`);
		return null;
	}
}

export function loadApi(apiDir: string, fullPath: string): (ApiFolder | ApiEntry)[] {
	const result: (ApiFolder | ApiEntry)[] = [];
	if (!fs.existsSync(apiDir)) {
		return result;
	}
	if (!fs.statSync(apiDir).isDirectory()) {
		return result;
	}

	fs.readdirSync(apiDir).forEach((f) => {
		const subFile = path.resolve(apiDir, f);
		const stat = fs.statSync(subFile);
		if (stat.isDirectory()) {
			const folder: ApiFolder = {
				type: 'folder',
				path: path.resolve(fullPath, f),
				name: f,
				methods: {},
				children: [],
			};
			const indexFile = path.resolve(subFile, 'index.js');
			const indexStat = fs.statSync(indexFile);
			if (indexStat.isFile()) {
				const indexApi = loadEntry(indexFile, path.resolve(fullPath, f, 'index'));
				if (indexApi) {
					folder.title = indexApi.title;
					folder.methods = indexApi.methods;
				}
			}
			folder.children = loadApi(subFile, path.resolve(fullPath, f));
			if (folder.title || folder.children.length > 0) {
				result.push(folder);
			}
		} else if (stat.isFile() && f.endsWith('.js')) {
			const api = loadEntry(path.resolve(apiDir, f), fullPath);
			if (api && Object.keys(api.methods).length > 0) {
				result.push(api);
			}
		}
	});
	result.sort((a, b) => {
		const v = ORDER[a.type] - ORDER[b.type];
		if (v === 0) {
			return (a.name + '').localeCompare(b.name + '');
		} else {
			return v;
		}
	});
	return result;
}

export async function renderDoc(
	ctx: Context,
	docs: (ApiFolder | ApiEntry)[],
	middleware: Middleware,
	apiDocPath: string
): Promise<void> {
	if (ctx.path === apiDocPath) {
		await ctx.redirect(apiDocPath + '/');
	} else if (ctx.path === path.resolve(apiDocPath, 'apis.json')) {
		await ctx.sendJson(docs);
	} else {
		const processed = await middleware(ctx, ctx.req, ctx.rsp);
		if (!processed) {
			await ctx.error(404, 'Api doc does not exist!');
		}
	}
}
