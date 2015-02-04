var Promise = require('bluebird');
var fs = require('fs-extra');
var readFile = Promise.promisify(fs.readFile);
// Used to read a png (decoder)
var pngParse = require('pngparse');
var parsePng = Promise.promisify(pngParse.parse);

// You can pass in a string, buffer, or vinyl file
// Returns a promise with the image data(see, pngjs docs. simliar to: https://developer.mozilla.org/en-US/docs/DOM/ImageData)
function convertToPng(file) {
	var whenPngReadyPromise = new Promise(function(resolve, reject) {
		var buffer;

		// If it is a glob string
		if (typeof file === 'string') {
			//console.log('is glob string');
			readFile(file).then(function(data) {
				buffer = data;
				parsePngAsync(buffer);
			}, function(err) {
				reject(err);
			});
		}
		// If it is a buffer
		else if(Buffer.isBuffer(file)) {
			//console.log('is buffer');
			buffer = file;
			parsePngAsync(buffer);
		}
		// If it is a vinyl file
		else if(file.contents && Buffer.isBuffer(file.contents)) {
			//console.log('is vinyl');
			buffer = file.contents || undefined;
			parsePngAsync(buffer);
		}
		else {
			reject(new Error('File passed in is undefined or not supported. Pass in a glob string, buffer, or vinyl file'));
		}

		function parsePngAsync(buffer) {
			if(buffer) {
				parsePng(buffer).then(function(result) {
					resolve(result);
				}, function(err) {
					reject(err);
				});
			}
			else {
				reject(new Error('Buffer not defined'));
			}
		}
	});

	return whenPngReadyPromise;
}



module.exports =  convertToPng;