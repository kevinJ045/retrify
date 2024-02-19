(function(){

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

	var worker = new Worker('worker.js');

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

	function allocateNumber(number){
		if(typeof number == "string") number = parseInt(number);
		if(isNaN(number)) return 0;
		return number;
	}


	function canvasToPixMap(canvas, context, options){
		return new Promise((r, err) => {
			try{
				worker.postMessage({ imageData: context.getImageData(0, 0, canvas.width, canvas.height), width: canvas.width, height: canvas.height, ...options });
				worker.onmessage = function (e) {
					var result = e.data;
					r(result);
				};
				worker.onerror = function (e){
					err(e);
				}
			} catch(e){
				err(e);
			}
		});
	}

	function imageToPixelMap({
		imageUrl =  "",
		pixelSize = 10,
		scaleTo = 0,
		flip = false,
		rotation = 0,
		invert = false,
		temperature = 0,
		contrast = 0,
		brightness = 0
	}) {
		const image = new Image();
		image.src = imageUrl;

		temperature = allocateNumber(temperature);
		contrast = allocateNumber(contrast);
		brightness = allocateNumber(brightness);

		return new Promise((resolve) => {
			image.onload = async function () {
				const canvas = document.createElement('canvas');
				let context = canvas.getContext('2d');
				const rotationAngle = rotation;

				const originalWidth = image.width;
				const originalHeight = image.height;
				

				const rotatedWidth = Math.abs(Math.cos(rotationAngle * Math.PI / 180) * originalWidth) + Math.abs(Math.sin(rotationAngle * Math.PI / 180) * originalHeight);
				const rotatedHeight = Math.abs(Math.sin(rotationAngle * Math.PI / 180) * originalWidth) + Math.abs(Math.cos(rotationAngle * Math.PI / 180) * originalHeight);

				let scale = scaleTo ? scaleTo / rotatedWidth : 1;
				if(scaleTo === 0) scale = 1;

				canvas.width = rotatedWidth * scale;
				canvas.height = rotatedHeight * scale;

				context.translate(canvas.width / 2, canvas.height / 2);
				if(flip) context.scale(-1, 1);
				context.rotate(rotationAngle * Math.PI / 180);
				context.drawImage(image, -originalWidth * scale / 2, -originalHeight * scale / 2, originalWidth * scale, originalHeight * scale);
				
				resolve(await canvasToPixMap(canvas, context, {
					pixelSize,
					scaleTo,
					flip,
					rotation,
					invert,
					temperature,
					contrast,
					brightness
				}));
			};
		});
	}


	const form = document.getElementById('form');
	const retrified = document.getElementById('retrified');
	const preview = document.getElementById('preview');
	
	let currentZoom = 100;
	retrified.onwheel = (e) => {
		if(e.altKey){
			e.preventDefault();

			const zoomFactor = 0.01;
			currentZoom += e.deltaY * zoomFactor;
			if(currentZoom > 200) currentZoom = 200;
			if(currentZoom < 30) currentZoom = 30;

			retrified.style.zoom = currentZoom + '%';

		}
	}


	const urlInput = document.getElementById('url');
	const fileInput = document.getElementById('file');
	const pixelSizeInput = document.getElementById('pixelSize');
	const scaleInput = document.getElementById('scale');
	const rotationInput = document.getElementById('rotation');
	const removeBlackInput = document.getElementById('removeBlack');
	const flippedInput = document.getElementById('flipped');
	const elementsInput = document.getElementById('use_elements');
	const invertInput = document.getElementById('invert');
	const temperatureInput = document.getElementById('temperature');
	const brighnessInput = document.getElementById('brightness');
	const contrastInput = document.getElementById('contrast');

	const submit_button = document.getElementById('submit_button');
	const clear_button = document.getElementById('clear_button');
	const export_button = document.getElementById('export_button');
	const removeFile = document.getElementById('remove-file');

	let file = null, useElements = false;

	function createPixelRow(w){
		const element = document.createElement('div');
		element.className = 'pixel-row';
		if(w) element.style.width = w+'px';
		return element;
	}

	form.onsubmit = (e) => {
		e.preventDefault();

		startConversion({
			url: urlInput.value,
			file,
			scale: parseInt(scaleInput.value),
			pixelSize: parseInt(pixelSizeInput.value),
			rotation: parseInt(rotationInput.value),
			temperature: parseInt(temperatureInput.value),
			brightness: parseInt(brighnessInput.value),
			contrast: parseInt(contrastInput.value),
			removeBlack: removeBlackInput.checked,
			flipped: flippedInput.checked,
			useElements: elementsInput.checked,
			invert: invertInput.checked,
		});

	} 

	fileInput.onchange = (e) => {
		file = e.target.files[0];
		showPreview(file);
		removeFile.hidden = false;
	}

	removeFile.onclick = () => {
		removeFile.hidden = true;
		file = null;
		fileInput.value = '';
	}

	clear_button.onclick = () => {
		retrified.innerHTML = '';
		preview.src = './static/placeholder.png';
		removeFile.click();
	}

	function showPreview(file){
		if(typeof file == "string"){
			preview.src = file;
		} else {
			preview.src = URL.createObjectURL(file);
		}
	}

	function startConversion(options){

		if(submit_button.disabled) return;

		let url = options.url;
		if(options.file){
			url = URL.createObjectURL(options.file);
		}
		

		if(url){

			showPreview(url);

			submit_button.disabled = true;

			imageToPixelMap({
				imageUrl: url,
				pixelSize: options.pixelSize,
				scaleTo: options.scale,
				flip: options.flipped,
				rotation: options.rotation,
				invert: options.invert,
				temperature: options.temperature,
				contrast: options.contrast,
				brightness: options.brightness
			}).then((map) => {
				submit_button.disabled = false;

				retrified.innerHTML = '';

				if(options.useElements){
					useElements = options.useElements;

					let lastTop = 0;
					let lastElement = createPixelRow();
					retrified.appendChild(lastElement);
					let perRow = 0, countRow = true;;
	
					map.pixelMap.forEach(pixelData => {
						const pixel = document.createElement('span');
						pixel.className = 'pixel';
						
						pixel.style.width = options.pixelSize+'px';
						pixel.style.height = options.pixelSize+'px';
	
						pixel.pixelData = pixelData;
	
						if(pixelData.y > lastTop){
							if(countRow) lastElement.style.width = (options.pixelSize * perRow)+'px';
							if(countRow) countRow = false;
							lastElement = createPixelRow((options.pixelSize * perRow));
							retrified.appendChild(lastElement);
						}
	
						lastElement.appendChild(pixel);
	
						if(options.removeBlack){
							if(pixelData.rgb.join('') === '000'){
								pixelData.filled = false;
							}
						}
	
						pixel.style.background = `rgba(${pixelData.rgb}, ${pixelData.filled ? '1' : '0'})`;
	
						lastTop = pixelData.y;
						if(countRow) perRow++;
	
					});
				} else {
					useElements = false;

					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d');

					canvas.width = map.perRowPixels[0].length * map.pixelSize;
					canvas.height = map.perColPixels[0].length * map.pixelSize;

					let colIndex = 0, rowIndex = 0;

					map.pixelMap.forEach(pixelData => {
						if(pixelData.y > rowIndex){
							rowIndex = pixelData.y;
							colIndex = 0;
						}

						if(options.removeBlack){
							if(pixelData.rgb.join('') === '000'){
								pixelData.filled = false;
							}
						}

						if (pixelData.filled) {
							ctx.fillStyle = `rgb(${pixelData.rgb.join(',')})`;
							ctx.fillRect(colIndex * pixelData.size, rowIndex * pixelData.size, pixelData.size, pixelData.size);
						}
						
						colIndex++;
					});


					retrified.appendChild(canvas);		
				}
			});
		}

	}

	const messageElement = document.getElementById('message');

	let t;
	function message(str, time = 3000){
		clearTimeout(t);
		messageElement.innerText = str;
		setTimeout(() => messageElement.innerText = '', time);
	}

	form.onpaste = (e) => {
		message('Pasted file');
		let f = e.clipboardData.items[0].getAsFile();
		if(!f instanceof File) return null;
	  file = f;
		showPreview(file);
	};

	window.addEventListener("dragover", function(e){
		e.preventDefault();
	},false);
	
	window.addEventListener("drop", function(e){
		e.preventDefault();
		var files = e.dataTransfer.files;
		if(!files || !files.length) return;
		file = files[0];
		showPreview(file);
		message('Dropped file');
	},false);

	function downloadAsPng() {
		export_button.disabled = true;

		let canvas;

		if(useElements){
			canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			canvas.width = retrified.offsetWidth;
			canvas.height = retrified.offsetHeight;

			Array.from(retrified.children).forEach((pixelRow, rowIndex) => {
				Array.from(pixelRow.children).forEach((pixel, colIndex) => {
					let { pixelData } = pixel;

					if (pixelData.filled) {
						ctx.fillStyle = `rgb(${pixelData.rgb.join(',')})`;
						ctx.fillRect(colIndex * pixelData.size, rowIndex * pixelData.size, pixelData.size, pixelData.size);
					}
				});
			});
		} else { 
			canvas = retrified.children[0];
		}

	
		export_button.disabled = false;
		const image = canvas.toDataURL('image/png');
		const link = document.createElement('a');
		link.href = image;
		link.download = 'retrified.png';
		link.click();
	}

	export_button.onclick = downloadAsPng;

})();