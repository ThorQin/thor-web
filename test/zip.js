/* eslint-disable @typescript-eslint/no-var-requires */
const { createGzip } = require('zlib');
const s = require('stream');
const { promisify } = require('util');
const fs = require('fs');

const pipelineAsync = promisify(s.pipeline);

const zs = createGzip();

const fileStream = fs.createReadStream(__dirname + '/../html/build/bundle.js');
// const outputFileStream = fs.createWriteStream(__dirname + '/out.gz');

class Counter extends s.Transform {
	size = 0;
	_transform(chunk, encoding, cb) {
		this.size += chunk.length;
		cb(null, chunk);
	}
}

async function dozip() {
	const counter = new Counter();
	await pipelineAsync(fileStream, zs, counter); // , outputFileStream);
	console.log('out size:', counter.size);
}
dozip();
