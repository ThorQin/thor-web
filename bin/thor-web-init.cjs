#!/usr/bin/env node

var project = process.argv[2];

if (!project) {
	console.log('Usage: thor-web <project-name>');
	process.exit(-1);
}

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const basedir = path.resolve(path.dirname(require.main.filename), '..', 'template');

async function copyFolder(src, dest) {
	await fs.mkdir(dest);
	let dir = await fs.opendir(src);
	let ent;
	do {
		ent = await dir.read();
		if (ent) {
			if (ent.isDirectory()) {
				await copyFolder(path.resolve(src, ent.name), path.resolve(dest, ent.name));
			} else if (ent.isFile()) {
				await fs.copyFile(path.resolve(src, ent.name), path.resolve(dest, ent.name));
			}
		}
	} while (ent);
}

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
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	console.log('\nWhich project type would you want to create?\n\n[1] Hello World. (Verify simple demo.)\n[2] Basic Project. (Provide login, session, access control and TUI2, etc..)\n');
	let projectType;
	do {
		projectType = await new Promise((resolve) => {
			rl.question('Choose the type: [1]: ', (answer) => {
				if (answer === '1' || answer === '') {
					resolve('hello-world');
					rl.close();
				} else if (answer === '2') {
					resolve('simple-project');
					rl.close();
				} else {
					resolve('');
				}
			});
		});
	} while(!projectType);

	await copyFolder(path.resolve(basedir, projectType), project);

	let packageFile = path.resolve(project, 'package.json');
	let json = await fs.readFile(packageFile, 'utf8');
	let packageInfo = JSON.parse(json);
	packageInfo.name = project;
	await fs.writeFile(packageFile, JSON.stringify(packageInfo, 2), 'utf8');

	process.chdir(project);

	await execCmd('npm install thor-web thor-tpl @types/node');
	await execCmd('npm install --save-dev cross-env nodemon');
	console.log(`\nProject [${project}] created!!\n`);
}

run();

