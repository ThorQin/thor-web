import os from 'os';

/**
 * @type import('thor-web').Controller
 */
export async function get(ctx) {
	let info = {
		version: os.platform() + '-' + os.arch() + '(' + os.release() + ')',
		loadavg: os.loadavg(),
		totalmem: os.totalmem(),
		freemem: os.freemem()
	}
	await ctx.sendJson(info);
}
