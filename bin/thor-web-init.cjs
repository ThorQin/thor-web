var project = process.argv[2];

if (!project) {
	console.log('Usage: thor-web-init <project-name>');
	process.exit(-1);
}

const fs = require('fs').promises;
const path = require('path');
const basedir = path.resolve(path.dirname(require.main.filename), '..', 'project-template');

async function mkdir(...dirname) {
	await fs.mkdir(path.resolve(...dirname));
}

async function copy(...pathname) {
	await fs.copyFile(path.resolve(basedir,...pathname), path.resolve(project, ...pathname));
}

const { exec } = require("child_process");



async function run() {
	await mkdir(project)
	await mkdir(project, 'controllers');
	await mkdir(project, 'templates');
	await mkdir(project, 'www');
	await copy('package.json');
	await copy('index.mjs');
	await copy('LICENSE');
	await copy('README.md');
	await copy('www','index.html');
	await copy('templates','about.html');
	await copy('controllers','about.mjs');
	await copy('controllers','echo.mjs');

	let packageFile = path.resolve(project, 'package.json');
	let json = await fs.readFile(packageFile, 'utf8');
	let packageInfo = JSON.parse(json);
	packageInfo.name = project;
	await fs.writeFile(packageFile, JSON.stringify(packageInfo, 2), 'utf8');

	process.chdir(project);

	exec("npm i thor-web @types/node", (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
});
}

run();

