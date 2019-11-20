/**
 * Create security handler middleware
 * @param {(param: {ctx:Context,username:string,passowrd:string,session,cookie,path: string,method: string,ip: string}) => boolean|'allow'|'deny'|'redirect:'|'auth:'} securityHandler
 * @returns {(ctx, req, rsp) => boolean}
 */
function create(securityHandler) {
	return async function(ctx) {
		let u = null, p = null;
		ctx.checkBasicAuth(function(username, password) {
			u = username;
			p = password;
		});
		let result = securityHandler({
			ctx: ctx,
			username: u,
			password: p,
			session: ctx.session,
			cookie: ctx.getRequestCookies(),
			path: ctx.path,
			method: ctx.method,
			ip: ctx.ip
		});
		if (typeof result === 'object' && result) {
			let headers = {};
			Object.keys(result).filter(k => k != 'code' && k != 'body').forEach(k => {
				headers[k.toLowerCase()] = result[k];
			});
			let code = 403;
			if (typeof result.code === 'number') {
				code = result.code;
			}
			let body = null;
			if (typeof result.body === 'object') {
				body = JSON.stringify(result.body);
				headers['content-type'] = 'application/json; charset=utf-8';
			}
			ctx.writeHead(code, result);
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
	};
}

module.exports = {
	create: create
};
