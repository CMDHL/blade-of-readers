import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const pdfDocument = document.querySelector("#pdfDocument");
const readerStage = document.querySelector(".reader-stage");
const playerSprite = document.querySelector("#playerSprite");
const input = document.querySelector("#pdfInput");
const resetButton = document.querySelector("#resetButton");
const controlsPanel = document.querySelector("#controlsPanel");
const collisionButton = document.querySelector("#collisionButton");
const languageSelect = document.querySelector("#languageSelect");
const dropZone = document.querySelector("#dropZone");
const loadingOverlay = document.querySelector("#loadingOverlay");
const statusText = document.querySelector("#statusText");
const pageText = document.querySelector("#pageText");

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_SRC;

const punctuationPattern = /[\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+/u;
const textSegmentPattern = /[\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+|[^\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+/gu;
const textMeasureContext = document.createElement("canvas").getContext("2d");

const keyMap = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  jump: ["Space", "KeyZ"],
  dash: ["ShiftLeft", "ShiftRight", "KeyC"],
};

const controllerMap = {
  jump: [0],
  dash: [7],
};

const controllerButtonLabels = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "View",
  9: "Menu",
  10: "LS",
  11: "RS",
  12: "D-pad Up",
  13: "D-pad Down",
  14: "D-pad Left",
  15: "D-pad Right",
  16: "Home",
};

const world = {
  cssWidth: 900,
  cssHeight: 720,
  pages: [],
  platforms: [],
  portals: [],
  loaded: false,
  renderWidth: 900,
  pageGap: 28,
  minTextHeight: 16,
  activePage: 1,
  activePlatformLineId: null,
  renderedActivePlatformLineId: null,
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
  dashFrames: 0,
  dashDirection: 1,
  dashCooldown: 0,
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
  dashDuration: 10,
  dashDistance: 96,
  dashSpeed: 9.6,
};

const keys = new Set();
const controllerButtons = new Set();
const previousControllerButtons = new Set();
const controllerDirections = {
  left: false,
  right: false,
  up: false,
  down: false,
};
let remappingAction = null;
let remappingDevice = null;
let controllerRemapBaseline = new Set();
let collisionsVisible = false;
let autoScrollEnabled = true;
let programmaticScrollUntil = 0;
let currentLanguage = "en";
let currentStatus = { key: "waiting", values: {} };
let currentPageText = { page: 1, total: null };

const translations = {
  en: {
    appName: "Blade of Readers",
    tagline: "Turn complicated articles into simple platformer levels.",
    languageLabel: "Language",
    uploadPdf: "Upload PDF",
    hideCollisions: "Hide Collisions",
    showCollisions: "Show Collisions",
    reset: "Reset",
    controlsLabel: "Key mapping",
    keyboardControls: "Keyboard",
    controllerControls: "Controller",
    move: "Move",
    leftStick: "Left stick",
    left: "Left",
    right: "Right",
    up: "Up",
    down: "Down",
    jump: "Jump",
    dash: "Dash",
    readerStageLabel: "PDF platformer",
    dropTitle: "Upload a PDF to generate the level",
    dropDescription: "Words and punctuation-separated chunks become invisible platforms at the text itself.",
    keysHelp: "Move with keys or left stick. Jump: Space / A. Dash: Shift / RT. Mouse click teleports.",
    loadingTitle: "Loading PDF...",
    loadingDescription: "Preparing the level before switching views.",
    waiting: "Waiting for a PDF.",
    readingPdf: "Reading PDF...",
    loadedPage: "Loaded page {page} of {total}...",
    generatedPlatforms: "{count} text platforms generated from {total} {pageWord}.",
    page: "Page {page}",
    pageOf: "Page {page} of {total}",
    pageSingular: "page",
    pagePlural: "pages",
    pdfReadError: "Could not read that PDF. Try another file.",
    pressKey: "Press a key",
    pressButton: "Press button",
  },
  zh: {
    appName: "读者之刃",
    tagline: "把晦涩的文章变成简单的平台关卡。",
    languageLabel: "语言",
    uploadPdf: "上传 PDF",
    hideCollisions: "隐藏碰撞",
    showCollisions: "显示碰撞",
    reset: "重置",
    controlsLabel: "按键映射",
    keyboardControls: "键盘",
    controllerControls: "手柄",
    move: "移动",
    leftStick: "左摇杆",
    left: "左",
    right: "右",
    up: "上",
    down: "下",
    jump: "跳跃",
    dash: "冲刺",
    readerStageLabel: "PDF 平台关卡",
    dropTitle: "上传 PDF 生成关卡",
    dropDescription: "单词和由标点分隔的文本片段会在原文位置变成隐形平台。",
    keysHelp: "按键或左摇杆移动。跳跃：空格 / A。冲刺：Shift / RT。鼠标点击可传送。",
    loadingTitle: "正在加载 PDF...",
    loadingDescription: "正在准备关卡，完成后会切换显示。",
    waiting: "等待上传 PDF。",
    readingPdf: "正在读取 PDF...",
    loadedPage: "已加载第 {page} 页，共 {total} 页...",
    generatedPlatforms: "已从 {total} 页生成 {count} 个文字平台。",
    page: "第 {page} 页",
    pageOf: "第 {page} 页，共 {total} 页",
    pageSingular: "page",
    pagePlural: "pages",
    pdfReadError: "无法读取这个 PDF，请试试另一个文件。",
    pressKey: "按一个键",
    pressButton: "按一个按钮",
  },
};

playerSprite.hidden = true;

function detectLanguage() {
  const savedLanguage = localStorage.getItem("bladeOfReadersLanguage");
  if (savedLanguage && translations[savedLanguage]) return savedLanguage;
  const browserLanguage = navigator.languages?.[0] || navigator.language || "en";
  return browserLanguage.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function t(key, values = {}) {
  const template = translations[currentLanguage][key] || translations.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function setStatus(key, values = {}) {
  currentStatus = { key, values };
  statusText.textContent = t(key, values);
}

function updatePageText(page = currentPageText.page, total = currentPageText.total) {
  currentPageText = { page, total };
  pageText.textContent = total ? t("pageOf", { page, total }) : t("page", { page });
}

function updateCollisionButtonLabel() {
  collisionButton.textContent = collisionsVisible ? t("hideCollisions") : t("showCollisions");
}

function applyLanguage(language) {
  currentLanguage = translations[language] ? language : "en";
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.title = t("appName");
  languageSelect.value = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    for (const pair of element.dataset.i18nAttr.split(",")) {
      const [attribute, key] = pair.split(":").map((item) => item.trim());
      if (attribute && key) element.setAttribute(attribute, t(key));
    }
  });

  statusText.textContent = t(currentStatus.key, currentStatus.values);
  updatePageText();
  updateCollisionButtonLabel();
  updateControlLabels();
}

function actionPressed(action) {
  if (keyMap[action]?.some((code) => keys.has(code))) return true;
  if (controllerDirections[action]) return true;
  return controllerMap[action]?.some((button) => controllerButtons.has(button)) || false;
}

function formatKey(code) {
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  return code.replace("Arrow", "").replace("Key", "").replace("Space", "Space");
}

function formatKeyList(codes) {
  const labels = [];
  for (const code of codes) {
    const label = formatKey(code);
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.join(" / ");
}

function formatControllerButton(button) {
  return controllerButtonLabels[button] || `B${button}`;
}

function formatControllerButtonList(buttons) {
  const labels = [];
  for (const button of buttons) {
    const label = formatControllerButton(button);
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.join(" / ");
}

function updateControlLabels() {
  document.querySelectorAll("[data-map-action]").forEach((button) => {
    const action = button.dataset.mapAction;
    const device = button.dataset.mapDevice;
    const isRemapping = remappingAction === action && remappingDevice === device;
    if (device === "controller") {
      button.textContent = isRemapping ? t("pressButton") : formatControllerButtonList(controllerMap[action]);
      return;
    }
    button.textContent = isRemapping ? t("pressKey") : formatKeyList(keyMap[action]);
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
  config.dashDistance = 96 * config.scale;
  config.dashDuration = Math.max(6, Math.round(10 * Math.sqrt(config.scale)));
  config.dashSpeed = config.dashDistance / config.dashDuration;
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
  if (!world.loaded || !autoScrollEnabled) return;
  const offset = documentPageOffset();
  const viewport = viewportPageRect();
  const targetX = offset.left + player.x + player.width / 2 - viewport.width / 2;
  const targetY = player.groundedByViewport
    ? viewport.top
    : offset.top + player.y + player.height / 2 - viewport.height / 2;
  programmaticScrollUntil = performance.now() + 150;
  window.scrollTo({
    left: Math.max(0, targetX),
    top: Math.max(0, targetY),
    behavior: "instant",
  });
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
  player.dashFrames = 0;
  player.dashCooldown = 0;
  autoScrollEnabled = true;
  renderPlayer();
}

function cssFontFamily(fontFamily) {
  if (!fontFamily) return "sans-serif";
  if (
    fontFamily.includes(",")
    || /^["'].*["']$/u.test(fontFamily)
    || /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/u.test(fontFamily)
  ) {
    return fontFamily;
  }
  return `"${fontFamily.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function textMeasureFont(fontHeight, style) {
  const fontStyle = style?.italic ? "italic " : "";
  const fontWeight = style?.black ? "900 " : style?.bold ? "700 " : "";
  return `${fontStyle}${fontWeight}${fontHeight}px ${cssFontFamily(style?.fontFamily)}`;
}

function measureTextWidth(text, fontHeight, style) {
  if (!textMeasureContext || !text) return 0;
  textMeasureContext.font = textMeasureFont(fontHeight, style);
  textMeasureContext.fontKerning = "normal";
  return textMeasureContext.measureText(text).width;
}

function estimatedTextWidth(text, fontHeight) {
  return Array.from(text).length * fontHeight * 0.5;
}

function fallbackTextWidth(text, fontHeight) {
  return Math.max(config.platformMinWidth, estimatedTextWidth(text, fontHeight));
}

function textSegments(text) {
  return Array.from(text.matchAll(textSegmentPattern), (match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
    isSeparator: punctuationPattern.test(match[0]),
  }));
}

function measureTextSegmentRects(text, segments, fontHeight, style, totalTextWidth, measuredTextWidth) {
  if (!document.createRange || measuredTextWidth <= 0) return null;

  const widthScale = totalTextWidth / measuredTextWidth;
  const probe = document.createElement("span");
  probe.textContent = text;
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.left = "-10000px";
  probe.style.top = "-10000px";
  probe.style.visibility = "hidden";
  probe.style.whiteSpace = "pre";
  probe.style.font = textMeasureFont(fontHeight, style);
  probe.style.fontKerning = "normal";
  probe.style.transform = `scaleX(${widthScale})`;
  probe.style.transformOrigin = "0 0";
  document.body.append(probe);

  const textNode = probe.firstChild;
  if (!textNode) {
    probe.remove();
    return null;
  }

  const range = document.createRange();
  const origin = probe.getBoundingClientRect();
  const rects = new Map();

  try {
    for (const segment of segments) {
      if (segment.isSeparator) continue;
      range.setStart(textNode, segment.start);
      range.setEnd(textNode, segment.end);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0) {
        rects.set(segment, {
          x: rect.left - origin.left,
          width: rect.width,
        });
      }
    }
  } finally {
    range.detach?.();
    probe.remove();
  }

  return rects;
}

function splitTextIntoPlatforms(item, style, viewport, pageOffsetY, pageNumber) {
  const text = item.str || "";
  const segments = textSegments(text);
  if (!segments.some((segment) => !segment.isSeparator)) return [];

  const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const x = transform[4];
  const y = transform[5] + pageOffsetY;
  const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]) || item.height || 10);
  const measuredTextWidth = measureTextWidth(text, fontHeight, style);
  const pdfTextWidth = Math.abs(item.width || 0) * viewport.scale;
  const totalTextWidth = pdfTextWidth || measuredTextWidth || fallbackTextWidth(text, fontHeight);
  const widthScale = measuredTextWidth > 0 ? totalTextWidth / measuredTextWidth : 1;
  const fallbackScale = measuredTextWidth > 0 ? 1 : totalTextWidth / Math.max(estimatedTextWidth(text, fontHeight), 1);
  const segmentRects = measureTextSegmentRects(text, segments, fontHeight, style, totalTextWidth, measuredTextWidth);
  const prefixWidths = new Map([[0, 0]]);
  const prefixWidth = (index) => {
    if (!prefixWidths.has(index)) {
      const prefix = text.slice(0, index);
      const width = measuredTextWidth > 0
        ? measureTextWidth(prefix, fontHeight, style) * widthScale
        : estimatedTextWidth(prefix, fontHeight) * fallbackScale;
      prefixWidths.set(index, width);
    }
    return prefixWidths.get(index);
  };

  return segments.flatMap((segment) => {
    if (segment.isSeparator) return [];
    const measuredSegment = segmentRects?.get(segment);
    const segmentX = x + (measuredSegment?.x ?? prefixWidth(segment.start));
    const segmentWidth = measuredSegment?.width ?? (prefixWidth(segment.end) - prefixWidth(segment.start));
    const platform = {
      x: segmentX,
      y: y - fontHeight * 0.78,
      width: Math.max(config.platformMinWidth, segmentWidth),
      height: Math.max(2, fontHeight * 0.2),
      textHeight: fontHeight,
      page: pageNumber,
      type: "text",
    };
    return [platform];
  });
}

function buildWrapPortals() {
  const portals = [];
  const byPage = new Map();
  for (const platform of world.platforms) {
    if (!byPage.has(platform.page)) byPage.set(platform.page, []);
    byPage.get(platform.page).push(platform);
  }

  for (const [pageNumber, platforms] of byPage) {
    const lines = [];
    for (const platform of [...platforms].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const line = lines.find((item) => Math.abs(item.y - platform.y) <= Math.max(3, platform.textHeight * 0.45));
      if (line) {
        line.platforms.push(platform);
        line.y = (line.y + platform.y) / 2;
      } else {
        lines.push({ y: platform.y, platforms: [platform] });
      }
    }

    lines.sort((a, b) => a.y - b.y);
    lines.forEach((line, index) => {
      const lineId = `${pageNumber}:${index}`;
      for (const platform of line.platforms) {
        platform.lineId = lineId;
      }
    });

    for (let index = 0; index < lines.length - 1; index += 1) {
      const fromLine = lines[index].platforms.sort((a, b) => a.x - b.x);
      const toLine = lines[index + 1].platforms.sort((a, b) => a.x - b.x);
      const from = fromLine.at(-1);
      const to = toLine[0];
      if (!from || !to) continue;

      const portalHeight = from.textHeight;
      const portalWidth = Math.max(4, from.textHeight * 0.55);
      const portalGap = Math.max(2, from.textHeight * 0.16);
      portals.push({
        x: from.x + from.width + portalGap,
        y: from.y + from.height - portalHeight,
        width: portalWidth,
        height: portalHeight,
        page: pageNumber,
        direction: 1,
        sourcePlatform: from,
        targetPlatform: to,
        targetX: to.x,
        targetY: to.y,
        type: "portal",
      });
      portals.push({
        x: to.x - portalGap - portalWidth,
        y: to.y + to.height - portalHeight,
        width: portalWidth,
        height: portalHeight,
        page: pageNumber,
        direction: -1,
        sourcePlatform: to,
        targetPlatform: from,
        targetX: from.x + from.width - player.width,
        targetY: from.y,
        type: "portal",
      });
    }
  }

  world.portals = portals;
}

function renderCollisionLayer() {
  pdfDocument.querySelector(".collision-layer")?.remove();
  world.renderedActivePlatformLineId = null;
  const layer = document.createElement("div");
  layer.className = "collision-layer";

  for (const platform of world.platforms) {
    const shape = document.createElement("div");
    shape.className = "collision-shape";
    shape.dataset.lineId = platform.lineId || "";
    shape.style.transform = `translate(${platform.x}px, ${platform.y}px)`;
    shape.style.width = `${platform.width}px`;
    shape.style.height = `${platform.height}px`;
    layer.append(shape);
  }

  for (const portal of world.portals) {
    const shape = document.createElement("div");
    shape.className = "wrap-portal";
    shape.style.transform = `translate(${portal.x}px, ${portal.y}px)`;
    shape.style.width = `${portal.width}px`;
    shape.style.height = `${portal.height}px`;
    layer.append(shape);
  }

  pdfDocument.insertBefore(layer, playerSprite);
}

function clearPdfDocument() {
  pdfDocument.replaceChildren();
  pdfDocument.append(playerSprite);
}

function setLoadingPdf(isLoading) {
  pdfDocument.classList.toggle("is-loading", isLoading);
  loadingOverlay.classList.toggle("is-hidden", !isLoading);
  loadingOverlay.setAttribute("aria-busy", String(isLoading));
}

async function loadPdf(file) {
  world.loaded = false;
  playerSprite.hidden = true;
  dropZone.classList.add("is-hidden");
  clearPdfDocument();
  setLoadingPdf(true);
  setStatus("readingPdf");
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const firstPage = await pdf.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const availableWidth = Math.max(320, Math.min(1100, window.innerWidth - 36));
  const renderScale = availableWidth / firstViewport.width;

  world.renderWidth = availableWidth;
  world.pages = [];
  world.platforms = [];
  world.portals = [];
  world.activePlatformLineId = null;
  world.minTextHeight = Infinity;

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
    const pagePlatforms = textContent.items.flatMap((item) => (
      splitTextIntoPlatforms(item, textContent.styles[item.fontName], viewport, offsetY, pageNumber)
    ));
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
    setStatus("loadedPage", { page: pageNumber, total: pdf.numPages });
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
  buildWrapPortals();
  renderCollisionLayer();
  resetPlayer();
  setLoadingPdf(false);
  playerSprite.hidden = false;
  updatePageText(1, pdf.numPages);
  setStatus("generatedPlatforms", {
    count: world.platforms.length,
    total: pdf.numPages,
    pageWord: t(pdf.numPages === 1 ? "pageSingular" : "pagePlural"),
  });
  autoCenterPlayer();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function activeCollisionPlatforms() {
  if (!world.loaded) return [];
  const page = world.pages.find((item) => item.y <= player.y + player.height && item.y + item.height >= player.y);
  const activePage = page?.number || world.activePage;
  const playerTop = player.y - 240;
  const playerBottom = player.y + player.height + 240;
  return world.platforms.filter((platform) => {
    const nearPage = Math.abs(platform.page - activePage) <= 1;
    const nearPlayer = platform.y + platform.height >= playerTop && platform.y <= playerBottom;
    return nearPage && nearPlayer;
  });
}

function activeWrapPortals() {
  if (!world.loaded) return [];
  const page = world.pages.find((item) => item.y <= player.y + player.height && item.y + item.height >= player.y);
  const activePage = page?.number || world.activePage;
  const playerTop = player.y - 240;
  const playerBottom = player.y + player.height + 240;
  return world.portals.filter((portal) => {
    const nearPage = Math.abs(portal.page - activePage) <= 1;
    const nearPlayer = portal.y + portal.height >= playerTop && portal.y <= playerBottom;
    return nearPage && nearPlayer;
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

  player.vy = -config.jumpSpeed;
  player.jumpHeld = true;
  player.jumpFrames = 0;
  player.grounded = false;
  player.groundedByViewport = false;
  player.coyote = 0;
}

function startDash() {
  if (player.dashFrames > 0 || player.dashCooldown > 0) return;
  const direction = actionPressed("left") && !actionPressed("right")
    ? -1
    : actionPressed("right") && !actionPressed("left")
      ? 1
      : player.dashDirection || 1;
  player.dashDirection = direction;
  player.dashFrames = config.dashDuration;
  player.dashCooldown = config.dashDuration + 4;
  player.vx = direction * config.dashSpeed;
  player.vy = 0;
  player.grounded = false;
  player.groundedByViewport = false;
}

function collideWithPlatforms(previousY) {
  if (player.dropThrough) return;
  const supportX = player.x + player.width / 2;
  for (const platform of activeCollisionPlatforms()) {
    if (!rectsOverlap(player, platform)) continue;
    const centeredOnPlatform = supportX >= platform.x && supportX <= platform.x + platform.width;
    if (!centeredOnPlatform) continue;
    const wasAbove = previousY + player.height <= platform.y + Math.max(2, platform.height * 0.5);
    if (player.vy >= 0 && wasAbove) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.grounded = true;
      player.groundedByViewport = false;
      world.activePlatformLineId = platform.lineId || world.activePlatformLineId;
    }
  }
}

function playerSupportedByPlatform(platform) {
  if (!platform || player.dropThrough) return false;
  const supportX = player.x + player.width / 2;
  const footY = player.y + player.height;
  const horizontalTolerance = Math.max(1, platform.textHeight * 0.08);
  const verticalTolerance = Math.max(2, platform.height + Math.abs(player.vy) + config.gravity);
  const centeredOnPlatform = supportX >= platform.x - horizontalTolerance && supportX <= platform.x + platform.width + horizontalTolerance;
  const standingOnPlatform = Math.abs(footY - platform.y) <= verticalTolerance;
  return player.grounded && centeredOnPlatform && standingOnPlatform;
}

function useWrapPortal(previousX) {
  for (const portal of activeWrapPortals()) {
    if (Math.sign(player.vx) !== portal.direction) continue;
    if (!playerSupportedByPlatform(portal.sourcePlatform)) continue;
    const portalEdge = portal.direction > 0 ? portal.x : portal.x + portal.width;
    const crossedDoor = portal.direction > 0
      ? previousX + player.width <= portalEdge && player.x + player.width >= portalEdge
      : previousX >= portalEdge && player.x <= portalEdge;
    const verticallyAligned = player.y + player.height >= portal.y && player.y <= portal.y + portal.height;
    if (!crossedDoor || !verticallyAligned) continue;
    player.x = portal.targetX;
    player.y = Math.max(0, portal.targetY - player.height);
    player.vx = portal.direction * Math.min(config.moveSpeed, Math.max(1, Math.abs(player.vx)));
    player.vy = 0;
    player.grounded = true;
    player.groundedByViewport = false;
    world.activePlatformLineId = portal.targetPlatform.lineId || world.activePlatformLineId;
    return true;
  }
  return false;
}

function updateActivePage() {
  const centerY = player.y + player.height / 2;
  const page = world.pages.find((item) => centerY >= item.y && centerY <= item.y + item.height);
  if (page) {
    world.activePage = page.number;
    updatePageText(page.number, world.pages.length);
  }
}

function updatePlayer() {
  const movingLeft = actionPressed("left");
  const movingRight = actionPressed("right");
  const isDashing = player.dashFrames > 0;

  if (isDashing) {
    player.vx = player.dashDirection * config.dashSpeed;
    player.vy = 0;
    player.dashFrames -= 1;
  } else {
    if (movingLeft) player.vx -= config.acceleration;
    if (movingRight) player.vx += config.acceleration;
    if (!movingLeft && !movingRight) player.vx *= config.friction;
    player.vx = Math.max(-config.moveSpeed, Math.min(config.moveSpeed, player.vx));

    player.vy = Math.min(config.maxFall, player.vy + config.gravity);
    if (player.jumpHeld && !player.dropThrough && player.vy < 0 && player.jumpFrames < config.maxJumpFrames) {
      player.vy -= config.jumpHoldForce;
      player.jumpFrames += 1;
    }
  }

  player.dashCooldown = Math.max(0, player.dashCooldown - 1);

  const previousX = player.x;
  player.x += player.vx;
  player.x = Math.max(0, Math.min(world.cssWidth - player.width, player.x));
  const usedPortal = useWrapPortal(previousX);

  const wasGrounded = player.grounded;
  const previousY = player.y;
  if (!usedPortal) {
    player.grounded = false;
    player.groundedByViewport = false;
    player.y += player.vy;
  }
  player.y = Math.max(0, Math.min(world.cssHeight - player.height, player.y));
  if (player.y + player.height >= world.cssHeight) {
    player.vy = 0;
    player.grounded = true;
  }

  collideWithPlatforms(previousY);
  player.coyote = player.grounded ? 8 : Math.max(0, player.coyote - 1);
  if (wasGrounded && !player.grounded) player.coyote = 8;

  if (autoScrollEnabled) keepPlayerInVisibleWindow();
  updateActivePage();
  autoCenterPlayer();
}

function renderPlayer() {
  playerSprite.style.width = `${player.width}px`;
  playerSprite.style.height = `${player.height}px`;
  playerSprite.style.transform = `translate(${player.x}px, ${player.y}px)`;
  playerSprite.classList.toggle("is-grounded", player.grounded);
  playerSprite.classList.toggle("is-facing-right", player.vx >= 0);
  pdfDocument.classList.toggle("show-collisions", collisionsVisible);
  if (world.renderedActivePlatformLineId === world.activePlatformLineId) return;
  for (const shape of pdfDocument.querySelectorAll(".collision-shape")) {
    shape.classList.toggle("is-line-highlighted", shape.dataset.lineId === world.activePlatformLineId);
  }
  world.renderedActivePlatformLineId = world.activePlatformLineId;
}

function markManualScrollIntent() {
  if (!world.loaded) return;
  autoScrollEnabled = false;
}

function restartAutoScroll() {
  if (!world.loaded) return;
  autoScrollEnabled = true;
  autoCenterPlayer();
}

function teleportPlayerToClick(event) {
  if (!world.loaded || event.button !== 0) return;
  const stageRect = readerStage.getBoundingClientRect();
  if (
    event.clientX < stageRect.left ||
    event.clientX > stageRect.right ||
    event.clientY < stageRect.top ||
    event.clientY > stageRect.bottom
  ) {
    return;
  }

  const offset = documentPageOffset();
  const viewport = viewportPageRect();
  player.x = event.clientX + viewport.left - offset.left - player.width / 2;
  player.y = event.clientY + viewport.top - offset.top - player.height / 2;
  player.x = Math.max(0, Math.min(world.cssWidth - player.width, player.x));
  player.y = Math.max(0, Math.min(world.cssHeight - player.height, player.y));
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.groundedByViewport = false;
  player.jumpHeld = false;
  player.jumpFrames = 0;
  player.dropThrough = false;
  player.coyote = 0;
  player.dashFrames = 0;
  player.dashCooldown = 0;
  restartAutoScroll();
  updateActivePage();
  renderPlayer();
}

function activeGamepad() {
  const gamepads = navigator.getGamepads?.() || [];
  return Array.from(gamepads).find(Boolean) || null;
}

function pressedGamepadButtons(gamepad) {
  const pressed = new Set();
  if (!gamepad) return pressed;
  gamepad.buttons.forEach((button, index) => {
    if (button.pressed || button.value > 0.5) pressed.add(index);
  });
  return pressed;
}

function updateControllerInput() {
  const gamepad = activeGamepad();
  const pressedButtons = pressedGamepadButtons(gamepad);
  const axisX = gamepad?.axes?.[0] || 0;
  const axisY = gamepad?.axes?.[1] || 0;
  const deadzone = 0.35;

  controllerDirections.left = axisX < -deadzone;
  controllerDirections.right = axisX > deadzone;
  controllerDirections.up = axisY < -deadzone;
  controllerDirections.down = axisY > deadzone;

  controllerButtons.clear();
  pressedButtons.forEach((button) => controllerButtons.add(button));

  if (remappingDevice === "controller" && remappingAction) {
    const selectedButton = [...pressedButtons].find((button) => !controllerRemapBaseline.has(button));
    if (selectedButton !== undefined) {
      for (const action of Object.keys(controllerMap)) {
        controllerMap[action] = controllerMap[action].filter((button) => button !== selectedButton);
      }
      controllerMap[remappingAction] = [selectedButton];
      remappingAction = null;
      remappingDevice = null;
      controllerRemapBaseline = new Set();
      updateControlLabels();
    }
  } else {
    const jumpPressed = controllerMap.jump.some((button) => controllerButtons.has(button));
    const jumpWasPressed = controllerMap.jump.some((button) => previousControllerButtons.has(button));
    const dashPressed = controllerMap.dash.some((button) => controllerButtons.has(button));
    const dashWasPressed = controllerMap.dash.some((button) => previousControllerButtons.has(button));

    if (jumpPressed && !jumpWasPressed) {
      restartAutoScroll();
      startJump();
    }
    if (dashPressed && !dashWasPressed) {
      restartAutoScroll();
      startDash();
    }
    if (!jumpPressed && jumpWasPressed) {
      player.jumpHeld = false;
      player.dropThrough = false;
      if (player.vy < 0) player.vy = 0;
    }
  }

  previousControllerButtons.clear();
  pressedButtons.forEach((button) => previousControllerButtons.add(button));
}

function tick() {
  updateControllerInput();
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
    setLoadingPdf(false);
    world.loaded = false;
    playerSprite.hidden = true;
    setStatus("pdfReadError");
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

collisionButton.addEventListener("click", () => {
  collisionsVisible = !collisionsVisible;
  updateCollisionButtonLabel();
  collisionButton.setAttribute("aria-pressed", String(collisionsVisible));
  renderPlayer();
});

languageSelect.addEventListener("change", () => {
  localStorage.setItem("bladeOfReadersLanguage", languageSelect.value);
  applyLanguage(languageSelect.value);
});

controlsPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-action]");
  if (!button) return;
  remappingAction = button.dataset.mapAction;
  remappingDevice = button.dataset.mapDevice;
  controllerRemapBaseline = remappingDevice === "controller"
    ? pressedGamepadButtons(activeGamepad())
    : new Set();
  updateControlLabels();
});

window.addEventListener("keydown", (event) => {
  if (remappingDevice === "keyboard" && remappingAction) {
    event.preventDefault();
    for (const action of Object.keys(keyMap)) {
      keyMap[action] = keyMap[action].filter((code) => code !== event.code);
    }
    keyMap[remappingAction] = [event.code];
    remappingAction = null;
    remappingDevice = null;
    updateControlLabels();
    return;
  }

  const isControlKey = Object.values(keyMap).flat().includes(event.code);
  if (["PageDown", "PageUp", "Home", "End"].includes(event.code)) markManualScrollIntent();
  if (isControlKey) {
    event.preventDefault();
    restartAutoScroll();
  }
  if (!keys.has(event.code) && keyMap.jump.includes(event.code)) startJump();
  if (!keys.has(event.code) && keyMap.dash.includes(event.code)) startDash();
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
  if (performance.now() < programmaticScrollUntil) return;
  markManualScrollIntent();
}, { passive: true });

window.addEventListener("resize", () => {
  if (!world.loaded) return;
  keepPlayerInVisibleWindow();
});

window.addEventListener("wheel", markManualScrollIntent, { passive: true });
window.addEventListener("touchmove", markManualScrollIntent, { passive: true });
window.addEventListener("pointerdown", teleportPlayerToClick);

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (!world.loaded) return;
    keepPlayerInVisibleWindow();
  });
  window.visualViewport.addEventListener("scroll", () => {
    if (performance.now() < programmaticScrollUntil) return;
    markManualScrollIntent();
  });
}

applyLanguage(detectLanguage());
setDocumentSize();
resetPlayer();
tick();
