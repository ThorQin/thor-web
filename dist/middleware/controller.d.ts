/**
 * @typedef {import('../context').default} Context
 */
/**
 * @typedef ControllerOptions
 * @property {string} baseDir The root directory of the controllers.
 * @property {string} rootPath The root url path of the controllers.
 */
/**
 * Create controller middleware.
 * @param {ControllerOptions} options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
declare function create({ baseDir, rootPath }?: {
    baseDir: any;
    rootPath?: string | undefined;
}): (ctx: any, req: any, rsp: any) => Promise<boolean>;
declare const _default: {
    create: typeof create;
};
export default _default;
