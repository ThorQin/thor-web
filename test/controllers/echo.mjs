import { Context, time } from "../..";

/**
 *
 * @param {Context} ctx
 */
export async function get(ctx) {
	let now = time.now();
	await ctx.sendJson(now);
}
