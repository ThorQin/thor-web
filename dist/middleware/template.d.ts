/**
 * @typedef TemplateOptions
 * @property {string} baseDir The root directory of the controllers.
 * @property {boolean} isDebug Use debug mode
 */
/**
 * Create template render engin middleware.
 * @param {TemplateOptions} options
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
declare function create({ baseDir, isDebug }?: {
    baseDir?: null | undefined;
    isDebug?: boolean | undefined;
}): (ctx: any) => Promise<boolean>;
declare const _default: {
    create: typeof create;
};
export default _default;
