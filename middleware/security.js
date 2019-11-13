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
		if (result === true) {
			return false;
		} else if (result === 'deny' || !result) {
			await ctx.errorForbidden();
			return true;
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
	};
}

module.exports = {
	create: create
};
