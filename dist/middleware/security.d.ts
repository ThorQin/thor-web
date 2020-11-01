import { Middleware } from '../defs';
export declare class SecurityError extends Error {
}
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
declare function create(securityHandler: any): Middleware;
declare const _default: {
    create: typeof create;
};
export default _default;
