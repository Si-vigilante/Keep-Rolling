import { achievements, asset, beetles, cards, navItems, profileRows, tasks, todos as todoSeed } from "./data.js";
import { authEmail, authErrorMessage, authName, initializeAuth, loginWithEmail, logoutCurrentUser, signupWithEmail } from "./authService.js";
import { decomposeTaskWithDeepSeek } from "./deepseekService.js";
import { createAiTaskBreakdown, createTodosFromAi, makeTodo, rewardCardForTask, taskFromTodo } from "./mockServices.js";
const ASSET_VERSION = "20260517-ai21-todo-fix";
const design = (name) => `./Page_View/${name}?v=${ASSET_VERSION}`;

const ROUTES = {
  HOME: "home",
  AI: "ai",
  TODO: "todo",
  EXECUTE: "execute",
  REVIEW: "review",
  CARDS: "cards",
  PROFILE: "profile",
  DRAW: "draw",
};

// ================================================================
//  新手引导 — 三阶段配置
//  第一阶段：对话介绍（开场→王国介绍→过渡）
//  第二阶段：功能导览（AI→抽卡→待办→回顾→收藏）
//  第三阶段：对话收尾（开场→分支选项→完结收尾）
// ================================================================

// 第一阶段对话（3轮）
const phase1Steps = [
  {
    text: '造物主，你终于来了。我们日夜祈祷，终于等到你降临的这一刻。',
    options: ['我是谁？', '这里是哪里？', '为何寻我前来']
  },
  {
    segments: [
      '首先自我介绍一下，我是屎克螂王国的国王。',
      '我们的王国曾是这片土地上最富饶繁荣的国度，人民安居乐业，资源丰沛，人人都能过上衣食无忧的日子。',
      '可一场突如其来的灾荒，让一切都变了。资源一夜之间枯竭，我们的人民陷入了绝境。'
    ],
    options: ['我帮你们。', '我该怎么做？', '我虽茫然，但愿相助']
  },
  {
    segments: [
      '感谢您愿意伸出援手！',
      '请跟我来，我带您认识国家各项职能，教您如何造物、创造资源，帮我们渡过这场危机。'
    ]
  }
];

// 第二阶段功能导览配置
const phase2Features = [
  {
    id: 'ai', selector: '.menu-ai', route: 'ai',
    label: 'AI任务拆解',
    tip: '点击这里，开始拆解任务',
    explain: '这是AI任务拆解页，输入任务内容即可自动拆解成小步骤'
  },
  {
    id: 'draw', selector: '.menu-draw', route: 'draw',
    label: '任务选择',
    tip: '点击这里，抽取任务卡牌',
    explain: '这是任务选择页，选择一张卡牌即可开启新的冒险'
  },
  {
    id: 'todo', selector: '.menu-todo', route: 'todo',
    label: '待办管理',
    tip: '点击这里，查看待办清单',
    explain: '这是待办管理页，勾选已完成的任务，进度一目了然'
  },
  {
    id: 'review', selector: '.menu-review', route: 'review',
    label: '任务回顾',
    tip: '点击这里，回顾任务记录',
    explain: '这是任务回顾页，过往每一步都记录在这里可随时查看'
  },
  {
    id: 'cards', selector: '.menu-cards', route: 'cards',
    label: '卡牌收藏',
    tip: '点击这里，浏览卡牌图鉴',
    explain: '这是卡牌收藏页，收集各类角色卡牌，解锁精彩故事'
  }
];

// 第三阶段对话（开场 → 分支 → 完结）
const phase3Steps = [
  {
    text: '造物主，所有功能部署已经全部完成，这座王国已经为您准备就绪。'
  },
  {
    segments: [
      '这片王国辽阔无边，处处都藏着惊喜与机遇，您大可随心探索。',
      '除此之外，还有更多功能等待您亲自去发掘，我就不在此一一罗列了。'
    ],
    branches: [
      { label: '好的，我明白了', key: 'A', response: '既然您已明了，那这座王国便交由您了，造物主大人。' },
      { label: '你退下', key: 'B', response: '臣告退。但臣会在暗处守护，造物主若有需要，随时传召便是。' },
      { label: '我想再看一遍', key: 'C', response: '第一阶段内容已重温，结束后可再次选择。', loop: true }
    ]
  },
  {
    text: '造物主，往后之路还长着呢。不过您放心，我屎克螂王国上下，都会陪您走下去。愿您在这片大陆上，玩得尽兴，走得长远。',
    isEnd: true
  }
];

// 当前阶段对应的步骤数组引用
function guideCurrentSteps() {
  if (state.guidePhase === 1) return phase1Steps;
  if (state.guidePhase === 2) return null; // phase2 用 feature 索引
  if (state.guidePhase === 3) return phase3Steps;
  return null;
}

// 获取当前步骤对象
function guideCurrentStep() {
  const steps = guideCurrentSteps();
  if (!steps) return null;
  return steps[state.guideStep] || null;
}

const state = {
  route: ROUTES.HOME,
  previousRoute: ROUTES.HOME,
  transition: "forward",
  history: [ROUTES.HOME],
  menuOpen: true,
  modal: null,
  authMode: "login",
  authLoading: true,
  authSubmitting: false,
  authError: "",
  authUser: null,
  pendingRoute: null,
  toast: null,
  selectedTask: tasks[0],
  selectedTodoId: todoSeed[0].id,
  selectedCard: cards[0],
  todos: structuredClone(todoSeed),
  aiPhase: "input",
  aiInput: "",
  aiAttachment: null,
  aiLoading: false,
  aiError: "",
  aiSteps: [],
  cardTab: "cards",
  profileTab: "settings",
  executeStatus: "idle",
  drawnCard: null,
  drawPhase: "selecting",
  // ===== 新手引导状态（三阶段） =====
  guideActive: false,       // 引导是否激活
  guidePhase: 0,           // 0=未开始, 1=第一阶段, 2=第二阶段, 3=第三阶段, 4=已完成
  guideStep: 0,            // 当前阶段的步骤索引
  guideSegment: 0,         // 多段文本中的段落索引
  guideTriangle: false,    // 三角标是否显示（可点击推进）
  guideOptions: false,     // 选项浮层是否显示
  guideBranchReturn: false, // 分支C：返回选项界面
  guideAfterBranch: false,  // 分支回应打完，推进而非显示选项
  guideMenuHint: false,    // 第二阶段：是否处于"请展开菜单"提示状态
  guideShowBackArrow: false, // 第二阶段功能页：文字展示完后显示返回箭头
  guideFeatureIdx: 0,      // 第二阶段当前导览的功能索引
  guideInFeature: false,   // 第二阶段是否正在功能页面中
};

// 引导打字机相关（模块级）
let guideTimer = null;
let guideTypedIndex = 0;
let guideFullText = "";

const app = document.querySelector("#app");
let toastTimer;
let pendingTimer;

const routeMeta = {
  [ROUTES.HOME]: { resetOnEnter: true },
  [ROUTES.AI]: { resetOnFreshEnter: true },
  [ROUTES.TODO]: {},
  [ROUTES.EXECUTE]: {},
  [ROUTES.REVIEW]: {},
  [ROUTES.CARDS]: {},
  [ROUTES.PROFILE]: {},
  [ROUTES.DRAW]: { resetOnFreshEnter: true },
};

function updateStageScale() {
  const safePaddingX = 36;
  const safePaddingY = 28;
  const availableWidth = Math.max(window.innerWidth - safePaddingX * 2, 320);
  const availableHeight = Math.max(window.innerHeight - safePaddingY * 2, 320);
  const scale = Math.min(availableWidth / 1280, availableHeight / 800);

  document.documentElement.style.setProperty("--stage-scale", Math.max(scale, 0.48).toString());
  document.documentElement.style.setProperty("--viewport-safe-x", `${safePaddingX}px`);
  document.documentElement.style.setProperty("--viewport-safe-y", `${safePaddingY}px`);
}

function routeClass() {
  return `route-${state.route} nav-${state.transition}`;
}

function resetFlowState(destination = ROUTES.HOME) {
  clearTimeout(pendingTimer);
  state.modal = null;
  state.toast = null;
  if ([ROUTES.HOME, ROUTES.CARDS, ROUTES.REVIEW].includes(destination)) {
    state.aiPhase = "input";
    state.aiAttachment = null;
    state.aiLoading = false;
    state.aiError = "";
    state.aiSteps = [];
    state.drawnCard = null;
    state.drawPhase = "selecting";
    state.executeStatus = "idle";
  }
}

function syncRouteState(route, options = {}) {
  if (route === ROUTES.HOME && routeMeta[route].resetOnEnter) {
    resetFlowState(route);
  }

  if (route === ROUTES.AI && routeMeta[route].resetOnFreshEnter && options.fresh) {
    state.aiPhase = "input";
    state.aiAttachment = null;
    state.aiLoading = false;
    state.aiError = "";
    state.aiSteps = [];
  }

  if (route === ROUTES.DRAW && routeMeta[route].resetOnFreshEnter && options.fresh) {
    state.drawnCard = null;
    state.drawPhase = "selecting";
  }

  if (route === ROUTES.TODO && !state.todos.some((todo) => todo.id === state.selectedTodoId)) {
    state.selectedTodoId = state.todos[0]?.id ?? null;
  }

  if (route === ROUTES.TODO) normalizeTodoSelection();

  if (route === ROUTES.EXECUTE && state.executeStatus === "idle") {
    state.executeStatus = "running";
  }
}

function setHistory(route, mode) {
  if (mode === "reset") {
    state.history = [route];
    return;
  }

  if (mode === "replace") {
    state.history = [...state.history.slice(0, -1), route];
    if (!state.history.length) state.history = [route];
    return;
  }

  if (mode === "push") {
    if (state.history[state.history.length - 1] !== route) {
      state.history = [...state.history, route];
    }
  }
}

function navigate(route, options = {}) {
  const mode = options.mode || "push";
  const direction = options.direction || (mode === "back" ? "back" : "forward");
  if (!route || route === state.route) return;
  // 引导锁：引导激活时禁止手动导航，仅允许第二阶段内部导航
  if (state.guideActive && !options.fromGuide) return;
  if (!options.fromPending) clearTimeout(pendingTimer);
  if (!options.fromPending) clearTimeout(pendingTimer);
  state.previousRoute = state.route;
  state.route = route;
  state.transition = direction;
  state.modal = null;
  if (mode !== "back") setHistory(route, mode);
  syncRouteState(route, { fresh: options.fresh ?? (mode === "push" && state.previousRoute === ROUTES.HOME) });
  render();
}

function navigateFlowEnd(route) {
  resetFlowState(route);
  if (route === ROUTES.HOME) {
    navigate(ROUTES.HOME, { mode: "reset", direction: "back" });
    return;
  }
  state.history = [ROUTES.HOME];
  navigate(route, { mode: "push", direction: "forward", fresh: false });
}

function goBack() {
  if (state.route === ROUTES.HOME) return;
  clearTimeout(pendingTimer);
  const previous = state.history.length > 1 ? state.history[state.history.length - 2] : ROUTES.HOME;
  state.history = state.history.slice(0, -1);
  state.previousRoute = state.route;
  state.route = previous;
  state.transition = "back";
  state.modal = null;
  state.history = state.history.length ? state.history : [ROUTES.HOME];
  syncRouteState(previous, { fresh: false });
  render();
}

function finishToHome() {
  navigate(ROUTES.HOME, { mode: "reset", direction: "back" });
}

function setModal(modal) {
  state.modal = modal;
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

function showToast(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  render();
  toastTimer = setTimeout(() => {
    state.toast = null;
    render();
  }, 1800);
}

// ================================================================
//  新手引导函数（三阶段状态机）- 简化版
// ================================================================

// ---------- 渲染 ----------

function guideMarkup() {
  if (!state.guideActive) return "";

  const phase = state.guidePhase;
  let overlay = "<div class=\"guide-overlay\" id=\"guideOverlay\">";

  // 第二阶段：浮动气泡 + 箭头，不遮挡页面交互
  if (phase === 2) {
    if (state.guideMenuHint) {
      // 菜单收起提示：箭头指向切换按钮，气泡在中间偏下
      overlay += "<div class=\"guide-bubble\" id=\"guideBubble\" style=\"left:50%;top:48%;width:900px;height:440px;transform:translateX(-50%);\"><img src=\"" + asset("大气泡.png") + "\" alt=\"\" class=\"guide-bubble-bg\" /><span class=\"guide-bubble-text\" id=\"guideDialogText\"></span></div>";
      overlay += "<div class=\"guide-arrow-overlay\" id=\"guideArrow\"><img src=\"" + asset("指引箭头.png") + "\" alt=\"指引箭头\" /></div>";
    } else if (!state.guideInFeature && state.route === ROUTES.HOME) {
      overlay += "<div class=\"guide-bubble\" id=\"guideBubble\"><img src=\"" + asset("大气泡.png") + "\" alt=\"\" class=\"guide-bubble-bg\" /><span class=\"guide-bubble-text\" id=\"guideDialogText\"></span></div>";
      overlay += "<div class=\"guide-arrow-overlay\" id=\"guideArrow\"><img src=\"" + asset("指引箭头.png") + "\" alt=\"指引箭头\" /></div>";
    } else if (state.guideInFeature) {
      // 功能页面内：先显示气泡+三角标，点击后箭头+气泡提示出现
      if (!state.guideShowBackArrow) {
        const _triShow = state.guideTriangle;
        overlay += "<div class=\"guide-bubble guide-bubble-feature\" id=\"guideBubble\"><img src=\"" + asset("大气泡.png") + "\" alt=\"\" class=\"guide-bubble-bg\" /><span class=\"guide-bubble-text\" id=\"guideDialogText\"></span></div>";
        overlay += "<div class=\"guide-triangle " + (_triShow ? "" : "hidden") + "\" id=\"guideTri2\"><img src=\"" + asset("三角标.png") + "\" alt=\"提示\" /></div>";
      }
      if (state.guideShowBackArrow) {
        overlay += "<div class=\"guide-arrow-overlay\" id=\"guideArrow\" style=\"width:80px;height:80px;\"><img src=\"" + asset("指引箭头.png") + "\" alt=\"指引箭头\" /></div>";
        overlay += "<div class=\"guide-bubble guide-bubble-hint\" id=\"guideBubble\"><img src=\"" + asset("大气泡.png") + "\" alt=\"\" class=\"guide-bubble-bg\" /><span class=\"guide-bubble-text\" id=\"guideDialogText\" style=\"font-size:32px;padding:25px 40px;\"></span></div>";
      }
    }
  } else {
    // 第一/三阶段：螂王对话框
    overlay += "<div class=\"guide-bg-layer\"><img src=\"" + asset("大背景.png") + "\" alt=\"背景\" /></div>"
      + "<div class=\"guide-character-layer\"><img src=\"" + beetles.king + "\" alt=\"螂王角色\" /></div>"
      + "<div class=\"guide-dialog-bg\"><img src=\"" + asset("对话框 .png") + "\" alt=\"对话框\" /></div>"
      + "<div class=\"guide-dialog-text\" id=\"guideDialogText\"></div>"
      + "<div class=\"guide-character-label\">螂王</div>";

    // 三角标
    const showTri = state.guideTriangle && !state.guideOptions;
    overlay += "<div class=\"guide-triangle " + (showTri ? "" : "hidden") + "\"><img src=\"" + asset("三角标.png") + "\" alt=\"提示\" /></div>";

    // 选项按钮
    const steps = phase === 1 ? phase1Steps : phase3Steps;
    const step = steps[state.guideStep];
    if (step) {
      const hasOptions = step.options && step.options.length > 0;
      const hasBranches = step.branches && step.branches.length > 0;
      const showOv = state.guideOptions && (hasOptions || hasBranches);
      if (hasOptions || hasBranches) {
        let btns = "";
        if (hasBranches) {
          for (let i = 0; i < step.branches.length; i++) {
            const b = step.branches[i];
            btns += "<button class=\"guide-option-btn\" data-branch=\"" + b.key + "\">" + b.label + "</button>";
          }
        } else {
          for (let i = 0; i < step.options.length; i++) {
            btns += "<button class=\"guide-option-btn\" data-idx=\"" + i + "\">" + step.options[i] + "</button>";
          }
        }
        overlay += "<div class=\"guide-options-overlay " + (showOv ? "visible" : "") + "\" id=\"guideOptionsOverlay\"><div class=\"guide-options-container\">" + btns + "</div></div>";
      }
    }
  }

  overlay += "<div class=\"guide-click-overlay\" id=\"guideClickOverlay\"></div>";
  overlay += "</div>";
  return overlay;
}

// ---------- 获取当前要打字的文本 ----------

function guideGetTextSimple() {
  const p = state.guidePhase;
  if (p === 2) {
    if (state.guideMenuHint) return "请点击右侧「展开菜单」按钮，打开功能面板";
    const f = phase2Features[state.guideFeatureIdx];
    if (!f) return "";
    if (state.guideInFeature) {
      if (state.guideShowBackArrow) return "请点击左上角返回按钮，继续下一个功能";
      return f.explain;
    }
    return f.tip;
  }
  const steps = p === 1 ? phase1Steps : (p === 3 ? phase3Steps : null);
  if (!steps) return "";
  const s = steps[state.guideStep];
  if (!s) return "";
  if (s.segments) return s.segments[state.guideSegment] || "";
  if (s.text) return s.text;
  if (s.response) return s.response;
  return "";
}

// ---------- 打字机 ----------

function guideShowText() {
  const text = guideGetTextSimple();
  const el = document.getElementById("guideDialogText");
  if (!el) return;

  // 第二阶段气泡文字自动适配字号（根据文字长度精细调节）
  if (state.guidePhase === 2 && text) {
    const len = text.length;
    if (len > 35) { el.style.fontSize = "32px"; }
    else if (len > 25) { el.style.fontSize = "34px"; }
    else if (len > 18) { el.style.fontSize = "36px"; }
    else { el.style.fontSize = "38px"; }
    el.style.lineHeight = "1.35";
    el.style.padding = "40px 50px";
  }

  if (!text) {
    guideShowTriangle();
    return;
  }

  // === 打字机效果（三个阶段通用） ===
  state.guideTriangle = false;
  guideUpdateUI();
  el.textContent = "";

  if (guideTimer) { clearInterval(guideTimer); guideTimer = null; }
  guideFullText = text;
  guideTypedIndex = 0;

  guideTimer = setInterval(() => {
    const e2 = document.getElementById("guideDialogText");
    if (!e2) { clearInterval(guideTimer); guideTimer = null; return; }
    if (guideTypedIndex < guideFullText.length) {
      e2.textContent += guideFullText.charAt(guideTypedIndex);
      guideTypedIndex++;
    } else {
      clearInterval(guideTimer);
      guideTimer = null;
      guideShowTriangle();
    }
  }, 30);
}



function guideShowTriangle() {
  // 第二阶段：主页不显示三角标，功能页内箭头模式不显示，仅气泡模式显示
  if (state.guidePhase === 2) {
    if (state.guideInFeature && !state.guideShowBackArrow) {
      state.guideTriangle = true;
    } else {
      state.guideTriangle = false;
    }
    guideUpdateUI();
    return;
  }
  state.guideTriangle = true;
  guideUpdateUI();
}

function guideUpdateUI() {
  const tri = document.querySelector(".guide-triangle");
  if (tri) tri.classList.toggle("hidden", !state.guideTriangle);
  const tri2 = document.getElementById("guideTri2");
  if (tri2) tri2.classList.toggle("hidden", !state.guideTriangle);
  const ov = document.getElementById("guideOptionsOverlay");
  if (ov) ov.classList.toggle("visible", state.guideOptions);
  const co = document.getElementById("guideClickOverlay");
  if (co) {
    // 第二阶段：click-overlay 也要穿透，不阻挡页面交互
    if (state.guidePhase === 2) {
      co.style.pointerEvents = "none";
    } else {
      co.style.pointerEvents = state.guideOptions ? "none" : "auto";
    }
  }
  const guide = document.getElementById("guideOverlay");
  if (guide) guide.style.pointerEvents = "none";
  // 定位第二阶段箭头
  if (state.guidePhase === 2) guidePositionArrow();
}

// ---------- 推进到下一步（通用） ----------

function guideAdvanceToNextStep(phase) {
  const _stepsLen = phase === 1 ? phase1Steps.length : (phase === 3 ? phase3Steps.length : 0);
  if (state.guideStep < _stepsLen - 1) {
    state.guideStep++;
    state.guideSegment = 0;
    state.guideTriangle = false;
    state.guideOptions = false;
    state.guideBranchReturn = false;
    state.guideAfterBranch = false;
    state.guideShowBackArrow = false;
    render();
    guideShowText();
  } else {
    guideNextPhase();
  }
}

// ---------- 核心：点击推进 ----------

function guideAdvance() {
  if (state.guideOptions) return; // 选项用按钮点击，不进这里

  // 打字中 → 立即打完
  if (guideTimer) {
    clearInterval(guideTimer);
    guideTimer = null;
    const el = document.getElementById("guideDialogText");
    if (el) el.textContent = guideFullText;
    guideTypedIndex = guideFullText.length;
    // 如果是分支回应文字（Phase 3），打完也要标记 afterBranch
    if (state.guidePhase === 3) {
      const _st = phase3Steps[state.guideStep];
      if (_st && _st.branches) state.guideAfterBranch = true;
    }
    guideShowTriangle();
    return;
  }

  // 没有三角标 → 忽略（防御）
  if (!state.guideTriangle) return;

  // ===== 有三角标，执行推进 =====
  state.guideTriangle = false;
  guideUpdateUI();

  const phase = state.guidePhase;

  // Phase 2 的推进由 click 事件处理器直接管理，这里不处理
  if (phase === 2) return;

  // --- 第一/三阶段：对话推进 ---
  const stepsArr = phase === 1 ? phase1Steps : (phase === 3 ? phase3Steps : null);
  const step = stepsArr ? stepsArr[state.guideStep] : null;
  if (!step) { guideNextPhase(); return; }

  // 结束步骤 → 完成当前阶段
  if (step.isEnd) {
    guideNextPhase();
    return;
  }

// 分支C：返回选项界面（重新开始第二阶段）
    if (state.guideBranchReturn) {
      state.guideBranchReturn = false;
      guideRestartPhase2();
    return;
  }

  // 分支回应已打完，下次点击推进到下一步
  if (state.guideAfterBranch) {
    state.guideAfterBranch = false;
    guideAdvanceToNextStep(phase);
    return;
  }

  // 多段文本 → 下一段
  if (step.segments && state.guideSegment < step.segments.length - 1) {
    state.guideSegment++;
    guideShowText();
    return;
  }

  // 有选项/分支 → 显示
  if (step.branches || step.options) {
    state.guideOptions = true;
    guideUpdateUI();
    return;
  }

  // 推进到下一步
  guideAdvanceToNextStep(phase);
}

// ---------- 处理选项/分支点击 ----------

function guideHandleOption(indexOrKey, isBranch) {
  const steps = state.guidePhase === 1 ? phase1Steps : (state.guidePhase === 3 ? phase3Steps : null);
  const step = steps ? steps[state.guideStep] : null;
  if (!step) return;

  state.guideOptions = false;
  guideUpdateUI();
  state.guideSegment = 0;

  if (isBranch) {
    // ===== 分支选项（第三阶段） =====
    const branch = step.branches.find(b => b.key === indexOrKey);
    if (!branch) return;

    // 分支C：「我想再看一遍」→ 直接重启第二阶段，不显示回复文字
    if (branch.loop) {
      guideRestartPhase2();
      return;
    }

    // 打字显示分支回应
    guideFullText = branch.response;
    guideTypedIndex = 0;
    const el = document.getElementById("guideDialogText");
    if (el) el.textContent = "";
    guideTimer = setInterval(() => {
      const el2 = document.getElementById("guideDialogText");
      if (!el2) { clearInterval(guideTimer); guideTimer = null; return; }
      if (guideTypedIndex < guideFullText.length) {
        el2.textContent += guideFullText.charAt(guideTypedIndex);
        guideTypedIndex++;
      } else {
        clearInterval(guideTimer);
        guideTimer = null;
        // 分支回应打完显示三角标
        state.guideTriangle = true;
        // 非循环分支（A/B）设置标记，下次点击推进而非重新显示选项
        if (!branch.loop) state.guideAfterBranch = true;
        guideUpdateUI();
      }
    }, 35);
    return;
  }

  // ===== 普通选项（第一阶段） =====
  // 选项出现在所有段落后，点击选项直接推进到下一步
  guideAdvanceToNextStep(state.guidePhase);
}

// ---------- 阶段切换 ----------

function guideNextPhase() {
  clearInterval(guideTimer);
  guideTimer = null;

  if (state.guidePhase === 1) {
    // 第一阶段完成 → 进入第二阶段
    state.guidePhase = 2;
    state.guideStep = 0;
    state.guideSegment = 0;
    state.guideTriangle = false;
    state.guideOptions = false;
    state.guideBranchReturn = false;
    state.guideMenuHint = true;  // 先提示用户展开菜单
    state.guideShowBackArrow = false;
    state.guideFeatureIdx = 0;
    state.guideInFeature = false;
    state.menuOpen = false; // 菜单收起，让用户自己打开
    // 第二阶段从主页开始
    if (state.route !== ROUTES.HOME) {
      navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
    } else {
      render();
      guideShowText();
    }
    return;
  }

  if (state.guidePhase === 2) {
    // 第二阶段完成 → 进入第三阶段
    state.guidePhase = 3;
    state.guideStep = 0;
    state.guideSegment = 0;
    state.guideTriangle = false;
    state.guideOptions = false;
    state.guideBranchReturn = false;
    state.guideShowBackArrow = false;
    state.guideFeatureIdx = 0;
    state.guideInFeature = false;
    if (state.route !== ROUTES.HOME) {
      navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
    } else {
      render();
      guideShowText();
    }
    return;
  }

  if (state.guidePhase === 3) {
    // 第三阶段完成 → 引导结束
    completeGuide();
    return;
  }
}

// ---------- 引导完成 ----------

let _guideFadeTimer = null; // 淡出动画定时器

function completeGuide() {
  clearInterval(guideTimer);
  guideTimer = null;
  clearTimeout(_guideFadeTimer);
  state.guideActive = false;
  state.guidePhase = 4; // 已完成
  state.guideStep = 0;
  state.guideSegment = 0;
  state.guideTriangle = false;
  state.guideOptions = false;
  state.guideBranchReturn = false;
  state.guideMenuHint = false;
  state.guideShowBackArrow = false;
  state.guideFeatureIdx = 0;
  state.guideInFeature = false;

  // 确保回到主页，引导完全消失
  if (state.route !== ROUTES.HOME) {
    navigate(ROUTES.HOME, { mode: "reset", direction: "back" });
  }
  // 淡出动画
  const overlay = document.querySelector(".guide-overlay");
  if (overlay) {
    overlay.classList.add("fade-out");
    _guideFadeTimer = setTimeout(() => {
      render();
      _guideFadeTimer = null;
    }, 800);
  } else {
    render();
  }
  try { localStorage.setItem("beetle-guide-v1-seen", "1"); } catch (e) { /* ignore */ }
}

// ---------- 启动引导 ----------

function startGuide() {
  if (state.guideActive) return;
  clearInterval(guideTimer);
  clearTimeout(_guideFadeTimer);
  guideTimer = null;
  state.guideActive = true;
  state.guidePhase = 1;
  state.guideStep = 0;
  state.guideSegment = 0;
  state.guideTriangle = false;
  state.guideOptions = false;
  state.guideBranchReturn = false;
  state.guideAfterBranch = false;
  state.guideShowBackArrow = false;
  state.guideFeatureIdx = 0;
  state.guideInFeature = false;
  render();
}

// ---------- 回去重看：重启第二阶段 ----------

function guideRestartPhase2() {
  clearInterval(guideTimer);
  guideTimer = null;
  state.guidePhase = 2;
  state.guideStep = 0;
  state.guideSegment = 0;
  state.guideTriangle = false;
  state.guideOptions = false;
  state.guideBranchReturn = false;
  state.guideAfterBranch = false;
  state.guideMenuHint = true;
  state.guideShowBackArrow = false;
  state.guideFeatureIdx = 0;
  state.guideInFeature = false;
  state.menuOpen = false;
  if (state.route !== ROUTES.HOME) {
    navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
  } else {
    render();
    guideShowText();
  }
}

// ---------- 定位第二阶段指引箭头 & 气泡（动态跟随按钮） ----------

function guidePositionArrow() {
  const arrow = document.getElementById("guideArrow");
  if (!arrow) return;

  // ---- 菜单提示态：箭头指向切换按钮（翻转指向按钮） ----
  if (state.guideMenuHint) {
    const toggle = document.querySelector(".home-toggle-hotspot");
    if (!toggle) { arrow.style.display = "none"; return; }
    const stage = document.querySelector(".stage");
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const br = toggle.getBoundingClientRect();
    const sc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")) || 1;
    const btnCy = (br.top + br.height / 2 - sr.top) / sc;
    const btnR = (br.right - sr.left) / sc;
    arrow.style.display = "block";
    arrow.style.left = (btnR + 8) + "px";
    arrow.style.top = (btnCy - 30) + "px";
    arrow.classList.add("point-left"); // 翻转指向左边的切换按钮
    return;
  }

  // ---- 功能页面内：箭头指向返回按钮（仅在箭头模式下显示） ----
  if (state.guideInFeature) {
    if (!state.guideShowBackArrow) { arrow.style.display = "none"; return; }
    const backBtn = document.querySelector(".back-btn, .back-hotspot, [data-action=\"back\"]");
    if (!backBtn) { arrow.style.display = "none"; return; }
    const stage = document.querySelector(".stage");
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const br = backBtn.getBoundingClientRect();
    const sc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")) || 1;
    const btnCy = (br.top + br.height / 2 - sr.top) / sc;
    const btnR = (br.right - sr.left) / sc;
    arrow.style.display = "block";
    arrow.style.left = (btnR + 8) + "px";
    arrow.style.top = (btnCy - 35) + "px";
    arrow.classList.add("point-left");
    return;
  }

  const feat = phase2Features[state.guideFeatureIdx];
  if (!feat || state.route !== ROUTES.HOME) {
    arrow.style.display = "none";
    return;
  }
  const btn = document.querySelector(feat.selector);
  if (!btn) { arrow.style.display = "none"; return; }

  const stage = document.querySelector(".stage");
  if (!stage) return;
  const sr = stage.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  const sc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")) || 1;

  // 按钮中心Y坐标（相对于 stage）
  const btnCy = (br.top + br.height / 2 - sr.top) / sc;
  // 按钮右边缘X坐标
  const btnR = (br.right - sr.left) / sc;

  // ===== 箭头定位：放在按钮右侧，翻转指向按钮 =====
  const arrowW = 60;
  arrow.style.display = "block";
  arrow.style.left = (btnR - 6) + "px";
  arrow.style.top = (btnCy - arrowW / 2) + "px";
  arrow.classList.add("point-left");

  // ===== 气泡定位：紧跟箭头右侧，垂直对齐按钮 =====
  const bubble = document.getElementById("guideBubble");
  if (bubble) {
    bubble.style.position = "absolute";
    bubble.style.left = (btnR + 10) + "px";
    bubble.style.top = (btnCy - 220) + "px";
    bubble.style.width = "900px";
    bubble.style.height = "440px";
    bubble.style.transform = "none";
  }
}

// ---------- 检查是否自动弹出 ----------

function checkAutoGuide() {
  if (state.route !== ROUTES.HOME) return;
  // 硬性规则：仅在用户注册并登录后首次进入时触发
  // 本地调试时无 auth 也可通过 window.__forceGuide 触发
  if (!state.authUser && !window.__forceGuide) return;
  try {
    const seen = localStorage.getItem("beetle-guide-v1-seen");
    if (seen) return;
  } catch (e) { /* ignore */ }
  setTimeout(() => { if (!state.authLoading) startGuide(); }, 600);
}

function selectedTodo() {
  return state.todos.find((todo) => todo.id === state.selectedTodoId) || state.todos[0];
}

function selectTodo(todoId) {
  const todo = state.todos.find((item) => item.id === Number(todoId));
  if (!todo) return;
  state.selectedTodoId = todo.id;
  state.selectedTask = taskFromTodo(todo);
}

function normalizeTodoSelection() {
  if (!state.todos.length) {
    state.selectedTodoId = null;
    state.selectedTask = tasks[0];
    return;
  }

  if (!state.todos.some((todo) => todo.id === state.selectedTodoId)) {
    state.selectedTodoId = state.todos[0].id;
  }
  selectTodo(state.selectedTodoId);
}

function button(label, className = "", attrs = "") {
  return `<button class="ui-btn ${className}" ${attrs}><span>${label}</span></button>`;
}

function designFrame(name, className = "") {
  return `<div class="page-design ${className}" style="background-image:url('${design(name)}')"></div>`;
}

function backButton(extra = "") {
  return `<button class="round-btn back-btn" data-action="${extra || "back"}" aria-label="返回"><img src="${asset("操作按钮4.png")}" alt="" /><span>返回</span></button>`;
}

function homeTools() {
  return `
    <div class="floating-tools">
      <button class="tool-btn tool-gear" data-route="profile" data-profile-tab="settings" aria-label="设置"><img src="${asset("操作按钮1.png")}" alt="" /></button>
      <button class="tool-btn tool-mail" data-modal="message" aria-label="消息"><img src="${asset("操作按钮2.png")}" alt="" /></button>
      <button class="tool-btn tool-bell" data-modal="notice" aria-label="提醒"><img src="${asset("操作按钮3.png")}" alt="" /></button>
    </div>
  `;
}

function profileCard() {
  const name = authName(state.authUser);
  const email = authEmail(state.authUser);
  return `
    <button class="profile-card" data-route="profile">
      <span class="avatar-orb"></span>
      <span class="profile-text">
        <b>${state.authUser ? name : "点击登录"}</b>
        <small>Lv.3</small>
        <small>${state.authUser ? email : "注册 / 登录"}</small>
      </span>
    </button>
  `;
}

function kingMascot() {
  return `
    <div class="king-cloud">
      <img src="${beetles.king}" alt="螂王" />
    </div>
  `;
}

function renderHome() {
  return `
    <section class="page home-page">
      ${designFrame(state.menuOpen ? "主页2-王紫涵.png" : "主页1-王紫涵.png", "home-design")}
      ${authStatus()}
      <button class="hotspot home-profile-hotspot" data-route="profile" aria-label="个人中心"></button>
      <button class="hotspot home-tool-hotspot tool-gear-hotspot" data-route="profile" data-profile-tab="settings" aria-label="设置"></button>
      <button class="hotspot home-tool-hotspot tool-mail-hotspot" data-modal="message" aria-label="消息"></button>
      <button class="hotspot home-tool-hotspot tool-bell-hotspot" data-modal="notice" aria-label="提醒"></button>
      <button class="hotspot home-toggle-hotspot ${state.menuOpen ? "is-open" : "is-closed"}" data-action="toggle-menu" aria-label="${state.menuOpen ? "收起菜单" : "展开菜单"}"></button>
      ${
        state.menuOpen
          ? `
            <button class="hotspot home-menu-hotspot menu-ai" data-route="ai" aria-label="AI任务拆解"></button>
            <button class="hotspot home-menu-hotspot menu-draw" data-route="draw" aria-label="任务选择"></button>
            <button class="hotspot home-menu-hotspot menu-todo" data-route="todo" aria-label="待办管理"></button>
            <button class="hotspot home-menu-hotspot menu-review" data-route="review" aria-label="任务回顾"></button>
            <button class="hotspot home-menu-hotspot menu-cards" data-route="cards" aria-label="卡片收藏"></button>
          `
          : ""
      }
      <button class="hotspot home-cloud-hotspot" data-modal="notice" aria-label="云朵提示"></button>
      <button class="hotspot home-king-hotspot" data-route="profile" aria-label="螂王"></button>
    </section>
  `;
}

function authStatus() {
  return `
    <button
      class="auth-status ${state.authUser ? "is-authed" : ""}"
      data-modal="${state.authUser ? "account" : "auth"}"
      aria-label="${state.authLoading ? "账号同步中" : state.authUser ? `账号：${authName(state.authUser)}` : "注册或登录"}"
      title="${state.authLoading ? "账号同步中" : state.authUser ? authEmail(state.authUser) : "注册 / 登录"}"
    ></button>
  `;
}

function renderAi() {
  if (state.aiPhase === "generated" || state.aiPhase === "confirmed") {
    return `
      <section class="page ai-page">
        <div class="page-design ai-design generated" style="background-image:url('${design("AI任务拆解2.2-汪嫣然.png")}')"></div>
        <button class="hotspot back-hotspot" data-action="back" aria-label="返回"></button>
        <div class="ai-result-live" aria-live="polite">
          ${state.aiSteps
            .slice(0, 4)
            .map(
              (step, index) => `
                <section class="ai-result-card result-${index + 1}">
                  <strong>${step.title}</strong>
                  <span>${step.detail}</span>
                </section>
              `,
            )
            .join("")}
        </div>
        <button class="hotspot ai-choice-hotspot choice-a" data-action="toast" data-toast="${state.aiSteps[0]?.detail || ""}" aria-label="A"></button>
        <button class="hotspot ai-choice-hotspot choice-b" data-action="toast" data-toast="${state.aiSteps[1]?.detail || ""}" aria-label="B"></button>
        <button class="hotspot ai-choice-hotspot choice-c" data-action="toast" data-toast="${state.aiSteps[2]?.detail || ""}" aria-label="C"></button>
        <button class="hotspot ai-choice-hotspot choice-d" data-action="toast" data-toast="${state.aiSteps[3]?.detail || ""}" aria-label="D"></button>
        <button class="hotspot ai-confirm-hotspot" data-action="confirm-ai" aria-label="确认"></button>
        <button class="hotspot ai-reset-hotspot" data-action="reset-ai" aria-label="重新拆解"></button>
      </section>
    `;
  }

  return `
    <section class="page ai-page">
      <div class="page-design ai-design initial" style="background-image:url('${design("AI任务拆解2.1-汪嫣然.png")}')"></div>
      <button class="hotspot back-hotspot" data-action="back" aria-label="返回"></button>
      <textarea class="ai-task-input" aria-label="输入要拆解的大任务" placeholder="请输入文本（支持文件上传）">${state.aiInput}</textarea>
      <label class="ai-file-button" aria-label="上传任务文件">
        <input class="ai-file-input" type="file" accept=".txt,.md,.csv,.json,.doc,.docx,.pdf" />
        <span>＋</span>
      </label>
      <button class="ai-submit-button" data-action="start-ai" ${state.aiLoading ? "disabled" : ""}>
        ${state.aiLoading ? "拆解中" : "开始拆解"}
      </button>
      <div class="ai-file-name">${state.aiAttachment ? state.aiAttachment.name : "支持 .txt / .md / .csv / .json 文件正文读取"}</div>
      ${state.aiError ? `<div class="ai-error-note">${state.aiError}</div>` : ""}
      ${state.aiLoading ? `<div class="ai-loading-note">正在请读书螂拆解任务...</div>` : ""}
      <button class="hotspot ai-cloud-hotspot" data-action="start-ai" aria-label="今天想做些什么"></button>
      <button class="hotspot ai-core-hotspot" data-action="start-ai" aria-label="Click Me"></button>
    </section>
  `;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

function renderExecute() {
  return `
    <section class="page execute-page">
      ${designFrame(state.executeStatus === "paused" ? "任务执行2.3-汪嫣然.png" : "任务执行2.0-汪嫣然.png", "execute-design")}
      <button class="hotspot execute-back-hotspot" data-action="ask-abandon" aria-label="返回"></button>
      <button class="hotspot execute-complete-hotspot" data-action="complete-task" aria-label="完成任务"></button>
      <button class="hotspot execute-toggle-hotspot" data-action="toggle-execute" aria-label="${state.executeStatus === "paused" ? "继续执行" : "暂停任务"}"></button>
      <button class="hotspot execute-cancel-hotspot" data-action="ask-abandon" aria-label="取消任务"></button>
    </section>
  `;
}

function renderTodo() {
  const currentTodo = selectedTodo();
  const currentTask = currentTodo ? taskFromTodo(currentTodo) : state.selectedTask;
  return `
    <section class="page todo-page">
      ${designFrame("待办事项2-王紫涵.png", "todo-design")}
      <button class="hotspot todo-back-hotspot" data-action="back" aria-label="返回"></button>
      <button class="hotspot todo-draw-hotspot" data-route="draw" aria-label="抽卡"></button>
      <button class="hotspot todo-add-hotspot" data-modal="todo-new" aria-label="新增任务"></button>
      <button class="hotspot todo-remove-hotspot" data-action="ask-remove-done" aria-label="删除已完成"></button>
      <button class="hotspot todo-detail-hotspot" data-modal="todo-detail" aria-label="任务详情"></button>
      <button class="hotspot todo-execute-hotspot" data-action="execute-selected" aria-label="开始执行"></button>
      <button class="hotspot todo-side-hotspot side-one" data-action="toast" data-toast="已切换卡片视图" aria-label="卡片视图"></button>
      <button class="hotspot todo-side-hotspot side-two" data-action="toast" data-toast="排序方式已更新" aria-label="排序"></button>
      <button class="hotspot todo-side-hotspot side-three" data-action="toast" data-toast="插图功能稍后接入" aria-label="图片"></button>
      <button class="hotspot todo-side-hotspot side-four" data-modal="todo-new" aria-label="编辑"></button>
      <div class="todo-clean-list-panel" aria-hidden="true"></div>
      <div class="todo-clean-detail-panel" aria-hidden="true"></div>
      <div class="todo-live-list">
        ${state.todos
          .slice(0, 4)
          .map(
            (todo) => `
              <label class="todo-live-row ${state.selectedTodoId === todo.id ? "selected" : ""}">
                <input type="checkbox" data-todo="${todo.id}" ${todo.done ? "checked" : ""} />
                <button class="todo-live-label" data-action="select-todo" data-todo-id="${todo.id}">${todo.name.replace(/^任务名：/, "")}</button>
              </label>
            `,
          )
          .join("")}
      </div>
      <button class="todo-detail-copy" data-modal="todo-detail" aria-label="查看任务详情">
        <strong>${currentTask.name.replace(/^任务名：/, "")}</strong>
        ${currentTask.detail.slice(0, 4).map((line) => `<span>${line}</span>`).join("")}
      </button>
      <button class="todo-cheer-hotspot" data-action="toast" data-toast="加油，准备好了就开始吧" aria-label="加油"></button>
      <button class="todo-king-hotspot" data-route="profile" aria-label="螂王"></button>
      <button class="todo-acorn-plus-hotspot" data-modal="todo-new" aria-label="橡果加号"></button>
      <button class="todo-acorn-minus-hotspot" data-action="ask-remove-done" aria-label="橡果减号"></button>
    </section>
  `;
}

function renderCards() {
  const body =
    state.cardTab === "cards"
      ? `<div class="library-panel tab-panel">
          ${cards
            .map(
              (card) => `
                <button class="card-tile" data-card="${card.id}">
                  <span>${card.date}</span>
                  <img src="${asset("透明卡牌背面.png")}" alt="${card.title}" />
                </button>
              `,
            )
            .join("")}
        </div>`
      : `<div class="achievement-panel tab-panel">
          ${achievements
            .map(
              (item) => `
                <div class="achievement-row">
                  <span class="seal"></span>
                  <div><b>${item.title}</b><small>${item.desc}</small></div>
                  <strong>${item.progress}</strong>
                </div>
              `,
            )
            .join("")}
          <div class="achievement-total">已完成 12/50</div>
        </div>`;

  return `
    <section class="page cards-page">
      ${backButton()}
      <h1 class="page-title">卡牌库</h1>
      ${state.cardTab === "achievements" ? `<div class="search-pill">⌕ 搜索成就</div>` : ""}
      <nav class="library-tabs">
        <button class="tab ${state.cardTab === "cards" ? "active" : ""}" data-action="card-tab" data-tab="cards">卡牌</button>
        <button class="tab ${state.cardTab === "achievements" ? "active" : ""}" data-action="card-tab" data-tab="achievements">成就</button>
      </nav>
      ${body}
    </section>
  `;
}

function renderReview() {
  return `
    <section class="page review-page">
      ${backButton()}
      <h1 class="page-title">任务回顾</h1>
      <div class="review-book">
        <div class="date-pill">4月28日</div>
        ${[1, 2, 3].map(() => `<p>✓ <span></span></p>`).join("")}
        <div class="date-pill">4月28日</div>
        ${[1, 2, 3].map(() => `<p>✓ <span></span></p>`).join("")}
      </div>
      <button class="cloud-note" data-action="toast" data-toast="今日回顾已保存">太厉害!</button>
      <img class="review-character" src="${beetles.board}" alt="看板螂" />
      <div class="review-actions">
        <button data-action="toast" data-toast="分享面板稍后接入"><img src="${asset("操作按钮1.png")}" alt="" /><span>分享</span></button>
        <button data-action="toast" data-toast="已切换回顾样式"><img src="${asset("操作按钮2.png")}" alt="" /><span>切换</span></button>
      </div>
    </section>
  `;
}

function renderProfile() {
  const labels = [
    ["settings", "操作按钮1.png"],
    ["mail", "操作按钮2.png"],
    ["notice", "操作按钮3.png"],
  ];
  return `
    <section class="page profile-page">
      ${backButton()}
      <h1 class="page-title">个人中心</h1>
      ${!state.authUser ? `<button class="profile-login-call" data-modal="auth">注册 / 登录</button>` : ""}
      <nav class="profile-tabs">
        ${labels.map(([tab, icon]) => `<button class="${state.profileTab === tab ? "active" : ""}" data-action="profile-tab" data-tab="${tab}"><img src="${asset(icon)}" alt="" /></button>`).join("")}
      </nav>
      <div class="profile-grid tab-panel">
        <div class="profile-panel">
          <div class="profile-head">
            <img src="${beetles.king}" alt="金角大螂" />
            <div class="name-strip"><b>${state.authUser ? authName(state.authUser) : "游客螂"}</b><span>Lv.3</span></div>
          </div>
          ${profileRows.map((row) => `<button class="setting-row" data-action="toast" data-toast="${row[0]}编辑稍后接入"><span>${row[0]}</span><b>${row[1]}</b><em>›</em></button>`).join("")}
          <label class="export-row">一键导出任务记录 <input type="checkbox" /></label>
        </div>
        <div class="profile-panel">
          <div class="volume-row"><span>⌕×</span><i></i><b>⌕</b></div>
          ${["帮助与反馈", "内存", "语言", "字体", "桌宠功能", "兑换码"].map((label, idx) => `<button class="setting-row" data-action="toast" data-toast="${label}设置稍后接入"><span>${label}</span><b>${idx === 1 ? "100MB" : idx === 2 ? "中文" : idx === 3 ? "默认" : idx === 4 ? "开启" : ""}</b><em>›</em></button>`).join("")}
          <button class="code-input" data-action="toast" data-toast="兑换入口稍后接入">✎ 输入…… <em>›</em></button>
          <button class="logout" data-modal="${state.authUser ? "logout" : "auth"}">${state.authUser ? "退出登录 ⏻" : "注册 / 登录"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderDraw() {
  const picked = state.drawnCard;
  return `
    <section class="page draw-page">
      ${backButton()}
      <h1 class="page-title">抽卡</h1>
      <button class="history-btn" data-route="cards" data-mode="push"><img src="${asset("操作按钮4.png")}" alt="" /><span>历史</span></button>
      <img class="draw-king" src="${beetles.king}" alt="螂王" />
      <div class="pick-one">Pick One</div>
      <div class="card-fan ${state.drawPhase === "revealed" ? "has-pick" : ""}">
        ${cards.slice(0, 6).map((card, index) => `<button class="fan-card fan-${index} ${picked?.id === card.id ? "picked" : ""}" data-draw="${card.id}" ${picked ? "disabled" : ""}><img src="${asset("透明卡牌背面.png")}" alt="抽卡" /></button>`).join("")}
      </div>
      <div class="draw-tip">选择一张卡片，开启你的任务之旅吧!</div>
      ${
        picked
          ? `<div class="draw-result">
              <div class="result-card"><img src="${picked.character}" alt="${picked.title}" /><strong>${picked.title}</strong></div>
              <div class="result-actions">${button("确认", "paper", 'data-action="confirm-draw"')}${button("重抽", "paper", 'data-action="redraw"')}</div>
            </div>`
          : ""
      }
    </section>
  `;
}

function toastMarkup() {
  return state.toast ? `<div class="toast" role="status">${state.toast}</div>` : "";
}

function modalShell(content, className = "", options = {}) {
  const dismiss = options.dismissible === false ? "false" : "true";
  return `<div class="modal-layer ${className}" data-dismissible="${dismiss}">${content}</div>`;
}

function modalMarkup() {
  if (!state.modal) return "";

  if (state.modal === "auth") {
    const isSignup = state.authMode === "signup";
    return modalShell(`
      <form class="auth-dialog" data-auth-form="${state.authMode}" role="dialog" aria-modal="true">
        <h2>${isSignup ? "注册王国账号" : "登录王国账号"}</h2>
        <p>${isSignup ? "创建账号后，你的任务旅程就能和邮箱身份绑定。" : "登录后继续你的任务拆解、待办与卡牌旅程。"}</p>
        ${isSignup ? `<input id="authName" name="name" autocomplete="name" placeholder="昵称" />` : ""}
        <input id="authEmail" name="email" type="email" autocomplete="email" required placeholder="邮箱" />
        <input id="authPassword" name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" required placeholder="密码" />
        ${state.authError ? `<div class="auth-error">${state.authError}</div>` : ""}
        <button class="auth-submit" type="submit" ${state.authSubmitting ? "disabled" : ""}>${state.authSubmitting ? "处理中..." : isSignup ? "注册" : "登录"}</button>
        <button class="auth-switch" type="button" data-action="switch-auth">${isSignup ? "已有账号，去登录" : "没有账号，去注册"}</button>
      </form>
    `, "auth-modal-layer");
  }

  if (state.modal === "account") {
    const guideDone = state.guidePhase === 4 || state.guidePhase === 0;
    return modalShell(`
      <div class="auth-dialog account-dialog" role="dialog" aria-modal="true">
        <h2>王国档案</h2>
        <p>${authName(state.authUser)}</p>
        <strong>${authEmail(state.authUser)}</strong>
        ${button("进入个人中心", "orange", 'data-route="profile"')}
        ${guideDone ? button("看完了", "paper", 'data-action="guide-review"') : ""}
        ${button("退出登录", "paper", 'data-modal="logout"')}
      </div>
    `, "auth-modal-layer");
  }

  if (state.modal === "message" || state.modal === "notice") {
    const title = state.modal === "message" ? "消息" : "提醒";
    const text = state.modal === "message" ? "任务A正在等待拆解结果，今日还有 3 条待办未完成。" : "今天还有一张任务卡可以抽取，完成后会进入回顾。";
    return modalShell(`
      <div class="message-modal" role="dialog" aria-modal="true">
        <h2>${title}</h2>
        <p>${text}</p>
        ${button(state.modal === "message" ? "查看任务" : "去抽卡", "orange", `data-route="${state.modal === "message" ? "todo" : "draw"}"`)}
      </div>
    `);
  }

  if (state.modal === "complete") {
    const reward = rewardCardForTask(state.selectedTask);
    return modalShell(`
      <div class="cloud-modal">
        <h2>我就知道<br />你可以的</h2>
        <p class="reward-line">获得：${reward.title}</p>
        ${button("查看卡牌", "orange", 'data-action="finish-to-cards"')}
        ${button("任务回顾", "orange", 'data-action="finish-to-review"')}
        ${button("返回首页", "paper", 'data-action="finish-home"')}
        <img src="${beetles.worker}" alt="小二螂" />
        <img class="gold-ball" src="${asset("Golden Dung Ball.jpg")}" alt="奖励金球" />
      </div>
    `, "golden", { dismissible: false });
  }

  if (state.modal === "cancel" || state.modal === "logout" || state.modal === "remove-done") {
    const copy = {
      cancel: ["真的要放弃吗", "再想想", "确定", "abandon-task"],
      logout: ["确定退出登录吗", "留下", "退出", "confirm-logout"],
      "remove-done": ["删除已完成任务吗", "取消", "删除", "remove-done"],
    }[state.modal];
    return modalShell(`
      <div class="cloud-modal cancel-modal">
        <h2>${copy[0]}</h2>
        <img src="${beetles.cleaner}" alt="保洁螂" />
        ${button(copy[1], "orange", 'data-action="close-modal"')}
        <button class="text-choice" data-action="${copy[3]}">${copy[2]}</button>
      </div>
    `, "dark", { dismissible: false });
  }

  if (state.modal === "todo-new" || state.modal === "todo-detail") {
    const isDetail = state.modal === "todo-detail";
    return modalShell(`
      <div class="paper-dialog">
        <h2>${isDetail ? "任务详情" : "新增任务"}</h2>
        <input id="newTaskName" value="${isDetail ? state.selectedTask.name : ""}" placeholder="任务名：请输入" />
        ${button(isDetail ? "保存" : "加入待办", "orange", `data-action="${isDetail ? "save-task" : "add-todo"}"`)}
        ${isDetail ? button("开始执行", "paper", 'data-action="execute-selected"') : ""}
      </div>
    `);
  }

  if (state.modal === "card-detail") {
    const card = state.selectedCard;
    return modalShell(`
      <div class="card-detail-modal">
        <div class="collected-card">
          <img src="${card.character}" alt="${card.title}" />
          <strong>${card.date}收集</strong>
        </div>
        <div class="card-info">
          <p>▣ 收集时间：<b>${card.date}</b></p>
          <p>☆ 任务名称：<b>${card.title}</b></p>
          <p>▤ 备注：${card.note}</p>
          <p>◉ 收集地点：${card.place}</p>
          <p>✧ 稀有度：${"★".repeat(card.rarity)}</p>
          <p>♡ 喜爱度：<b>${card.love}</b></p>
        </div>
      </div>
    `, "card-modal-layer");
  }

  return "";
}

function render() {
  const pages = {
    [ROUTES.HOME]: renderHome,
    [ROUTES.AI]: renderAi,
    [ROUTES.TODO]: renderTodo,
    [ROUTES.EXECUTE]: renderExecute,
    [ROUTES.REVIEW]: renderReview,
    [ROUTES.CARDS]: renderCards,
    [ROUTES.PROFILE]: renderProfile,
    [ROUTES.DRAW]: renderDraw,
  };

  app.innerHTML = `
    <main class="stage ${routeClass()}">
      <div class="page-transition" data-route="${state.route}">
        ${pages[state.route]()}
      </div>
      ${guideMarkup()}
      ${modalMarkup()}
      ${toastMarkup()}
    </main>
  `;
  // 引导激活时启动打字机
  if (state.guideActive) {
    setTimeout(() => guideShowText(), 50);
  }
}

function handleRoute(target) {
  const tab = target.dataset.tab;
  const profileTab = target.dataset.profileTab;
  const mode = target.dataset.mode || "push";
  if (tab) state.cardTab = tab;
  if (profileTab) state.profileTab = profileTab;
  const route = target.dataset.route;

  // 引导期间：第二阶段功能导览需要导航，跳过登录检测
  if (state.guideActive && state.guidePhase === 2 && route) {
    navigate(route, { mode: "push", direction: "forward", fromGuide: true });
    return;
  }

  if (requiresAuth(route) && !state.authUser) {
    state.pendingRoute = route;
    state.authMode = "login";
    state.authError = "请先注册或登录，再进入这个功能。";
    setModal("auth");
    return;
  }
  navigate(route, { mode, fresh: true });
}

function requiresAuth(route) {
  return [ROUTES.AI, ROUTES.TODO, ROUTES.EXECUTE, ROUTES.REVIEW, ROUTES.CARDS, ROUTES.DRAW].includes(route);
}

async function handleAction(action, target) {
  if (action === "back") goBack();
  if (action === "toggle-menu") {
    const wasOpen = state.menuOpen;
    state.menuOpen = !state.menuOpen;
    render();
    // 第二阶段菜单提示态：用户展开菜单后自动推进到功能指引
    if (state.guidePhase === 2 && state.guideMenuHint && state.menuOpen && !wasOpen) {
      state.guideMenuHint = false;
      state.guideFeatureIdx = 0;
      guideShowText();
    }
  }
  if (action === "switch-auth") {
    state.authMode = state.authMode === "login" ? "signup" : "login";
    state.authError = "";
    render();
  }
  if (action === "start-ai") {
    const input = document.querySelector(".ai-task-input");
    state.aiInput = input?.value?.trim() || state.aiInput;
    if (!state.aiInput && !state.aiAttachment) {
      state.aiError = "请先输入任务内容，或上传一个任务文件。";
      render();
      return;
    }
    state.aiLoading = true;
    state.aiError = "";
    render();

    try {
      state.aiSteps = await decomposeTaskWithDeepSeek(state.aiInput, state.aiAttachment);
      state.aiPhase = "generated";
      showToast("AI 拆解完成");
    } catch (error) {
      state.aiSteps = createAiTaskBreakdown(state.aiInput);
      state.aiPhase = "generated";
      state.aiError = error.message.includes("Missing DEEPSEEK_API_KEY") ? "服务端未配置 Key，已使用本地演示拆解。" : "AI 请求失败，已使用本地演示拆解。";
      showToast(state.aiError);
    } finally {
      state.aiLoading = false;
      render();
    }
  }
  if (action === "confirm-ai") {
    if (state.aiPhase === "confirmed") return;
    state.todos = [...createTodosFromAi(state.aiSteps), ...state.todos];
    state.selectedTodoId = state.todos[0].id;
    state.selectedTask = taskFromTodo(state.todos[0]);
    state.aiPhase = "confirmed";
    showToast("已加入任务池");
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => navigate(ROUTES.TODO, { mode: "replace", direction: "forward", fromPending: true }), 900);
  }
  if (action === "reset-ai") {
    state.aiPhase = "input";
    state.aiAttachment = null;
    state.aiLoading = false;
    state.aiError = "";
    state.aiSteps = [];
    render();
  }
  if (action === "toggle-execute") {
    state.executeStatus = state.executeStatus === "running" ? "paused" : "running";
    render();
  }
  if (action === "complete-task") {
    state.executeStatus = "complete";
    setModal("complete");
  }
  if (action === "ask-abandon") setModal("cancel");
  if (action === "abandon-task") finishToHome();
  if (action === "ask-remove-done") setModal("remove-done");
  if (action === "remove-done") {
    state.todos = state.todos.filter((todo) => !todo.done);
    normalizeTodoSelection();
    closeModal();
    showToast("已删除完成项");
  }
  if (action === "close-modal") closeModal();
  if (action === "card-tab") {
    state.cardTab = target.dataset.tab;
    render();
  }
  if (action === "profile-tab") {
    state.profileTab = target.dataset.tab;
    showToast(target.dataset.tab === "mail" ? "消息设置已打开" : target.dataset.tab === "notice" ? "提醒设置已打开" : "设置已打开");
    render();
  }
  if (action === "add-todo") {
    const input = document.querySelector("#newTaskName");
    const value = input?.value?.trim() || "新的任务";
    const todo = makeTodo(value);
    state.todos.push(todo);
    selectTodo(todo.id);
    closeModal();
    showToast("已加入待办");
  }
  if (action === "save-task") {
    const input = document.querySelector("#newTaskName");
    const value = input?.value?.trim();
    if (value) {
      state.selectedTask = { ...state.selectedTask, name: value.replace(/^任务名：/, "") };
      state.todos = state.todos.map((todo) => (todo.id === state.selectedTodoId ? { ...todo, name: value.startsWith("任务名：") ? value : `任务名：${value}` } : todo));
    }
    closeModal();
    showToast("任务已更新");
  }
  if (action === "select-todo") {
    selectTodo(target.dataset.todoId);
    showToast("已选中任务");
    render();
  }
  if (action === "execute-selected") {
    const todo = selectedTodo();
    if (todo) state.selectedTask = taskFromTodo(todo);
    state.executeStatus = "running";
    navigate(ROUTES.EXECUTE, { mode: "push", direction: "forward" });
  }
  if (action === "redraw") {
    state.drawnCard = null;
    state.drawPhase = "selecting";
    render();
  }
  if (action === "confirm-draw") {
    state.selectedTask = tasks.find((task) => task.name === state.drawnCard?.title) || tasks[0];
    state.executeStatus = "running";
    navigate(ROUTES.EXECUTE, { mode: "replace", direction: "forward" });
  }
  if (action === "confirm-logout") {
    state.authSubmitting = true;
    render();
    try {
      await logoutCurrentUser();
      state.authUser = null;
      state.pendingRoute = null;
      closeModal();
      showToast("已退出登录");
      if (requiresAuth(state.route)) finishToHome();
    } catch (error) {
      state.authError = authErrorMessage(error);
      state.modal = "auth";
      render();
    } finally {
      state.authSubmitting = false;
    }
  }
  if (action === "finish-to-cards") {
    state.cardTab = "cards";
    navigateFlowEnd(ROUTES.CARDS);
  }
  if (action === "finish-to-review") navigateFlowEnd(ROUTES.REVIEW);
  if (action === "finish-home") finishToHome();
  if (action === "toast") showToast(target.dataset.toast || "功能稍后接入");
  if (action === "guide-review") {
    closeModal();
    // 回到第三阶段分支对话
    clearInterval(guideTimer);
    guideTimer = null;
    state.guideActive = true;
    state.guidePhase = 3;
    state.guideStep = 1; // 分支步骤
    state.guideSegment = 1; // 分支之前的最后一段
    state.guideTriangle = false;
    state.guideOptions = true;
    state.guideBranchReturn = false;
    state.guideAfterBranch = false;
    state.guideMenuHint = false;
    state.guideShowBackArrow = false;
    state.guideFeatureIdx = 0;
    state.guideInFeature = false;
    if (state.route !== ROUTES.HOME) {
      navigate(ROUTES.HOME, { mode: "reset", direction: "back" });
    } else {
      render();
    }
  }
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");

  // ===== 新手引导点击处理 =====
  if (state.guideActive) {
    // 选项按钮点击
    if (target && target.classList.contains("guide-option-btn")) {
      const isBranch = target.dataset.branch !== undefined;
      if (isBranch) {
        guideHandleOption(target.dataset.branch, true);
      } else {
        guideHandleOption(parseInt(target.dataset.idx), false);
      }
      return;
    }

    // 第二阶段：功能导览 - 点击功能按钮
    if (state.guidePhase === 2 && !state.guideInFeature && target && target.dataset.route) {
      const feat = phase2Features[state.guideFeatureIdx];
      if (feat && target.dataset.route === feat.route) {
        state.guideInFeature = true;
        state.guideShowBackArrow = false;
        state.guideSegment = 0;
        handleRoute(target);
        guideShowText();
        return;
      }
      return;
    }

    // 第二阶段：功能导览 - 点击任意处切换到箭头指引模式（不显示三角标）
    if (state.guidePhase === 2 && state.guideInFeature && !state.guideShowBackArrow && event.target.closest(".guide-overlay")) {
      state.guideShowBackArrow = true;
      state.guideTriangle = false;
      render();
      return;
    }

    // 第二阶段：功能导览 - 点击返回按钮
    if (state.guidePhase === 2 && state.guideInFeature && target) {
      const action = target.dataset.action;
      if (action === "back" || target.classList.contains("back-btn") || target.classList.contains("back-hotspot")) {
        const isLast = state.guideFeatureIdx >= phase2Features.length - 1;
        // 先标记离开功能页面，防止中间 render 显示旧提示
        state.guideInFeature = false;
        state.guideShowBackArrow = false;
        state.guideSegment = 0;
        if (isLast) {
          // 最后一个功能：直接进第三阶段，不显示旧的指引文字
          goBack();
          guideNextPhase();
        } else {
          // 非最后一个：递增索引后再返回，render 直接显示下一个功能的指引
          state.guideFeatureIdx++;
          goBack();
        }
        return;
      }
      return;
    }

    // 第一/三阶段：引导区域点击 → 推进对话
    if (state.guidePhase !== 2 && event.target.closest(".guide-overlay")) {
      guideAdvance();
      return;
    }
    // 第二阶段：不拦截任何点击
    if (state.guidePhase === 2) {
      // 穿透到下面的正常处理逻辑
    } else {
      return;
    }
  }

  if (!target && event.target.classList.contains("modal-layer")) {
    if (event.target.dataset.dismissible !== "false") closeModal();
    return;
  }

  if (!target) return;

  if (target.dataset.route) {
    handleRoute(target);
    return;
  }

  if (target.dataset.modal) {
    setModal(target.dataset.modal);
    return;
  }

  if (target.dataset.card) {
    state.selectedCard = cards.find((card) => card.id === Number(target.dataset.card));
    setModal("card-detail");
    return;
  }

  if (target.dataset.draw) {
    state.drawnCard = cards.find((card) => card.id === Number(target.dataset.draw));
    state.drawPhase = "revealed";
    render();
    return;
  }

  const action = target.dataset.action;
  if (action) handleAction(action, target);
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-auth-form]");
  if (!form) return;
  event.preventDefault();

  const email = form.email?.value?.trim();
  const password = form.password?.value || "";
  const name = form.name?.value?.trim() || "";
  state.authSubmitting = true;
  state.authError = "";
  render();

  try {
    const user = state.authMode === "signup" ? await signupWithEmail(email, password, name) : await loginWithEmail(email, password);
    state.authUser = user;
    state.modal = null;
    state.authLoading = false;
    showToast(user.emailVerified === false ? "注册成功，请前往邮箱确认账号。" : "登录成功");
    // 登录成功后检查是否需要弹出新手引导
    if (!state.pendingRoute || localStorage.getItem("beetle-guide-v1-seen")) {
      checkAutoGuide();
    } else {
      // 有 pendingRoute（登录前点击的功能按钮），先进功能再触发引导
      const route = state.pendingRoute;
      state.pendingRoute = null;
      navigate(route, { mode: "push", fresh: true });
      // 等路由稳定后再触发引导
      setTimeout(() => checkAutoGuide(), 100);
    }
  } catch (error) {
    state.authError = authErrorMessage(error);
    render();
  } finally {
    state.authSubmitting = false;
  }
});

app.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-todo]");
  if (!checkbox) {
    if (event.target.classList.contains("ai-task-input")) {
      state.aiInput = event.target.value.trim();
    }
    return;
  }
  const todo = state.todos.find((item) => item.id === Number(checkbox.dataset.todo));
  if (todo) todo.done = checkbox.checked;
  render();
});

app.addEventListener("input", (event) => {
  if (event.target.classList.contains("ai-task-input")) {
    state.aiInput = event.target.value;
  }
});

app.addEventListener("keydown", (event) => {
  if (!event.target.classList.contains("ai-task-input")) return;
  if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
  event.preventDefault();
  handleAction("start-ai", event.target);
});

app.addEventListener("change", async (event) => {
  if (!event.target.classList.contains("ai-file-input")) return;

  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const isTextLike = /\.(txt|md|csv|json)$/i.test(file.name);
    state.aiAttachment = {
      name: file.name,
      content: isTextLike ? await readFileAsText(file) : `用户上传了文件：${file.name}。当前前端原型暂未解析该文件正文，请结合文件名和用户输入进行拆解。`,
    };
    showToast(`已选择文件：${file.name}`);
  } catch {
    state.aiAttachment = null;
    showToast("文件读取失败");
  }

  render();
});

window.addEventListener("resize", updateStageScale);
updateStageScale();
render();

// 暴露调试接口
window.startGuide = typeof startGuide !== 'undefined' ? startGuide : function(){};
window.completeGuide = typeof completeGuide !== 'undefined' ? completeGuide : function(){};
window.skipGuide = typeof completeGuide !== 'undefined' ? completeGuide : function(){};

initializeAuth({
  onChange(user) {
    state.authUser = user || null;
    state.authLoading = false;
    render();
    // 首次加载完成后检查是否需要自动弹出新手引导
    checkAutoGuide();
  },
  onMessage(message) {
    state.authLoading = false;
    showToast(message);
  },
}).catch((error) => {
  state.authLoading = false;
  state.authError = authErrorMessage(error);
  render();
});
