const fs = require('fs').promises;

async function fileStat(file) {
	try {
		let stat = await fs.stat(file);
		return { isFile: stat.isFile(), length: stat.length, mtime: stat.mtime, ctime: stat.ctime };
	} catch (e) {
		return { isFile: false, length: 0, mtime: null, ctime: null };
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
