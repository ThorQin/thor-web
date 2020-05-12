import { Context } from 'thor-web';
import os from 'os';

/**
 *
 * @param {Context} ctx
 */
export async function get(ctx) {

	let info = {
		version: os.version(),
		loadavg: os.loadavg(),
		totalmem: os.totalmem(),
		freemem: os.freemem()
	}
	await ctx.sendJson(info);
}
