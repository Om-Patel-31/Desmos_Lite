const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");
const functionsDiv = document.getElementById("functions");
const historyList = document.createElement("ul");
historyList.id = "history";
document.body.appendChild(historyList);

let width = canvas.width;
let height = canvas.height;
let xMin = -10, xMax = 10, yMin = -5, yMax = 5;

let functionHistory = [];
let graphData = [];

function scaleX() {
  return width / (xMax - xMin);
}

function scaleY() {
  return height / (yMax - yMin);
}

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

function updateHistory(equation) {
  if (!functionHistory.includes(equation)) {
    functionHistory.unshift(equation);
    if (functionHistory.length > 10) functionHistory.pop();

    renderHistory();
  }
}

function renderHistory() {
  historyList.innerHTML = "<h3>History</h3>";
  functionHistory.forEach(eq => {
    const li = document.createElement("li");
    li.textContent = eq;
    historyList.appendChild(li);
  });
}

function getFunctions() {
  return graphData.filter(f => f.visible && f.equation);
}

function graphFunctions() {
  drawAxes();

  const funcs = getFunctions();
  funcs.forEach(({ color, expression }) => {
    if (!expression) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    let first = true;

    for (let i = 0; i <= width; i++) {
      const x = xMin + (i / scaleX());
      let y;
      try {
        y = expression.evaluate({ x });
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

function addFunction(equationValue = "") {
  const row = document.createElement("div");
  row.className = "function-row";

  const color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  row.innerHTML = `
    <input type="color" class="color-picker" value="${color}">
    <input type="text" class="equation" placeholder="Enter y= expression" value="${equationValue}">
    <button class="toggle-btn">Hide</button>
    <button class="delete-btn">×</button>
  `;

  const equationInput = row.querySelector(".equation");
  const colorPicker = row.querySelector(".color-picker");
  const toggleBtn = row.querySelector(".toggle-btn");
  const deleteBtn = row.querySelector(".delete-btn");

  let expression;
  let visible = true;

  const update = () => {
    const equation = equationInput.value.trim();
    try {
      expression = math.compile(equation);
      equationInput.style.borderColor = "";
      updateHistory(equation);
    } catch (e) {
      equationInput.style.borderColor = "red";
      return;
    }

    const index = graphData.findIndex(f => f.element === row);
    if (index !== -1) {
      graphData[index] = { color: colorPicker.value, equation, expression, visible, element: row };
    } else {
      graphData.push({ color: colorPicker.value, equation, expression, visible, element: row });
    }

    graphFunctions();
  };

  equationInput.addEventListener("input", update);
  colorPicker.addEventListener("input", () => {
    const index = graphData.findIndex(f => f.element === row);
    if (index !== -1) {
      graphData[index].color = colorPicker.value;
      graphFunctions();
    }
  });

  toggleBtn.addEventListener("click", () => {
    visible = !visible;
    toggleBtn.textContent = visible ? "Hide" : "Show";

    const index = graphData.findIndex(f => f.element === row);
    if (index !== -1) {
      graphData[index].visible = visible;
    }

    graphFunctions();
  });

  deleteBtn.addEventListener("click", () => {
    const index = graphData.findIndex(f => f.element === row);
    if (index !== -1) {
      graphData.splice(index, 1);
    }
    row.remove();
    graphFunctions();
  });

  functionsDiv.appendChild(row);
  update(); // Initial update
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

function zoomIn() {
  zoom(0.8);
}

function zoomOut() {
  zoom(1.25);
}

function resetZoom() {
  xMin = -10; xMax = 10;
  yMin = -5; yMax = 5;
  graphFunctions();
}

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

document.getElementById('theme-toggle').addEventListener('change', () => {
  document.body.classList.toggle('dark', toggle.checked);
  localStorage.setItem('theme', toggle.checked ? 'dark' : 'light');
  graphFunctions(); // redraw with updated theme
});

// Initial load
addFunction("x^2");
drawAxes();