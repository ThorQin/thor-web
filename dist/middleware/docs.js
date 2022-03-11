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
function loadApi(apiDir, pathName, fullPath) {
	const folder = {
		type: 'folder',
		name: pathName,
		children: [],
	};
	if (!fs_1.default.existsSync(apiDir)) {
		return null;
	}
	if (!fs_1.default.statSync(apiDir).isDirectory()) {
		return null;
	}
	fs_1.default.readdirSync(apiDir).forEach((f) => {
		const subFile = path_1.default.resolve(apiDir, f);
		const stat = fs_1.default.statSync(subFile);
		if (stat.isDirectory()) {
			const subFolder = loadApi(subFile, f, path_1.default.resolve(fullPath, f));
			if (subFolder) folder.children.push(subFolder);
		} else if (stat.isFile() && f.endsWith('.js')) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				let module = require(subFile);
				if (typeof module === 'function') {
					module = { default: module };
				}
				const apiName = f.substring(0, f.length - 3);
				const api = {
					type: 'api',
					path: path_1.default.resolve(fullPath, apiName),
					name: apiName,
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
exports.loadApi = loadApi;
async function renderDoc(ctx, apiFolder, middleware, apiDocPath) {
	if (ctx.path === apiDocPath) {
		await ctx.redirect(apiDocPath + '/');
	} else if (ctx.path === path_1.default.resolve(apiDocPath, 'apis.json')) {
		await ctx.sendJson(apiFolder);
	} else {
		const processed = await middleware(ctx, ctx.req, ctx.rsp);
		if (!processed) {
			await ctx.error(404, 'Api doc does not exist!');
		}
	}
}
exports.renderDoc = renderDoc;
//# sourceMappingURL=docs.js.map
