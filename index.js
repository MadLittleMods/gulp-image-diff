var fs = require('fs-extra');
var path = require('path');

var Promise = require('promise');
var outputFile = Promise.denodeify(fs.outputFile);

var through = require('through2');
var extend = require('extend');
var gutil = require('gulp-util');

var jsonReporter = require('./lib/json-reporter.js');

var compareImages = require('./lib/compare-images.js');
var convertToPng = require('./lib/convert-to-png.js');


// consts
const PLUGIN_NAME = 'gulp-image-diff';



var differ = function(options) {

	var defaults = {
		// String path+filename, buffer, or vinyl file of where the reference image
		referenceImage: null,
		// 0-1 representing the allowed color difference between pixels
		// 0 means no tolerance. Pixels need to be exactly the same
		// This allows for slight differences in aliasing
		pixelColorTolerance: 0.01,
		// Pass a string path+filename or a function that returns string path+filename of where to save the difference image
		// function(referencePath, compareImagePath): Return string path+filename
		differenceMapImage: null,
		// The color for each pixel that is different
		differenceMapColor: {
			r: 255,
			g: 0,
			b: 0,
			a: 200
		},
		// Log to the console
		// You can also hook onto `.on('log', ...)` events which are emitted no matter what
		logProgress: false
	};

	var settings = extend({}, defaults, options);


	var whenReferenceImageReadyPromise = convertToPng(settings.referenceImage);

	var stream = through.obj(function(chunk, enc, cb) {
		// http://nodejs.org/docs/latest/api/stream.html#stream_transform_transform_chunk_encoding_callback
		//console.log('transform');

		// Each `chunk` is a vinyl file: https://www.npmjs.com/package/vinyl
		// chunk.cwd
		// chunk.base
		// chunk.path
		// chunk.contents

		var self = this;


		if (chunk.isStream()) {
			self.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Cannot operate on stream'));
		}
		else if (chunk.isBuffer()) {
			whenReferenceImageReadyPromise.then(function(referenceImage) {

				convertToPng(chunk).then(function(compareImage) {
					var totalPixels = compareImage.width*compareImage.height;
					var compareResult = compareImages(referenceImage, compareImage, settings.pixelColorTolerance, settings.differenceMapColor);

					// Some nice debug info on the diff
					//console.log('diff:', compareResult.numDifferences, '/', totalPixels, '= ', (compareResult.numDifferences/totalPixels));
					
					var analysis = {
						differences: compareResult.numDifferences,
						total: totalPixels,
						disparity: compareResult.numDifferences/totalPixels,
						referenceImage: path.normalize(settings.referenceImage),
						compareImage: path.relative(chunk.cwd, chunk.path)
					};

					compareResult.differenceMapImagePromise.then(function(differenceMapImageBuffer) {

						var whenImageDealtWithPromise = new Promise(function(resolve, reject) {
							if(settings.differenceMapImage) {
								// You can pass a string or function to generate the diff save path
								// We give you the path of the reference and compare image to construct a path
								var differenceMapSavePath = settings.differenceMapImage;
								if(typeof(settings.differenceMapImage) === "function") {
									differenceMapSavePath = settings.differenceMapImage(analysis.referenceImage, analysis.compareImage);
								}

								// Save out the difference map
								outputFile(differenceMapSavePath, differenceMapImageBuffer).then(function(err) {
									if(err) {
										err.message = 'Error saving difference image:\n' + err.message;
										self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
									}

									// Add to the analysis if we saved the image
									analysis.differenceMap = differenceMapSavePath;

								}).done(function() {
									resolve();
								});
							}
							else {
								resolve();
							}
						});


						whenImageDealtWithPromise.done(function() {

							// Attach some extra data to what we emit in case something else wants to consume down the line
							// Since we can chain the diffs, we need to maintain all of the analysis's
							// If array, add to the array
							if(chunk.analysis instanceof Array) {
								chunk.analysis.push(analysis);
							}
							// If it already exists, make it into an array
							else if(chunk.analysis) {
								chunk.analysis = [chunk.analysis, analysis];
							}
							// Else, just set it to itself
							else {
								chunk.analysis = analysis;
							}

							// We don't maintain multiple difference images through chains
							chunk.differenceMap = differenceMapImageBuffer;


							var logMessage = 'Diff complete: ' + analysis.differences + '/' + analysis.total + ' = ' + gutil.colors.cyan(analysis.differences / analysis.total) + ' -- ' + gutil.colors.magenta(analysis.compareImage) + ' compared to ' + gutil.colors.magenta(analysis.referenceImage);
							
							// Emit some log events for anyone to catch
							self.emit('log', logMessage);

							// We also have a setting to log to the console
							if(settings.logProgress) {
								gutil.log(logMessage);
							}

							// Push out the original image
							// So you can pipe it multiple times into the diff plugin against different references
							self.push(chunk);

							// "call callback when the transform operation is complete."
							return cb();
						});


					}, function(err) {
						err.message = 'Error making difference image:\n' + err.message;
						self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
					});

				});
			}, function(err) {
				err.message = 'Error getting reference image\n:' + err.message;
				self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
			});
		}



	}, function(cb) {
		// http://nodejs.org/docs/latest/api/stream.html#stream_transform_flush_callback
		//console.log('flush');



		// "call callback when the flush operation is complete."
		cb();
		

	});

	// returning the file stream
	return stream;
};


module.exports = differ;
module.exports.jsonReporter = jsonReporter;