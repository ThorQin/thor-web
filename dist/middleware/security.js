'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SecurityError = void 0;
class SecurityError extends Error {}
exports.SecurityError = SecurityError;
async function isCompleted(ctx, result) {
	if (typeof result === 'object' && result) {
		if (result.action === 'redirect') {
			if (result.url) {
				await ctx.redirect(result.url);
				return true;
			}
			await ctx.errorForbidden();
			return true;
		}
		if (result.action === 'auth') {
			if (result.domain) {
				await ctx.needBasicAuth(result.domain);
				return true;
			}
			await ctx.errorForbidden();
			return true;
		}
		const r = result;
		const headers = {};
		if (r && typeof r.headers === 'object' && r.headers) {
			Object.keys(r.headers).forEach((k) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				headers[k.toLowerCase()] = r.headers[k];
			});
		}
		let code = 403;
		if (typeof r.code === 'number') {
			code = r.code;
		}
		let body = null;
		if (!r.contentType || r.contentType === 'json') {
			body = JSON.stringify(r.body);
			headers['content-type'] = 'application/json; charset=utf-8';
		} else if (r.contentType === 'text') {
			headers['content-type'] = 'text/plain; charset=utf-8';
			body = r.body + '';
		} else if (r.contentType === 'html') {
			headers['content-type'] = 'text/html; charset=utf-8';
			body = r.body + '';
		}
		ctx.writeHead(code, headers);
		await ctx.end(body);
		return true;
	} else if (typeof result === 'boolean') {
		if (result) {
			return false;
		} else {
			await ctx.errorForbidden();
			return true;
		}
	} else {
		await ctx.errorForbidden();
		return true;
	}
}
class SecurityFactory {
	create(app, param = {}) {
		const fn = async function (ctx) {
			if (!ctx.isWebSocket) {
				ctx.checkPrivilege = async function (account, resource, resourceId, action) {
					if (typeof param.privilegeHandler === 'function') {
						const result = await param.privilegeHandler({
							ctx: ctx,
							account: account,
							resource: resource,
							resourceId: resourceId,
							action: action,
						});
						if (!result) {
							throw new SecurityError(`Permission denied: ${action} ${resource}(${resourceId}) by ${account}`);
						}
					} else {
						throw new SecurityError(`Permission denied: ${account} ${resource}(${resourceId}) by ${account}`);
					}
				};
			}
			if (typeof param.accessHandler === 'function') {
				const result = await param.accessHandler({
					ctx: ctx,
					path: ctx.path,
					method: ctx.method,
				});
				if (!ctx.isWebSocket) {
					return await isCompleted(ctx, result);
				} else {
					return result !== true;
				}
			} else {
				return true;
			}
		};
		fn.supportWebSocket = true;
		return fn;
	}
}
const securityFactory = new SecurityFactory();
exports.default = securityFactory;
//# sourceMappingURL=security.js.map
