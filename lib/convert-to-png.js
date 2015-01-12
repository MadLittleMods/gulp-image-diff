var fs = require('fs-extra');
var Promise = require('promise');
// Used to read a png (decoder)
var pngparse = require('pngparse');

// You can pass in a string, buffer, or vinyl file
// Returns a promise with the image data(see, pngjs docs. simliar to: https://developer.mozilla.org/en-US/docs/DOM/ImageData)
function convertToPng(file) {
	var whenPngReadyPromise = new Promise(function(resolve, reject) {
		// If it is a glob string
		if (typeof file === 'string') {
			//console.log('is glob string');
			fs.readFile(file, function (err, data) {
				if(err) {
					reject(err);
				}
				else {
					var buffer = data;
					parsePngAsync(buffer);
				}

			});
		}
		// If it is a buffer
		else if(Buffer.isBuffer(file)) {
			//console.log('is buffer');
			var buffer = file;
			parsePngAsync(buffer);
		}
		// If it is a vinyl file
		else if(file.contents && Buffer.isBuffer(file.contents)) {
			//console.log('is vinyl');
			var buffer = file.contents;
			parsePngAsync(buffer);
		}

		function parsePngAsync(buffer) {
			if(buffer) {
				pngparse.parse(buffer, function(err, result) {
					if(err) {
						reject(err);
					}

					resolve(result);
				});
			}
		}
	});

	return whenPngReadyPromise;
}



module.exports =  convertToPng;