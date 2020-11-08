export class SecurityError extends Error {}
async function isCompleted(ctx, result) {
	if (typeof result === 'object' && result) {
		const headers = {};
		Object.keys(result)
			.filter((k) => k != 'code' && k != 'body')
			.forEach((k) => {
				headers[k.toLowerCase()] = result[k];
			});
		let code = 403;
		if (typeof result.code === 'number') {
			code = result.code;
		}
		let body = null;
		if (!result.contentType || result.contentType === 'json') {
			body = JSON.stringify(result.body);
			headers['content-type'] = 'application/json; charset=utf-8';
		} else if (result.contentType === 'text') {
			headers['content-type'] = 'text/plain; charset=utf-8';
			body = result.body + '';
		} else if (result.contentType === 'html') {
			headers['content-type'] = 'text/html; charset=utf-8';
			body = result.body + '';
		}
		ctx.writeHead(code, headers);
		await ctx.end(body);
		return true;
	} else if (typeof result === 'string') {
		if (result === 'allow') {
			return false;
		} else {
			let m = /^redirect:(.+)$/.exec(result);
			if (m) {
				await ctx.redirect(m[1]);
				return true;
			}
			m = /^auth:(.+)$/.exec(result);
			if (m) {
				await ctx.needBasicAuth(m[1]);
				return true;
			}
			await ctx.errorForbidden();
			return true;
		}
	} else {
		if (result) {
			return false;
		} else {
			await ctx.errorForbidden();
			return true;
		}
	}
}
class SecurityFactory {
	create(securityHandler) {
		return async function (ctx) {
			if (typeof securityHandler === 'function') {
				ctx.checkPrivilege = async function (action, resource, resourceId, account) {
					const result = await securityHandler({
						ctx: ctx,
						resource: resource,
						resourceId: resourceId,
						action: action,
						account: account,
					});
					if (result !== true && result != 'allow') {
						throw new SecurityError(`Permission denied: ${action} ${resource}(${resourceId}) by ${account}`);
					}
				};
				const result = await securityHandler({
					ctx: ctx,
					resource: 'access',
					resourceId: ctx.path,
					action: ctx.method,
				});
				return await isCompleted(ctx, result);
			} else {
				return false;
			}
		};
	}
}
const securityFactory = new SecurityFactory();
export default securityFactory;
