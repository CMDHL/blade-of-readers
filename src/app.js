import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const pdfDocument = document.querySelector("#pdfDocument");
const playerSprite = document.querySelector("#playerSprite");
const input = document.querySelector("#pdfInput");
const resetButton = document.querySelector("#resetButton");
const controlsButton = document.querySelector("#controlsButton");
const controlsPanel = document.querySelector("#controlsPanel");
const dropZone = document.querySelector("#dropZone");
const statusText = document.querySelector("#statusText");
const pageText = document.querySelector("#pageText");

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_SRC;

const punctuationPattern = /[\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+/u;

const keyMap = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  jump: ["Space"],
};

const world = {
  cssWidth: 900,
  cssHeight: 720,
  pages: [],
  platforms: [],
  loaded: false,
  renderWidth: 900,
  pageGap: 28,
  minTextHeight: 16,
  activePage: 1,
};

const player = {
  x: 72,
  y: 80,
  width: 16,
  height: 16,
  vx: 0,
  vy: 0,
  grounded: false,
  groundedByViewport: false,
  jumpHeld: false,
  jumpFrames: 0,
  dropThrough: false,
  coyote: 0,
};

const config = {
  scale: 1,
  gravity: 0.52,
  maxFall: 13,
  moveSpeed: 3.6,
  acceleration: 0.55,
  friction: 0.78,
  jumpSpeed: 8.8,
  jumpHoldForce: 0.32,
  maxJumpFrames: 12,
  platformMinWidth: 3,
};

const keys = new Set();
let remappingAction = null;
let lastManualScrollAt = -Infinity;
let autoScrollLockedUntil = 0;
let programmaticScroll = false;
let ignoreScrollUntil = 0;

playerSprite.hidden = true;

function setStatus(message) {
  statusText.textContent = message;
}

function actionPressed(action) {
  return keyMap[action].some((code) => keys.has(code));
}

function formatKey(code) {
  return code.replace("Arrow", "").replace("Key", "").replace("Space", "Space");
}

function updateControlLabels() {
  document.querySelectorAll("[data-map-action]").forEach((button) => {
    const action = button.dataset.mapAction;
    button.textContent = remappingAction === action ? "Press a key" : keyMap[action].map(formatKey).join(" / ");
  });
}

function setDocumentSize() {
  pdfDocument.style.width = `${world.cssWidth}px`;
  pdfDocument.style.height = `${world.cssHeight}px`;
}

function applyPhysicsScale() {
  const textHeight = Math.max(8, world.minTextHeight);
  config.scale = textHeight / 16;
  player.width = Math.max(7, textHeight * 0.78);
  player.height = Math.max(8, textHeight * 0.98);
  config.gravity = 0.52 * config.scale;
  config.maxFall = 13 * config.scale;
  config.moveSpeed = 3.6 * config.scale;
  config.acceleration = 0.55 * config.scale;
  config.jumpSpeed = 8.8 * config.scale;
  config.jumpHoldForce = 0.32 * config.scale;
  config.maxJumpFrames = Math.max(8, Math.round(12 * Math.sqrt(config.scale)));
}

function documentPageOffset() {
  const rect = pdfDocument.getBoundingClientRect();
  const viewport = window.visualViewport;
  const pageLeft = viewport?.pageLeft ?? window.scrollX;
  const pageTop = viewport?.pageTop ?? window.scrollY;
  return {
    left: rect.left + pageLeft,
    top: rect.top + pageTop,
  };
}

function viewportPageRect() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.pageLeft ?? window.scrollX,
    top: viewport?.pageTop ?? window.scrollY,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

function visibleWorldRect() {
  const offset = documentPageOffset();
  const viewport = viewportPageRect();
  return {
    left: Math.max(0, viewport.left - offset.left),
    top: Math.max(0, viewport.top - offset.top),
    right: Math.min(world.cssWidth, viewport.left + viewport.width - offset.left),
    bottom: Math.min(world.cssHeight, viewport.top + viewport.height - offset.top),
  };
}

function keepPlayerInVisibleWindow() {
  const view = visibleWorldRect();
  if (view.right <= view.left || view.bottom <= view.top) return false;

  let clamped = false;
  player.groundedByViewport = false;

  if (player.x < view.left) {
    player.x = view.left;
    player.vx = Math.max(0, player.vx);
    clamped = true;
  }
  if (player.x + player.width > view.right) {
    player.x = view.right - player.width;
    player.vx = Math.min(0, player.vx);
    clamped = true;
  }
  if (player.y < view.top) {
    player.y = view.top;
    player.vy = Math.max(0, player.vy);
    clamped = true;
  }
  if (player.y + player.height > view.bottom) {
    player.y = view.bottom - player.height;
    player.vy = Math.min(0, player.vy);
    player.grounded = true;
    player.groundedByViewport = true;
    clamped = true;
  }

  return clamped;
}

function autoCenterPlayer() {
  if (!world.loaded || performance.now() < autoScrollLockedUntil) return;
  const offset = documentPageOffset();
  const viewport = viewportPageRect();
  const targetX = offset.left + player.x + player.width / 2 - viewport.width / 2;
  const targetY = player.groundedByViewport
    ? viewport.top
    : offset.top + player.y + player.height / 2 - viewport.height / 2;
  programmaticScroll = true;
  ignoreScrollUntil = performance.now() + 350;
  window.scrollTo({
    left: Math.max(0, targetX),
    top: Math.max(0, targetY),
    behavior: "instant",
  });
  window.setTimeout(() => {
    programmaticScroll = false;
  }, 350);
}

function resetPlayer() {
  const firstPlatform = world.platforms.find((platform) => platform.page === 1);
  player.x = firstPlatform ? firstPlatform.x : 72;
  player.y = firstPlatform ? Math.max(0, firstPlatform.y - player.height - 4) : 80;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.groundedByViewport = false;
  player.jumpHeld = false;
  player.jumpFrames = 0;
  player.dropThrough = false;
  player.coyote = 0;
  autoScrollLockedUntil = performance.now() + 150;
  renderPlayer();
}

function splitTextIntoPlatforms(item, viewport, pageOffsetY, pageNumber) {
  const text = item.str || "";
  const chunks = text.split(punctuationPattern).filter(Boolean);
  if (!chunks.length) return [];

  const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const x = transform[4];
  const y = transform[5] + pageOffsetY;
  const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]) || item.height || 10);
  const totalTextWidth = Math.max(item.width || 0, chunks.join("").length * fontHeight * 0.48);
  const compactLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const separatorCount = Math.max(0, chunks.length - 1);
  const gap = separatorCount ? Math.min(fontHeight * 0.45, totalTextWidth * 0.08) : 0;
  const usableWidth = Math.max(config.platformMinWidth, totalTextWidth - gap * separatorCount);
  let cursor = x;

  return chunks.map((chunk) => {
    const width = Math.max(config.platformMinWidth, usableWidth * (chunk.length / Math.max(compactLength, 1)));
    const rect = {
      x: cursor,
      y: y - fontHeight * 0.78,
      width,
      height: Math.max(2, fontHeight * 0.2),
      textHeight: fontHeight,
      page: pageNumber,
      type: "text",
    };
    cursor += width + gap;
    return rect;
  });
}

function clearPdfDocument() {
  pdfDocument.replaceChildren();
  pdfDocument.append(playerSprite);
}

async function loadPdf(file) {
  setStatus("Reading PDF...");
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const firstPage = await pdf.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const availableWidth = Math.max(320, Math.min(1100, window.innerWidth - 36));
  const renderScale = availableWidth / firstViewport.width;

  world.renderWidth = availableWidth;
  world.pages = [];
  world.platforms = [];
  world.minTextHeight = Infinity;
  clearPdfDocument();

  let offsetY = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: renderScale });
    const pageCanvas = document.createElement("canvas");
    pageCanvas.className = "pdf-page";
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    pageCanvas.style.width = `${viewport.width}px`;
    pageCanvas.style.height = `${viewport.height}px`;
    pageCanvas.style.marginTop = pageNumber === 1 ? "0" : `${world.pageGap}px`;
    const pageCtx = pageCanvas.getContext("2d");
    pageCtx.fillStyle = "#fff";
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    await page.render({ canvasContext: pageCtx, viewport }).promise;
    pdfDocument.insertBefore(pageCanvas, playerSprite);

    const textContent = await page.getTextContent();
    const pagePlatforms = textContent.items.flatMap((item) => splitTextIntoPlatforms(item, viewport, offsetY, pageNumber));
    for (const platform of pagePlatforms) {
      world.minTextHeight = Math.min(world.minTextHeight, platform.textHeight);
    }

    world.pages.push({
      number: pageNumber,
      element: pageCanvas,
      x: 0,
      y: offsetY,
      width: viewport.width,
      height: viewport.height,
    });
    world.platforms.push(...pagePlatforms);
    offsetY += viewport.height + world.pageGap;
    setStatus(`Loaded page ${pageNumber} of ${pdf.numPages}...`);
  }

  world.cssWidth = Math.ceil(Math.max(...world.pages.map((page) => page.width)));
  world.cssHeight = Math.ceil(offsetY - world.pageGap);
  setDocumentSize();
  for (const page of world.pages) {
    page.x = (world.cssWidth - page.width) / 2;
    page.element.style.marginLeft = `${page.x}px`;
  }
  for (const platform of world.platforms) {
    const page = world.pages[platform.page - 1];
    platform.x += page?.x || 0;
  }

  world.minTextHeight = Number.isFinite(world.minTextHeight) ? world.minTextHeight : 16;
  world.loaded = true;
  applyPhysicsScale();
  resetPlayer();
  playerSprite.hidden = false;
  dropZone.classList.add("is-hidden");
  pageText.textContent = `Page 1 of ${pdf.numPages}`;
  setStatus(`${world.platforms.length} text platforms generated from ${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}.`);
  autoCenterPlayer();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function activeCollisionPlatforms() {
  if (!world.loaded || performance.now() - lastManualScrollAt < 1000) return [];
  const view = visibleWorldRect();
  const page = world.pages.find((item) => item.y <= player.y + player.height && item.y + item.height >= player.y);
  const activePage = page?.number || world.activePage;
  return world.platforms.filter((platform) => {
    const nearPage = Math.abs(platform.page - activePage) <= 1;
    const nearView = platform.y + platform.height >= view.top - 240 && platform.y <= view.bottom + 240;
    return nearPage && nearView;
  });
}

function startJump() {
  if (actionPressed("down") && (player.grounded || player.coyote > 0)) {
    player.dropThrough = true;
    player.jumpHeld = true;
    player.jumpFrames = 0;
    player.grounded = false;
    player.groundedByViewport = false;
    player.coyote = 0;
    player.y += Math.max(2, player.height * 0.45);
    player.vy = Math.max(player.vy, config.gravity * 6);
    return;
  }

  if (player.grounded || player.coyote > 0) {
    player.vy = -config.jumpSpeed;
    player.jumpHeld = true;
    player.jumpFrames = 0;
    player.grounded = false;
    player.groundedByViewport = false;
    player.coyote = 0;
  }
}

function collideWithPlatforms(previousY) {
  if (player.dropThrough) return;
  for (const platform of activeCollisionPlatforms()) {
    if (!rectsOverlap(player, platform)) continue;
    const wasAbove = previousY + player.height <= platform.y + Math.max(2, platform.height * 0.5);
    if (player.vy >= 0 && wasAbove) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.grounded = true;
      player.groundedByViewport = false;
    }
  }
}

function updateActivePage() {
  const centerY = player.y + player.height / 2;
  const page = world.pages.find((item) => centerY >= item.y && centerY <= item.y + item.height);
  if (page) {
    world.activePage = page.number;
    pageText.textContent = `Page ${page.number} of ${world.pages.length}`;
  }
}

function updatePlayer() {
  const movingLeft = actionPressed("left");
  const movingRight = actionPressed("right");

  if (movingLeft) player.vx -= config.acceleration;
  if (movingRight) player.vx += config.acceleration;
  if (!movingLeft && !movingRight) player.vx *= config.friction;
  player.vx = Math.max(-config.moveSpeed, Math.min(config.moveSpeed, player.vx));

  player.vy = Math.min(config.maxFall, player.vy + config.gravity);
  if (player.jumpHeld && !player.dropThrough && player.vy < 0 && player.jumpFrames < config.maxJumpFrames) {
    player.vy -= config.jumpHoldForce;
    player.jumpFrames += 1;
  }

  player.x += player.vx;
  player.x = Math.max(0, Math.min(world.cssWidth - player.width, player.x));

  const wasGrounded = player.grounded;
  const previousY = player.y;
  player.grounded = false;
  player.groundedByViewport = false;
  player.y += player.vy;
  player.y = Math.max(0, Math.min(world.cssHeight - player.height, player.y));
  if (player.y + player.height >= world.cssHeight) {
    player.vy = 0;
    player.grounded = true;
  }

  collideWithPlatforms(previousY);
  player.coyote = player.grounded ? 8 : Math.max(0, player.coyote - 1);
  if (wasGrounded && !player.grounded) player.coyote = 8;

  keepPlayerInVisibleWindow();
  updateActivePage();
  autoCenterPlayer();
}

function renderPlayer() {
  playerSprite.style.width = `${player.width}px`;
  playerSprite.style.height = `${player.height}px`;
  playerSprite.style.transform = `translate(${player.x}px, ${player.y}px)`;
  playerSprite.classList.toggle("is-grounded", player.grounded);
  playerSprite.classList.toggle("is-facing-right", player.vx >= 0);
  pdfDocument.classList.toggle("is-manual-scroll", performance.now() - lastManualScrollAt < 1000);
}

function markManualScrollIntent() {
  if (!world.loaded) return;
  lastManualScrollAt = performance.now();
  autoScrollLockedUntil = lastManualScrollAt + 1000;
}

function tick() {
  if (world.loaded) updatePlayer();
  renderPlayer();
  requestAnimationFrame(tick);
}

async function handlePdfFile(file) {
  if (!file) return;
  try {
    await loadPdf(file);
  } catch (error) {
    console.error(error);
    setStatus("Could not read that PDF. Try another file.");
    dropZone.classList.remove("is-hidden");
  }
}

input.addEventListener("change", async (event) => {
  await handlePdfFile(event.target.files?.[0]);
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
  await handlePdfFile(file);
});

resetButton.addEventListener("click", () => {
  resetPlayer();
  autoCenterPlayer();
});

controlsButton.addEventListener("click", () => {
  controlsPanel.hidden = !controlsPanel.hidden;
});

controlsPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-action]");
  if (!button) return;
  remappingAction = button.dataset.mapAction;
  updateControlLabels();
});

window.addEventListener("keydown", (event) => {
  if (remappingAction) {
    event.preventDefault();
    for (const action of Object.keys(keyMap)) {
      keyMap[action] = keyMap[action].filter((code) => code !== event.code);
    }
    keyMap[remappingAction] = [event.code];
    remappingAction = null;
    updateControlLabels();
    return;
  }

  if (["PageDown", "PageUp", "Home", "End"].includes(event.code)) markManualScrollIntent();
  if (Object.values(keyMap).flat().includes(event.code)) event.preventDefault();
  if (!keys.has(event.code) && keyMap.jump.includes(event.code)) startJump();
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  if (keyMap.jump.includes(event.code)) {
    player.jumpHeld = false;
    player.dropThrough = false;
    if (player.vy < 0) player.vy = 0;
  }
});

window.addEventListener("scroll", () => {
  if (programmaticScroll || performance.now() < ignoreScrollUntil) return;
  markManualScrollIntent();
  if (world.loaded) keepPlayerInVisibleWindow();
}, { passive: true });

window.addEventListener("resize", () => {
  if (!world.loaded) return;
  keepPlayerInVisibleWindow();
});

window.addEventListener("wheel", markManualScrollIntent, { passive: true });
window.addEventListener("touchmove", markManualScrollIntent, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (!world.loaded) return;
    keepPlayerInVisibleWindow();
  });
  window.visualViewport.addEventListener("scroll", () => {
    if (programmaticScroll || performance.now() < ignoreScrollUntil) return;
    markManualScrollIntent();
    if (world.loaded) keepPlayerInVisibleWindow();
  });
}

updateControlLabels();
setDocumentSize();
resetPlayer();
tick();
