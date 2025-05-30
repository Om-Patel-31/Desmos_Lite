const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");
const functionsDiv = document.getElementById("functions");

let width = canvas.width;
let height = canvas.height;
let xMin = -10, xMax = 10, yMin = -5, yMax = 5;

function scaleX() { return width / (xMax - xMin); }
function scaleY() { return height / (yMax - yMin); }

// Helper to read CSS variables from :root or body
function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function drawAxes() {
  // Clear and fill background from CSS var
  const bgColor = getCssVar('--canvas-bg') || '#f9f9f9';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Draw axes using CSS var for border color
  const axisColor = getCssVar('--border-color') || '#bbb';
  ctx.beginPath();
  ctx.strokeStyle = axisColor;

  const y0 = height - (-yMin * scaleY());
  ctx.moveTo(0, y0);
  ctx.lineTo(width, y0);

  const x0 = -xMin * scaleX();
  ctx.moveTo(x0, 0);
  ctx.lineTo(x0, height);
  ctx.stroke();
}

function getFunctions() {
  const rows = functionsDiv.querySelectorAll(".function-row");
  return Array.from(rows).map(row => {
    const color = row.querySelector(".color-picker")?.value || "#ff0000";
    const equation = row.querySelector(".equation").value.trim();
    return { color, equation };
  }).filter(f => f.equation);
}

function graphFunctions() {
  drawAxes();

  const funcs = getFunctions();
  funcs.forEach(({ color, equation }) => {
    let expr;
    try {
      expr = math.compile(equation);
    } catch (e) {
      return; // skip invalid expression
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    let first = true;

    for (let i = 0; i <= width; i++) {
      const x = xMin + (i / scaleX());
      let y;
      try {
        y = expr.evaluate({ x });
      } catch (e) {
        continue;
      }

      const px = i;
      const py = height - ((y - yMin) * scaleY());

      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  });
}

function addFunction() {
  const row = document.createElement("div");
  row.className = "function-row";
  // Include color picker input for colors, default random color
  row.innerHTML = `
    <input type="color" class="color-picker" value="#${Math.floor(Math.random()*16777215).toString(16)}">
    <input type="text" class="equation" placeholder="Enter function, e.g. sin(x), x^2" />
  `;
  functionsDiv.appendChild(row);

  row.querySelector(".equation").addEventListener("input", graphFunctions);
  row.querySelector(".color-picker").addEventListener("input", graphFunctions);

  graphFunctions();
}

function zoom(factor) {
  const xCenter = (xMin + xMax) / 2;
  const yCenter = (yMin + yMax) / 2;
  const newWidth = (xMax - xMin) * factor;
  const newHeight = (yMax - yMin) * factor;

  xMin = xCenter - newWidth / 2;
  xMax = xCenter + newWidth / 2;
  yMin = yCenter - newHeight / 2;
  yMax = yCenter + newHeight / 2;

  graphFunctions();
}

function zoomIn() { zoom(0.8); }
function zoomOut() { zoom(1.25); }

let lastTouch = null;

canvas.addEventListener("wheel", (e) => {
  zoom(e.deltaY > 0 ? 1.1 : 0.9);
  e.preventDefault();
});

canvas.addEventListener("pointerdown", (e) => {
  lastTouch = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!lastTouch) return;
  const dx = (e.clientX - lastTouch.x) / scaleX();
  const dy = (e.clientY - lastTouch.y) / scaleY();

  xMin -= dx;
  xMax -= dx;
  yMin += dy;
  yMax += dy;

  lastTouch = { x: e.clientX, y: e.clientY };
  graphFunctions();
});

canvas.addEventListener("pointerup", () => {
  lastTouch = null;
});

// Initial function and graph
addFunction();
drawAxes();

// Handle theme toggle to redraw graph
const toggle = document.getElementById('theme-toggle');
toggle.addEventListener('change', () => {
  document.body.classList.toggle('dark', toggle.checked);
  localStorage.setItem('theme', toggle.checked ? 'dark' : 'light');
  graphFunctions();  // redraw with updated colors
});