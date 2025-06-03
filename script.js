const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");
const functionsDiv = document.getElementById("functions");

let width = canvas.width;
let height = canvas.height;
let xMin = -10, xMax = 10, yMin = -5, yMax = 5;

function scaleX() { return width / (xMax - xMin); }
function scaleY() { return height / (yMax - yMin); }

function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function drawAxes() {
  const bgColor = getCssVar('--canvas-bg') || '#f9f9f9';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

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
    return { color, equation, row };
  }).filter(f => f.equation);
}

function graphFunctions() {
  drawAxes();
  const funcs = getFunctions();

  const xStep = (xMax - xMin) / width;
  const yStep = (yMax - yMin) / height;

  funcs.forEach(({ color, equation, row }) => {
    let leftExpr, rightExpr;
    if (!equation.includes("=")) {
      row.classList.add("invalid");
      return;
    }

    const [left, right] = equation.split("=").map(e => e.trim());
    try {
      leftExpr = math.compile(left);
      rightExpr = math.compile(right);
      row.classList.remove("invalid");
    } catch {
      row.classList.add("invalid");
      return;
    }

    ctx.fillStyle = color;

    for (let px = 0; px < width; px++) {
      const x = xMin + px * xStep;
      for (let py = 0; py < height; py++) {
        const y = yMax - py * yStep;

        try {
          const leftVal = leftExpr.evaluate({ x, y });
          const rightVal = rightExpr.evaluate({ x, y });
          if (Math.abs(leftVal - rightVal) < 0.05) {
            ctx.fillRect(px, py, 1, 1);
          }
        } catch { continue; }
      }
    }
  });
}

function addFunction() {
  const row = document.createElement("div");
  row.className = "function-row";
  row.innerHTML = `
    <input type="color" class="color-picker" value="#${Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6, '0')}">
    <input type="text" class="equation" placeholder="Enter equation, e.g. y=sin(x), x^2+y^2=4" />
    <button class="delete-btn" title="Delete function">✕</button>
  `;
  functionsDiv.appendChild(row);

  const eqInput = row.querySelector(".equation");
  const colorInput = row.querySelector(".color-picker");

  const validateAndGraph = () => {
    try {
      const eq = eqInput.value.trim();
      if (eq.includes("=")) {
        const [l, r] = eq.split("=");
        math.compile(l.trim());
        math.compile(r.trim());
        row.classList.remove("invalid");
      } else {
        row.classList.add("invalid");
      }
    } catch {
      row.classList.add("invalid");
    }
    graphFunctions();
  };

  eqInput.addEventListener("input", validateAndGraph);
  colorInput.addEventListener("input", graphFunctions);

  row.querySelector(".delete-btn").addEventListener("click", () => {
    row.remove();
    graphFunctions();
  });

  graphFunctions();
}

function zoom(factor) {
  const xCenter = (xMin + xMax) / 2;
  const yCenter = (yMin + yMax) / 2;
  const newWidth = (xMax - xMin) * factor;
  const newHeight = (yMax - yMin) * factor;

  if (newWidth < 0.01 || newWidth > 1e6 || newHeight < 0.01 || newHeight > 1e6) return;

  xMin = xCenter - newWidth / 2;
  xMax = xCenter + newWidth / 2;
  yMin = yCenter - newHeight / 2;
  yMax = yCenter + newHeight / 2;

  graphFunctions();
}

function zoomIn() { zoom(0.8); }
function zoomOut() { zoom(1.25); }

let lastTouch = null;
canvas.addEventListener("wheel", e => {
  zoom(e.deltaY > 0 ? 1.1 : 0.9);
  e.preventDefault();
});
canvas.addEventListener("pointerdown", e => {
  lastTouch = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (!lastTouch) return;
  const dx = (e.clientX - lastTouch.x) / scaleX();
  const dy = (e.clientY - lastTouch.y) / scaleY();
  xMin -= dx; xMax -= dx; yMin += dy; yMax += dy;
  lastTouch = { x: e.clientX, y: e.clientY };
  graphFunctions();
});
canvas.addEventListener("pointerup", () => { lastTouch = null; });

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  const isDark = savedTheme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.getElementById('theme-toggle').checked = isDark;
  addFunction(); // default
});

document.getElementById('theme-toggle').addEventListener('change', e => {
  const isDark = e.target.checked;
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  graphFunctions();
});