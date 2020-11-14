#!/usr/bin/env node

import { createInterface } from 'readline';
import { promises as fs } from 'fs';
import { resolve as _resolve, dirname } from 'path';
import { exec } from 'child_process';

var project = process.argv[2];

if (!project) {
	console.log('Usage: thor-web <project-name>');
	process.exit(-1);
}

const basedir = _resolve(dirname(import.meta.url.substring(7)), '..', 'template');

async function copyFolder(src, srcName, dest) {
	await fs.mkdir(dest);
	await execCmd(`cd ${dest} && tar xzf ${src}`);
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
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log('\nWhich type project would you want to generate?\n');
	const templates = (await fs.readdir(basedir, { withFileTypes: true }))
		.filter((f) => f.isFile() && /^\d+\.(.+)\.tar\.gz$/.test(f.name))
		.map((f) => /^\d+\.(.+)\.tar\.gz$/.exec(f.name)[1]);

	templates.forEach((t, idx) => console.log(`[${idx + 1}] ${t}`));
	console.log();
	let tid;
	do {
		tid = await new Promise((resolve) => {
			rl.question('Choose the type: [1]: ', (answer) => {
				if (answer === '') {
					resolve(0);
				} else if (/^\d+$/.test(answer)) {
					resolve(parseInt(answer) - 1);
				} else {
					resolve(-1);
				}
			});
		});
	} while (tid < 0 || tid >= templates.length);
	rl.close();

	await copyFolder(_resolve(basedir, `${tid + 1}.${templates[tid]}.tar.gz`), `${tid + 1}.${templates[tid]}`, project);

	let packageFile = _resolve(project, 'package.json');
	let json = await fs.readFile(packageFile, 'utf8');
	let packageInfo = JSON.parse(json);
	packageInfo.name = project;
	await fs.writeFile(packageFile, JSON.stringify(packageInfo, 2), 'utf8');

	process.chdir(project);

	console.log('Install packages ...');
	await execCmd('npm i');
	await execCmd('npm i thor-web thor-tpl thor-validation --save');
	console.log(`\nProject [${project}] created!!\n`);
}

(async function () {
	try {
		await run();
	} catch (e) {
		console.error(e.message || e + '');
	}
})();
