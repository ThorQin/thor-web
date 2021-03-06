#!/usr/bin/env node

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

const { exec } = require('child_process');

function execCmd(cmdLine) {
	return new Promise((resolve, reject) => {
		exec(cmdLine, (error, stdout, stderr) => {
			if (error) {
				reject(error.message || error);
				return;
			}
			console.log(stdout);
			if (stderr) {
				console.error(`${stderr}`);
			}
			resolve();
		});
	});
}


async function run() {
	await mkdir(project);
	await mkdir(project, 'controllers');
	await mkdir(project, 'templates');
	await mkdir(project, 'www');
	await mkdir(project, '.vscode');
	await copy('package.json');
	await copy('index.mjs');
	await copy('LICENSE');
	await copy('README.md');
	await copy('www','index.html');
	await copy('templates','about.html');
	await copy('controllers','about.mjs');
	await copy('controllers','echo.mjs');
	await copy('.vscode', 'launch.json');

	let packageFile = path.resolve(project, 'package.json');
	let json = await fs.readFile(packageFile, 'utf8');
	let packageInfo = JSON.parse(json);
	packageInfo.name = project;
	await fs.writeFile(packageFile, JSON.stringify(packageInfo, 2), 'utf8');

	process.chdir(project);

	await execCmd('npm install thor-web thor-tpl @types/node');
	await execCmd('npm install --save-dev cross-env nodemon');
	console.log(`Project '${project}' created!!\n`);
}

run();

