// script.js

// Global state
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
const functionsContainer = document.getElementById('functions');
const themeToggle = document.getElementById('theme-toggle');

let width, height;
let scale = 50;  // pixels per unit
let offsetX = 0;
let offsetY = 0;

const functionsList = []; // {id, expr, color, visible, type}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Utils
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function toCanvasCoords(x, y) {
  return {
    x: width/2 + (x + offsetX) * scale,
    y: height/2 - (y + offsetY) * scale,
  };
}

function fromCanvasCoords(cx, cy) {
  return {
    x: (cx - width/2)/scale - offsetX,
    y: (height/2 - cy)/scale - offsetY,
  };
}

function drawAxes() {
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;

  // X axis
  ctx.beginPath();
  const yZero = toCanvasCoords(0, 0).y;
  ctx.moveTo(0, yZero);
  ctx.lineTo(width, yZero);
  ctx.stroke();

  // Y axis
  ctx.beginPath();
  const xZero = toCanvasCoords(0, 0).x;
  ctx.moveTo(xZero, 0);
  ctx.lineTo(xZero, height);
  ctx.stroke();

  // Draw grid lines every 1 unit
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  const unitsHorizontal = Math.ceil(width / scale / 2);
  const unitsVertical = Math.ceil(height / scale / 2);

  // Vertical grid lines
  for(let i = -unitsHorizontal; i <= unitsHorizontal; i++) {
    let cx = toCanvasCoords(i, 0).x;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
  }

  // Horizontal grid lines
  for(let i = -unitsVertical; i <= unitsVertical; i++) {
    let cy = toCanvasCoords(0, i).y;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
  }

  // Axis labels every 1 unit (skip 0)
  ctx.fillStyle = '#666';
  ctx.font = '11px Arial';
  for(let i = -unitsHorizontal; i <= unitsHorizontal; i++) {
    if(i !== 0) {
      const cx = toCanvasCoords(i, 0).x;
      ctx.fillText(i, cx + 2, yZero - 2);
    }
  }
  for(let i = -unitsVertical; i <= unitsVertical; i++) {
    if(i !== 0) {
      const cy = toCanvasCoords(0, i).y;
      ctx.fillText(i, xZero + 4, cy - 2);
    }
  }
}

function parseFunctionInput(input) {
  // Simple parser - will try to detect parametric, polar, inequality, or normal function
  // Returns {type: 'normal'|'parametric'|'polar'|'inequality', expr: string or object}

  input = input.trim();

  if (input.includes(',')) {
    // maybe parametric "x(t), y(t)" format
    const parts = input.split(',');
    if(parts.length === 2) {
      return {
        type: 'parametric',
        xExpr: parts[0].trim(),
        yExpr: parts[1].trim()
      };
    }
  }

  if(input.startsWith('r=')) {
    // polar, like r=2*sin(theta)
    return {
      type: 'polar',
      expr: input.slice(2).trim()
    };
  }

  if(input.includes('<') || input.includes('>') || input.includes('≤') || input.includes('≥')) {
    return {
      type: 'inequality',
      expr: input
    };
  }

  return {type: 'normal', expr: input};
}

function evaluateExpression(expr, scope) {
  try {
    return math.evaluate(expr, scope);
  } catch {
    return null;
  }
}

function drawFunction(fn) {
  if (!fn.visible) return;
  ctx.strokeStyle = fn.color;
  ctx.lineWidth = 2;

  try {
    if(fn.type === 'normal') {
      // y = f(x)
      ctx.beginPath();
      let started = false;
      for(let px = 0; px < width; px++) {
        const x = fromCanvasCoords(px, 0).x;
        const scope = {x};
        let y = evaluateExpression(fn.expr, scope);
        if(y === null || typeof y !== 'number' || !isFinite(y)) {
          started = false;
          continue;
        }
        const c = toCanvasCoords(x, y);
        if(!started) {
          ctx.moveTo(c.x, c.y);
          started = true;
        } else {
          ctx.lineTo(c.x, c.y);
        }
      }
      ctx.stroke();

    } else if(fn.type === 'parametric') {
      // parametric: x(t), y(t)
      ctx.beginPath();
      let started = false;
      for(let t = -10; t <= 10; t += 0.01) {
        let x = evaluateExpression(fn.xExpr, {t});
        let y = evaluateExpression(fn.yExpr, {t});
        if(x === null || y === null || !isFinite(x) || !isFinite(y)) {
          started = false;
          continue;
        }
        const c = toCanvasCoords(x, y);
        if(!started) {
          ctx.moveTo(c.x, c.y);
          started = true;
        } else {
          ctx.lineTo(c.x, c.y);
        }
      }
      ctx.stroke();

    } else if(fn.type === 'polar') {
      // polar: r= expr(theta)
      ctx.beginPath();
      let started = false;
      for(let theta = 0; theta <= 2 * Math.PI; theta += 0.01) {
        let r = evaluateExpression(fn.expr, {theta});
        if(r === null || !isFinite(r)) {
          started = false;
          continue;
        }
        let x = r * Math.cos(theta);
        let y = r * Math.sin(theta);
        const c = toCanvasCoords(x, y);
        if(!started) {
          ctx.moveTo(c.x, c.y);
          started = true;
        } else {
          ctx.lineTo(c.x, c.y);
        }
      }
      ctx.stroke();

    } else if(fn.type === 'inequality') {
      // Inequality shading is expensive - approximate by sampling grid points
      ctx.fillStyle = fn.color + '40'; // transparent fill
      const step = 1 / scale; // in graph units

      for(let x = -width/(2*scale) - offsetX; x < width/(2*scale) - offsetX; x += step) {
        for(let y = -height/(2*scale) - offsetY; y < height/(2*scale) - offsetY; y += step) {
          // Evaluate inequality with x,y
          // Replace ≤, ≥ with <=, >= for math.js compatibility
          let expr = fn.expr.replace(/≤/g, "<=").replace(/≥/g, ">=");
          try {
            let result = math.evaluate(expr, {x,y});
            if(result === true) {
              const c = toCanvasCoords(x, y);
              ctx.fillRect(c.x, c.y, 2, 2);
            }
          } catch {
            // ignore errors
          }
        }
      }
    }
  } catch (e) {
    // Fail silently on drawing errors
  }
}

function drawAll() {
  clearCanvas();
  drawAxes();
  for(const fn of functionsList) {
    drawFunction(fn);
  }
}

function addFunctionRow(fn) {
  const id = fn.id;
  const container = document.createElement('div');
  container.classList.add('function-row');
  container.dataset.id = id;

  // Color picker
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = fn.color;
  colorInput.className = 'color-picker';
  colorInput.title = 'Select function color';
  colorInput.addEventListener('input', e => {
    fn.color = e.target.value;
    drawAll();
  });

  // Input box
  const input = document.createElement('input');
  input.type = 'text';
  input.value = fn.expr;
  input.className = 'equation';
  input.placeholder = 'Enter function (e.g. y=x^2, r=sin(theta), x(t), y(t), x>y)';
  input.title = 'Enter function or inequality';
  input.addEventListener('input', () => {
    validateFunctionInput(fn, input);
  });

  // Toggle visibility button
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = fn.visible ? '👁' : '🚫';
  toggleBtn.title = 'Toggle graph visibility';
  toggleBtn.style.fontSize = '1.1rem';
  toggleBtn.style.border = 'none';
  toggleBtn.style.background = 'transparent';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.addEventListener('click', () => {
    fn.visible = !fn.visible;
    toggleBtn.textContent = fn.visible ? '👁' : '🚫';
    drawAll();
  });

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove function';
  removeBtn.addEventListener('click', () => {
    const index = functionsList.findIndex(f => f.id === id);
    if(index !== -1) {
      functionsList.splice(index, 1);
      container.remove();
      drawAll();
    }
  });

  container.appendChild(colorInput);
  container.appendChild(input);
  container.appendChild(toggleBtn);
  container.appendChild(removeBtn);
  functionsContainer.appendChild(container);

  validateFunctionInput(fn, input);
}

function validateFunctionInput(fn, inputElem) {
  const val = inputElem.value.trim();
  if(val === '') {
    inputElem.classList.remove('invalid');
    fn.expr = '';
    fn.type = 'normal';
    drawAll();
    return;
  }

  // Try to parse and test eval a sample value
  const parsed = parseFunctionInput(val);
  fn.type = parsed.type;

  let valid = true;
  try {
    if(parsed.type === 'normal') {
      const test = evaluateExpression(parsed.expr, {x: 1});
      if(typeof test !== 'number' || !isFinite(test)) valid = false;
    } else if(parsed.type === 'parametric') {
      const xt = evaluateExpression(parsed.xExpr, {t: 1});
      const yt = evaluateExpression(parsed.yExpr, {t: 1});
      if([xt, yt].some(v => typeof v !== 'number' || !isFinite(v))) valid = false;
    } else if(parsed.type === 'polar') {
      const rt = evaluateExpression(parsed.expr, {theta: Math.PI/4});
      if(typeof rt !== 'number' || !isFinite(rt)) valid = false;
    } else if(parsed.type === 'inequality') {
      // Check with some sample x,y
      const expr = parsed.expr.replace(/≤/g, '<=').replace(/≥/g, '>=');
      const test = math.evaluate(expr, {x:1, y:1});
      if(typeof test !== 'boolean') valid = false;
    }
  } catch {
    valid = false;
  }

  if(valid) {
    inputElem.classList.remove('invalid');
    fn.expr = val;
    drawAll();
  } else {
    inputElem.classList.add('invalid');
  }
}

// Zoom controls
function zoomIn() {
  scale *= 1.2;
  drawAll();
}
function zoomOut() {
  scale /= 1.2;
  drawAll();
}
function resetZoom() {
  scale = 50;
  offsetX = 0;
  offsetY = 0;
  drawAll();
}

// Export PNG
function exportPNG() {
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'graph.png';
  a.click();
}

// Export SVG - very basic, only grid + axes + functions as paths (approximated)
function exportSVG() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Background
  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('fill', getComputedStyle(document.body).getPropertyValue('--bg-color').trim());
  svg.appendChild(rect);

  // Axes lines
  const axesGroup = document.createElementNS(svgNS, 'g');
  axesGroup.setAttribute('stroke', '#888');
  axesGroup.setAttribute('stroke-width', '1');

  // X axis
  const yZero = toCanvasCoords(0, 0).y;
  const xLine = document.createElementNS(svgNS, 'line');
  xLine.setAttribute('x1', 0);
  xLine.setAttribute('y1', yZero);
  xLine.setAttribute('x2', width);
  xLine.setAttribute('y2', yZero);
  axesGroup.appendChild(xLine);

  // Y axis
  const xZero = toCanvasCoords(0, 0).x;
  const yLine = document.createElementNS(svgNS, 'line');
  yLine.setAttribute('x1', xZero);
  yLine.setAttribute('y1', 0);
  yLine.setAttribute('x2', xZero);
  yLine.setAttribute('y2', height);
  axesGroup.appendChild(yLine);

  svg.appendChild(axesGroup);

  // TODO: Export functions as paths is complex, so we skip or do only normal functions (for brevity)

  // Serialize and download
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const blob = new Blob([svgStr], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'graph.svg';
  a.click();
  URL.revokeObjectURL(url);
}

// Dark mode toggle
function toggleDarkMode(enabled) {
  document.body.classList.toggle('dark', enabled);
  localStorage.setItem('darkMode', enabled ? '1' : '0');
}

function setup() {
  // Resize canvas
  width = canvas.width;
  height = canvas.height;

  // Load dark mode from localStorage
  const darkPref = localStorage.getItem('darkMode') === '1';
  themeToggle.checked = darkPref;
  toggleDarkMode(darkPref);

  themeToggle.addEventListener('change', () => {
    toggleDarkMode(themeToggle.checked);
  });

  // Bind buttons
  document.getElementById('add-function').addEventListener('click', () => {
    const newFn = {
      id: generateId(),
      expr: '',
      color: '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      visible: true,
      type: 'normal'
    };
    functionsList.push(newFn);
    addFunctionRow(newFn);
  });

  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('reset-zoom').addEventListener('click', resetZoom);
  document.getElementById('export-png').addEventListener('click', exportPNG);
  document.getElementById('export-svg').addEventListener('click', exportSVG);

  // Add one initial empty function
  document.getElementById('add-function').click();

  drawAll();
}

// Initialize
setup();
