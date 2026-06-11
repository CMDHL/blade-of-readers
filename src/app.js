import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const pdfDocument = document.querySelector("#pdfDocument");
const topbar = document.querySelector(".topbar");
const topbarToggleButton = document.querySelector("#topbarToggleButton");
const readerStage = document.querySelector(".reader-stage");
const playerSprite = document.querySelector("#playerSprite");
const input = document.querySelector("#pdfInput");
const downloadAnnotatedButton = document.querySelector("#downloadAnnotatedButton");
const annotationSidebar = document.querySelector("#annotationSidebar");
const annotationList = document.querySelector("#annotationList");
const annotationModeLabel = document.querySelector("#annotationModeLabel");
const annotationRadial = document.querySelector("#annotationRadial");
const resetButton = document.querySelector("#resetButton");
const controlsPanel = document.querySelector("#controlsPanel");
const collisionButton = document.querySelector("#collisionButton");
const messageAnnotationsButton = document.querySelector("#messageAnnotationsButton");
const languageSelect = document.querySelector("#languageSelect");
const dropZone = document.querySelector("#dropZone");
const loadingOverlay = document.querySelector("#loadingOverlay");
const statusText = document.querySelector("#statusText");
const pageText = document.querySelector("#pageText");
const messageDialog = document.querySelector("#messageDialog");
const messageDialogText = document.querySelector("#messageDialogText");

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_SRC;

const {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFArray,
  PDFHexString,
  PDFString,
} = window.PDFLib || {};

const punctuationPattern = /[\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+/u;
const textSegmentPattern = /[\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+|[^\s.,;:!?()[\]{}"'`~@#$%^&*_+=<>/\\|，。？！、；：（）【】《》“”‘’—…·「」『』]+/gu;
const textMeasureContext = document.createElement("canvas").getContext("2d");
const SPAWN_ANNOTATION_COMMENT = "[spawn]";

const keyMap = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  jump: ["Space", "KeyZ"],
  dash: ["ShiftLeft", "ShiftRight", "KeyC"],
  interact: ["KeyE"],
  attack: ["KeyX"],
  copySelection: ["KeyV"],
  highlightSelection: ["KeyH"],
  commentSelection: ["KeyJ"],
};

const controllerMap = {
  jump: [0],
  attack: [2],
  dash: [7],
  interact: [1],
  menu: [8],
};

const controllerDpadButtons = {
  up: 12,
  down: 13,
  left: 14,
  right: 15,
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
  annotations: [],
  messageAnnotations: [],
  removedPdfAnnotations: [],
  loaded: false,
  renderWidth: 900,
  pageGap: 28,
  minTextHeight: 16,
  activePage: 1,
  activePlatformLineId: null,
  renderedActivePlatformLineId: null,
  spawnPlatformReadingIndex: null,
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
  facingDirection: 1,
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
  bladeDurationMs: 150,
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
const previousControllerDirections = {
  left: false,
  right: false,
  up: false,
  down: false,
};
let remappingAction = null;
let remappingDevice = null;
let controllerRemapBaseline = new Set();
let collisionsVisible = false;
let messageAnnotationsVisible = true;
let autoScrollEnabled = true;
let programmaticScrollUntil = 0;
let currentLanguage = "en";
let currentStatus = { key: "waiting", values: {} };
let currentPageText = { page: 1, total: null };
let currentPdfBytes = null;
let currentPdfName = "document.pdf";
let topbarHidden = false;
let annotationMenuMode = false;
let selectedAnnotationIndex = 0;
let nextAnnotationOrder = 0;
let annotationRadialActive = false;
let annotationRadialChoice = null;
let activeMessageAnnotationId = null;
let messageDialogChoiceIndex = 0;
const textSelection = {
  anchorPlatform: null,
  startIndex: null,
  endIndex: null,
};
let activeBladeSwing = null;
const teleportSuppressedPointerEvents = new WeakSet();

const translations = {
  en: {
    appName: "Blade of Readers",
    tagline: "Convert complicated articles into simple platformer levels.",
    languageLabel: "Language",
    uploadPdf: "Upload PDF",
    copySelection: "Copy",
    highlightSelection: "Highlight",
    commentSelection: "Comment",
    downloadAnnotated: "Download Annotated PDF",
    hideTopbar: "Hide Top",
    showTopbar: "Show Top",
    hideCollisions: "Hide Collisions",
    showCollisions: "Show Collisions",
    hideMessages: "Hide Messages",
    showMessages: "Show Messages",
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
    interact: "Interact",
    attack: "Attack",
    menu: "Menu",
    annotationActions: "Actions",
    radialControl: "LB + right stick",
    annotationsLabel: "Annotations",
    gameMode: "Game",
    menuMode: "Menu",
    noAnnotations: "No annotations yet.",
    highlightEntry: "Highlight",
    commentEntry: "Comment",
    pageEntry: "Page {page}",
    pdfAnnotationEntry: "PDF annotation",
    menuModeOn: "Annotation menu active.",
    menuModeOff: "Game controls active.",
    annotationFocused: "Focused annotation {index} of {total}.",
    annotationDeleted: "Annotation deleted.",
    readerStageLabel: "PDF platformer",
    dropTitle: "Upload a PDF to generate the level",
    dropDescription: "Words and punctuation-separated chunks become invisible platforms at the text itself.",
    keysHelp: "Attack selects text. E or B opens messages. V/H/J or LB + right stick handles copy, highlight, and comment. Click entries to jump, attack in menu mode removes one.",
    messageDialogTitle: "Message",
    closeMessage: "Close",
    goodMessage: "Good",
    badMessage: "Bad",
    messageOpened: "Message opened.",
    messageChoiceSaved: "{choice} response recorded.",
    messageChoiceGood: "Good",
    messageChoiceBad: "Bad",
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
    copiedSelection: "Copied selected text.",
    copyError: "Could not copy selected text.",
    highlightAdded: "Highlight added.",
    commentAdded: "Comment added.",
    commentPrompt: "Comment for selected text:",
    writingPdf: "Writing annotated PDF...",
    annotatedPdfReady: "Annotated PDF downloaded.",
    pdfWriteError: "Could not write annotations into that PDF.",
    pdfLibMissing: "PDF annotation export is still loading. Try again in a moment.",
    pressKey: "Press a key",
    pressButton: "Press button",
  },
  zh: {
    appName: "读者之刃",
    tagline: "把晦涩的文章变成简单的平台跳跃游戏。",
    languageLabel: "语言",
    uploadPdf: "上传 PDF",
    copySelection: "复制",
    highlightSelection: "高亮",
    commentSelection: "评论",
    downloadAnnotated: "下载批注 PDF",
    hideTopbar: "隐藏顶部",
    showTopbar: "显示顶部",
    hideCollisions: "隐藏碰撞",
    showCollisions: "显示碰撞",
    hideMessages: "隐藏消息",
    showMessages: "显示消息",
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
    interact: "互动",
    attack: "攻击",
    menu: "菜单",
    annotationActions: "操作",
    radialControl: "LB + 右摇杆",
    annotationsLabel: "批注",
    gameMode: "游戏",
    menuMode: "菜单",
    noAnnotations: "还没有批注。",
    highlightEntry: "高亮",
    commentEntry: "评论",
    pageEntry: "第 {page} 页",
    pdfAnnotationEntry: "PDF 批注",
    menuModeOn: "批注菜单已激活。",
    menuModeOff: "游戏控制已激活。",
    annotationFocused: "已定位第 {index} 条批注，共 {total} 条。",
    annotationDeleted: "已删除批注。",
    readerStageLabel: "PDF 平台关卡",
    dropTitle: "上传 PDF 生成关卡",
    dropDescription: "单词和由标点分隔的文本片段会在原文位置变成隐形平台。",
    keysHelp: "攻击选择文字。E 或 B 打开消息。V/H/J 或 LB + 右摇杆可复制、高亮、评论。点击条目可跳转，攻击删除条目。",
    messageDialogTitle: "消息",
    closeMessage: "关闭",
    goodMessage: "赞同",
    badMessage: "反对",
    messageOpened: "已打开消息。",
    messageChoiceSaved: "已记录{choice}回应。",
    messageChoiceGood: "赞同",
    messageChoiceBad: "反对",
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
    copiedSelection: "已复制选中的文字。",
    copyError: "无法复制选中的文字。",
    highlightAdded: "已添加高亮。",
    commentAdded: "已添加评论。",
    commentPrompt: "给选中文字添加评论：",
    writingPdf: "正在写入批注 PDF...",
    annotatedPdfReady: "已下载批注 PDF。",
    pdfWriteError: "无法把批注写入这个 PDF。",
    pdfLibMissing: "PDF 批注导出还在加载，请稍后再试。",
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

function updateMessageAnnotationsButtonLabel() {
  messageAnnotationsButton.textContent = messageAnnotationsVisible ? t("hideMessages") : t("showMessages");
}

function updateTopbarToggleButton() {
  const key = topbarHidden ? "showTopbar" : "hideTopbar";
  topbarToggleButton.dataset.i18n = key;
  topbarToggleButton.textContent = t(key);
  topbarToggleButton.setAttribute("aria-label", t(key));
  topbarToggleButton.setAttribute("aria-expanded", String(!topbarHidden));
}

function setTopbarHidden(isHidden) {
  topbarHidden = isHidden;
  topbar.classList.toggle("is-hidden", topbarHidden);
  updateTopbarToggleButton();
  updateStickyTopbarHeight();
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
  updateMessageAnnotationsButtonLabel();
  updateTopbarToggleButton();
  updateControlLabels();
  updateAnnotationControls();
  renderAnnotationSidebar();
  renderAnnotationRadial();
  renderMessageDialog();
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
  updateStickyTopbarHeight();
}

function updateStickyTopbarHeight() {
  const height = topbarHidden ? 0 : Math.ceil(topbar?.getBoundingClientRect().height || 0);
  document.documentElement.style.setProperty("--sticky-topbar-height", `${height}px`);
}

function readerStageAvailableWidth() {
  const stageWidth = readerStage.getBoundingClientRect().width;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const shellPadding = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shell-inline-padding")) || 0;
  const fallbackWidth = Math.max(1, viewportWidth - shellPadding * 2);
  return Math.max(1, Math.floor(Math.min(1100, stageWidth || fallbackWidth)));
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
  const spawnPlatform = platformAtReadingIndex(world.spawnPlatformReadingIndex);
  const firstPlatform = world.platforms.find((platform) => platform.page === 1);
  const startPlatform = spawnPlatform || firstPlatform;
  const x = spawnPlatform
    ? spawnPlatform.x + spawnPlatform.width / 2 - player.width / 2
    : startPlatform?.x;
  player.x = startPlatform ? Math.max(0, Math.min(world.cssWidth - player.width, x)) : 72;
  player.y = startPlatform
    ? Math.max(0, startPlatform.y - player.height - (spawnPlatform ? 0 : 4))
    : 80;
  player.vx = 0;
  player.vy = 0;
  player.grounded = Boolean(spawnPlatform);
  player.groundedByViewport = false;
  player.jumpHeld = false;
  player.jumpFrames = 0;
  player.dropThrough = false;
  player.coyote = 0;
  player.dashFrames = 0;
  player.dashCooldown = 0;
  player.facingDirection = 1;
  if (spawnPlatform) world.activePlatformLineId = spawnPlatform.lineId || world.activePlatformLineId;
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

function splitTextIntoPlatforms(item, style, viewport, pageOffsetY, pageNumber, textItemId, textItemOrder, textLineOrder) {
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

  return segments.flatMap((segment, segmentOrder) => {
    if (segment.isSeparator) return [];
    const measuredSegment = segmentRects?.get(segment);
    const segmentX = x + (measuredSegment?.x ?? prefixWidth(segment.start));
    const segmentWidth = measuredSegment?.width ?? (prefixWidth(segment.end) - prefixWidth(segment.start));
    const boundsY = y - fontHeight * 0.9;
    const platform = {
      x: segmentX,
      y: boundsY,
      width: Math.max(config.platformMinWidth, segmentWidth),
      height: fontHeight * 1.08,
      textHeight: fontHeight,
      text: segment.text,
      sourceText: text,
      textStart: segment.start,
      textEnd: segment.end,
      textItemId,
      textItemOrder,
      textSegmentOrder: segmentOrder,
      textLineOrder,
      page: pageNumber,
      type: "text",
    };
    return [platform];
  });
}

function platformsInTextOrder(platforms) {
  return [...platforms].sort((a, b) => (
    (a.textItemOrder ?? 0) - (b.textItemOrder ?? 0)
    || (a.textSegmentOrder ?? 0) - (b.textSegmentOrder ?? 0)
    || a.y - b.y
    || a.x - b.x
  ));
}

function platformTextHeight(platforms) {
  const heights = platforms.map((platform) => platform.textHeight).filter(Number.isFinite);
  return heights.length ? Math.max(...heights) : world.minTextHeight || 16;
}

function lineFromPlatforms(pageNumber, platforms, lineOrder) {
  const left = Math.min(...platforms.map((platform) => platform.x));
  const right = Math.max(...platforms.map((platform) => platform.x + platform.width));
  const top = Math.min(...platforms.map((platform) => platform.y));
  const bottom = Math.max(...platforms.map((platform) => platform.y + platform.height));
  return {
    page: pageNumber,
    x: left,
    y: top,
    right,
    width: right - left,
    height: bottom - top,
    textHeight: platformTextHeight(platforms),
    lineOrder,
    platforms: platformsInTextOrder(platforms),
  };
}

function pagePlatformLines(pageNumber, platforms) {
  const lines = new Map();
  for (const platform of platformsInTextOrder(platforms)) {
    if (!Number.isFinite(platform.textLineOrder)) continue;
    if (!lines.has(platform.textLineOrder)) lines.set(platform.textLineOrder, []);
    lines.get(platform.textLineOrder).push(platform);
  }

  return [...lines.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineOrder, linePlatforms]) => lineFromPlatforms(pageNumber, linePlatforms, lineOrder));
}

function platformLinesInReadingOrder() {
  const lines = [];
  const byPage = new Map();
  for (const platform of world.platforms) {
    if (!byPage.has(platform.page)) byPage.set(platform.page, []);
    byPage.get(platform.page).push(platform);
  }

  for (const [pageNumber, platforms] of [...byPage.entries()].sort(([a], [b]) => a - b)) {
    pagePlatformLines(pageNumber, platforms).forEach((line, index) => {
      const lineId = `${pageNumber}:${index}`;
      line.lineId = lineId;
      line.lineOrder = index;
      line.platforms = platformsInTextOrder(line.platforms);
      for (const [wordIndex, platform] of line.platforms.entries()) {
        platform.lineId = lineId;
        platform.lineOrder = index;
        platform.lineWordOrder = wordIndex;
      }
      lines.push(line);
    });
  }

  return lines;
}

function portalLandingX(targetPlatform, direction) {
  const edgeX = direction > 0
    ? targetPlatform.x
    : targetPlatform.x + targetPlatform.width - player.width;
  return Math.max(0, Math.min(world.cssWidth - player.width, edgeX));
}

function addWrapPortal(portals, sourcePlatform, targetPlatform, direction) {
  const portalHeight = sourcePlatform.textHeight;
  const portalWidth = Math.max(4, sourcePlatform.textHeight * 0.55);
  const portalAttachOverlap = Math.max(1, sourcePlatform.textHeight * 0.05);
  const portalStandOverlap = Math.max(2, portalHeight * 0.2);
  const sourceEdge = direction > 0
    ? sourcePlatform.x + sourcePlatform.width
    : sourcePlatform.x;
  const portalX = direction > 0
    ? sourceEdge - portalAttachOverlap
    : sourceEdge - portalWidth;

  portals.push({
    x: portalX,
    y: sourcePlatform.y - portalHeight + portalStandOverlap,
    width: portalWidth + portalAttachOverlap,
    height: portalHeight,
    page: sourcePlatform.page,
    direction,
    sourcePlatform,
    targetPlatform,
    targetX: portalLandingX(targetPlatform, direction),
    targetY: targetPlatform.y,
    triggerX: sourceEdge,
    type: "portal",
  });
}

function buildWrapPortals() {
  const portals = [];
  const lines = platformLinesInReadingOrder();

  for (let index = 0; index < lines.length - 1; index += 1) {
    const from = lines[index].platforms.at(-1);
    const to = lines[index + 1].platforms[0];
    if (!from || !to) continue;
    addWrapPortal(portals, from, to, 1);
    addWrapPortal(portals, to, from, -1);
  }

  world.portals = portals;
}

function assignPlatformReadingOrder() {
  [...world.platforms]
    .sort((a, b) => (
      a.page - b.page
      || (a.lineOrder ?? 0) - (b.lineOrder ?? 0)
      || (a.lineWordOrder ?? 0) - (b.lineWordOrder ?? 0)
      || a.x - b.x
    ))
    .forEach((platform, index) => {
      platform.readingIndex = index;
    });
}

function hasTextSelection() {
  return textSelection.startIndex !== null && textSelection.endIndex !== null;
}

function selectedPlatforms() {
  if (!hasTextSelection()) return [];
  const startIndex = Math.min(textSelection.startIndex, textSelection.endIndex);
  const endIndex = Math.max(textSelection.startIndex, textSelection.endIndex);
  return world.platforms.filter((platform) => (
    Number.isFinite(platform.readingIndex)
    && platform.readingIndex >= startIndex
    && platform.readingIndex <= endIndex
  ));
}

function lineGroupsForPlatforms(platforms) {
  const lines = new Map();

  for (const platform of platforms) {
    const key = `${platform.page}:${platform.lineOrder ?? platform.lineId ?? platform.readingIndex}`;
    if (!lines.has(key)) {
      lines.set(key, {
        page: platform.page,
        lineOrder: platform.lineOrder ?? 0,
        platforms: [],
      });
    }
    lines.get(key).platforms.push(platform);
  }

  return [...lines.values()]
    .sort((a, b) => a.page - b.page || a.lineOrder - b.lineOrder)
    .map((group) => ({
      ...group,
      platforms: platformsInTextOrder(group.platforms),
    }));
}

function textFromPlatformLineGroup(group) {
  let lineText = "";
  group.platforms.forEach((platform, index) => {
    lineText += platform.text || "";
    const nextPlatform = group.platforms[index + 1];
    if (!nextPlatform) return;
    if (
      platform.textItemId
      && platform.textItemId === nextPlatform.textItemId
      && platform.sourceText === nextPlatform.sourceText
      && Number.isFinite(platform.textEnd)
      && Number.isFinite(nextPlatform.textStart)
    ) {
      lineText += platform.sourceText.slice(platform.textEnd, nextPlatform.textStart);
    } else {
      lineText += " ";
    }
  });
  return lineText.trim();
}

function textFromPlatforms(platforms) {
  return lineGroupsForPlatforms(platforms)
    .map(textFromPlatformLineGroup)
    .filter(Boolean)
    .join("\n");
}

function annotationStableOrder(annotation) {
  if (!Number.isFinite(annotation.sortOrder)) {
    annotation.sortOrder = nextAnnotationOrder;
    nextAnnotationOrder += 1;
  }
  return annotation.sortOrder;
}

function readingIndexRange(platforms) {
  const indexes = platforms
    .map((platform) => platform.readingIndex)
    .filter(Number.isFinite);
  if (!indexes.length) return null;
  return {
    start: Math.min(...indexes),
    end: Math.max(...indexes),
  };
}

function setAnnotationPlatformRange(annotation, platforms) {
  const range = readingIndexRange(platforms);
  if (range && annotation) {
    annotation.startReadingIndex = range.start;
    annotation.endReadingIndex = range.end;
  }
  return range;
}

function annotationReadingIndexRange(annotation) {
  if (
    Number.isFinite(annotation?.startReadingIndex)
    && Number.isFinite(annotation?.endReadingIndex)
  ) {
    return {
      start: annotation.startReadingIndex,
      end: annotation.endReadingIndex,
    };
  }

  return setAnnotationPlatformRange(annotation, platformsFromAnnotationRects(annotation?.rects || []));
}

function annotationPlatforms(annotation) {
  const range = annotationReadingIndexRange(annotation);
  if (range) {
    return world.platforms.filter((platform) => (
      Number.isFinite(platform.readingIndex)
      && platform.readingIndex >= range.start
      && platform.readingIndex <= range.end
    ));
  }
  return platformsFromAnnotationRects(annotation?.rects || []);
}

function platformAtReadingIndex(readingIndex) {
  if (!Number.isFinite(readingIndex)) return null;
  return world.platforms.find((platform) => platform.readingIndex === readingIndex) || null;
}

function annotationStartPlatform(annotation) {
  const range = annotationReadingIndexRange(annotation);
  const rangeStartPlatform = platformAtReadingIndex(range?.start);
  if (rangeStartPlatform) return rangeStartPlatform;

  return annotationPlatforms(annotation).reduce((first, platform) => {
    if (!Number.isFinite(platform.readingIndex)) return first;
    if (!first || platform.readingIndex < first.readingIndex) return platform;
    return first;
  }, null);
}

function firstAnnotationRect(annotation) {
  return [...(annotation?.rects || [])]
    .filter((rect) => Number.isFinite(rect.page) && Number.isFinite(rect.x) && Number.isFinite(rect.y))
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)[0] || null;
}

function annotationStartRect(annotation) {
  const platform = annotationStartPlatform(annotation);
  if (platform) {
    return {
      page: platform.page,
      x: platform.x,
      y: platform.y,
      width: platform.width,
      height: platform.height,
    };
  }
  return firstAnnotationRect(annotation);
}

function annotationStartLocation(annotation) {
  const platform = annotationStartPlatform(annotation);
  if (platform) {
    return {
      page: platform.page,
      y: platform.y,
      x: platform.x,
      readingIndex: platform.readingIndex,
      order: annotationStableOrder(annotation),
    };
  }

  const rect = firstAnnotationRect(annotation);
  return {
    page: rect?.page ?? Number.POSITIVE_INFINITY,
    y: rect?.y ?? Number.POSITIVE_INFINITY,
    x: rect?.x ?? Number.POSITIVE_INFINITY,
    readingIndex: Number.POSITIVE_INFINITY,
    order: annotationStableOrder(annotation),
  };
}

function compareAnnotationsByStart(a, b) {
  const startA = annotationStartLocation(a);
  const startB = annotationStartLocation(b);
  const hasReadingIndexA = Number.isFinite(startA.readingIndex);
  const hasReadingIndexB = Number.isFinite(startB.readingIndex);
  if (hasReadingIndexA && hasReadingIndexB && startA.readingIndex !== startB.readingIndex) {
    return startA.readingIndex - startB.readingIndex;
  }
  if (hasReadingIndexA !== hasReadingIndexB) return hasReadingIndexA ? -1 : 1;

  return startA.page - startB.page
    || startA.order - startB.order;
}

function sortAnnotationsByStart(preserveId = null) {
  world.annotations.forEach(annotationStableOrder);
  world.annotations.sort(compareAnnotationsByStart);
  if (preserveId) {
    const selectedIndex = world.annotations.findIndex((annotation) => annotation.id === preserveId);
    if (selectedIndex >= 0) selectedAnnotationIndex = selectedIndex;
  }
}

function isSpawnAnnotationComment(comment) {
  return comment === SPAWN_ANNOTATION_COMMENT;
}

function isSpawnAnnotation(annotation) {
  return isSpawnAnnotationComment(annotation?.comment);
}

function isVisibleAnnotation(annotation) {
  return !isSpawnAnnotation(annotation);
}

function visibleAnnotationEntries() {
  return world.annotations
    .map((annotation, index) => ({ annotation, index }))
    .filter(({ annotation }) => isVisibleAnnotation(annotation));
}

function markPdfAnnotationForRemoval(annotation) {
  if (annotation?.source !== "pdf") return;

  const removal = {
    page: annotation.pdfPage || annotationFirstPage(annotation),
    id: annotation.pdfId || annotation.id || "",
    rect: annotation.pdfRect || [],
    quadPoints: annotation.pdfQuadPoints || [],
  };
  const alreadyMarked = world.removedPdfAnnotations.some((item) => (
    item.page === removal.page
    && (
      (removal.id && item.id === removal.id)
      || nearlyEqualNumberArray(item.rect, removal.rect)
      || nearlyEqualNumberArray(item.quadPoints, removal.quadPoints)
    )
  ));
  if (!alreadyMarked) world.removedPdfAnnotations.push(removal);
}

function syncSpawnPlatformFromAnnotations() {
  const spawnAnnotation = world.annotations.find(isSpawnAnnotation);
  const platform = annotationStartPlatform(spawnAnnotation);
  world.spawnPlatformReadingIndex = Number.isFinite(platform?.readingIndex)
    ? platform.readingIndex
    : null;
  return spawnAnnotation || null;
}

function enforceUniqueSpawnAnnotation() {
  const spawnAnnotations = world.annotations.filter(isSpawnAnnotation);
  if (!spawnAnnotations.length) {
    world.spawnPlatformReadingIndex = null;
    return null;
  }

  const sortedSpawns = [...spawnAnnotations].sort(compareAnnotationsByStart);
  const keptAnnotation = sortedSpawns.at(-1);
  const removedAnnotations = new Set(sortedSpawns.slice(0, -1));

  for (const annotation of removedAnnotations) {
    markPdfAnnotationForRemoval(annotation);
  }

  if (removedAnnotations.size) {
    world.annotations = world.annotations.filter((annotation) => !removedAnnotations.has(annotation));
    clampSelectedAnnotationIndex();
  }

  const platform = annotationStartPlatform(keptAnnotation);
  world.spawnPlatformReadingIndex = Number.isFinite(platform?.readingIndex)
    ? platform.readingIndex
    : null;
  return keptAnnotation;
}

function setSpawnAnnotationPlatform(platform) {
  if (!platform || !Number.isFinite(platform.readingIndex)) return null;

  const range = readingIndexRange([platform]);
  const rects = rectsForLineGroups(lineGroupsForPlatforms([platform]));
  if (!range || !rects.length) return null;

  let annotation = enforceUniqueSpawnAnnotation();
  if (!annotation) {
    annotation = {
      id: createAnnotationId(),
      type: "highlight",
      source: "session",
      sortOrder: nextAnnotationOrder,
      createdAt: new Date().toISOString(),
    };
    nextAnnotationOrder += 1;
    world.annotations.push(annotation);
  } else {
    markPdfAnnotationForRemoval(annotation);
  }

  annotation.type = "highlight";
  annotation.text = platform.text || "";
  annotation.comment = SPAWN_ANNOTATION_COMMENT;
  annotation.rects = rects;
  annotation.startReadingIndex = range.start;
  annotation.endReadingIndex = range.end;
  world.spawnPlatformReadingIndex = platform.readingIndex;
  sortAnnotationsByStart(annotation.id);
  return annotation;
}

function rectsForLineGroups(lineGroups) {
  return lineGroups.flatMap((group) => {
    if (!group.platforms.length) return [];
    const textHeight = Math.max(...group.platforms.map((platform) => platform.textHeight || world.minTextHeight));
    const paddingX = Math.max(1, textHeight * 0.07);
    const left = Math.min(...group.platforms.map((platform) => platform.x));
    const right = Math.max(...group.platforms.map((platform) => platform.x + platform.width));
    const top = Math.min(...group.platforms.map((platform) => platform.y));
    const bottom = Math.max(...group.platforms.map((platform) => platform.y + platform.height));
    const x = Math.max(0, left - paddingX);
    const width = Math.max(1, Math.min(world.cssWidth, right + paddingX) - x);
    const y = Math.max(0, top);
    const height = Math.max(2, bottom - y);
    return [{
      page: group.page,
      x,
      y,
      width,
      height,
    }];
  });
}

function parseMessageAnnotationComment(comment) {
  const match = String(comment || "").match(/^\[msg\|(\d+)\|(\d+)(?:\|([+-]))?\]([\s\S]*)$/u);
  if (!match) return null;
  return {
    goodBase: Number.parseInt(match[1], 10),
    badBase: Number.parseInt(match[2], 10),
    choice: match[3] === "+" ? "good" : match[3] === "-" ? "bad" : null,
    text: match[4],
  };
}

function messageChoiceSymbol(choice) {
  if (choice === "good") return "+";
  if (choice === "bad") return "-";
  return "";
}

function formatMessageAnnotationComment(annotation) {
  const choice = messageChoiceSymbol(annotation.messageChoice);
  const choiceTag = choice ? `|${choice}` : "";
  return `[msg|${annotation.messageGoodBase}|${annotation.messageBadBase}${choiceTag}]${annotation.messageText || ""}`;
}

function messageDisplayCounts(annotation) {
  return {
    good: annotation.messageGoodBase + (annotation.messageChoice === "good" ? 1 : 0),
    bad: annotation.messageBadBase + (annotation.messageChoice === "bad" ? 1 : 0),
  };
}

function messageVoteChanged(annotation) {
  return annotation.messageChoice !== annotation.messageOriginalChoice;
}

function selectedText() {
  return textFromPlatforms(selectedPlatforms());
}

function updateAnnotationControls() {
  const canUseSelection = world.loaded && hasTextSelection();
  annotationRadial?.querySelectorAll(".annotation-radial-option").forEach((option) => {
    option.classList.toggle("is-disabled", !canUseSelection);
  });
  downloadAnnotatedButton.disabled = !currentPdfBytes;
}

function clearTextSelection({ render = true } = {}) {
  textSelection.anchorPlatform = null;
  textSelection.startIndex = null;
  textSelection.endIndex = null;
  updateAnnotationControls();
  if (render) renderSelectionLayer();
}

function renderSelectionLayer() {
  pdfDocument.querySelector(".selection-layer")?.remove();
  if (!world.loaded || !hasTextSelection()) return;

  const selectionPlatforms = selectedPlatforms();
  if (!selectionPlatforms.length) return;
  const layer = document.createElement("div");
  layer.className = "selection-layer";

  for (const { x, y, width, height } of rectsForLineGroups(lineGroupsForPlatforms(selectionPlatforms))) {
    const highlight = document.createElement("div");
    highlight.className = "selection-highlight";
    highlight.style.transform = `translate(${x}px, ${y}px)`;
    highlight.style.width = `${width}px`;
    highlight.style.height = `${height}px`;
    layer.append(highlight);
  }

  const collisionLayer = pdfDocument.querySelector(".collision-layer");
  pdfDocument.insertBefore(layer, collisionLayer || playerSprite);
}

function updateTextSelection(platform) {
  if (!platform || !Number.isFinite(platform.readingIndex)) return;

  if (textSelection.anchorPlatform) {
    textSelection.startIndex = textSelection.anchorPlatform.readingIndex;
    textSelection.endIndex = platform.readingIndex;
    textSelection.anchorPlatform = null;
  } else {
    textSelection.anchorPlatform = platform;
    textSelection.startIndex = platform.readingIndex;
    textSelection.endIndex = platform.readingIndex;
  }

  renderSelectionLayer();
  updateAnnotationControls();
}

function createAnnotationId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addAnnotationFromSelection(comment = "") {
  const selectionPlatforms = selectedPlatforms();
  const rects = rectsForLineGroups(lineGroupsForPlatforms(selectionPlatforms));
  if (!selectionPlatforms.length || !rects.length) return false;
  const range = readingIndexRange(selectionPlatforms);

  const annotation = {
    id: createAnnotationId(),
    type: "highlight",
    source: "session",
    text: selectedText(),
    comment: comment.trim(),
    rects,
    startReadingIndex: range?.start,
    endReadingIndex: range?.end,
    sortOrder: nextAnnotationOrder,
    createdAt: new Date().toISOString(),
  };
  world.annotations.push(annotation);
  nextAnnotationOrder += 1;
  if (isSpawnAnnotation(annotation)) enforceUniqueSpawnAnnotation();
  renderAnnotationLayer();
  renderAnnotationSidebar();
  clearTextSelection();
  return true;
}

function renderAnnotationLayer() {
  pdfDocument.querySelector(".annotation-layer")?.remove();
  const hasVisibleMessages = messageAnnotationsVisible && world.messageAnnotations.length > 0;
  const visibleAnnotations = world.annotations.filter(isVisibleAnnotation);
  if (!world.loaded || (!visibleAnnotations.length && !hasVisibleMessages)) return;

  const layer = document.createElement("div");
  layer.className = "annotation-layer";

  for (const annotation of visibleAnnotations) {
    for (const rect of annotation.rects || []) {
      const highlight = document.createElement("div");
      highlight.className = "pdf-annotation-highlight";
      highlight.classList.toggle("has-comment", Boolean(annotation.comment));
      highlight.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      if (annotation.comment) highlight.title = annotation.comment;
      layer.append(highlight);
    }
  }

  if (messageAnnotationsVisible) {
    for (const annotation of world.messageAnnotations) {
      const platforms = messageHostPlatforms(annotation);
      if (!platforms.length) continue;
      const title = compactText(firstContentLine(annotation.messageText), 72);
      for (const rect of rectsForLineGroups(lineGroupsForPlatforms(platforms))) {
        const highlight = document.createElement("div");
        highlight.className = "pdf-message-platform-highlight";
        highlight.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        highlight.title = title;
        layer.append(highlight);
      }
    }
  }

  const selectionLayer = pdfDocument.querySelector(".selection-layer");
  const collisionLayer = pdfDocument.querySelector(".collision-layer");
  pdfDocument.insertBefore(layer, selectionLayer || collisionLayer || playerSprite);
  updateMessageInteractionHint();
}

function annotationFirstPage(annotation) {
  return annotation.rects?.[0]?.page || annotation.pdfPage || 1;
}

function compactText(text, maxLength = 96) {
  const normalized = (text || "").replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function firstContentLine(text) {
  return String(text || "")
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function annotationPreviewText(annotation) {
  return compactText(annotation.text)
    || t(annotation.source === "pdf" ? "pdfAnnotationEntry" : "highlightEntry");
}

function clampSelectedAnnotationIndex() {
  const entries = visibleAnnotationEntries();
  if (!entries.length) {
    selectedAnnotationIndex = 0;
    return;
  }
  if (!entries.some((entry) => entry.index === selectedAnnotationIndex)) {
    selectedAnnotationIndex = entries[0].index;
  }
}

function selectedVisibleAnnotationPosition() {
  return visibleAnnotationEntries().findIndex((entry) => entry.index === selectedAnnotationIndex);
}

function scrollSelectedAnnotationIntoView() {
  const entry = annotationList
    ?.querySelector(`[data-annotation-index="${selectedAnnotationIndex}"]`);
  if (!entry) return;

  const entryRect = entry.getBoundingClientRect();
  const listRect = annotationList.getBoundingClientRect();
  if (entryRect.top < listRect.top || entryRect.bottom > listRect.bottom) {
    entry.scrollIntoView({ block: "nearest" });
  }
}

function renderAnnotationSidebar() {
  if (!annotationList) return;
  const selectedId = world.annotations[selectedAnnotationIndex]?.id || null;
  sortAnnotationsByStart(selectedId);
  clampSelectedAnnotationIndex();
  annotationSidebar.classList.toggle("is-menu-mode", annotationMenuMode);
  annotationModeLabel.textContent = t(annotationMenuMode ? "menuMode" : "gameMode");
  annotationList.replaceChildren();
  const entries = visibleAnnotationEntries();

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "annotation-empty";
    empty.textContent = t("noAnnotations");
    annotationList.append(empty);
    return;
  }

  entries.forEach(({ annotation, index }) => {
    const entry = document.createElement("button");
    entry.type = "button";
    entry.className = "annotation-entry";
    entry.classList.toggle("is-selected", index === selectedAnnotationIndex);
    entry.dataset.annotationIndex = String(index);

    const meta = document.createElement("span");
    meta.className = "annotation-entry-meta";
    meta.textContent = annotationPreviewText(annotation);

    entry.append(meta);
    if (annotation.comment) {
      const body = document.createElement("span");
      body.className = "annotation-entry-body";
      body.textContent = annotation.comment;
      entry.append(body);
    }

    annotationList.append(entry);
  });

  scrollSelectedAnnotationIntoView();
}

function setAnnotationMenuMode(isActive) {
  annotationMenuMode = isActive;
  if (annotationMenuMode) {
    player.vx = 0;
    player.vy = 0;
    player.jumpHeld = false;
    player.dropThrough = false;
  }
  clampSelectedAnnotationIndex();
  renderAnnotationSidebar();
  if (annotationMenuMode) focusSelectedAnnotation();
  setStatus(annotationMenuMode ? "menuModeOn" : "menuModeOff");
}

function toggleAnnotationMenuMode() {
  setAnnotationMenuMode(!annotationMenuMode);
}

function selectAnnotationEntry(delta) {
  const entries = visibleAnnotationEntries();
  if (!entries.length) return;
  const selectedPosition = entries.findIndex((entry) => entry.index === selectedAnnotationIndex);
  const currentPosition = selectedPosition >= 0 ? selectedPosition : 0;
  const nextPosition = (currentPosition + delta + entries.length) % entries.length;
  selectedAnnotationIndex = entries[nextPosition].index;
  renderAnnotationSidebar();
  if (annotationMenuMode) focusSelectedAnnotation();
}

function selectedAnnotation() {
  clampSelectedAnnotationIndex();
  const annotation = world.annotations[selectedAnnotationIndex] || null;
  return isVisibleAnnotation(annotation) ? annotation : null;
}

function focusSelectedAnnotation() {
  const annotation = selectedAnnotation();
  const rect = annotationStartRect(annotation);
  if (!rect || !world.loaded) return;

  player.x = Math.max(0, Math.min(world.cssWidth - player.width, rect.x));
  player.y = Math.max(0, Math.min(world.cssHeight - player.height, rect.y - player.height - 4));
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
  const selectedPosition = selectedVisibleAnnotationPosition();
  setStatus("annotationFocused", {
    index: selectedPosition + 1,
    total: visibleAnnotationEntries().length,
  });
}

function deleteSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (!annotation) return;
  const wasSpawnAnnotation = isSpawnAnnotation(annotation);

  markPdfAnnotationForRemoval(annotation);

  world.annotations.splice(selectedAnnotationIndex, 1);
  if (wasSpawnAnnotation) syncSpawnPlatformFromAnnotations();
  clampSelectedAnnotationIndex();
  renderAnnotationLayer();
  renderAnnotationSidebar();
  if (annotationMenuMode) focusSelectedAnnotation();
  setStatus("annotationDeleted");
}

function messageHostPlatforms(annotation) {
  return annotationPlatforms(annotation);
}

function supportedPlatformsForAnnotation(annotation, platforms) {
  return platforms.filter((platform) => annotationIncludesPlatform(annotation, platform));
}

function messageCandidateScore(annotation, platforms, index) {
  const matchedPlatforms = supportedPlatformsForAnnotation(annotation, platforms);
  if (!matchedPlatforms.length) return null;
  return {
    annotation,
    distance: annotationDistanceToPlayerLocation(annotation, matchedPlatforms),
    index,
  };
}

function supportedMessageAnnotation() {
  if (!world.loaded || !messageAnnotationsVisible) return null;
  const platforms = supportedTextPlatforms();
  if (!platforms.length) return null;

  return world.messageAnnotations
    .map((annotation, index) => messageCandidateScore(annotation, platforms, index))
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]?.annotation || null;
}

function interactableMessageAnnotation() {
  if (activeMessageAnnotationId) return null;
  return supportedMessageAnnotation();
}

function activeMessageAnnotation() {
  return world.messageAnnotations.find((annotation) => annotation.id === activeMessageAnnotationId) || null;
}

function messageDialogActions() {
  return ["close", "good", "bad"];
}

function clampMessageDialogChoiceIndex() {
  const actions = messageDialogActions();
  messageDialogChoiceIndex = Math.max(0, Math.min(messageDialogChoiceIndex, actions.length - 1));
}

function renderMessageDialog() {
  if (!messageDialog) return;
  const annotation = activeMessageAnnotation();
  if (!annotation) {
    messageDialog.hidden = true;
    return;
  }

  messageDialog.hidden = false;
  messageDialogText.textContent = annotation.messageText || "";
  const counts = messageDisplayCounts(annotation);
  clampMessageDialogChoiceIndex();
  const selectedAction = messageDialogActions()[messageDialogChoiceIndex];

  messageDialog.querySelectorAll("[data-message-dialog-action]").forEach((button) => {
    const action = button.dataset.messageDialogAction;
    button.classList.toggle("is-selected", action === selectedAction);
    button.classList.toggle("is-choice-selected", action === annotation.messageChoice);
    button.setAttribute("aria-pressed", String(action === annotation.messageChoice));
    if (action === "close") {
      button.textContent = t("closeMessage");
    } else if (action === "good") {
      button.textContent = `${t("goodMessage")} ${counts.good}`;
    } else if (action === "bad") {
      button.textContent = `${t("badMessage")} ${counts.bad}`;
    }
  });
}

function closeMessageDialog() {
  activeMessageAnnotationId = null;
  messageDialogChoiceIndex = 0;
  renderMessageDialog();
}

function recordMessageChoice(annotation, choice) {
  if (!annotation || !["good", "bad"].includes(choice)) return;
  annotation.messageChoice = choice;
  annotation.comment = formatMessageAnnotationComment(annotation);
  annotation.messageVotedAt = new Date().toISOString();
  renderAnnotationLayer();
  renderMessageDialog();
  setStatus("messageChoiceSaved", {
    choice: t(choice === "good" ? "messageChoiceGood" : "messageChoiceBad"),
  });
}

function chooseMessageDialogAction(action) {
  const annotation = activeMessageAnnotation();
  if (!annotation) return;
  if (action === "close") {
    closeMessageDialog();
    return;
  }
  recordMessageChoice(annotation, action);
}

function handleMessageDialogKey(code) {
  const actions = messageDialogActions();
  if (keyMap.left.includes(code)) {
    messageDialogChoiceIndex = (messageDialogChoiceIndex - 1 + actions.length) % actions.length;
    renderMessageDialog();
    return true;
  }
  if (keyMap.right.includes(code)) {
    messageDialogChoiceIndex = (messageDialogChoiceIndex + 1) % actions.length;
    renderMessageDialog();
    return true;
  }
  if (keyMap.jump.includes(code)) {
    chooseMessageDialogAction(actions[messageDialogChoiceIndex]);
    return true;
  }
  if (keyMap.interact.includes(code) || code === "Escape") {
    closeMessageDialog();
    return true;
  }
  return false;
}

function openMessageDialog(annotation) {
  if (!annotation || !messageAnnotationsVisible) return false;
  activeMessageAnnotationId = annotation.id;
  messageDialogChoiceIndex = annotation.messageChoice === "good"
    ? 1
    : annotation.messageChoice === "bad"
      ? 2
      : 0;
  player.vx = 0;
  player.vy = 0;
  player.jumpHeld = false;
  player.dropThrough = false;
  renderMessageDialog();
  setStatus("messageOpened");
  return true;
}

function openInteractableMessage() {
  return openMessageDialog(interactableMessageAnnotation());
}

function updateMessageInteractionHint() {
  const isReady = Boolean(supportedMessageAnnotation()) && !annotationMenuMode;
  document.querySelectorAll('[data-map-action="interact"]').forEach((button) => {
    button.closest(".control-row")?.classList.toggle("is-interaction-ready", isReady);
    button.setAttribute("aria-current", isReady ? "true" : "false");
  });
}

function handleAnnotationMenuKey(code) {
  if (keyMap.up.includes(code)) {
    selectAnnotationEntry(-1);
    return true;
  }
  if (keyMap.down.includes(code)) {
    selectAnnotationEntry(1);
    return true;
  }
  if (keyMap.jump.includes(code)) {
    focusSelectedAnnotation();
    return true;
  }
  if (keyMap.attack.includes(code)) {
    deleteSelectedAnnotation();
    return true;
  }
  return false;
}

async function performSelectionAction(action) {
  if (!hasTextSelection()) return;
  if (action === "copySelection") {
    await copySelectedText();
    return;
  }
  if (action === "highlightSelection") {
    if (!addAnnotationFromSelection()) return;
    setStatus("highlightAdded");
    return;
  }
  if (action === "commentSelection") {
    const comment = window.prompt(t("commentPrompt"), "");
    if (comment === null) return;
    if (!addAnnotationFromSelection(comment)) return;
    setStatus("commentAdded");
  }
}

function radialActionOptions() {
  return [
    { action: "copySelection", angle: -90 },
    { action: "highlightSelection", angle: 150 },
    { action: "commentSelection", angle: 30 },
  ];
}

function angleDistance(a, b) {
  return Math.abs((((a - b) + 540) % 360) - 180);
}

function radialChoiceFromRightStick(x, y) {
  if (Math.hypot(x, y) < 0.45) return null;
  const angle = Math.atan2(y, x) * 180 / Math.PI;
  return radialActionOptions()
    .sort((a, b) => angleDistance(angle, a.angle) - angleDistance(angle, b.angle))[0]
    ?.action || null;
}

function renderAnnotationRadial() {
  if (!annotationRadial) return;
  annotationRadial.classList.toggle("is-hidden", !annotationRadialActive);
  annotationRadial.querySelectorAll("[data-radial-choice]").forEach((option) => {
    option.classList.toggle("is-selected", option.dataset.radialChoice === annotationRadialChoice);
  });
}

function viewportRectToWorldRect(page, viewportRect) {
  const [x1, y1, x2, y2] = viewportRect;
  const left = Math.min(x1, x2) + page.x;
  const top = Math.min(y1, y2) + page.y;
  const right = Math.max(x1, x2) + page.x;
  const bottom = Math.max(y1, y2) + page.y;
  return {
    page: page.number,
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function pdfRectToWorldRect(page, rect) {
  if (!Array.isArray(rect) || rect.length < 4) return null;
  return viewportRectToWorldRect(page, page.viewport.convertToViewportRectangle(rect));
}

function flatQuadPoints(quadPoints) {
  if (!quadPoints) return [];
  if (ArrayBuffer.isView(quadPoints)) return Array.from(quadPoints);
  if (!Array.isArray(quadPoints)) return [];

  const values = [];
  for (const item of quadPoints) {
    if (typeof item === "number") {
      values.push(item);
    } else if (ArrayBuffer.isView(item)) {
      values.push(...Array.from(item));
    } else if (Array.isArray(item)) {
      values.push(...flatQuadPoints(item));
    } else if (item && Number.isFinite(item.x) && Number.isFinite(item.y)) {
      values.push(item.x, item.y);
    }
  }
  return values;
}

function quadPointsToWorldRects(page, quadPoints) {
  const values = flatQuadPoints(quadPoints);
  const rects = [];
  for (let index = 0; index + 7 < values.length; index += 8) {
    const viewportPoints = [
      page.viewport.convertToViewportPoint(values[index], values[index + 1]),
      page.viewport.convertToViewportPoint(values[index + 2], values[index + 3]),
      page.viewport.convertToViewportPoint(values[index + 4], values[index + 5]),
      page.viewport.convertToViewportPoint(values[index + 6], values[index + 7]),
    ];
    const xs = viewportPoints.map(([x]) => x);
    const ys = viewportPoints.map(([, y]) => y);
    rects.push(viewportRectToWorldRect(page, [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ]));
  }
  return rects;
}

function annotationText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.str === "string") return value.str;
  return "";
}

function isHighlightAnnotation(annotation) {
  return annotation?.subtype === "Highlight" || annotation?.annotationType === 9;
}

function importPdfAnnotations() {
  world.annotations = [];
  world.messageAnnotations = [];
  nextAnnotationOrder = 0;

  for (const page of world.pages) {
    for (const annotation of page.annotations || []) {
      if (!isHighlightAnnotation(annotation)) continue;
      const pdfQuadPoints = flatQuadPoints(annotation.quadPoints);
      const rects = quadPointsToWorldRects(page, pdfQuadPoints);
      const fallbackRect = pdfRectToWorldRect(page, annotation.rect);
      if (!rects.length && fallbackRect) rects.push(fallbackRect);
      if (!rects.length) continue;
      const matchedPlatforms = platformsFromAnnotationRects(rects);
      const range = readingIndexRange(matchedPlatforms);
      const comment = annotationText(annotation.contentsObj) || annotationText(annotation.contents);
      const message = parseMessageAnnotationComment(comment);
      const importedAnnotation = {
        id: annotation.id || createAnnotationId(),
        source: "pdf",
        pdfId: annotation.id || "",
        pdfPage: page.number,
        pdfRect: Array.isArray(annotation.rect) ? [...annotation.rect] : [],
        pdfQuadPoints,
        text: textFromPlatforms(matchedPlatforms),
        comment,
        rects,
        startReadingIndex: range?.start,
        endReadingIndex: range?.end,
        sortOrder: nextAnnotationOrder,
        createdAt: annotation.modificationDate || "",
      };

      if (message) {
        world.messageAnnotations.push({
          ...importedAnnotation,
          type: "message",
          text: message.text,
          messageText: message.text,
          messageGoodBase: message.goodBase,
          messageBadBase: message.badBase,
          messageChoice: message.choice,
          messageOriginalChoice: message.choice,
        });
      } else {
        world.annotations.push({
          ...importedAnnotation,
          type: "highlight",
        });
      }
      nextAnnotationOrder += 1;
    }
  }
  enforceUniqueSpawnAnnotation();
  world.messageAnnotations.sort(compareAnnotationsByStart);
}

function pdfNumberArray(pdfDoc, values) {
  const array = PDFArray.withContext(pdfDoc.context);
  for (const value of values) {
    array.push(PDFNumber.of(Number(value) || 0));
  }
  return array;
}

function finiteNumberValues(values, expectedLength = 0) {
  return Array.isArray(values)
    && values.length >= expectedLength
    && values.every((value) => Number.isFinite(value));
}

function pdfDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    "D:",
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function pageAnnotationArray(pdfDoc, page) {
  const annotsName = PDFName.of("Annots");
  let annots = page.node.lookupMaybe?.(annotsName, PDFArray);
  if (!annots) {
    annots = PDFArray.withContext(pdfDoc.context);
    page.node.set(annotsName, annots);
  }
  return annots;
}

function pdfObjectText(value) {
  if (!value) return "";
  if (typeof value.decodeText === "function") return value.decodeText();
  if (typeof value.asString === "function") return value.asString();
  return String(value);
}

function pdfArrayValues(array) {
  if (!array || typeof array.size !== "function") return [];
  const values = [];
  for (let index = 0; index < array.size(); index += 1) {
    const value = array.get(index);
    const number = typeof value?.asNumber === "function" ? value.asNumber() : value?.numberValue;
    if (Number.isFinite(number)) values.push(number);
  }
  return values;
}

function nearlyEqualNumberArray(a = [], b = [], tolerance = 0.75) {
  if (!a.length || a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

function lookupPdfAnnotation(pdfDoc, annotRef) {
  let annot = annotRef;
  try {
    annot = pdfDoc.context.lookup(annotRef);
  } catch (error) {
    console.warn("Could not inspect PDF annotation.", error);
  }
  return annot;
}

function isPdfHighlightDict(annot) {
  if (!annot?.lookup) return false;

  const subtype = annot?.lookup?.(PDFName.of("Subtype"));
  return String(subtype).includes("Highlight");
}

function isPdfSpawnAnnotationDict(annot) {
  if (!isPdfHighlightDict(annot)) return false;
  const comment = pdfObjectText(annot.lookup?.(PDFName.of("Contents")));
  return isSpawnAnnotationComment(comment);
}

function pdfAnnotationMatchesMetadata(annot, metadata) {
  const nm = pdfObjectText(annot.lookup?.(PDFName.of("NM")));
  if (metadata.id && nm && metadata.id === nm) return true;

  const rect = pdfArrayValues(annot.lookup?.(PDFName.of("Rect"), PDFArray));
  const quadPoints = pdfArrayValues(annot.lookup?.(PDFName.of("QuadPoints"), PDFArray));
  return nearlyEqualNumberArray(rect, metadata.rect)
    || nearlyEqualNumberArray(quadPoints, metadata.quadPoints);
}

function pdfAnnotationMatchesRemoval(pdfDoc, annotRef, removal) {
  const annot = lookupPdfAnnotation(pdfDoc, annotRef);
  if (!isPdfHighlightDict(annot)) return false;
  return pdfAnnotationMatchesMetadata(annot, removal);
}

function removePdfAnnotations(pdfDoc) {
  if (!world.removedPdfAnnotations.length) return;

  const removalsByPage = new Map();
  for (const removal of world.removedPdfAnnotations) {
    if (!removalsByPage.has(removal.page)) removalsByPage.set(removal.page, []);
    removalsByPage.get(removal.page).push(removal);
  }

  pdfDoc.getPages().forEach((page, pageIndex) => {
    const removals = removalsByPage.get(pageIndex + 1);
    if (!removals?.length) return;

    const annots = page.node.lookupMaybe?.(PDFName.of("Annots"), PDFArray);
    if (!annots) return;

    for (let index = annots.size() - 1; index >= 0; index -= 1) {
      const annotRef = annots.get(index);
      if (removals.some((removal) => pdfAnnotationMatchesRemoval(pdfDoc, annotRef, removal))) {
        annots.remove(index);
      }
    }
  });
}

function removePdfSpawnAnnotations(pdfDoc) {
  pdfDoc.getPages().forEach((page) => {
    const annots = page.node.lookupMaybe?.(PDFName.of("Annots"), PDFArray);
    if (!annots) return;

    for (let index = annots.size() - 1; index >= 0; index -= 1) {
      const annotRef = annots.get(index);
      const annot = lookupPdfAnnotation(pdfDoc, annotRef);
      if (isPdfSpawnAnnotationDict(annot)) annots.remove(index);
    }
  });
}

function updatePdfMessageAnnotations(pdfDoc) {
  const changedMessages = world.messageAnnotations.filter(messageVoteChanged);
  if (!changedMessages.length) return;

  const messagesByPage = new Map();
  for (const annotation of changedMessages) {
    const page = annotation.pdfPage || annotationFirstPage(annotation);
    if (!messagesByPage.has(page)) messagesByPage.set(page, []);
    messagesByPage.get(page).push(annotation);
  }

  pdfDoc.getPages().forEach((page, pageIndex) => {
    const messages = messagesByPage.get(pageIndex + 1);
    if (!messages?.length) return;

    const annots = page.node.lookupMaybe?.(PDFName.of("Annots"), PDFArray);
    if (!annots) return;

    for (let index = 0; index < annots.size(); index += 1) {
      const annotRef = annots.get(index);
      const annot = lookupPdfAnnotation(pdfDoc, annotRef);
      if (!isPdfHighlightDict(annot)) continue;

      const message = messages.find((annotation) => pdfAnnotationMatchesMetadata(annot, {
        id: annotation.pdfId || annotation.id || "",
        rect: annotation.pdfRect || [],
        quadPoints: annotation.pdfQuadPoints || [],
      }));
      if (!message) continue;

      annot.set(PDFName.of("Contents"), PDFHexString.fromText(formatMessageAnnotationComment(message)));
      annot.set(PDFName.of("M"), PDFString.of(pdfDateString()));
    }
  });
}

function worldRectToPdfQuad(page, rect) {
  const left = rect.x - page.x;
  const top = rect.y - page.y;
  const right = left + rect.width;
  const bottom = top + rect.height;
  const topLeft = page.viewport.convertToPdfPoint(left, top);
  const topRight = page.viewport.convertToPdfPoint(right, top);
  const bottomLeft = page.viewport.convertToPdfPoint(left, bottom);
  const bottomRight = page.viewport.convertToPdfPoint(right, bottom);
  const points = [topLeft, topRight, bottomLeft, bottomRight];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);

  return {
    rect: [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ],
    quadPoints: points.flat(),
  };
}

function isWritableAnnotationRect(rect) {
  return rect
    && Number.isInteger(rect.page)
    && rect.page > 0
    && Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0;
}

function isWritablePdfQuad(quad) {
  return finiteNumberValues(quad?.rect, 4)
    && finiteNumberValues(quad?.quadPoints, 8);
}

function addPdfHighlightAnnotation(pdfDoc, page, annotation) {
  const now = pdfDateString();
  const dict = pdfDoc.context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Highlight"),
    Rect: pdfNumberArray(pdfDoc, annotation.rect),
    QuadPoints: pdfNumberArray(pdfDoc, annotation.quadPoints),
    C: pdfNumberArray(pdfDoc, [1, 0.84, 0]),
    CA: PDFNumber.of(0.38),
    F: PDFNumber.of(4),
    T: PDFString.of("Blade of Readers"),
    M: PDFString.of(now),
    NM: PDFString.of(annotation.id),
    Subj: PDFString.of("Highlight"),
  });

  if (annotation.comment) {
    dict.set(PDFName.of("Contents"), PDFHexString.fromText(annotation.comment));
  }

  pageAnnotationArray(pdfDoc, page).push(pdfDoc.context.register(dict));
}

function addPdfSpawnAnnotation(pdfDoc, pdfPages, platform) {
  const rectsByPage = new Map();
  for (const rect of rectsForLineGroups(lineGroupsForPlatforms([platform]))) {
    if (!isWritableAnnotationRect(rect)) continue;
    if (!rectsByPage.has(rect.page)) rectsByPage.set(rect.page, []);
    rectsByPage.get(rect.page).push(rect);
  }

  for (const [pageNumber, rects] of rectsByPage) {
    const pageInfo = world.pages[pageNumber - 1];
    const pdfPage = pdfPages[pageNumber - 1];
    if (!pageInfo || !pdfPage) continue;

    const quads = rects
      .map((rect) => worldRectToPdfQuad(pageInfo, rect))
      .filter(isWritablePdfQuad);
    if (!quads.length) continue;

    const annotationRect = [
      Math.min(...quads.map((quad) => quad.rect[0])),
      Math.min(...quads.map((quad) => quad.rect[1])),
      Math.max(...quads.map((quad) => quad.rect[2])),
      Math.max(...quads.map((quad) => quad.rect[3])),
    ];
    addPdfHighlightAnnotation(pdfDoc, pdfPage, {
      id: `BladeOfReaders-spawn-${pageNumber}`,
      rect: annotationRect,
      quadPoints: quads.flatMap((quad) => quad.quadPoints),
      comment: SPAWN_ANNOTATION_COMMENT,
    });
  }
}

function annotationDownloadName() {
  const name = currentPdfName.trim() || "document.pdf";
  return /\.pdf$/iu.test(name) ? name : `${name}.pdf`;
}

function downloadBytes(bytes, name) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function annotatedPdfBytes(spawnPlatform = currentStandingPlatform()) {
  if (!currentPdfBytes) return null;
  const hasSpawnAnnotationUpdate = Boolean(spawnPlatform);
  const sessionAnnotations = world.annotations.filter((annotation) => (
    annotation.source === "session"
    && (!hasSpawnAnnotationUpdate || !isSpawnAnnotation(annotation))
  ));
  const hasPdfAnnotationRemovals = world.removedPdfAnnotations.length > 0;
  const hasMessageAnnotationUpdates = world.messageAnnotations.some(messageVoteChanged);
  if (
    !sessionAnnotations.length
    && !hasPdfAnnotationRemovals
    && !hasMessageAnnotationUpdates
    && !hasSpawnAnnotationUpdate
  ) {
    return new Uint8Array(currentPdfBytes.slice(0));
  }

  if (!PDFDocument || !PDFName || !PDFNumber || !PDFArray || !PDFString || !PDFHexString) {
    throw new Error("pdf-lib-missing");
  }

  const pdfDoc = await PDFDocument.load(currentPdfBytes.slice(0));
  const pdfPages = pdfDoc.getPages();
  removePdfAnnotations(pdfDoc);
  if (spawnPlatform) removePdfSpawnAnnotations(pdfDoc);
  updatePdfMessageAnnotations(pdfDoc);

  for (const annotation of sessionAnnotations) {
    const rectsByPage = new Map();
    for (const rect of annotation.rects || []) {
      if (!isWritableAnnotationRect(rect)) continue;
      if (!rectsByPage.has(rect.page)) rectsByPage.set(rect.page, []);
      rectsByPage.get(rect.page).push(rect);
    }

    for (const [pageNumber, rects] of rectsByPage) {
      const pageInfo = world.pages[pageNumber - 1];
      const pdfPage = pdfPages[pageNumber - 1];
      if (!pageInfo || !pdfPage) continue;

      const quads = rects
        .map((rect) => worldRectToPdfQuad(pageInfo, rect))
        .filter(isWritablePdfQuad);
      if (!quads.length) continue;

      const annotationRect = [
        Math.min(...quads.map((quad) => quad.rect[0])),
        Math.min(...quads.map((quad) => quad.rect[1])),
        Math.max(...quads.map((quad) => quad.rect[2])),
        Math.max(...quads.map((quad) => quad.rect[3])),
      ];
      addPdfHighlightAnnotation(pdfDoc, pdfPage, {
        id: `BladeOfReaders-${annotation.id}-${pageNumber}`,
        rect: annotationRect,
        quadPoints: quads.flatMap((quad) => quad.quadPoints),
        comment: annotation.comment,
      });
    }
  }

  if (spawnPlatform) addPdfSpawnAnnotation(pdfDoc, pdfPages, spawnPlatform);

  return pdfDoc.save();
}

function attackDirection() {
  const wantsUp = actionPressed("up") && !actionPressed("down");
  const wantsDown = actionPressed("down") && !actionPressed("up");
  const wantsLeft = actionPressed("left") && !actionPressed("right");
  const wantsRight = actionPressed("right") && !actionPressed("left");

  if (wantsUp) return { name: "up", x: 0, y: -1 };
  if (wantsDown) return { name: "down", x: 0, y: 1 };
  if (wantsLeft) return { name: "left", x: -1, y: 0 };
  if (wantsRight) return { name: "right", x: 1, y: 0 };
  return player.facingDirection < 0
    ? { name: "left", x: -1, y: 0 }
    : { name: "right", x: 1, y: 0 };
}

function bladeHitbox(direction) {
  const length = Math.max(36, world.minTextHeight * 3.2, player.width * 3.4);
  const thickness = Math.max(8, world.minTextHeight * 0.8, player.height * 0.8);
  const gap = Math.max(2, world.minTextHeight * 0.12);
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;

  if (direction.x > 0) {
    return {
      x: player.x + player.width + gap,
      y: centerY - thickness / 2,
      width: length,
      height: thickness,
    };
  }
  if (direction.x < 0) {
    return {
      x: player.x - gap - length,
      y: centerY - thickness / 2,
      width: length,
      height: thickness,
    };
  }
  if (direction.y < 0) {
    return {
      x: centerX - thickness / 2,
      y: player.y - gap - length,
      width: thickness,
      height: length,
    };
  }
  return {
    x: centerX - thickness / 2,
    y: player.y + player.height + gap,
    width: thickness,
    height: length,
  };
}

function distanceSquaredToRect(point, rect) {
  const closestX = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

function closestBladeHit(hitbox) {
  const playerCenter = {
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
  };

  return activeCollisionPlatforms()
    .filter((platform) => rectsOverlap(hitbox, platform))
    .sort((a, b) => (
      distanceSquaredToRect(playerCenter, a) - distanceSquaredToRect(playerCenter, b)
      || (a.readingIndex ?? 0) - (b.readingIndex ?? 0)
    ))[0] || null;
}

function clearBladeSwing() {
  if (!activeBladeSwing) return;
  window.clearTimeout(activeBladeSwing.timeoutId);
  activeBladeSwing.element.remove();
  activeBladeSwing = null;
}

function renderBladeSwing() {
  if (!activeBladeSwing) return;
  const hitbox = bladeHitbox(activeBladeSwing.direction);
  activeBladeSwing.element.style.transform = `translate(${hitbox.x}px, ${hitbox.y}px)`;
  activeBladeSwing.element.style.width = `${hitbox.width}px`;
  activeBladeSwing.element.style.height = `${hitbox.height}px`;
}

function showBlade(direction) {
  clearBladeSwing();
  const blade = document.createElement("div");
  blade.className = `blade-swing blade-swing-${direction.name}`;
  pdfDocument.append(blade);
  activeBladeSwing = {
    element: blade,
    direction,
    timeoutId: window.setTimeout(() => {
      if (activeBladeSwing?.element === blade) activeBladeSwing = null;
      blade.remove();
    }, config.bladeDurationMs),
  };
  renderBladeSwing();
}

function activeLineMarkerBounds(lineId) {
  if (!lineId) return null;
  const platforms = world.platforms.filter((platform) => platform.lineId === lineId);
  if (!platforms.length) return null;

  const left = Math.min(...platforms.map((platform) => platform.x));
  const right = Math.max(...platforms.map((platform) => platform.x + platform.width));
  const bottom = Math.max(...platforms.map((platform) => (
    platform.y + Math.max(platform.textHeight || 0, platform.height || 0)
  )));
  const height = Math.max(2, Math.min(4, world.minTextHeight * 0.16));
  const padding = Math.max(2, world.minTextHeight * 0.12);

  return {
    x: Math.max(0, left - padding),
    y: bottom + Math.max(1, height * 0.5),
    width: Math.min(world.cssWidth, right + padding) - Math.max(0, left - padding),
    height,
  };
}

function renderCollisionLayer() {
  pdfDocument.querySelector(".collision-layer")?.remove();
  world.renderedActivePlatformLineId = null;
  const layer = document.createElement("div");
  layer.className = "collision-layer";

  const activeLineMarker = document.createElement("div");
  activeLineMarker.className = "active-line-marker";
  layer.append(activeLineMarker);

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

function renderActiveLineMarker(lineId) {
  const marker = pdfDocument.querySelector(".active-line-marker");
  if (!marker) return;

  const bounds = activeLineMarkerBounds(lineId);
  marker.classList.toggle("is-visible", Boolean(bounds));
  if (!bounds) return;

  marker.style.transform = `translate(${bounds.x}px, ${bounds.y}px)`;
  marker.style.width = `${bounds.width}px`;
  marker.style.height = `${bounds.height}px`;
}

function clearPdfDocument() {
  clearBladeSwing();
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
  currentPdfBytes = null;
  currentPdfName = file?.name || "document.pdf";
  world.annotations = [];
  world.messageAnnotations = [];
  world.removedPdfAnnotations = [];
  world.spawnPlatformReadingIndex = null;
  nextAnnotationOrder = 0;
  annotationMenuMode = false;
  selectedAnnotationIndex = 0;
  annotationRadialActive = false;
  annotationRadialChoice = null;
  activeMessageAnnotationId = null;
  renderMessageDialog();
  renderAnnotationRadial();
  updateAnnotationControls();
  clearTextSelection({ render: false });
  clearPdfDocument();
  setLoadingPdf(true);
  setStatus("readingPdf");
  const bytes = await file.arrayBuffer();
  currentPdfBytes = bytes.slice(0);
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const firstPage = await pdf.getPage(1);
  const availableWidth = readerStageAvailableWidth();

  world.renderWidth = availableWidth;
  world.pages = [];
  world.platforms = [];
  world.portals = [];
  world.annotations = [];
  world.messageAnnotations = [];
  world.removedPdfAnnotations = [];
  world.spawnPlatformReadingIndex = null;
  nextAnnotationOrder = 0;
  world.activePlatformLineId = null;
  world.minTextHeight = Infinity;

  let offsetY = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: availableWidth / baseViewport.width });
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
    const renderOptions = { canvasContext: pageCtx, viewport };
    if (pdfjsLib.AnnotationMode?.DISABLE !== undefined) {
      renderOptions.annotationMode = pdfjsLib.AnnotationMode.DISABLE;
    }
    await page.render(renderOptions).promise;
    pdfDocument.insertBefore(pageCanvas, playerSprite);

    const textContent = await page.getTextContent();
    const pageAnnotations = await page.getAnnotations({ intent: "display" });
    const pagePlatforms = [];
    let textLineOrder = 0;
    textContent.items.forEach((item, itemIndex) => {
      pagePlatforms.push(...splitTextIntoPlatforms(
        item,
        textContent.styles[item.fontName],
        viewport,
        offsetY,
        pageNumber,
        `${pageNumber}:${itemIndex}`,
        itemIndex,
        textLineOrder,
      ));
      if (item.hasEOL) textLineOrder += 1;
    });
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
      viewport,
      annotations: pageAnnotations,
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
  assignPlatformReadingOrder();
  importPdfAnnotations();
  renderCollisionLayer();
  renderAnnotationLayer();
  renderAnnotationSidebar();
  renderSelectionLayer();
  resetPlayer();
  setLoadingPdf(false);
  playerSprite.hidden = false;
  updatePageText(1, pdf.numPages);
  setStatus("generatedPlatforms", {
    count: world.platforms.length,
    total: pdf.numPages,
    pageWord: t(pdf.numPages === 1 ? "pageSingular" : "pagePlural"),
  });
  updateAnnotationControls();
  autoCenterPlayer();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointInRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function rectIntersectionSize(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return {
    width: Math.max(0, width),
    height: Math.max(0, height),
  };
}

function platformOverlapsAnnotationRect(platform, rect) {
  if (platform.page !== rect.page || !rectsOverlap(platform, rect)) return false;

  const center = {
    x: platform.x + platform.width / 2,
    y: platform.y + platform.height / 2,
  };
  if (pointInRect(center, rect)) return true;

  const overlap = rectIntersectionSize(platform, rect);
  if (!overlap.width || !overlap.height) return false;

  const platformArea = Math.max(1, platform.width * platform.height);
  const areaCoverage = (overlap.width * overlap.height) / platformArea;
  const horizontalCoverage = overlap.width / Math.max(1, Math.min(platform.width, rect.width));
  const verticalCoverage = overlap.height / Math.max(1, Math.min(platform.height, rect.height));
  return areaCoverage >= 0.2 || (horizontalCoverage >= 0.45 && verticalCoverage >= 0.35);
}

function platformsFromAnnotationRects(rects) {
  if (!rects?.length) return [];
  return world.platforms
    .filter((platform) => rects.some((rect) => platformOverlapsAnnotationRect(platform, rect)))
    .sort((a, b) => (
      (a.readingIndex ?? Number.POSITIVE_INFINITY) - (b.readingIndex ?? Number.POSITIVE_INFINITY)
      || a.page - b.page
      || a.y - b.y
      || a.x - b.x
    ));
}

function eventPathIncludesElement(event, element) {
  if (event.composedPath?.().includes(element)) return true;
  return event.target instanceof Node && element.contains(event.target);
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
  player.facingDirection = direction;
  player.dashFrames = config.dashDuration;
  player.dashCooldown = config.dashDuration + 4;
  player.vx = direction * config.dashSpeed;
  player.vy = 0;
  player.grounded = false;
  player.groundedByViewport = false;
}

function startAttack() {
  if (!world.loaded) return;
  const direction = attackDirection();
  if (direction.x !== 0) player.facingDirection = direction.x;
  const hitbox = bladeHitbox(direction);
  showBlade(direction);
  const hitPlatform = closestBladeHit(hitbox);
  if (hitPlatform) {
    updateTextSelection(hitPlatform);
  } else {
    clearTextSelection();
  }
  renderPlayer();
}

function collideWithPlatforms(previousY) {
  if (player.dropThrough) return;
  const supportX = player.x + player.width / 2;
  for (const platform of activeCollisionPlatforms()) {
    if (!rectsOverlap(player, platform)) continue;
    const centeredOnPlatform = supportX >= platform.x && supportX <= platform.x + platform.width;
    if (!centeredOnPlatform) continue;
    const topEdgeTolerance = Math.max(2, (platform.textHeight || world.minTextHeight) * 0.12);
    const wasAbove = previousY + player.height <= platform.y + topEdgeTolerance;
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

function supportedTextPlatforms() {
  return activeCollisionPlatforms()
    .filter(playerSupportedByPlatform)
    .sort((a, b) => (
      (a.readingIndex ?? Number.POSITIVE_INFINITY) - (b.readingIndex ?? Number.POSITIVE_INFINITY)
      || a.page - b.page
      || a.y - b.y
      || a.x - b.x
    ));
}

function currentStandingPlatform() {
  const supportPoint = {
    x: player.x + player.width / 2,
    y: player.y + player.height,
  };
  return supportedTextPlatforms()
    .sort((a, b) => (
      distanceSquaredToRect(supportPoint, a) - distanceSquaredToRect(supportPoint, b)
      || (a.readingIndex ?? Number.POSITIVE_INFINITY) - (b.readingIndex ?? Number.POSITIVE_INFINITY)
      || a.page - b.page
      || a.y - b.y
      || a.x - b.x
    ))[0] || null;
}

function updateSpawnAnnotationFromPlayer() {
  const platform = currentStandingPlatform();
  if (!platform) return null;
  setSpawnAnnotationPlatform(platform);
  renderAnnotationLayer();
  renderAnnotationSidebar();
  return platform;
}

function annotationIncludesPlatform(annotation, platform) {
  if (!platform) return false;
  const range = annotationReadingIndexRange(annotation);
  if (range && Number.isFinite(platform.readingIndex)) {
    return platform.readingIndex >= range.start && platform.readingIndex <= range.end;
  }
  return annotationPlatforms(annotation).includes(platform);
}

function annotationDistanceToPlayerLocation(annotation, platforms) {
  const start = annotationStartLocation(annotation);
  const readingDistances = platforms
    .map((platform) => (
      Number.isFinite(start.readingIndex) && Number.isFinite(platform.readingIndex)
        ? Math.abs(start.readingIndex - platform.readingIndex)
        : null
    ))
    .filter(Number.isFinite);
  if (readingDistances.length) return Math.min(...readingDistances);

  const playerX = player.x + player.width / 2;
  const playerY = player.y + player.height;
  const dx = (Number.isFinite(start.x) ? start.x : playerX) - playerX;
  const dy = (Number.isFinite(start.y) ? start.y : playerY) - playerY;
  return Math.hypot(dx, dy);
}

function syncSelectedAnnotationFromPlayer() {
  if (annotationMenuMode || !visibleAnnotationEntries().length) return;
  const platforms = supportedTextPlatforms();
  if (!platforms.length) return;

  sortAnnotationsByStart(world.annotations[selectedAnnotationIndex]?.id || null);
  let best = null;
  visibleAnnotationEntries().forEach(({ annotation, index }) => {
    const matchedPlatforms = platforms.filter((platform) => annotationIncludesPlatform(annotation, platform));
    if (!matchedPlatforms.length) return;
    const distance = annotationDistanceToPlayerLocation(annotation, matchedPlatforms);
    if (!best || distance < best.distance || (distance === best.distance && index < best.index)) {
      best = { index, distance };
    }
  });

  if (!best) return;
  if (selectedAnnotationIndex !== best.index) {
    selectedAnnotationIndex = best.index;
    renderAnnotationSidebar();
  } else {
    scrollSelectedAnnotationIntoView();
  }
}

function useWrapPortal(previousX) {
  for (const portal of activeWrapPortals()) {
    if (Math.sign(player.vx) !== portal.direction) continue;
    if (!playerSupportedByPlatform(portal.sourcePlatform)) continue;
    const portalEdge = portal.triggerX ?? (portal.direction > 0 ? portal.x : portal.x + portal.width);
    const crossedDoor = portal.direction > 0
      ? previousX + player.width <= portalEdge && player.x + player.width >= portalEdge
      : previousX >= portalEdge && player.x <= portalEdge;
    const reachedDoor = portal.direction > 0
      ? player.x + player.width >= portalEdge
      : player.x <= portalEdge;
    const verticallyAligned = player.y + player.height >= portal.y && player.y <= portal.y + portal.height;
    if ((!crossedDoor && !reachedDoor) || !verticallyAligned) continue;
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

  if (movingLeft && !movingRight) player.facingDirection = -1;
  if (movingRight && !movingLeft) player.facingDirection = 1;

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

  if (autoScrollEnabled && !usedPortal) keepPlayerInVisibleWindow();
  updateActivePage();
  syncSelectedAnnotationFromPlayer();
  autoCenterPlayer();
}

function renderPlayer() {
  playerSprite.style.width = `${player.width}px`;
  playerSprite.style.height = `${player.height}px`;
  playerSprite.style.transform = `translate(${player.x}px, ${player.y}px)`;
  playerSprite.classList.toggle("is-grounded", player.grounded);
  playerSprite.classList.toggle("is-facing-right", player.facingDirection >= 0);
  renderBladeSwing();
  pdfDocument.classList.toggle("show-collisions", collisionsVisible);
  updateMessageInteractionHint();
  if (world.renderedActivePlatformLineId === world.activePlatformLineId) return;
  for (const shape of pdfDocument.querySelectorAll(".collision-shape")) {
    shape.classList.toggle("is-line-highlighted", shape.dataset.lineId === world.activePlatformLineId);
  }
  renderActiveLineMarker(world.activePlatformLineId);
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
  if (
    teleportSuppressedPointerEvents.has(event)
    || !world.loaded
    || annotationMenuMode
    || activeMessageAnnotationId
    || event.button !== 0
    || !eventPathIncludesElement(event, readerStage)
  ) {
    return;
  }
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
  const clickPoint = {
    x: event.clientX + viewport.left - offset.left,
    y: event.clientY + viewport.top - offset.top,
  };
  const clickedPlatform = world.platforms.find((platform) => pointInRect(clickPoint, platform));
  if (!clickedPlatform) return;

  player.x = clickPoint.x - player.width / 2;
  player.y = clickedPlatform.y - player.height;
  player.x = Math.max(0, Math.min(world.cssWidth - player.width, player.x));
  player.y = Math.max(0, Math.min(world.cssHeight - player.height, player.y));
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  player.groundedByViewport = false;
  player.jumpHeld = false;
  player.jumpFrames = 0;
  player.dropThrough = false;
  player.coyote = 0;
  player.dashFrames = 0;
  player.dashCooldown = 0;
  world.activePlatformLineId = clickedPlatform.lineId || world.activePlatformLineId;
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

function storePreviousControllerState(pressedButtons) {
  previousControllerButtons.clear();
  pressedButtons.forEach((button) => previousControllerButtons.add(button));
  previousControllerDirections.left = controllerDirections.left;
  previousControllerDirections.right = controllerDirections.right;
  previousControllerDirections.up = controllerDirections.up;
  previousControllerDirections.down = controllerDirections.down;
}

function updateControllerInput() {
  const gamepad = activeGamepad();
  const pressedButtons = pressedGamepadButtons(gamepad);
  const axisX = gamepad?.axes?.[0] || 0;
  const axisY = gamepad?.axes?.[1] || 0;
  const rightStickX = gamepad?.axes?.[2] || 0;
  const rightStickY = gamepad?.axes?.[3] || 0;
  const deadzone = 0.35;

  controllerDirections.left = axisX < -deadzone || pressedButtons.has(controllerDpadButtons.left);
  controllerDirections.right = axisX > deadzone || pressedButtons.has(controllerDpadButtons.right);
  controllerDirections.up = axisY < -deadzone || pressedButtons.has(controllerDpadButtons.up);
  controllerDirections.down = axisY > deadzone || pressedButtons.has(controllerDpadButtons.down);

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
    const attackPressed = controllerMap.attack.some((button) => controllerButtons.has(button));
    const attackWasPressed = controllerMap.attack.some((button) => previousControllerButtons.has(button));
    const dashPressed = controllerMap.dash.some((button) => controllerButtons.has(button));
    const dashWasPressed = controllerMap.dash.some((button) => previousControllerButtons.has(button));
    const interactPressed = controllerMap.interact.some((button) => controllerButtons.has(button));
    const interactWasPressed = controllerMap.interact.some((button) => previousControllerButtons.has(button));
    const menuPressed = controllerMap.menu.some((button) => controllerButtons.has(button));
    const menuWasPressed = controllerMap.menu.some((button) => previousControllerButtons.has(button));
    const leftBumperPressed = controllerButtons.has(4);

    if (activeMessageAnnotationId) {
      if (controllerDirections.left && !previousControllerDirections.left) handleMessageDialogKey(keyMap.left[0]);
      if (controllerDirections.right && !previousControllerDirections.right) handleMessageDialogKey(keyMap.right[0]);
      if (jumpPressed && !jumpWasPressed) handleMessageDialogKey(keyMap.jump[0]);
      if (interactPressed && !interactWasPressed) handleMessageDialogKey(keyMap.interact[0]);
      if (!jumpPressed && jumpWasPressed) {
        player.jumpHeld = false;
        player.dropThrough = false;
      }
      storePreviousControllerState(pressedButtons);
      return;
    }

    if (menuPressed && !menuWasPressed) {
      toggleAnnotationMenuMode();
    }

    if (annotationMenuMode) {
      if (controllerDirections.up && !previousControllerDirections.up) selectAnnotationEntry(-1);
      if (controllerDirections.down && !previousControllerDirections.down) selectAnnotationEntry(1);
      if (jumpPressed && !jumpWasPressed) focusSelectedAnnotation();
      if (attackPressed && !attackWasPressed) deleteSelectedAnnotation();
      if (!jumpPressed && jumpWasPressed) {
        player.jumpHeld = false;
        player.dropThrough = false;
      }
      storePreviousControllerState(pressedButtons);
      return;
    }

    if (leftBumperPressed || annotationRadialActive) {
      if (leftBumperPressed) {
        annotationRadialActive = true;
        annotationRadialChoice = radialChoiceFromRightStick(rightStickX, rightStickY);
        renderAnnotationRadial();
      } else {
        const releasedChoice = annotationRadialChoice;
        annotationRadialActive = false;
        annotationRadialChoice = null;
        renderAnnotationRadial();
        if (releasedChoice) performSelectionAction(releasedChoice);
      }
      storePreviousControllerState(pressedButtons);
      return;
    }

    if (jumpPressed && !jumpWasPressed) {
      restartAutoScroll();
      startJump();
    }
    if (dashPressed && !dashWasPressed) {
      restartAutoScroll();
      startDash();
    }
    if (attackPressed && !attackWasPressed) {
      restartAutoScroll();
      startAttack();
    }
    if (interactPressed && !interactWasPressed) {
      openInteractableMessage();
    }
    if (!jumpPressed && jumpWasPressed) {
      player.jumpHeld = false;
      player.dropThrough = false;
      if (player.vy < 0) player.vy = 0;
    }
  }

  storePreviousControllerState(pressedButtons);
}

function tick() {
  updateControllerInput();
  if (world.loaded && !annotationMenuMode && !activeMessageAnnotationId) updatePlayer();
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
    currentPdfBytes = null;
    world.annotations = [];
    world.messageAnnotations = [];
    world.removedPdfAnnotations = [];
    world.spawnPlatformReadingIndex = null;
    nextAnnotationOrder = 0;
    annotationMenuMode = false;
    selectedAnnotationIndex = 0;
    annotationRadialActive = false;
    annotationRadialChoice = null;
    activeMessageAnnotationId = null;
    renderMessageDialog();
    renderAnnotationRadial();
    updateAnnotationControls();
    renderAnnotationSidebar();
    playerSprite.hidden = true;
    setStatus("pdfReadError");
    dropZone.classList.remove("is-hidden");
  }
}

async function copySelectedText() {
  const text = selectedText();
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-10000px";
      textArea.style.top = "0";
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setStatus("copiedSelection");
  } catch (error) {
    console.error(error);
    setStatus("copyError");
  }
}

async function downloadAnnotatedPdf() {
  if (!currentPdfBytes) return;

  try {
    const spawnPlatform = updateSpawnAnnotationFromPlayer();
    setStatus("writingPdf");
    const bytes = await annotatedPdfBytes(spawnPlatform);
    if (!bytes) return;
    downloadBytes(bytes, annotationDownloadName());
    setStatus("annotatedPdfReady");
  } catch (error) {
    console.error(error);
    setStatus(error.message === "pdf-lib-missing" ? "pdfLibMissing" : "pdfWriteError");
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
  closeMessageDialog();
  clearTextSelection();
  resetPlayer();
  autoCenterPlayer();
});

annotationList.addEventListener("click", (event) => {
  const entry = event.target.closest("[data-annotation-index]");
  if (!entry) return;
  selectedAnnotationIndex = Number(entry.dataset.annotationIndex) || 0;
  setAnnotationMenuMode(true);
});

downloadAnnotatedButton.addEventListener("click", () => {
  downloadAnnotatedPdf();
});

topbarToggleButton.addEventListener("click", () => {
  setTopbarHidden(!topbarHidden);
});

collisionButton.addEventListener("click", () => {
  collisionsVisible = !collisionsVisible;
  updateCollisionButtonLabel();
  collisionButton.setAttribute("aria-pressed", String(collisionsVisible));
  renderPlayer();
});

messageAnnotationsButton.addEventListener("click", () => {
  messageAnnotationsVisible = !messageAnnotationsVisible;
  updateMessageAnnotationsButtonLabel();
  messageAnnotationsButton.setAttribute("aria-pressed", String(messageAnnotationsVisible));
  if (!messageAnnotationsVisible) closeMessageDialog();
  renderAnnotationLayer();
  renderPlayer();
});

messageDialog?.addEventListener("click", (event) => {
  if (event.target === messageDialog) {
    closeMessageDialog();
    return;
  }
  const button = event.target.closest("[data-message-dialog-action]");
  if (!button) return;
  const actions = messageDialogActions();
  messageDialogChoiceIndex = actions.indexOf(button.dataset.messageDialogAction);
  chooseMessageDialogAction(button.dataset.messageDialogAction);
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
  const wasPressed = keys.has(event.code);
  if (["PageDown", "PageUp", "Home", "End"].includes(event.code)) markManualScrollIntent();
  if (isControlKey) {
    event.preventDefault();
  }

  if (activeMessageAnnotationId) {
    if (!wasPressed) handleMessageDialogKey(event.code);
    keys.add(event.code);
    return;
  }

  if (!wasPressed && event.code === "Delete") {
    event.preventDefault();
    deleteSelectedAnnotation();
    keys.add(event.code);
    return;
  }

  if (annotationMenuMode) {
    if (!wasPressed) handleAnnotationMenuKey(event.code);
    keys.add(event.code);
    return;
  }

  if (isControlKey) restartAutoScroll();
  if (!wasPressed && keyMap.jump.includes(event.code)) startJump();
  if (!wasPressed && keyMap.dash.includes(event.code)) startDash();
  if (!wasPressed && keyMap.attack.includes(event.code)) startAttack();
  if (!wasPressed && keyMap.interact.includes(event.code)) openInteractableMessage();
  if (!wasPressed && keyMap.copySelection.includes(event.code)) performSelectionAction("copySelection");
  if (!wasPressed && keyMap.highlightSelection.includes(event.code)) performSelectionAction("highlightSelection");
  if (!wasPressed && keyMap.commentSelection.includes(event.code)) performSelectionAction("commentSelection");
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
  updateStickyTopbarHeight();
  if (!world.loaded) return;
  keepPlayerInVisibleWindow();
});

window.addEventListener("wheel", markManualScrollIntent, { passive: true });
window.addEventListener("touchmove", markManualScrollIntent, { passive: true });
document.addEventListener("pointerdown", (event) => {
  if (!annotationMenuMode || event.target.closest("[data-annotation-index]")) return;
  teleportSuppressedPointerEvents.add(event);
  setAnnotationMenuMode(false);
}, { capture: true });
readerStage.addEventListener("pointerdown", teleportPlayerToClick);

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
if (window.ResizeObserver && topbar) {
  new ResizeObserver(updateStickyTopbarHeight).observe(topbar);
}
updateStickyTopbarHeight();
setDocumentSize();
resetPlayer();
tick();
