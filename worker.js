// worker.js
onmessage = function (e) {
  const { width, height, imageData, pixelSize, invert, temperature, contrast, brightness } = e.data;

  const result = canvasToPixMap(imageData.data, { width, height, pixelSize, invert, temperature, contrast, brightness });

  postMessage(result);
};

const clipColor = val => Math.max(0, Math.min(255, val));

function invertRGBColor(r, g, b) {
	const invertedR = 255 - r;
	const invertedG = 255 - g;
	const invertedB = 255 - b;

	return [
		clipColor(invertedR),
		clipColor(invertedG),
		clipColor(invertedB)
	];
}


function adjustColorTemperature(r, g, b, temperature) {
	temperature = Math.max(-100, Math.min(100, temperature));

	const adjustedR = r + temperature;
	const adjustedG = g + temperature / 2;
	const adjustedB = b - temperature;

	return [
		clipColor(adjustedR),
		clipColor(adjustedG),
		clipColor(adjustedB)
	];
}

function adjustPixelContrast(r, g, b, contrast) {
	const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
	const adjustedR = factor * (r - 128) + 128;
	const adjustedG = factor * (g - 128) + 128;
	const adjustedB = factor * (b - 128) + 128;

	return [
		clipColor(adjustedR),
		clipColor(adjustedG),
		clipColor(adjustedB)
	];
}

function adjustPixelBrightness(r, g, b, brightness) {
	const adjustedR = r + brightness;
	const adjustedG = g + brightness;
	const adjustedB = b + brightness;
	
	return [
		clipColor(adjustedR),
		clipColor(adjustedG),
		clipColor(adjustedB)
	];
}


function canvasToPixMap(imageData, { width, height, pixelSize, invert, temperature, contrast, brightness }) {
  
	const pixelMap = [];
	const perRowPixels = [];
	let i = 0;

	for (let y = 0; y < height; y += pixelSize) {
		const rowPixels = [];
		for (let x = 0; x < width; x += pixelSize) {
			let index = ((y * width + x) * 4);
			let pixelData = [
        imageData[index],
        imageData[index + 1],
        imageData[index + 2],
        imageData[index + 3]
      ];
			const isPixelFilled = pixelData.some(value => value > 0);
			let rgb = [pixelData[0], pixelData[1], pixelData[2]];

			if(isPixelFilled){
				if(invert) rgb = invertRGBColor(...rgb);
				if(temperature) rgb = adjustColorTemperature(...rgb, temperature);
				if(contrast) rgb = adjustPixelContrast(...rgb, contrast);
				if(brightness) rgb = adjustPixelBrightness(...rgb, brightness);
			}

			const pixel = {
					x: x / pixelSize,
					y: y / pixelSize,
					filled: isPixelFilled,
					size: pixelSize,
					rgb,
			};

			rowPixels.push(pixel);
			pixelMap.push(pixel);
			i++;
		}
		perRowPixels.push(rowPixels);
	}

	const perColPixels = perRowPixels[0].map((col, i) => perRowPixels.map(row => row[i]));


	return {
		pixelMap,
		width: Math.floor(width / pixelSize),
		height: Math.floor(height / pixelSize),
		perRowPixels,
		pixelSize,
		perColPixels
	};
}
