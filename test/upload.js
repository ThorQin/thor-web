/* eslint-disable @typescript-eslint/no-var-requires */
const { homedir } = require('os');
const Path = require('path');
const fs = require('fs');
const App = require('..').default;

const uploadDir = Path.join(homedir(), 'upload-file');
fs.mkdirSync(uploadDir, { recursive: true });

const page = `
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
function addLine(evt) {
	evt.preventDefault();
	const l = document.querySelector('form>p:last-child');
	const nl = document.createElement('p');
	nl.innerHTML = '<input name="file" type="file">';
	l.parentElement.insertBefore(nl, l);
}
</script>
<h1>Test File Upload!</h1>
<form method="post" enctype="multipart/form-data" action="./upload">
	<p><input name="file" type="file"></p>
	<p><button onclick="addLine(event)">Add more file</button> <button type="submit">Submit form</button></p>
</form>
</body>
</html>`;

App.start({
	controllers: {
		'/': async (ctx) => await ctx.sendHtml(page),
		'/upload': {
			post: async (ctx) => {
				if (ctx.body.isMultipart()) {
					const parts = await ctx.body.multipart(uploadDir, 1024 * 1024 * 10);
					if (parts.length > 0) {
						await ctx.sendHtml(
							parts
								.map(
									(p) =>
										`<h2>File Name: <font color="red">${p.filename}</font>: File Length: <font color="red">${p.length}</font></h2>`
								)
								.join('\n')
						);
					} else {
						await ctx.sendHtml('<p>No upload file found!</p>');
					}
				}
			},
		},
	},
});
