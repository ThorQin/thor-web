/* eslint-disable @typescript-eslint/no-var-requires */
const { homedir } = require('os');
const Path = require('path');
const fs = require('fs');
const App = require('..').default;

const uploadDir = Path.join(homedir(), 'upload-file');
fs.mkdirSync(uploadDir, { recursive: true });

const page = `
<h1>Test File Upload!</h1>
<form method="post" enctype="multipart/form-data" action="./upload">
	<p><input name="file" type="file"></p>
	<p><button type="submit">Submit Form</button></p>
</form>`;

App.start({
	controllers: {
		'/': async (ctx) => await ctx.sendHtml(page),
		'/upload': {
			post: async (ctx) => {
				if (ctx.body.isMultipart()) {
					const parts = await ctx.body.multipart(uploadDir);
					if (parts.length > 0) {
						await ctx.sendHtml(
							`<h2>File Name: <font color="red">${parts[0].filename}</font>: File Length: <font color="red">${parts[0].length}</font></h2>`
						);
					} else {
						await ctx.sendHtml('<p>No upload file found!</p>');
					}
				}
			},
		},
	},
});
