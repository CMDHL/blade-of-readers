import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const input = document.querySelector("#pdfInput");
const resetButton = document.querySelector("#resetButton");
const dropZone = document.querySelector("#dropZone");
const statusText = document.querySelector("#statusText");
const pageText = document.querySelector("#pageText");

const world = {
  width: 1280,
  height: 720,
  platforms: [],
  imageBlocks: [],
  pageCanvas: null,
  loaded: false,
  cameraY: 0,
  pageScale: 1,
};

const player = {
  x: 72,
  y: 80,
  width: 24,
  height: 30,
  vx: 0,
  vy: 0,
  grounded: false,
  touchingLeft: false,
  touchingRight: false,
  touchingTop: false,
  jumpHeld: false,
  jumpFrames: 0,
  coyote: 0,
};

const keys = new Set();
const config = {
  gravity: 0.62,
  maxFall: 18,
  moveSpeed: 4.8,
  acceleration: 0.74,
  friction: 0.78,
  jumpSpeed: 11.4,
  jumpHoldForce: 0.44,
  maxJumpFrames: 15,
  wallClimbSpeed: 3.1,
  platformMinWidth: 6,
};

const punctuationPattern = /[\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+/u;

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_SRC;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  world.width = rect.width;
  world.height = rect.height;
}

function setStatus(message) {
  statusText.textContent = message;
}

function resetPlayer() {
  player.x = 52;
  player.y = 48;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.touchingLeft = false;
  player.touchingRight = false;
  player.touchingTop = false;
  player.jumpHeld = false;
  player.jumpFrames = 0;
  player.coyote = 0;
}

function splitTextIntoPlatforms(item, viewport) {
  const text = item.str || "";
  const chunks = text.split(punctuationPattern).filter(Boolean);
  if (!chunks.length) return [];

  const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const x = transform[4];
  const y = transform[5];
  const fontHeight = Math.hypot(transform[2], transform[3]) || item.height || 10;
  const totalWidth = Math.max(item.width || 0, chunks.join("").length * fontHeight * 0.45);
  const compactTextLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const gap = Math.min(fontHeight * 0.5, 10);
  let cursor = x;

  return chunks.map((chunk) => {
    const share = chunk.length / Math.max(compactTextLength, 1);
    const width = Math.max(config.platformMinWidth, totalWidth * share - gap * 0.35);
    const rect = {
      x: cursor,
      y: y - fontHeight * 0.76,
      width,
      height: Math.max(5, fontHeight * 0.22),
      label: chunk,
      type: "text",
    };
    cursor += width + gap;
    return rect;
  });
}

function normalizeRects(rects, pageWidth, pageHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / pageWidth, targetHeight / pageHeight);
  const offsetX = (targetWidth - pageWidth * scale) / 2;
  const offsetY = 0;
  return rects.map((rect) => ({
    ...rect,
    x: rect.x * scale + offsetX,
    y: rect.y * scale + offsetY,
    width: rect.width * scale,
    height: Math.max(4, rect.height * scale),
  }));
}

function createTextMask(platforms, width, height) {
  const mask = new Uint8Array(width * height);
  for (const rect of platforms) {
    const x0 = Math.max(0, Math.floor(rect.x - 4));
    const y0 = Math.max(0, Math.floor(rect.y - 8));
    const x1 = Math.min(width, Math.ceil(rect.x + rect.width + 4));
    const y1 = Math.min(height, Math.ceil(rect.y + rect.height + 16));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) mask[y * width + x] = 1;
    }
  }
  return mask;
}

function inferImageBlocks(renderCanvas, textPlatforms) {
  const grid = 10;
  const width = renderCanvas.width;
  const height = renderCanvas.height;
  const imageCtx = renderCanvas.getContext("2d");
  const data = imageCtx.getImageData(0, 0, width, height).data;
  const textMask = createTextMask(textPlatforms, width, height);
  const cols = Math.ceil(width / grid);
  const rows = Math.ceil(height / grid);
  const solid = new Uint8Array(cols * rows);

  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      let ink = 0;
      let total = 0;
      const xEnd = Math.min(width, (gx + 1) * grid);
      const yEnd = Math.min(height, (gy + 1) * grid);
      for (let y = gy * grid; y < yEnd; y += 2) {
        for (let x = gx * grid; x < xEnd; x += 2) {
          total += 1;
          const pixel = y * width + x;
          if (textMask[pixel]) continue;
          const i = pixel * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const nonPaper = a > 20 && (r < 236 || g < 236 || b < 236) && Math.abs(r - g) + Math.abs(g - b) > 18;
          if (nonPaper) ink += 1;
        }
      }
      if (ink / Math.max(total, 1) > 0.16) solid[gy * cols + gx] = 1;
    }
  }

  const visited = new Uint8Array(cols * rows);
  const blocks = [];
  const queue = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const start = y * cols + x;
      if (!solid[start] || visited[start]) continue;
      visited[start] = 1;
      queue.length = 0;
      queue.push([x, y]);
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let cells = 0;

      for (let i = 0; i < queue.length; i += 1) {
        const [cx, cy] = queue[i];
        cells += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (!solid[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push([nx, ny]);
        }
      }

      const rect = {
        x: minX * grid,
        y: minY * grid,
        width: (maxX - minX + 1) * grid,
        height: (maxY - minY + 1) * grid,
        type: "image",
      };
      if (cells >= 12 && rect.width >= 34 && rect.height >= 24) blocks.push(rect);
    }
  }

  return blocks.slice(0, 80);
}

async function loadPdf(file) {
  setStatus("Reading PDF...");
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const unscaled = page.getViewport({ scale: 1 });
  const fitScale = Math.min(world.width / unscaled.width, world.height / unscaled.height);
  const viewport = page.getViewport({ scale: fitScale * 1.6 });

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = Math.ceil(viewport.width);
  renderCanvas.height = Math.ceil(viewport.height);
  const renderCtx = renderCanvas.getContext("2d");
  renderCtx.fillStyle = "#fff";
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  await page.render({ canvasContext: renderCtx, viewport }).promise;

  const textContent = await page.getTextContent();
  const rawPlatforms = textContent.items.flatMap((item) => splitTextIntoPlatforms(item, viewport));
  const platforms = normalizeRects(rawPlatforms, viewport.width, viewport.height, world.width, world.height);
  const imageBlocks = normalizeRects(
    inferImageBlocks(renderCanvas, rawPlatforms),
    viewport.width,
    viewport.height,
    world.width,
    world.height,
  );

  world.pageCanvas = renderCanvas;
  world.platforms = platforms.filter((rect) => rect.width >= 4);
  world.imageBlocks = imageBlocks;
  world.loaded = true;
  world.pageScale = Math.min(world.width / viewport.width, world.height / viewport.height);

  dropZone.classList.add("is-hidden");
  pageText.textContent = `Page 1 of ${pdf.numPages}`;
  setStatus(`${world.platforms.length} text platforms and ${world.imageBlocks.length} image blocks generated.`);
  resetPlayer();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function collisionRects() {
  return [
    ...world.platforms,
    ...world.imageBlocks,
    { x: -36, y: 0, width: 36, height: world.height, type: "wall" },
    { x: world.width, y: 0, width: 36, height: world.height, type: "wall" },
    { x: 0, y: world.height, width: world.width, height: 36, type: "floor" },
    { x: 0, y: -36, width: world.width, height: 36, type: "ceiling" },
  ];
}

function startJump() {
  const canWallJump = player.touchingLeft || player.touchingRight;
  if (player.grounded || player.coyote > 0 || canWallJump) {
    player.vy = -config.jumpSpeed;
    if (player.touchingLeft) player.vx = config.moveSpeed * 1.15;
    if (player.touchingRight) player.vx = -config.moveSpeed * 1.15;
    player.jumpHeld = true;
    player.jumpFrames = 0;
    player.grounded = false;
    player.coyote = 0;
  }
}

function updatePlayer() {
  const movingLeft = keys.has("ArrowLeft") || keys.has("KeyA");
  const movingRight = keys.has("ArrowRight") || keys.has("KeyD");
  const climbing = keys.has("ArrowUp") || keys.has("KeyW");

  if (movingLeft) player.vx -= config.acceleration;
  if (movingRight) player.vx += config.acceleration;
  if (!movingLeft && !movingRight) player.vx *= config.friction;
  player.vx = Math.max(-config.moveSpeed, Math.min(config.moveSpeed, player.vx));

  if ((player.touchingLeft || player.touchingRight) && climbing) {
    player.vy = Math.min(player.vy, -config.wallClimbSpeed);
  } else {
    player.vy += config.gravity;
  }

  if (player.jumpHeld && player.jumpFrames < config.maxJumpFrames && player.vy < 0) {
    player.vy -= config.jumpHoldForce;
    player.jumpFrames += 1;
  }

  player.vy = Math.min(config.maxFall, player.vy);
  player.touchingLeft = false;
  player.touchingRight = false;
  player.touchingTop = false;
  const solids = collisionRects();

  player.x += player.vx;
  for (const rect of solids) {
    if (rect.type === "text") continue;
    if (!rectsOverlap(player, rect)) continue;
    if (player.vx > 0) {
      player.x = rect.x - player.width;
      player.touchingRight = true;
    } else if (player.vx < 0) {
      player.x = rect.x + rect.width;
      player.touchingLeft = true;
    }
    player.vx = 0;
  }

  const wasGrounded = player.grounded;
  player.grounded = false;
  const previousY = player.y;
  player.y += player.vy;
  for (const rect of solids) {
    if (!rectsOverlap(player, rect)) continue;
    if (player.vy >= 0) {
      if (rect.type === "text" && previousY + player.height > rect.y + 7) continue;
      player.y = rect.y - player.height;
      player.vy = 0;
      player.grounded = true;
    } else {
      if (rect.type === "text") continue;
      player.y = rect.y + rect.height;
      player.vy = 0;
      player.touchingTop = true;
    }
  }

  player.coyote = player.grounded ? 8 : Math.max(0, player.coyote - 1);
  if (wasGrounded && !player.grounded) player.coyote = 8;
}

function drawBackground() {
  ctx.fillStyle = "#f8f8f5";
  ctx.fillRect(0, 0, world.width, world.height);
  if (world.pageCanvas) {
    const drawWidth = world.pageCanvas.width * world.pageScale;
    const drawHeight = world.pageCanvas.height * world.pageScale;
    const x = (world.width - drawWidth) / 2;
    ctx.drawImage(world.pageCanvas, x, 0, drawWidth, drawHeight);
    ctx.fillStyle = "rgba(248, 248, 245, 0.62)";
    ctx.fillRect(0, 0, world.width, world.height);
  } else {
    ctx.strokeStyle = "rgba(25, 118, 111, 0.16)";
    ctx.lineWidth = 1;
    for (let y = 38; y < world.height; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
      ctx.stroke();
    }
  }
}

function drawPlatforms() {
  ctx.save();
  for (const block of world.imageBlocks) {
    ctx.fillStyle = "rgba(100, 166, 189, 0.46)";
    ctx.strokeStyle = "rgba(29, 84, 104, 0.76)";
    ctx.lineWidth = 2;
    ctx.fillRect(block.x, block.y, block.width, block.height);
    ctx.strokeRect(block.x, block.y, block.width, block.height);
  }

  for (const platform of world.platforms) {
    ctx.fillStyle = "rgba(23, 25, 31, 0.78)";
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = player.grounded ? "#19766f" : "#ba3b46";
  ctx.fillRect(0, 0, player.width, player.height);
  ctx.fillStyle = "#fff";
  const eyeX = player.vx >= 0 ? player.width - 8 : 5;
  ctx.fillRect(eyeX, 7, 4, 4);
  ctx.restore();
}

function drawFrame() {
  drawBackground();
  if (world.loaded) drawPlatforms();

  ctx.strokeStyle = "rgba(23, 25, 31, 0.68)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, world.width - 3, world.height - 3);
  drawPlayer();
}

function tick() {
  resizeCanvas();
  if (world.loaded) updatePlayer();
  drawFrame();
  requestAnimationFrame(tick);
}

input.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await loadPdf(file);
  } catch (error) {
    console.error(error);
    setStatus("Could not read that PDF. Try another file.");
    dropZone.classList.remove("is-hidden");
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  const file = [...event.dataTransfer.files].find((item) => item.type === "application/pdf" || item.name.endsWith(".pdf"));
  if (file) await loadPdf(file);
});

resetButton.addEventListener("click", resetPlayer);

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW"].includes(event.code)) {
    event.preventDefault();
  }
  if (!keys.has(event.code) && (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW")) {
    startJump();
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
    player.jumpHeld = false;
  }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
resetPlayer();
tick();
