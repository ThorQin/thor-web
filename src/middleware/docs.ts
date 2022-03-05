import Context from '../context';
import fs from 'fs';
import path from 'path';
import { Rule } from 'thor-validation';
import { Middleware } from '../types';

export interface ApiDefine {
	body?: Rule;
	params?: Rule;
	desc?: string;
}

const ORDER = {
	api: 1,
	folder: 0,
};

interface ApiBase {
	type: 'api' | 'folder';
	name: string | RegExp;
}

interface ApiEntry extends ApiBase {
	type: 'api';
	methods: {
		[key: string]: ApiDefine;
	};
}

export interface ApiFolder extends ApiBase {
	type: 'folder';
	children: (ApiEntry | ApiFolder)[];
}

export function loadApi(apiDir: string, pathName: string): ApiFolder | null {
	const folder: ApiFolder = {
		type: 'folder',
		name: pathName,
		children: [],
	};
	if (!fs.existsSync(apiDir)) {
		return null;
	}
	if (!fs.statSync(apiDir).isDirectory()) {
		return null;
	}

	fs.readdirSync(apiDir).forEach((f) => {
		const subFile = path.resolve(apiDir, f);
		const stat = fs.statSync(subFile);
		if (stat.isDirectory()) {
			const subFolder = loadApi(subFile, f);
			if (subFolder) folder.children.push(subFolder);
		} else if (stat.isFile() && f.endsWith('.js')) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				let module = require(subFile);
				if (typeof module === 'function') {
					module = { default: module };
				}
				const api: ApiEntry = {
					type: 'api',
					name: f.substring(0, f.length - 3),
					methods: {},
				};
				['post', 'get', 'head', 'put', 'delete', 'options', 'trace', 'patch', 'default'].forEach((m) => {
					const fn = module[m];
					if (typeof fn === 'function') {
						api.methods[m] = {
							body: fn.body,
							params: fn.params,
							desc: fn.desc,
						};
					}
				});
				if (Object.keys(api.methods).length > 0) {
					folder.children.push(api);
				}
			} catch {
				console.log(`Load api doc ' ${subFile}' failed, ignored.`);
			}
		}
	});
	if (folder.children.length > 0) {
		folder.children.sort((a, b) => {
			const v = ORDER[a.type] - ORDER[b.type];
			if (v === 0) {
				return (a.name + '').localeCompare(b.name + '');
			} else {
				return v;
			}
		});
		return folder;
	} else {
		return null;
	}
}

export async function renderDoc(
	ctx: Context,
	apiFolder: ApiFolder,
	middleware: Middleware,
	apiDocPath: string
): Promise<void> {
	if (ctx.path === apiDocPath) {
		await ctx.redirect(apiDocPath + '/');
	} else if (ctx.path === path.resolve(apiDocPath, 'apis.json')) {
		await ctx.sendJson(apiFolder);
	} else {
		const processed = await middleware(ctx, ctx.req, ctx.rsp);
		if (!processed) {
			await ctx.error(404, 'Api doc does not exist!');
		}
	}
}
