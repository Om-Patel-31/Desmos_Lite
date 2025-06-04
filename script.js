// Advanced Graphing Calculator

const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const functionsList = document.getElementById('functions-list');
const addFunctionBtn = document.getElementById('add-function');
const exportPNGBtn = document.getElementById('export-png');
const exportSVGBtn = document.getElementById('export-svg');
const themeToggle = document.getElementById('theme-toggle');

let width = canvas.width;
let height = canvas.height;

const colors = Array.from(getComputedStyle(document.documentElement)
  .getPropertyValue('--func-colors').split(',')).map(s => s.trim());

let functions = [];
let scale = 50; // pixels per unit
let offsetX = width / 2;
let offsetY = height / 2;
let dragging = false;
let dragStart = {x: 0, y: 0};
let dragOffsetStart = {x: offsetX, y: offsetY};

const epsilon = 0.02; // for implicit zero crossing detection
const pixelStep = 3; // step size for implicit pixel checking (higher is faster, lower is more precise)

themeToggle.addEventListener('change', () => {
  document.body.classList.toggle('dark', themeToggle.checked);
  draw();
});

function unitToPixel(x, y) {
  return {
    x: offsetX + x * scale,
    y: offsetY - y * scale,
  };
}

function pixelToUnit(px, py) {
  return {
    x: (px - offsetX) / scale,
    y: (offsetY - py) / scale,
  };
}

function addFunction(value = '') {
  const id = Date.now() + Math.random();
  const color = colors[functions.length % colors.length];
  const fnObj = {
    id,
    input: value,
    color,
    visible: true,
    error: false,
    compiled: null,
    type: null,
    rawInput: value.trim(),
  };
  functions.push(fnObj);
  renderFunctions();
  draw();
}

function removeFunction(id) {
  functions = functions.filter(f => f.id !== id);
  renderFunctions();
  draw();
}

function toggleVisibility(id) {
  const fn = functions.find(f => f.id === id);
  if (fn) {
    fn.visible = !fn.visible;
    renderFunctions();
    draw();
  }
}

function setError(id, isError) {
  const fn = functions.find(f => f.id === id);
  if (fn) {
    fn.error = isError;
    renderFunctions();
  }
}

function parseFunction(input) {
  input = input.trim();

  // Empty input invalid
  if (!input) return null;

  // Parametric: x(t)=..., y(t)=...
  if (/x\s*\(t\)/i.test(input) && /y\s*\(t\)/i.test(input)) {
    const parts = input.split(',');
    let xExpr = null, yExpr = null;
    for (const p of parts) {
      if (/x\s*\(t\)/i.test(p)) xExpr = p.split('=')[1]?.trim();
      if (/y\s*\(t\)/i.test(p)) yExpr = p.split('=')[1]?.trim();
    }
    if (!xExpr || !yExpr) return null;
    try {
      const xC = math.compile(xExpr);
      const yC = math.compile(yExpr);
      return {type: 'parametric', xC, yC};
    } catch {
      return null;
    }
  }

  // Polar: r=...
  if (/^r\s*=/i.test(input)) {
    const expr = input.split('=')[1]?.trim();
    if (!expr) return null;
    try {
      const rC = math.compile(expr);
      return {type: 'polar', rC};
    } catch {
      return null;
    }
  }

  // Implicit or inequality: contains = or < > ≤ ≥
  if (/=/.test(input) || /[<>≤≥]/.test(input)) {
    // Try to parse sides for implicit
    try {
      // For implicit equations: turn "expr = expr" into "expr - expr"
      let expr = input;
      const eqMatch = input.match(/=/);
      if (eqMatch) {
        const parts = input.split('=');
        if (parts.length === 2) {
          expr = `(${parts[0]}) - (${parts[1]})`;
        }
      }
      const exprC = math.compile(expr);
      return {type: 'implicit', exprC, rawInput: input};
    } catch {
      return null;
    }
  }

  // Explicit function: y= or just expression in x
  try {
    let expr = input;
    if (/^y\s*=/i.test(input)) {
      expr = input.split('=')[1].trim();
    }
    const exprC = math.compile(expr);
    return {type: 'explicit', exprC};
  } catch {
    return null;
  }
}

function evaluateExplicit(fn, x) {
  try {
    return fn.exprC.evaluate({x});
  } catch {
    return NaN;
  }
}

function evaluateParametric(fn, t) {
  try {
    return {x: fn.xC.evaluate({t}), y: fn.yC.evaluate({t})};
  } catch {
    return {x: NaN, y: NaN};
  }
}

function evaluatePolar(fn, theta) {
  try {
    const r = fn.rC.evaluate({theta});
    return {
      x: r * Math.cos(theta),
      y: r * Math.sin(theta),
    };
  } catch {
    return {x: NaN, y: NaN};
  }
}

function evaluateImplicit(fn, x, y) {
  try {
    return fn.exprC.evaluate({x, y});
  } catch {
    return NaN;
  }
}

function drawGrid() {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;

  // vertical lines
  const leftUnit = Math.floor(pixelToUnit(0, 0).x);
  const rightUnit = Math.ceil(pixelToUnit(width, 0).x);
  const topUnit = Math.ceil(pixelToUnit(0, 0).y);
  const bottomUnit = Math.floor(pixelToUnit(0, height).y);

  // draw vertical grid lines
  for (let i = leftUnit; i <= rightUnit; i++) {
    const x = offsetX + i * scale;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  // draw horizontal grid lines
  for (let i = bottomUnit; i <= topUnit; i++) {
    const y = offsetY - i * scale;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;

  // y-axis
  ctx.beginPath();
  ctx.moveTo(offsetX, 0);
  ctx.lineTo(offsetX, height);
  ctx.stroke();

  // x-axis
  ctx.beginPath();
  ctx.moveTo(0, offsetY);
  ctx.lineTo(width, offsetY);
  ctx.stroke();

  // axis labels every 1 unit (skip 0)
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = leftUnit; i <= rightUnit; i++) {
    if (i === 0) continue;
    const px = offsetX + i * scale;
    ctx.fillText(i, px, offsetY + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = bottomUnit; i <= topUnit; i++) {
    if (i === 0) continue;
    const py = offsetY - i * scale;
    ctx.fillText(i, offsetX - 4, py);
  }
}

function drawFunction(fn, idx) {
  if (!fn.visible || fn.error) return;

  ctx.strokeStyle = fn.color;
  ctx.fillStyle = fn.color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  switch (fn.type) {
    case 'explicit': {
      let first = true;
      const step = 1 / scale; // step in x units
      const leftX = pixelToUnit(0, 0).x;
      const rightX = pixelToUnit(width, 0).x;

      for (let x = leftX; x <= rightX; x += step) {
        let y = evaluateExplicit(fn, x);
        if (!isFinite(y)) {
          ctx.moveTo(NaN, NaN);
          continue;
        }
        const p = unitToPixel(x, y);
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'parametric': {
      let first = true;
      const tStart = -10;
      const tEnd = 10;
      const tStep = 0.01;
      for (let t = tStart; t <= tEnd; t += tStep) {
        const pt = evaluateParametric(fn, t);
        if (!isFinite(pt.x) || !isFinite(pt.y)) continue;
        const p = unitToPixel(pt.x, pt.y);
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'polar': {
      let first = true;
      const thetaStart = 0;
      const thetaEnd = 2 * Math.PI;
      const thetaStep = 0.01;
      for (let theta = thetaStart; theta <= thetaEnd; theta += thetaStep) {
        const pt = evaluatePolar(fn, theta);
        if (!isFinite(pt.x) || !isFinite(pt.y)) continue;
        const p = unitToPixel(pt.x, pt.y);
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'implicit': {
      // Draw implicit by sampling pixels - slow but effective for demonstration
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let py = 0; py < height; py += pixelStep) {
        for (let px = 0; px < width; px += pixelStep) {
          const {x, y} = pixelToUnit(px, py);
          let val = evaluateImplicit(fn, x, y);
          if (isNaN(val)) continue;

          if (Math.abs(val) < epsilon) {
            const idx = (py * width + px) * 4;
            data[idx] = hexToRgb(fn.color).r;
            data[idx + 1] = hexToRgb(fn.color).g;
            data[idx + 2] = hexToRgb(fn.color).b;
            data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      break;
    }
  }
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function renderFunctions() {
  functionsList.innerHTML = '';
  functions.forEach((fn, i) => {
    const div = document.createElement('div');
    div.className = 'function-entry';

    const colorInd = document.createElement('label');
    colorInd.className = 'color-indicator' + (fn.visible ? ' visible' : '');
    colorInd.style.backgroundColor = fn.color;
    colorInd.title = fn.visible ? 'Click to hide' : 'Click to show';
    colorInd.onclick = () => {
      toggleVisibility(fn.id);
    };
    div.appendChild(colorInd);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = fn.input;
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Function input');
    input.classList.toggle('error', fn.error);
    input.oninput = e => {
      fn.input = e.target.value;
      updateFunction(fn);
    };
    div.appendChild(input);

    const delBtn = document.createElement('button');
    delBtn.title = 'Delete function';
    delBtn.textContent = '✕';
    delBtn.onclick = () => {
      removeFunction(fn.id);
    };
    div.appendChild(delBtn);

    functionsList.appendChild(div);
  });
}

function updateFunction(fn) {
  const parsed = parseFunction(fn.input);
  if (!parsed) {
    fn.error = true;
    fn.compiled = null;
    fn.type = null;
  } else {
    fn.error = false;
    fn.compiled = parsed;
    fn.type = parsed.type;
    fn.rawInput = fn.input.trim();
  }
  renderFunctions();
  draw();
}

function draw() {
  drawGrid();
  functions.forEach(fn => {
    if (!fn.error && fn.visible) {
      drawFunction({...fn, exprC: fn.compiled?.exprC, xC: fn.compiled?.xC, yC: fn.compiled?.yC, rC: fn.compiled?.rC});
    }
  });
}

function onWheel(e) {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.1 : 0.9;
  const mousePos = {x: e.offsetX, y: e.offsetY};
  const beforeZoom = pixelToUnit(mousePos.x, mousePos.y);

  scale *= delta;
  scale = Math.min(Math.max(scale, 10), 500);

  const afterZoom = pixelToUnit(mousePos.x, mousePos.y);

  // Adjust offset to zoom towards mouse pointer
  offsetX += (afterZoom.x - beforeZoom.x) * scale;
  offsetY -= (afterZoom.y - beforeZoom.y) * scale;

  draw();
}

function onMouseDown(e) {
  dragging = true;
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragOffsetStart.x = offsetX;
  dragOffsetStart.y = offsetY;
  canvas.style.cursor = 'grabbing';
}

function onMouseMove(e) {
  if (!dragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;

  offsetX = dragOffsetStart.x + dx;
  offsetY = dragOffsetStart.y + dy;

  draw();
}

function onMouseUp() {
  dragging = false;
  canvas.style.cursor = 'grab';
}

// Export canvas to PNG
function exportPNG() {
  const link = document.createElement('a');
  link.download = 'graph.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Export SVG (basic approximation)
function exportSVG() {
  // Create SVG XML with paths for each visible function
  const svgNS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', svgNS);

  // Background rect
  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  bg.setAttribute('fill', getComputedStyle(document.body).backgroundColor);
  svg.appendChild(bg);

  // Grid lines
  const gridGroup = document.createElementNS(svgNS, 'g');
  gridGroup.setAttribute('stroke', '#aaa');
  gridGroup.setAttribute('stroke-width', '1');
  const leftUnit = Math.floor(pixelToUnit(0, 0).x);
  const rightUnit = Math.ceil(pixelToUnit(width, 0).x);
  const topUnit = Math.ceil(pixelToUnit(0, 0).y);
  const bottomUnit = Math.floor(pixelToUnit(0, height).y);

  for (let i = leftUnit; i <= rightUnit; i++) {
    const x = offsetX + i * scale;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', height);
    gridGroup.appendChild(line);
  }
  for (let i = bottomUnit; i <= topUnit; i++) {
    const y = offsetY - i * scale;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width);
    line.setAttribute('y2', y);
    gridGroup.appendChild(line);
  }
  svg.appendChild(gridGroup);

  // Axes
  const axes = document.createElementNS(svgNS, 'g');
  axes.setAttribute('stroke', '#333');
  axes.setAttribute('stroke-width', '2');

  // y axis
  const yAxis = document.createElementNS(svgNS, 'line');
  yAxis.setAttribute('x1', offsetX);
  yAxis.setAttribute('y1', 0);
  yAxis.setAttribute('x2', offsetX);
  yAxis.setAttribute('y2', height);
  axes.appendChild(yAxis);

  // x axis
  const xAxis = document.createElementNS(svgNS, 'line');
  xAxis.setAttribute('x1', 0);
  xAxis.setAttribute('y1', offsetY);
  xAxis.setAttribute('x2', width);
  xAxis.setAttribute('y2', offsetY);
  axes.appendChild(xAxis);

  svg.appendChild(axes);

  // Functions
  functions.forEach(fn => {
    if (!fn.visible || fn.error) return;
    let pathData = '';

    switch (fn.type) {
      case 'explicit': {
        const step = 1 / scale;
        const leftX = pixelToUnit(0, 0).x;
        const rightX = pixelToUnit(width, 0).x;
        let first = true;
        for (let x = leftX; x <= rightX; x += step) {
          let y = evaluateExplicit(fn.compiled, x);
          if (!isFinite(y)) {
            pathData += ' M ';
            continue;
          }
          const px = offsetX + x * scale;
          const py = offsetY - y * scale;
          pathData += (first ? 'M ' : 'L ') + px + ' ' + py + ' ';
          first = false;
        }
        break;
      }
      case 'parametric': {
        let first = true;
        const tStart = -10;
        const tEnd = 10;
        const tStep = 0.01;
        for (let t = tStart; t <= tEnd; t += tStep) {
          const pt = evaluateParametric(fn.compiled, t);
          if (!isFinite(pt.x) || !isFinite(pt.y)) continue;
          const px = offsetX + pt.x * scale;
          const py = offsetY - pt.y * scale;
          pathData += (first ? 'M ' : 'L ') + px + ' ' + py + ' ';
          first = false;
        }
        break;
      }
      case 'polar': {
        let first = true;
        const thetaStart = 0;
        const thetaEnd = 2 * Math.PI;
        const thetaStep = 0.01;
        for (let theta = thetaStart; theta <= thetaEnd; theta += thetaStep) {
          const pt = evaluatePolar(fn.compiled, theta);
          if (!isFinite(pt.x) || !isFinite(pt.y)) continue;
          const px = offsetX + pt.x * scale;
          const py = offsetY - pt.y * scale;
          pathData += (first ? 'M ' : 'L ') + px + ' ' + py + ' ';
          first = false;
        }
        break;
      }
      // We skip implicit for SVG export for now because pixel rendering is complex
    }

    if (pathData) {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', fn.color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    }
  });

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(svgBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'graph.svg';
  link.click();
  URL.revokeObjectURL(url);
}

// Drag to delete function feature
let dragFunctionId = null;
let dragStartPos = null;

functionsList.addEventListener('mousedown', e => {
  const target = e.target;
  if (target.tagName === 'INPUT') {
    dragFunctionId = null;
    return;
  }
  if (target.classList.contains('function-entry') || target.parentElement.classList.contains('function-entry')) {
    const entry = target.classList.contains('function-entry') ? target : target.parentElement;
    const index = Array.from(functionsList.children).indexOf(entry);
    if (index >= 0) {
      dragFunctionId = functions[index].id;
      dragStartPos = {x: e.clientX, y: e.clientY};
    }
  }
});

document.addEventListener('mouseup', e => {
  if (!dragFunctionId) return;
  const dx = e.clientX - dragStartPos.x;
  const dy = e.clientY - dragStartPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 100) {
    // Delete if dragged more than 100px
    removeFunction(dragFunctionId);
  }
  dragFunctionId = null;
});

// Initialize with two example functions
addFunction('y=sin(x)');
addFunction('x^2 + y^2 = 4');

// Event listeners
addFunctionBtn.addEventListener('click', () => addFunction(''));
canvas.addEventListener('wheel', onWheel, {passive: false});
canvas.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);
exportPNGBtn.addEventListener('click', exportPNG);
exportSVGBtn.addEventListener('click', exportSVG);