/**
 * @type import('thor-web').Controller
 */
export async function get(ctx) {
	let info = Object.entries(process.env)
		.map(item => item[0] + ':' + item[1])
		.reduce((p,c) => p + '\n' + c, '');
	await ctx.render('about.html', {
		serverInfo: info
	});
}
