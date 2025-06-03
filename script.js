
const canvas = document.getElementById("graphCanvas");
const ctx = canvas.getContext("2d");
const equationInput = document.getElementById("equationInput");
const historyList = document.getElementById("history");
const legend = document.getElementById("legend");
const toggle = document.getElementById("darkToggle");

let equations = [];
let hiddenEquations = new Set();
let history = [];
let draggingEquation = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let xMin = -10, xMax = 10, yMin = -7.5, yMax = 7.5;
let width = canvas.width;
let height = canvas.height;

function scaleX() { return width / (xMax - xMin); }
function scaleY() { return height / (yMax - yMin); }

function toCanvasX(x) { return (x - xMin) * scaleX(); }
function toCanvasY(y) { return height - (y - yMin) * scaleY(); }
function fromCanvasX(px) { return px / scaleX() + xMin; }
function fromCanvasY(py) { return yMax - py / scaleY(); }

function drawAxes() {
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--canvas-bg').trim();
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color').trim();
  ctx.beginPath();
  const y0 = toCanvasY(0);
  ctx.moveTo(0, y0); ctx.lineTo(width, y0);
  const x0 = toCanvasX(0);
  ctx.moveTo(x0, 0); ctx.lineTo(x0, height);
  ctx.stroke();
}

function plotEquation(eq, color = "#f00", type = "normal", shade = false) {
  ctx.strokeStyle = color;
  ctx.beginPath();
  let first = true;

  for (let i = 0; i < width; i++) {
    const x = fromCanvasX(i);
    let y;
    try {
      if (type === "polar") {
        const r = eq(x); y = r * Math.sin(x); x = r * Math.cos(x);
      } else if (type === "parametric") {
        const [fx, fy] = eq(x); x = fx; y = fy;
      } else {
        y = eq(x);
      }
    } catch {
      continue;
    }

    const px = toCanvasX(x);
    const py = toCanvasY(y);

    if (isNaN(px) || isNaN(py) || !isFinite(px) || !isFinite(py)) continue;

    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else {
      ctx.lineTo(px, py);
    }

    if (shade) {
      ctx.lineTo(px, toCanvasY(yMin));
      ctx.lineTo(px, py);
    }
  }

  ctx.stroke();
}

function parseEquation(input) {
  const trimmed = input.trim();
  const isInequality = /[<>]=?/.test(trimmed);
  const isPolar = /^r\s*=/.test(trimmed);
  const isParametric = /^x\s*=.*;.*y\s*=/.test(trimmed);

  let func = () => NaN;

  try {
    if (isPolar) {
      const expr = trimmed.split("=")[1];
      const compiled = math.compile(expr);
      func = angle => compiled.evaluate({ x: angle, θ: angle });
      return { func, type: "polar", shade: false };
    } else if (isParametric) {
      const [xExpr, yExpr] = trimmed.split(";").map(s => s.split("=")[1]);
      const cx = math.compile(xExpr);
      const cy = math.compile(yExpr);
      func = t => [cx.evaluate({ t }), cy.evaluate({ t })];
      return { func, type: "parametric", shade: false };
    } else if (isInequality) {
      const [lhs, rhs] = trimmed.split(/([<>]=?)/);
      const op = trimmed.match(/[<>]=?/)[0];
      const compiled = math.compile(lhs.includes("x") ? lhs : rhs);
      func = x => compiled.evaluate({ x });
      return { func, type: "normal", shade: true };
    } else {
      const eq = trimmed.replace(/^y\s*=\s*/, '');
      const compiled = math.compile(eq);
      func = x => compiled.evaluate({ x });
      return { func, type: "normal", shade: false };
    }
  } catch {
    return null;
  }
}

function addEquation() {
  const input = equationInput.value;
  const parsed = parseEquation(input);
  if (!parsed) return;

  const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
  equations.push({ input, ...parsed, color });
  history.push(input);
  updateHistory();
  updateLegend();
  equationInput.value = "";
  draw();
}

function updateLegend() {
  legend.innerHTML = "";
  equations.forEach((eq, index) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    if (hiddenEquations.has(index)) item.classList.add("hidden");
    item.onclick = () => {
      if (hiddenEquations.has(index)) hiddenEquations.delete(index);
      else hiddenEquations.add(index);
      draw();
      updateLegend();
    };
    const colorBox = document.createElement("span");
    colorBox.className = "legend-color";
    colorBox.style.background = eq.color;
    const label = document.createElement("span");
    label.textContent = eq.input;
    item.appendChild(colorBox);
    item.appendChild(label);
    legend.appendChild(item);
  });
}

function updateHistory() {
  historyList.innerHTML = "";
  [...history].reverse().forEach(eq => {
    const li = document.createElement("li");
    li.textContent = eq;
    li.onclick = () => {
      equationInput.value = eq;
    };
    historyList.appendChild(li);
  });
}

function drawPoints() {
  // Optional: Add point selection/plotting feature here.
}

function draw() {
  drawAxes();
  equations.forEach((eq, i) => {
    if (!hiddenEquations.has(i)) plotEquation(eq.func, eq.color, eq.type, eq.shade);
  });
  drawPoints();
}

function resetZoom() {
  xMin = -10; xMax = 10; yMin = -7.5; yMax = 7.5;
  draw();
}

function exportGraph(format) {
  if (format === 'png') {
    const link = document.createElement('a');
    link.download = "graph.png";
    link.href = canvas.toDataURL();
    link.click();
  } else if (format === 'svg') {
    alert("SVG export requires additional SVG rendering logic.");
  }
}

// Zoom + Pan
canvas.addEventListener("wheel", e => {
  const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
  const mx = fromCanvasX(e.offsetX);
  const my = fromCanvasY(e.offsetY);
  const widthX = xMax - xMin;
  const heightY = yMax - yMin;

  xMin = mx - (mx - xMin) * zoomFactor;
  xMax = xMin + widthX * zoomFactor;
  yMin = my - (my - yMin) * zoomFactor;
  yMax = yMin + heightY * zoomFactor;

  draw();
  e.preventDefault();
});

let isDragging = false;
let lastX, lastY;

canvas.addEventListener("pointerdown", e => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener("pointermove", e => {
  if (!isDragging) return;
  const dx = (e.clientX - lastX) / scaleX();
  const dy = (e.clientY - lastY) / scaleY();

  xMin -= dx;
  xMax -= dx;
  yMin += dy;
  yMax += dy;

  lastX = e.clientX;
  lastY = e.clientY;

  draw();
});

canvas.addEventListener("pointerup", () => {
  isDragging = false;
});

// Theme toggle
toggle.addEventListener("change", () => {
  document.body.classList.toggle("dark", toggle.checked);
  localStorage.setItem("theme", toggle.checked ? "dark" : "light");
  draw();
});

window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    toggle.checked = true;
  }
  draw();
});