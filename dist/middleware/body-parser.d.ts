/**
 * Create body-parser middleware.
 * @returns {(ctx: Context, req, rsp) => boolean}
 */
declare function create(): (ctx: any, req: any) => Promise<boolean>;
declare const _default: {
    create: typeof create;
};
export default _default;
