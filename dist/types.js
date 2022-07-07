'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isDefaultContext =
	exports.isPrivilegeContext =
	exports.isAppContext =
	exports.isBodyContext =
	exports.isSessionContext =
	exports.isRenderContext =
		void 0;
function isRenderContext(ctx) {
	return !!ctx.render;
}
exports.isRenderContext = isRenderContext;
function isSessionContext(ctx) {
	return !!ctx.session;
}
exports.isSessionContext = isSessionContext;
function isBodyContext(ctx) {
	return !!ctx.body;
}
exports.isBodyContext = isBodyContext;
function isAppContext(ctx) {
	return !!ctx.app;
}
exports.isAppContext = isAppContext;
function isPrivilegeContext(ctx) {
	return !!ctx.checkPrivilege;
}
exports.isPrivilegeContext = isPrivilegeContext;
function isDefaultContext(ctx) {
	return (
		isRenderContext(ctx) && isSessionContext(ctx) && isBodyContext(ctx) && isAppContext(ctx) && isPrivilegeContext(ctx)
	);
}
exports.isDefaultContext = isDefaultContext;
//# sourceMappingURL=types.js.map
