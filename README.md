# gulp-image-diff

`gulp-image-diff`, a [gulp](http://gulpjs.com/) plugin, is a image diff'ing tool. We compare pixel by pixel with an option for color tolerance.

We also emit the raw data and percentage of disparity in `analysis`, see the [What we emit section](#what-we-emit).


# Install

## Latest Version: 0.2.0

Currently on GitHub.
```
npm install MadLittleMods/gulp-image-diff
```


# Usage

```
var gulp = require('gulp');
var imageDiff = require('gulp-image-diff');

gulp.task('diff-images', function() {
	return gulp.src(['my-image.png'])
		.pipe(imageDiff({
			referenceImage: 'reference.png',
			differenceMapImage: './diff.png'
		}));
});
```

### Chaining

Since `gulp-image-diff` is a pass-through and emits an untouched image, you can pipe it multiple times into the diff against different references.

```
var gulp = require('gulp');
var imageDiff = require('gulp-image-diff');

gulp.task('diff-images', function() {
	return gulp.src(['my-image.png'])
		.pipe(imageDiff({
			referenceImage: 'reference1.png',
			differenceMapImage: './diff1.png'
		}))
		.pipe(imageDiff({
			referenceImage: 'reference2.png',
			differenceMapImage: './diff2.png'
		}))
		.pipe(imageDiff({
			referenceImage: 'reference3.png',
			differenceMapImage: './diff3.png'
		}));
});
```


# Reporting/Logging/Generating JSON

`gulp-image-diff` includes `imageDiff.jsonReporter()` which you can use to pipe the diff analysis into and generate a JSON file. 

Since we chain the analysis, the JSON reporter will be able to pick up all analysis in the consecutive chain.

```
var gulp = require('gulp');
var imageDiff = require('gulp-image-diff');

gulp.task('diff-images', function() {
	return gulp.src(['icon-i.png', 'icon-o.png', 'icon-c.png'])
		.pipe(imageDiff({
			referenceImage: 'test-images/icon-reference.png',
			differenceMapImage: './diff1.png'
		}))
		.pipe(imageDiff({
			referenceImage: 'test-images/icon-reference2.png',
			differenceMapImage: './diff2.png'
		}))
		.pipe(imageDiff.jsonReporter())
		.pipe(gulp.dest('./diff-analysis-report.json'));
});
```




# Options

 - `options`: object - hash of options
 	 - `referenceImage`: string|buffer|vinyl-file - Pass in the image and we can take of it
 	 	 - Default: null
 	 - `pixelColorTolerance`: number - 0-1 representing the allowed color difference between the referenc and compare pixels
 	 	 - Default: 0.01
 	 	 - 0 means no tolerance. Pixels need to be exactly the same
 	 	 - This option allows for slight differences in aliasing in for example text
	 - `differenceMapImage`: string|function - Pass a string path+filename or a function that returns string path+filename of where to save the difference image
	 	 - Default: null
	 	 - `function(referencePath, compareImagePath)`: Return string path+filename
	 - `differenceMapColor`: object - The color for each pixel used in the `differenceMapImage` that is not within tolerance.
	 	 - Default: `{ r: 255, g: 0, b: 0, a: 200 }`
	 	 - If transparent, it will be alpha-blended with the reference image.



### Notes:

 - We use rgba 0-255 range colors.
 - The reference image is the master and we iterate over the reference image pixels. If the compare image doesn't have a pixel at that coordinate, we just skip to the next(does not increment the difference counter).
 	 - This is especially important point to know if you are comparing different size images.


# What we emit

`gulp-image-diff` is a pass-through and will emit the original image as a normal Gulp [vinyl file](https://www.npmjs.com/package/vinyl).

We also attach an `analysis` containing the raw data of differences and `differenceMap` which is a buffer of the difference image in case you want to consume it later down the pipe.

 - Gulp [vinyl file](https://www.npmjs.com/package/vinyl). We emit whatever you passed in (untouched).
	 - `analysis`: object - hash of data that is chained through out multiple diff calls
	 	 - `differences`: number - compareResult.numDifferences,
		 - `total`: number - total amount of pixels in the reference image,
		 - `disparity`: number - 0-1 percentage value. This is a just a shortcut for `differences/total`
		 - `referenceImage`: string - path of the reference image used in the diff
		 - `compareImage`: string - path of the compare image used in the diff
		 - *`differenceMap`: string - path to the difference map image, only if saved successfully
	 - `differenceMap`: buffer - The difference png image.