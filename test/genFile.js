/* eslint-disable @typescript-eslint/no-var-requires */
const uuidv1 = require('uuid').v1;
const fs = require('fs');

function generateFile(storeDir) {
	const id = uuidv1().replace(/-/g, '');
	console.log(id);
	const path =
		storeDir +
		id.substring(0, 6).replace(/.{3}/g, function (v) {
			return v + '/';
		});
	const file = path + id.substring(6) + '.data';
	console.log(file);
}

generateFile('/upload/');
