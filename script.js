(() => {
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  const addFunctionBtn = document.getElementById('addFunctionBtn');
  const functionsContainer = document.getElementById('functions');
  const pointCoords = document.getElementById('pointCoords');
  const paramSliderContainer = document.getElementById('paramSliderContainer');
  const paramSlider = document.getElementById('paramSlider');
  const paramValueDisplay = document.getElementById('paramValue');

  let functions = [];
  let scale = 50;
  let offsetX = canvas.width / 2;
  let offsetY = canvas.height / 2;
  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragOffsetStart = { x: 0, y: 0 };

  function unitToPixel(x, y) {
    return {
      x: offsetX + x * scale,
      y: offsetY - y * scale
    };
  }

  function pixelToUnit(px, py) {
    return {
      x: (px - offsetX) / scale,
      y: (offsetY - py) / scale
    };
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(0, offsetY);
    ctx.lineTo(canvas.width, offsetY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offsetX, 0);
    ctx.lineTo(offsetX, canvas.height);
    ctx.stroke();
  }

  function drawExplicit(fn) {
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let px = 0; px < canvas.width; px++) {
      const unitX = pixelToUnit(px, 0).x;
      try {
        const unitY = fn.compiled(unitX);
        const py = unitToPixel(unitX, unitY).y;
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
      } catch {}
    }
    ctx.stroke();
  }

  function drawParametric(fn, tValue) {
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let t = -10; t <= 10; t += 0.05) {
      try {
        const x = fn.compiledX(t);
        const y = fn.compiledY(t);
        const pt = unitToPixel(x, y);
        if (first) {
          ctx.moveTo(pt.x, pt.y);
          first = false;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      } catch {}
    }

    // draw point for selected t
    if (tValue !== null) {
      const x = fn.compiledX(tValue);
      const y = fn.compiledY(tValue);
      const pt = unitToPixel(x, y);
      ctx.fillStyle = fn.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.stroke();
  }

  function drawImplicit(fn) {
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let px = 0; px < canvas.width; px++) {
      for (let py = 0; py < canvas.height; py++) {
        const unit = pixelToUnit(px, py);
        try {
          const val = fn.compiled(unit.x, unit.y);
          if (Math.abs(val) < 0.05) {
            const index = (py * canvas.width + px) * 4;
            const rgb = hexToRgb(fn.color);
            imageData.data[index] = rgb.r;
            imageData.data[index + 1] = rgb.g;
            imageData.data[index + 2] = rgb.b;
            imageData.data[index + 3] = 255;
          }
        } catch {}
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function drawInequality(fn) {
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let px = 0; px < canvas.width; px++) {
      for (let py = 0; py < canvas.height; py++) {
        const unit = pixelToUnit(px, py);
        try {
          const val = fn.compiled(unit.x, unit.y);
          if (val) {
            const index = (py * canvas.width + px) * 4;
            const rgb = hexToRgb(fn.color);
            imageData.data[index] = rgb.r;
            imageData.data[index + 1] = rgb.g;
            imageData.data[index + 2] = rgb.b;
            imageData.data[index + 3] = 50;
          }
        } catch {}
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function addFunction() {
    const wrapper = document.createElement('div');
    wrapper.className = 'function-entry';
    const input = document.createElement('input');
    input.placeholder = 'e.g. y = x^2 or x(t) = cos(t), y(t) = sin(t)';
    const color = document.createElement('input');
    color.type = 'color';
    color.value = getRandomColor();

    wrapper.appendChild(input);
    wrapper.appendChild(color);
    functionsContainer.appendChild(wrapper);

    const fn = { input, color: color.value, visible: true };
    functions.push(fn);

    input.addEventListener('input', () => parseAndDraw(fn, input));
    color.addEventListener('input', () => {
      fn.color = color.value;
      draw();
    });

    parseAndDraw(fn, input);
  }

  function parseAndDraw(fn, inputEl) {
    try {
      const expr = inputEl.value.trim().toLowerCase();
      fn.error = false;

      if (/^y\s*=/.test(expr)) {
        fn.type = 'explicit';
        fn.compiled = new Function('x', `return ${expr.split('=')[1]}`);
      } else if (/^x\(t\)\s*=/.test(expr)) {
        const parts = expr.split(',');
        const xExpr = parts[0].split('=')[1];
        const yExpr = parts[1].split('=')[1];
        fn.type = 'parametric';
        fn.compiledX = new Function('t', `return ${xExpr}`);
        fn.compiledY = new Function('t', `return ${yExpr}`);
      } else if (/</.test(expr) || />/.test(expr)) {
        fn.type = 'inequality';
        fn.compiled = new Function('x', 'y', `return ${expr}`);
      } else if (/=/.test(expr)) {
        fn.type = 'implicit';
        fn.compiled = new Function('x', 'y', `return ${expr.split('=')[0]} - (${expr.split('=')[1]})`);
      } else {
        throw new Error("Unrecognized format");
      }

      inputEl.classList.remove('error');
    } catch {
      inputEl.classList.add('error');
      fn.error = true;
    }

    checkParametric();
    draw();
  }

  function draw() {
    drawGrid();
    functions.forEach(fn => {
      if (!fn.visible || fn.error) return;
      switch (fn.type) {
        case 'explicit': drawExplicit(fn); break;
        case 'parametric': drawParametric(fn, paramSliderContainer.style.display === 'flex' ? parseFloat(paramSlider.value) : null); break;
        case 'implicit': drawImplicit(fn); break;
        case 'inequality': drawInequality(fn); break;
      }
    });
  }

  function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 60%)`;
  }

  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  function checkParametric() {
    const hasParam = functions.some(fn => fn.visible && fn.type === 'parametric');
    paramSliderContainer.style.display = hasParam ? 'flex' : 'none';
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const coord = pixelToUnit(px, py);
    pointCoords.style.display = 'block';
    pointCoords.style.left = `${px + 10}px`;
    pointCoords.style.top = `${py + 10}px`;
    pointCoords.textContent = `(${coord.x.toFixed(3)}, ${coord.y.toFixed(3)})`;
  });

  canvas.addEventListener('mouseleave', () => {
    pointCoords.style.display = 'none';
  });

  canvas.addEventListener('mousedown', e => {
    dragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    dragOffsetStart.x = offsetX;
    dragOffsetStart.y = offsetY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  });

  window.addEventListener('mousemove', e => {
    if (dragging) {
      offsetX = dragOffsetStart.x + (e.clientX - dragStart.x);
      offsetY = dragOffsetStart.y + (e.clientY - dragStart.y);
      draw();
    }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomFactor = 1.1;
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const beforeZoom = pixelToUnit(mouseX, mouseY);

    scale *= delta > 0 ? zoomFactor : 1 / zoomFactor;
    scale = Math.min(Math.max(scale, 10), 300);

    const afterZoom = pixelToUnit(mouseX, mouseY);
    offsetX += (afterZoom.x - beforeZoom.x) * scale;
    offsetY -= (afterZoom.y - beforeZoom.y) * scale;

    draw();
  }, { passive: false });

  paramSlider.addEventListener('input', e => {
    paramValueDisplay.textContent = e.target.value;
    draw();
  });

  addFunctionBtn.onclick = () => addFunction();
  addFunction();
})();