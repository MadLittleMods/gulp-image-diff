// Manual way to run/try the plugin

// Include gulp
var gulp = require('gulp');
var es = require('event-stream');

var differ = require('../');


gulp.task('diff', function() {

	// './test-css/minimal-for-bare-testing.css'
	return gulp.src(['./images/test2.png'])
		.pipe(differ({
			referenceImage: './images/test1.png'
		}))
		.pipe(es.wait(function(err, body) {
			console.log(arguments);
		}));
});


// Default Task
gulp.task('default', ['diff']);