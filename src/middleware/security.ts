import {
	Middleware,
	MiddlewareFactory,
	AccessCheckResult,
	AccessHandler,
	PrivilegeHandler,
	RedirectResult,
	BasicAuthResult,
	CustomResult,
	Application,
	MiddlewareOptions,
	PermissionHandler,
} from '../types';
import Context from '../context';

export class SecurityError extends Error {}

async function isCompleted(ctx: Context, result: AccessCheckResult): Promise<boolean> {
	if (typeof result === 'object' && result) {
		if ((result as RedirectResult).action === 'redirect') {
			if ((result as RedirectResult).url) {
				await ctx.redirect((result as RedirectResult).url);
				return true;
			}
			await ctx.errorForbidden();
			return true;
		}

		if ((result as BasicAuthResult).action === 'auth') {
			if ((result as BasicAuthResult).domain) {
				await ctx.needBasicAuth((result as BasicAuthResult).domain);
				return true;
			}
			await ctx.errorForbidden();
			return true;
		}

		const r = result as CustomResult;

		const headers: { [key: string]: number | string | string[] } = {};
		if (r && typeof r.headers === 'object' && r.headers) {
			Object.keys(r.headers).forEach((k: string) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				headers[k.toLowerCase()] = r.headers![k];
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

export interface SecurityOptions extends MiddlewareOptions {
	accessHandler?: AccessHandler;
	privilegeHandler?: PrivilegeHandler;
	permissionHandler?: PermissionHandler;
}

class SecurityFactory implements MiddlewareFactory<SecurityOptions> {
	create(app: Application, param: SecurityOptions = {}): Middleware {
		const fn = async function (ctx: Context) {
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
				ctx.checkPermission = async function (account, permission) {
					if (typeof param.permissionHandler === 'function') {
						const result = await param.permissionHandler({
							ctx: ctx,
							account: account,
							permission: permission,
						});
						if (!result) {
							throw new SecurityError(`Permission denied: ${permission} by ${account}`);
						}
					} else {
						throw new SecurityError(`Permission denied: ${permission} by ${account}`);
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
export default securityFactory;
