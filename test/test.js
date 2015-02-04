
var Promise = require('bluebird');

var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var util = require('util');
var path = require('path');
var fs = require('fs');
var readFile = Promise.promisify(fs.readFile);
var stat = Promise.promisify(fs.stat);

var gulp = require('gulp');
var gutil = require('gulp-util');
var es = require('event-stream');


// The main gulp plugin to test
var differ = require('../');

var jsonReporter = require('../lib/json-reporter');
var convertToPng = require('../lib/convert-to-png');
var compareImages = require('../lib/compare-images');


var testImageInfo = {
	path: 'test/images/test1.png',
	expectedWidth: 4,
	expectedHeight: 4
};



describe('gulp-image-diff', function() {

	it('should emit a buffer', function() {
		var differPromise = differTest({
			referenceImage: './test/images/icon-reference.png'
		}, ['./test/images/icon-c.png']).then(function(result) {
			return result.isBuffer();
		});

		return expect(differPromise).to.eventually.equal(true);
	});

	it('should emit the original image', function() {
		var inputImagePath = './test/images/test2.png';
		var differPromise = differTest({
			referenceImage: './test/images/test1.png'
		}, [inputImagePath]).then(function(result) {
			return readFile(inputImagePath).then(function(originalContents) {
				originalContents = String(originalContents);

				return expect(String(result.contents)).to.equal(originalContents);
			});
		});

		return differPromise;
	});

	it('should save difference image when `options.differenceMapImage` is present', function() {
		var differenceMapImagePath  ='./test/test-output/diff2.png';
		var differPromise = differTest({
			referenceImage: './test/images/test1.png',
			differenceMapImage: differenceMapImagePath
		}, ['./test/images/test2.png']).then(function() {
			// Find out whether the differenceMapImage exists
			return stat(differenceMapImagePath);
		});

		return differPromise;
	});

	it('should pass path parameters to `options.differenceMapImage`', function() {
		var expectedReferencePath = './test/images/test1.png';
		var expectedComparePath = './test/images/test2.png';
		var testsPromise = new Promise(function(resolve, reject) {
			var differPromise = differTest({
				referenceImage: expectedReferencePath,
				differenceMapImage: function(referencePath, comparePath) {
					resolve(Promise.all([
						expect(path.resolve(referencePath)).to.equal(path.resolve(expectedReferencePath)),
						expect(path.resolve(comparePath)).to.equal(path.resolve(expectedComparePath))
					]));

					return './test/test-output/diff1.png';
				}
			}, [expectedComparePath]).catch(function(err) {
				reject(err);
			});
		});

		return testsPromise;
	});

	it('should throw error when `options.differenceMapImage` does not return a string', function() {
		var differPromise = differTest({
			referenceImage: './test/images/test1.png',
			differenceMapImage: function(referencePath, comparePath) {
				// No string path returned here should throw the error
			}
		}, ['./test/images/test2.png']);

		return expect(differPromise).to.eventually.be.rejected;
	});

	it('should chain analysis report', function() {
		var differOptions = {
			referenceImage: './test/images/icon-reference.png'
		};

		var testsPromise = new Promise(function(resolve, reject) {
			gulp.src(['./test/images/icon-c.png'])
				.pipe(differ({
					referenceImage: './test/images/icon-reference.png'
				}))
				.pipe(differ({
					referenceImage: './test/images/icon-reference2.png'
				}))
				.pipe(waitForAllChunks(function(chunks) {
					//console.log(util.inspect(arguments, false, null));
					//console.log(chunks[chunks.length-1].analysis);

					var analysis = chunks[0].analysis;

					resolve(Promise.all([
						expect(analysis.length).to.equal(2),
						expect(isAnalysisObjectShape(analysis)).to.equal(true),
						expect(analysis).to.deep.equal([
							{
								differences: 24,
								total: 100,
								disparity: 0.24,
								referenceImage: 'test\\images\\icon-reference.png',
								compareImage: 'test\\images\\icon-c.png' },
							{
								differences: 32,
								total: 100,
								disparity: 0.32,
								referenceImage: 'test\\images\\icon-reference2.png',
								compareImage: 'test\\images\\icon-c.png'
							}
						])
					]));
				}));
				/* * /
				.pipe(es.map(function(file) {
					console.log('f', file);
				}));
				/* */
		});

		return testsPromise;
	});

	// Get a promise that resolves with the transformed file/chunks
	function differTest(differOptions, paths) {
		differOptions = differOptions || {};
		paths = paths || [];

		var whenDifferDonePromise = new Promise(function(resolve, reject) {
			gulp.src(paths)
				.pipe(differ(differOptions))
				.on('error', function() {
					reject.apply(null, arguments);
				})
				.pipe(es.map(function() {
					resolve.apply(null, arguments);
				}));
		});

		return whenDifferDonePromise;
	}

	// Checks to make sure it has all of the necessary 
	function isAnalysisObjectShape(analyses) {
		var analysisShape = {
			differences: 1,
			total: 4,
			disparity: 0.25,
			referenceImage: './ref.png',
			compareImage: './compare.png'
		};

		analyses = [].concat(analyses);
		return analyses.every(function(analysis) {
			return Object.keys(analysisShape).reduce(function(hasAllProperties, key) {
				return hasAllProperties && (key in analysis);
			});
		});
	}
});


describe('lib/jsonReporter', function() {
	it('should emit JSON', function() {
		// create the fake file
		var fakeFile = new gutil.File({
			base: process.cwd(),
			cwd: process.cwd(),
			path: path.join(process.cwd(), 'test.css'),
			contents: new Buffer('test')
		});
		fakeFile.analysis =  {
			'test': true
		};

		return jsonReporterTest({}, fakeFile).then(function(chunks) {
			//console.log(String(chunks[0].contents));
			return Promise.all([
				expect(chunks.length).to.equal(1),
				expect(JSON.parse(String(chunks[0].contents))).to.deep.equal([fakeFile.analysis])
			]);
		});
	});

	it('should compile multiple(array of) analyses per file', function() {
		var fakeFile = new gutil.File({
			base: process.cwd(),
			cwd: process.cwd(),
			path: path.join(process.cwd(), 'test.css'),
			contents: new Buffer('test')
		});
		fakeFile.analysis =  [{
			'test': true
		}, {
			'test2': true
		}];

		return jsonReporterTest({}, fakeFile).then(function(chunks) {
			var analyses = JSON.parse(String(chunks[0].contents));
			return Promise.all([
				expect(chunks.length).to.equal(1),
				expect(analyses.length).to.equal(2),
				expect(analyses).to.deep.equal(fakeFile.analysis)
			]);
		});
	});

	it('should collect analyses from multiple chunks', function() {
		var fakeFile = new gutil.File({
			base: process.cwd(),
			cwd: process.cwd(),
			path: path.join(process.cwd(), 'test.css'),
			contents: new Buffer('test')
		});
		fakeFile.analysis =  {
			'test': true
		};

		var fakeFile2 = fakeFile.clone();
		fakeFile2.analysis =  {
			'test2': true
		};

		return jsonReporterTest({}, [fakeFile, fakeFile2]).then(function(chunks) {
			var analyses = JSON.parse(String(chunks[0].contents));
			return Promise.all([
				expect(chunks.length).to.equal(1),
				expect(analyses.length).to.equal(2),
				expect(analyses).to.deep.equal([fakeFile.analysis, fakeFile2.analysis])
			]);
		});
	});


	// Get a promise that resolves with the transformed file/chunks
	function jsonReporterTest(reporterOptions, vinylFiles) {
		reporterOptions = reporterOptions || {};
		vinylFiles = [].concat(vinylFiles);

		var whenReporterDonePromise = new Promise(function(resolve, reject) {
			// Create a spriter plugin stream
			var myReporter = jsonReporter(reporterOptions);

			// wait for the file to come back out
			myReporter.pipe(waitForAllChunks(function(chunks) {
				//console.log(util.inspect(arguments, false, null));
				resolve(chunks);
			}));

			myReporter.on('error', function(err) {
				reject(err);
			});

			myReporter.on('end', function() {
				resolve();
			});
		
			// write each file to it
			vinylFiles.forEach(function(file) {
				myReporter.write(file);
			});
			myReporter.end();
		});

		return whenReporterDonePromise;
	}
});



describe('lib/convertToPng', function() {
	describe('should create png data', function() {
		it('with string file path', function() {
			return convertToPng(testImageInfo.path).then(function(pngData) {
				return Promise.all([
					expect(pngData.width).to.equal(testImageInfo.expectedWidth),
					expect(pngData.height).to.equal(testImageInfo.expectedHeight),
					// 4 channels of color: rgba
					expect(pngData.data.length).to.equal(testImageInfo.expectedWidth*testImageInfo.expectedHeight*4)
				]);
			});
		});

		it('with buffer', function() {
			return readFile(testImageInfo.path).then(function(imageBuffer) {
				return convertToPng(imageBuffer).then(function(pngData) {
					return Promise.all([
						expect(pngData.width).to.equal(testImageInfo.expectedWidth),
						expect(pngData.height).to.equal(testImageInfo.expectedHeight),
						// 4 channels of color: rgba
						expect(pngData.data.length).to.equal(testImageInfo.expectedWidth*testImageInfo.expectedHeight*4)
					]);
				});
			});
		});

		it('with vinyl file object', function() {
			return readFile(testImageInfo.path).then(function(imageBuffer) {
				var imageVinylFile = new gutil.File({
					base: process.cwd(),
					cwd: process.cwd(),
					path: path.join(process.cwd(), testImageInfo.path),
					contents: imageBuffer
				});

				return convertToPng(imageBuffer).then(function(pngData) {
					return Promise.all([
						expect(pngData.width).to.equal(testImageInfo.expectedWidth),
						expect(pngData.height).to.equal(testImageInfo.expectedHeight),
						// 4 channels of color: rgba
						expect(pngData.data.length).to.equal(testImageInfo.expectedWidth*testImageInfo.expectedHeight*4)
					]);
				});
			});
		});
	});

});


describe('lib/compareImages', function() {
	it('should compare images with no tolerance', function() {
		var numDifferencePromise = compareImagesTest('./test/images/test1.png', './test/images/test2.png').then(function(result) {
			return result.numDifferences;
		});
		return expect(numDifferencePromise).to.eventually.equal(12);
	});

	it('should compare images with 50% tolerance', function() {
		var numDifferencePromise = compareImagesTest('./test/images/test1.png', './test/images/test2.png', 0.5).then(function(result) {
			return result.numDifferences;
		});
		return expect(numDifferencePromise).to.eventually.equal(12);
	});

	it('should compare images with 100% tolerance', function() {
		var numDifferencePromise = compareImagesTest('./test/images/test1.png', './test/images/test2.png', 1).then(function(result) {
			return result.numDifferences;
		});
		// No pixels should be different with a 100% tolerance!
		return expect(numDifferencePromise).to.eventually.equal(0);
	});

	function compareImagesTest(referenceImagePath, compareImagePath/*, optional args passed to compareImages */) {
		var extraCompareImagesArgs = [].slice.call(arguments, 2);

		var filesReadyPromise = Promise.all([
			readFile(referenceImagePath).then(function(buffer) { return convertToPng(buffer); }),
			readFile(compareImagePath).then(function(buffer) { return convertToPng(buffer); })
		]);

		var compareResultPromise = filesReadyPromise.then(function(res) {
			//console.log(util.inspect(arguments, false, null));
			var referenceImage = res[0];
			var compareImage = res[1];

			return compareImages.apply(null, [referenceImage, compareImage].concat(extraCompareImagesArgs));
		});

		return compareResultPromise;
	}
});



// ex. `.pipe(waitForAllChunks(function() { ... }))`
function waitForAllChunks(callback) {
	var chunkList = [];

	return es.through(
		function(chunk) {
			chunkList.push(chunk);
		},
		function() {
			var self = this;

			chunkList.forEach(function(chunk) {
				self.emit('data', chunk);
			});
			this.emit('end');

			if(callback) {
				callback(chunkList);
			}
		}
	);
}