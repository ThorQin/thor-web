const fs = require('fs').promises;

async function fileStat(file) {
	try {
		let stat = await fs.stat(file);
		return { isFile: stat.isFile(), length: stat.length };
	} catch (e) {
		return { isFile: false, length: 0 };
	}
}

async function isFile(file) {
	let stat = await fileStat(file);
	return stat.isFile;
}

module.exports = {
	fileStat: fileStat,
	isFile: isFile
};
