const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");
const functionsDiv = document.getElementById("functions");
const legend = document.getElementById("legend");
const coords = document.getElementById("coords");
const historyList = document.getElementById("history-list");

let width = canvas.width;
let height = canvas.height;
let xMin = -10, xMax = 10, yMin = -5, yMax = 5;
let selectedPoints = [];

function scaleX() { return width / (xMax - xMin); }
function scaleY() { return height / (yMax - yMin); }

function toCanvasX(x) { return (x - xMin) * scaleX(); }
function toCanvasY(y) { return height - (y - yMin) * scaleY(); }
function fromCanvasX(px) { return xMin + px / scaleX(); }
function fromCanvasY(py) { return yMax - py / scaleY(); }

function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function drawAxes() {
  ctx.fillStyle = getCssVar('--canvas-bg') || '#f9f9f9';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = getCssVar('--border-color') || '#bbb';
  ctx.beginPath();

  const y0 = toCanvasY(0);
  ctx.moveTo(0, y0); ctx.lineTo(width, y0);

  const x0 = toCanvasX(0);
  ctx.moveTo(x0, 0); ctx.lineTo(x0, height);
  ctx.stroke();
}

function getFunctions() {
  const rows = functionsDiv.querySelectorAll(".function-row");
  return Array.from(rows).map(row => {
    const color = row.querySelector(".color-picker").value;
    const eqn = row.querySelector(".equation").value.trim();
    const mode = row.querySelector(".mode").value;
    const isIneq = eqn.includes('<') || eqn.includes('>');
    return { color, eqn, mode, isIneq };
  }).filter(f => f.eqn);
}

function graphFunctions() {
  drawAxes();
  legend.innerHTML = '';

  getFunctions().forEach(({ color, eqn, mode, isIneq }) => {
    const legendItem = document.createElement('div');
    legendItem.innerHTML = `<span style="background:${color};"></span> ${eqn}`;
    legend.appendChild(legendItem);

    try {
      if (mode === "polar") {
        plotPolar(eqn, color);
      } else if (mode === "parametric") {
        plotParametric(eqn, color);
      } else {
        plotCartesian(eqn, color, isIneq);
      }
    } catch {}
  });

  selectedPoints.forEach(p => {
    ctx.beginPath();
    ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'orange';
    ctx.fill();
  });
}

function plotCartesian(eqn, color, isIneq) {
  let expr;
  try {
    if (!eqn.includes('=')) eqn = "y=" + eqn;
    const [lhs, rhs] = eqn.split('=');
    expr = math.compile(rhs);
  } catch { return; }

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  let first = true;

  for (let px = 0; px <= width; px++) {
    const x = fromCanvasX(px);
    let y;
    try {
      y = expr.evaluate({ x });
    } catch { continue; }

    const py = toCanvasY(y);

    if (isIneq) {
      if (eqn.includes("<")) ctx.fillRect(px, py, 1, height - py);
      if (eqn.includes(">")) ctx.fillRect(px, 0, 1, py);
    } else {
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
  }

  if (!isIneq) ctx.stroke();
}

function plotParametric(eqn, color) {
  const [xExpr, yExpr] = eqn.split(';').map(e => math.compile(e));
  ctx.beginPath();
  ctx.strokeStyle = color;
  for (let t = -10; t <= 10; t += 0.01) {
    const x = xExpr.evaluate({ t });
    const y = yExpr.evaluate({ t });
    const px = toCanvasX(x), py = toCanvasY(y);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function plotPolar(eqn, color) {
  const rExpr = math.compile(eqn);
  ctx.beginPath();
  ctx.strokeStyle = color;
  for (let a = 0; a <= 2 * Math.PI; a += 0.01) {
    const r = rExpr.evaluate({ θ: a, theta: a });
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    ctx.lineTo(toCanvasX(x), toCanvasY(y));
  }
  ctx.stroke();
}

function addFunction() {
  const row = document.createElement("div");
  row.className = "function-row";
  const defaultColor = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  row.innerHTML = `
    <input type="color" class="color-picker" value="${defaultColor}" />
    <input type="text" class="equation" placeholder="e.g. y=x^2 or r=1+sin(θ)" />
    <select class="mode">
      <option value="cartesian">y=</option>
      <option value="parametric">x=; y=</option>
      <option value="polar">r=</option>
    </select>
    <button class="delete">✕</button>
  `;
  functionsDiv.appendChild(row);

  const eqnInput = row.querySelector(".equation");
  eqnInput.addEventListener("input", () => {
    saveToHistory(eqnInput.value);
    graphFunctions();
  });

  row.querySelector(".color-picker").addEventListener("input", graphFunctions);
  row.querySelector(".mode").addEventListener("change", graphFunctions);
  row.querySelector(".delete").addEventListener("click", () => {
    row.remove();
    graphFunctions();
  });

  graphFunctions();
}

function saveToHistory(eqn) {
  if (!eqn) return;
  const li = document.createElement("li");
  li.textContent = eqn;
  li.onclick = () => {
    const row = document.createElement("div");
    row.className = "function-row";
    row.innerHTML = `
      <input type="color" class="color-picker" value="#ff0000" />
      <input type="text" class="equation" value="${eqn}" />
      <select class="mode"><option value="cartesian">y=</option></select>
      <button class="delete">✕</button>
    `;
    functionsDiv.appendChild(row);
    graphFunctions();
  };
  historyList.appendChild(li);
}

function zoom(factor) {
  const xc = (xMin + xMax) / 2;
  const yc = (yMin + yMax) / 2;
  const w = (xMax - xMin) * factor;
  const h = (yMax - yMin) * factor;
  xMin = xc - w / 2;
  xMax = xc + w / 2;
  yMin = yc - h / 2;
  yMax = yc + h / 2;
  graphFunctions();
}

function zoomIn() { zoom(0.8); }
function zoomOut() { zoom(1.25); }
function resetZoom() {
  xMin = -10; xMax = 10; yMin = -5; yMax = 5;
  graphFunctions();
}

let dragging = false;
let lastTouch = null;

canvas.addEventListener("pointerdown", e => {
  dragging = true;
  lastTouch = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointermove", e => {
  const x = fromCanvasX(e.offsetX).toFixed(2);
  const y = fromCanvasY(e.offsetY).toFixed(2);
  coords.textContent = `x: ${x}, y: ${y}`;

  if (!dragging) return;
  const dx = (e.clientX - lastTouch.x) / scaleX();
  const dy = (e.clientY - lastTouch.y) / scaleY();
  xMin -= dx; xMax -= dx;
  yMin += dy; yMax += dy;
  lastTouch = { x: e.clientX, y: e.clientY };
  graphFunctions();
});

canvas.addEventListener("pointerup", e => {
  dragging = false;
});

canvas.addEventListener("click", e => {
  const x = fromCanvasX(e.offsetX);
  const y = fromCanvasY(e.offsetY);
  selectedPoints.push({ x, y });
  graphFunctions();
});

canvas.addEventListener("wheel", e => {
  zoom(e.deltaY > 0 ? 1.1 : 0.9);
  e.preventDefault();
});

function exportGraph(format) {
  if (format === "png") {
    const link = document.createElement("a");
    link.download = "graph.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } else if (format === "svg") {
    alert("SVG export not supported yet in this version.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem('theme');
  const isDark = savedTheme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.getElementById("theme-toggle").checked = isDark;

  addFunction();
});