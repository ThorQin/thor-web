

/**
 * @typedef {import('../context').default} Context
 */
/**
 * Create security handler middleware
 * @param {(param: {
 *  ctx:Context,
 * 	resource:string,
 *	resourceId:string?,
 *	action:string}) => boolean|object|string} securityHandler
 * @returns {(ctx:Context, req, rsp) => boolean}
 */
function create(securityHandler) {
	return async function(ctx) {
		let result = securityHandler({
			ctx: ctx,
			resource: 'url',
			resourceId: ctx.path,
			action: ctx.method
		});
		return await shouldStopNext(result);
	};
}

/**
 *
 * @param {Context} ctx
 * @param {boolean|object|string} result
 * @returns {boolean}
 */
async function shouldStopNext(ctx, result) {
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
}

export default {
	create,
	shouldStopNext
};
