import { promises as fs } from 'fs';
import path from 'path';
async function fileStat(file) {
    try {
        let stat = await fs.stat(file);
        return { isFile: stat.isFile(), size: stat.size, mtime: stat.mtime, ctime: stat.ctime };
    }
    catch (e) {
        return { isFile: false, size: 0, mtime: null, ctime: null };
    }
}
async function isFile(file) {
    let stat = await fileStat(file);
    return stat.isFile;
}
function getRootDir() {
    let js = process.argv[1];
    if (!js) {
        return process.cwd();
    }
    if (/\.(c|m)?js$/.test(js)) {
        return js.substring(0, js.lastIndexOf(path.sep));
    }
    else {
        return js;
    }
}
export default {
    fileStat,
    isFile,
    getRootDir,
};
