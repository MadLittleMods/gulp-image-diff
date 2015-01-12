var fs = require('fs-extra');
var path = require('path');
var through = require('through2');
var extend = require('extend');
var gutil = require('gulp-util');


// consts
const PLUGIN_NAME = 'gulp-image-diff-json-reporter';


var jsonReporter = function(options) {

	var defaults = {
		
	};

	var settings = extend({}, defaults, options);

	var analysisList = [];

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
			// Store the analysis up so we can make a single json file in the flush
			if(chunk.analysis) {
				// If it isn't a array, make it into one, as it is easier to process
				chunkAnalysisList = chunk.analysis instanceof Array ? chunk.analysis : [chunk.analysis];
				chunk.analysis.forEach(function(analysis) {
					analysisList.push(analysis);
				});
			}
		}

		// Push out the original image
		// So you can pipe it multiple times into the diff plugin against different references
		//self.push(chunk);

		// "call callback when the transform operation is complete."
		return cb();


	}, function(cb) {
		// http://nodejs.org/docs/latest/api/stream.html#stream_transform_flush_callback
		//console.log('flush');

		var self = this;

		//console.log(analysisList);

		// Make the list json, and emit it
		var resultantJson = '';
		try {
			resultantJson = JSON.stringify(analysisList);
		}
		catch(err) {
			err.message = 'Could not stringify diff analysis list:\n' + err.message;
			self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
		}


		var jsonFile = new gutil.File({
			cwd: process.cwd(),
			base: process.cwd(),
			path: process.cwd(),
			contents: new Buffer(resultantJson)
		});
		

		// Emit the json
		self.push(jsonFile);

		// "call callback when the flush operation is complete."
		cb();
	
	});

	// returning the file stream
	return stream;
};


module.exports = jsonReporter;