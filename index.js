(function(){
	function imageToPixelMap({
		imageUrl =  "",
		pixelSize = 10,
		scaleTo = 0
	}) {
		const image = new Image();
		image.src = imageUrl;

		return new Promise((resolve) => {
			image.onload = function () {
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');
				const rotationAngle = -360;

				const originalWidth = image.width;
				const originalHeight = image.height;

				const rotatedWidth = Math.abs(Math.cos(rotationAngle * Math.PI / 180) * originalWidth) + Math.abs(Math.sin(rotationAngle * Math.PI / 180) * originalHeight);
				const rotatedHeight = Math.abs(Math.sin(rotationAngle * Math.PI / 180) * originalWidth) + Math.abs(Math.cos(rotationAngle * Math.PI / 180) * originalHeight);

				let scale = scaleTo ? scaleTo / rotatedWidth : 1;
				if(scaleTo === 0) scale = 1;

				canvas.width = rotatedWidth * scale;
				canvas.height = rotatedHeight * scale;

				context.translate(canvas.width / 2, canvas.height / 2);
				// context.scale(-1, 1); // Apply horizontal scale to fix the flipping issue
				context.rotate(rotationAngle * Math.PI / 180);
				context.drawImage(image, -originalWidth * scale / 2, -originalHeight * scale / 2, originalWidth * scale, originalHeight * scale);

				const pixelMap = [];

				for (let y = 0; y < canvas.height; y += pixelSize) {
					for (let x = 0; x < canvas.width; x += pixelSize) {
						const pixelData = context.getImageData(x, y, pixelSize, pixelSize).data;
						const isPixelFilled = pixelData.some(value => value > 0);

						pixelMap.push({
							x: x / pixelSize,
							y: y / pixelSize,
							filled: isPixelFilled,
							rgb: [pixelData[0], pixelData[1], pixelData[2]],
						});
					}
				}

				resolve({
					pixelMap,
					width: Math.floor(canvas.width / pixelSize),
					height: Math.floor(canvas.height / pixelSize),
				});
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

	const submit_button = document.getElementById('submit_button');
	const clear_button = document.getElementById('clear_button');
	const removeFile = document.getElementById('remove-file');

	let file = null;

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
			pixelSize: parseInt(pixelSizeInput.value)
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
				scaleTo: options.scale
			}).then((map) => {
				submit_button.disabled = false;

				retrified.innerHTML = '';

				let lastTop = 0;
				let lastElement = createPixelRow();
				retrified.appendChild(lastElement);
				let perRow = 0, countRow = true;;

				map.pixelMap.forEach(pixelData => {
					const pixel = document.createElement('span');
					pixel.className = 'pixel';
					
					pixel.style.width = options.pixelSize+'px';
					pixel.style.height = options.pixelSize+'px';

					if(pixelData.y > lastTop){
						if(countRow) lastElement.style.width = (options.pixelSize * perRow)+'px';
						if(countRow) countRow = false;
						lastElement = createPixelRow((options.pixelSize * perRow));
						retrified.appendChild(lastElement);
					}

					lastElement.appendChild(pixel);

					pixel.style.background = `rgba(${pixelData.rgb}, ${pixelData.filled ? '1' : '0'})`;

					lastTop = pixelData.y;
					if(countRow) perRow++;

				});

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

})();