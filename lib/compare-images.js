var Promise = require('bluebird');
var streamToBuffer = require('stream-to-buffer');

// Use to create/write a png (encode). Yes, I know this also does have a decoder
var png = require('pngjs').PNG;

// Compares two images and generates a difference map image
function compareImages(referenceImage, compareImage, pixelColorTolerance, differenceMapColor) {
	// Default it to no tolerance if it isn't specified
	pixelColorTolerance = pixelColorTolerance || 0;

	// Default the difference color to red
	differenceMapColor = differenceMapColor || {
		r: 255,
		g: 0,
		b: 0,
		a: 255
	};

	// Create a buffer that we will use to generate a difference map png image
	var numColorChannels = 4;
	// http://stackoverflow.com/a/13735425/796832
	var differenceMapImageBuffer = new Array(referenceImage.width*referenceImage.height*numColorChannels+1).join('0').split('').map(parseFloat);
	var currentDifferenceMapIndex = 0;
	var addColorToDifferenceMap = function(color) {
		differenceMapImageBuffer[currentDifferenceMapIndex] = color.r || 0;
		differenceMapImageBuffer[currentDifferenceMapIndex+1] = color.g || 0;
		differenceMapImageBuffer[currentDifferenceMapIndex+2] = color.b || 0;
		differenceMapImageBuffer[currentDifferenceMapIndex+3] = color.a || 255;
		currentDifferenceMapIndex += numColorChannels;
	};

	var numPixelDifferences = 0;
	for(var y = 0; y < referenceImage.height; y++) {
		for(var x = 0; x < referenceImage.width; x++) {

			var referencePixel = getPixel(referenceImage, x, y);
			var comparePixel = getPixel(compareImage, x, y);

			if(referencePixel && comparePixel) {
				var isPixelWithinTolerance = compareColorEquality(referencePixel, comparePixel, pixelColorTolerance);

				if(!isPixelWithinTolerance) {
					numPixelDifferences++;

					// Mark on the difference map where the disparity was
					addColorToDifferenceMap(alphaBlendColors(differenceMapColor, referencePixel));
				}
				else {
					// Add the reference as back onto the map so we can show what parts are similar
					addColorToDifferenceMap(referencePixel);
				}
			}
			/* * /
			else {
				// We consider a pixel that doesn't exist in either image as a difference
				numPixelDifferences++;
			}
			/* */


		}
	}


	var whenPngReadyPromise = new Promise(function(resolve, reject) {
		var differenceMapPng = new png({
			width: referenceImage.width,
			height: referenceImage.height
		});
		differenceMapPng.data = new Buffer(differenceMapImageBuffer);

		var pngPackStream = differenceMapPng.pack();
		streamToBuffer(pngPackStream, function(err, buffer) {
			if(err) {
				reject(err);
			}

			resolve(buffer);
		});
	});
	
	return {
		numDifferences: numPixelDifferences,
		differenceMapImagePromise: whenPngReadyPromise
	};
}


function compareColorEquality(referenceColor, compareColor, tolerance) {
	var isColorWithinTolerance = true;
	// Loop through each channel and check if it is within tolerance
	Object.keys({r: true, g: true, b: true, a: true}).forEach(function(colorChannel) {
		var isChannelWithinTolerance = Math.abs(compareColor[colorChannel] - referenceColor[colorChannel]) <= (tolerance*255);

		isColorWithinTolerance = isColorWithinTolerance && isChannelWithinTolerance;
	});

	return isColorWithinTolerance;
}

// Color A is blended on top of color B
function alphaBlendColors(colorA, colorB) {
	aAlpha = colorA.a || 255;
	bAlpha = colorB.a || 255;
	var resultantColor = {
		a: bAlpha + ((1-bAlpha)*aAlpha)
	};
	var alphaPercentage = (aAlpha || 255) / 255;
	Object.keys({r: true, g: true, b: true}).forEach(function(colorChannel) {
		resultantColor[colorChannel] = (colorA[colorChannel] || 0)*alphaPercentage + (colorB[colorChannel] || 0)*(1-alphaPercentage);
	});

	return resultantColor;
}




function getPixel(imageData, x, y) {
	var pixelColor = null;

	if(imageData && x >= 0 && y >= 0) {
		// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
		var numChannels = imageData.channels;
		var arrayIndex = ((y*(imageData.width*numChannels)) + (x*numChannels));
		var rawData = Array.prototype.slice.call(imageData.data, arrayIndex, arrayIndex+numChannels);

		// grayscale
		if(numChannels === 1) {
			pixelColor = {
				r: rawData[0],
				g: rawData[0],
				b: rawData[0],
				a: 255
			};
		}
		// grayscale + alpha
		else if(numChannels === 2) {
			pixelColor = {
				r: rawData[0],
				g: rawData[0],
				b: rawData[0],
				a: rawData[1]
			};
		}
		// RGB
		else if(numChannels === 3) {
			pixelColor = {
				r: rawData[0],
				g: rawData[1],
				b: rawData[2],
				a: 255
			};
		}
		// RGBA
		else if(numChannels === 4) {
			pixelColor = {
				r: rawData[0],
				g: rawData[1],
				b: rawData[2],
				a: rawData[3],
			};
		}
	}

	return pixelColor;
}




module.exports = compareImages;