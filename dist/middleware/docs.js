'use strict';
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, '__esModule', { value: true });
exports.renderDoc = exports.loadApi = void 0;
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const ORDER = {
	api: 1,
	folder: 0,
};
function loadEntry(apiFile, fullPath) {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		let module = require(apiFile);
		if (typeof module === 'function') {
			module = { default: module, title: module.title };
		}
		let apiName = path_1.default.basename(apiFile);
		apiName = apiName.substring(0, apiName.length - 3);
		const api = {
			type: 'api',
			path: path_1.default.resolve(fullPath, apiName),
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
function loadApi(apiDir, fullPath) {
	const result = [];
	if (!fs_1.default.existsSync(apiDir)) {
		return result;
	}
	if (!fs_1.default.statSync(apiDir).isDirectory()) {
		return result;
	}
	fs_1.default.readdirSync(apiDir).forEach((f) => {
		const subFile = path_1.default.resolve(apiDir, f);
		const stat = fs_1.default.statSync(subFile);
		if (stat.isDirectory()) {
			const folder = {
				type: 'folder',
				path: path_1.default.resolve(fullPath, f),
				name: f,
				methods: {},
				children: [],
			};
			const indexFile = path_1.default.resolve(subFile, 'index.js');
			if (fs_1.default.existsSync(indexFile)) {
				const indexStat = fs_1.default.statSync(indexFile);
				if (indexStat.isFile()) {
					const indexApi = loadEntry(indexFile, path_1.default.resolve(fullPath, f, 'index'));
					if (indexApi) {
						folder.title = indexApi.title;
						folder.methods = indexApi.methods;
					}
				}
			}
			folder.children = loadApi(subFile, path_1.default.resolve(fullPath, f));
			if (folder.title || folder.children.length > 0) {
				result.push(folder);
			}
		} else if (stat.isFile() && f.endsWith('.js')) {
			const api = loadEntry(path_1.default.resolve(apiDir, f), fullPath);
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
exports.loadApi = loadApi;
async function renderDoc(ctx, docs, middleware, apiDocPath) {
	if (ctx.path === apiDocPath) {
		await ctx.redirect(apiDocPath + '/');
	} else if (ctx.path === path_1.default.resolve(apiDocPath, 'apis.json')) {
		await ctx.sendJson(docs);
	} else {
		const processed = await middleware(ctx, ctx.req, ctx.rsp);
		if (!processed) {
			await ctx.error(404, 'Api doc does not exist!');
		}
	}
}
exports.renderDoc = renderDoc;
//# sourceMappingURL=docs.js.map
