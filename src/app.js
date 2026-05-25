import { achievements, asset, beetles, cards, navItems, profileRows, tasks, todos as todoSeed } from "./data.js";
import { authEmail, authErrorMessage, authName, initializeAuth, loginWithEmail, logoutCurrentUser, signupWithEmail } from "./authService.js";
import { decomposeTaskWithDeepSeek } from "./deepseekService.js";
import { createAiTaskBreakdown, createTodosFromAi, makeTodo, rewardCardForTask, taskFromTodo } from "./mockServices.js";
const ASSET_VERSION = "20260525-journey-progress";
const design = (name) => `./Page_View/${name}?v=${ASSET_VERSION}`;
const LOCAL_AUTH_STORAGE_KEY = "beetle-kingdom-local-auth";
const BGM_STORAGE_KEY = "beetle-kingdom-bgm";
const BGM_VOLUME_STORAGE_KEY = "beetle-kingdom-bgm-volume";
const HOME_ANIMATIONS_STORAGE_KEY = "beetle-home-animations-enabled";
const JOURNEY_PROGRESS_STORAGE_KEY = "beetle-journey-progress-v1";
const IS_LOCAL_PREVIEW = window.location.protocol === "file:" || ["", "localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const LOCAL_PREVIEW_USER = {
  name: "本地测试员",
  email: "123@local.preview",
  user_metadata: { full_name: "本地测试员" },
  emailVerified: true,
  localPreview: true,
};

function readLocalPreviewUser() {
  if (!IS_LOCAL_PREVIEW) return null;
  try {
    return sessionStorage.getItem(LOCAL_AUTH_STORAGE_KEY) === "active" ? LOCAL_PREVIEW_USER : null;
  } catch {
    return null;
  }
}

function setLocalPreviewSession(active) {
  if (!IS_LOCAL_PREVIEW) return;
  try {
    if (active) sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, "active");
    else sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
  } catch {
    // Session storage can be unavailable in strict privacy modes; the in-memory state still works.
  }
}

function readStoredBgmVolume() {
  try {
    const stored = Number(localStorage.getItem(BGM_VOLUME_STORAGE_KEY));
    return Number.isFinite(stored) ? Math.min(Math.max(stored, 0), 1) : 0.45;
  } catch {
    return 0.45;
  }
}

function hasSeenGuide() {
  try {
    return localStorage.getItem(GUIDE_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readStoredHomeAnimationsEnabled(isAuthed = Boolean(readLocalPreviewUser())) {
  if (!isAuthed) return false;

  try {
    const stored = localStorage.getItem(HOME_ANIMATIONS_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {}

  return hasSeenGuide();
}

function persistHomeAnimationsEnabled(enabled) {
  try {
    localStorage.setItem(HOME_ANIMATIONS_STORAGE_KEY, String(Boolean(enabled)));
  } catch {}
}

function readJourneyProgress() {
  const fallback = { completedTasks: [], unlockedCardIds: [] };

  try {
    const raw = localStorage.getItem(JOURNEY_PROGRESS_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const completedTasks = Array.isArray(parsed.completedTasks)
      ? parsed.completedTasks
          .filter(Boolean)
          .map((item, index) => {
            const completedAt = item.completedAt || new Date().toISOString();
            return {
              id: Number(item.id) || Date.now() + index,
              taskId: Number(item.taskId) || 0,
              taskName: String(item.taskName || "未命名任务"),
              unlockedCardId: Number(item.unlockedCardId) || 0,
              completedAt,
              completedDate: item.completedDate || formatReviewDate(completedAt),
              completedAtText: item.completedAtText || `${formatReviewDate(completedAt)} ${formatUserTime(new Date(completedAt))}`,
            };
          })
      : [];
    const unlockedCardIds = Array.isArray(parsed.unlockedCardIds)
      ? [...new Set(parsed.unlockedCardIds.map((value) => Number(value)).filter((value) => Number.isFinite(value)))]
      : [];

    return { completedTasks, unlockedCardIds };
  } catch {
    return fallback;
  }
}

function persistJourneyProgress() {
  try {
    localStorage.setItem(
      JOURNEY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        completedTasks: state.completedTasks,
        unlockedCardIds: state.unlockedCardIds,
      }),
    );
  } catch {}
}

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

const GUIDE_SEEN_STORAGE_KEY = "beetle-guide-v1-seen";

const phase1Steps = [
  {
    text: "造物主，你终于来了。我们日夜祈祷，终于等到你降临的这一刻。",
    options: ["我是谁？", "这里是哪里？", "为何寻我前来？"],
  },
  {
    segments: [
      "先让我自我介绍一下，我是屎克螂王国的国王。",
      "我们的王国曾经富饶而繁荣，人民安居乐业，资源充沛。",
      "可一场突如其来的灾荒改变了一切，我们急需你的帮助。 ",
    ],
    options: ["我愿意帮你们。", "我该怎么做？", "先带我看看这里。"],
  },
  {
    segments: [
      "感谢您愿意伸出援手！",
      "请跟我来，我会带您认识这个王国的各项能力。",
    ],
  },
];

const phase2Features = [
  {
    id: "ai",
    selector: ".menu-ai",
    route: ROUTES.AI,
    tip: "点击这里，开始拆解任务。",
    explain: "这是 AI 任务拆解页。输入任务内容，系统会把大任务拆成可执行的小步骤。",
  },
  {
    id: "draw",
    selector: ".menu-draw",
    route: ROUTES.DRAW,
    tip: "点击这里，抽取一张任务卡牌。",
    explain: "这是任务选择页。你可以通过抽卡开启一段新的任务流程。",
  },
  {
    id: "todo",
    selector: ".menu-todo",
    route: ROUTES.TODO,
    tip: "点击这里，查看待办清单。",
    explain: "这是待办管理页。你可以勾选完成项、排序任务，也能继续执行选中的任务。",
  },
  {
    id: "review",
    selector: ".menu-review",
    route: ROUTES.REVIEW,
    tip: "点击这里，回顾你的任务记录。",
    explain: "这是任务回顾页。完成过的流程会沉淀在这里，方便你回看进展。",
  },
  {
    id: "cards",
    selector: ".menu-cards",
    route: ROUTES.CARDS,
    tip: "点击这里，浏览卡牌收藏。",
    explain: "这是卡牌收藏页。你收集到的角色与奖励都会展示在这里。",
  },
];

const phase3Steps = [
  {
    text: "造物主，所有功能都已经准备好了，这座王国现在可以真正为你所用。",
  },
  {
    segments: [
      "这片王国很大，你可以随时回来继续探索。",
      "还有一些细节和惊喜，留给你亲自去发现会更有趣。",
    ],
    branches: [
      { label: "好的，我明白了", key: "A", response: "那就把这片王国交给您了，造物主大人。" },
      { label: "你先退下", key: "B", response: "臣告退。若您有需要，随时可以再唤我出来。" },
      { label: "我想再看一遍", key: "C", loop: true },
    ],
  },
  {
    text: "愿你在这片大陆上玩得尽兴，也走得长远。新的旅程，从现在开始。",
    isEnd: true,
  },
];

const DRAW_MODES = {
  TASK: "task",
  ACTION: "action",
};

const actionCards = [
  {
    id: "action-study",
    title: "专注搬运",
    category: "学习",
    detail: "专注学习/工作 25 分钟",
    reward: "奖励: +15 能量",
    icon: "book",
    accent: "#4d76be",
  },
  {
    id: "action-life",
    title: "巢穴整理",
    category: "生活",
    detail: "整理桌面或背包 10 分钟",
    reward: "奖励: +10 秩序值",
    icon: "nest",
    accent: "#6d8b39",
  },
  {
    id: "action-health",
    title: "叶露补给",
    category: "健康",
    detail: "喝一杯水，并伸展 5 分钟",
    reward: "奖励: +10 体力",
    icon: "drop",
    accent: "#4a9eb7",
  },
  {
    id: "action-social",
    title: "友情传信",
    category: "社交",
    detail: "给一位朋友发一条问候",
    reward: "奖励: +12 亲密值",
    icon: "mail",
    accent: "#cb6c63",
  },
  {
    id: "action-create",
    title: "灵感涂鸦",
    category: "创作",
    detail: "记录一个想法，写/画 5 分钟",
    reward: "奖励: +15 灵感",
    icon: "feather",
    accent: "#8b63b7",
  },
  {
    id: "action-challenge",
    title: "勇气探路",
    category: "挑战",
    detail: "完成一件拖延最久的小事",
    reward: "奖励: +20 勇气",
    icon: "flag",
    accent: "#d07c33",
  },
];

function guideCurrentSteps() {
  if (state.guidePhase === 1) return phase1Steps;
  if (state.guidePhase === 3) return phase3Steps;
  return null;
}

function guideCurrentStep() {
  const steps = guideCurrentSteps();
  return steps?.[state.guideStep] ?? null;
}

const state = {
  route: ROUTES.HOME,
  previousRoute: ROUTES.HOME,
  transition: "forward",
  history: [ROUTES.HOME],
  menuOpen: true,
  modal: null,
  authMode: "login",
  authLoading: !IS_LOCAL_PREVIEW,
  authSubmitting: false,
  authError: "",
  authUser: readLocalPreviewUser(),
  pendingRoute: null,
  toast: null,
  selectedTask: tasks[0],
  selectedTodoId: todoSeed[0].id,
  selectedCard: cards[0],
  completedTasks: [],
  unlockedCardIds: [],
  recentUnlockedCardId: null,
  completionPulse: 0,
  todos: structuredClone(todoSeed),
  todoSortMode: "default",
  todoMode: "view",
  todoDraft: "",
  todoRemoveSelection: [],
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
  drawMode: null,
  drawPool: [],
  bgmPlaying: false,
  bgmVolume: readStoredBgmVolume(),
  homeAnimationsEnabled: readStoredHomeAnimationsEnabled(),
  guideActive: false,
  guidePhase: 0,
  guideStep: 0,
  guideSegment: 0,
  guideTriangle: false,
  guideOptions: false,
  guideMenuHint: false,
  guideReplayMode: false,
  guideInFeature: false,
  guideShowBackArrow: false,
  guideFeatureIdx: 0,
  guideAfterBranch: false,
  guideBranchTyping: false,
  guideNeedsTyping: false,
  guideDisplayedText: "",
};

{
  const journeyProgress = readJourneyProgress();
  state.completedTasks = journeyProgress.completedTasks;
  state.unlockedCardIds = journeyProgress.unlockedCardIds;
}

state.achievementCount = state.completedTasks.length;

const app = document.querySelector("#app");
const bgmAudio = new Audio(asset("沙丘慢步-rebalanced.mp3"));
bgmAudio.loop = true;
bgmAudio.volume = state.bgmVolume;
let toastTimer;
let pendingTimer;
let clockTimer;
let guideTimer;
let guideTypedIndex = 0;
let guideFullText = "";
let guideFadeTimer;
let homeBallAnimFrame = 0;
let homeBallState = null;

function cancelHomeBallAnimation() {
  if (homeBallAnimFrame) {
    cancelAnimationFrame(homeBallAnimFrame);
    homeBallAnimFrame = 0;
  }
}

function homeAnimationsMarkup() {
  if (state.route !== ROUTES.HOME || !state.homeAnimationsEnabled) return "";

  return `
    <div class="homepage-animations-wrapper" aria-hidden="true">
      <button class="homepage-tumbleweed" data-action="boost-home-ball" aria-label="滚动的小球">
        <img src="${asset("littleball.png")}" alt="" />
      </button>

      <div class="homepage-beetle homepage-reader-beetle">
        <img src="${asset("reading1.gif")}" alt="" class="beetle-state idle" />
        <img src="${asset("reading2.gif")}" alt="" class="beetle-state hover" />
      </div>

      <div class="homepage-beetle homepage-cleaner-beetle">
        <img src="${asset("sweep1.gif")}" alt="" class="beetle-state idle" />
        <img src="${asset("sweep2.gif")}" alt="" class="beetle-state hover" />
      </div>

      <div class="homepage-beetle homepage-ice-beetle">
        <img src="${asset("ice1.gif")}" alt="" class="beetle-state idle" />
        <img src="${asset("ice2.gif")}" alt="" class="beetle-state hover" />
      </div>
    </div>
  `;
}

function ensureHomeBallState() {
  if (homeBallState) return homeBallState;
  homeBallState = {
    x: 860,
    y: 552,
    vx: 1.4,
    vy: -1.1,
    rotation: 0,
    boosted: false,
  };
  return homeBallState;
}

function boostHomeBall() {
  const ball = ensureHomeBallState();
  const angle = Math.random() * Math.PI * 2;
  const speed = 18 + Math.random() * 8;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.boosted = true;
}

function animateHomeBall() {
  cancelHomeBallAnimation();
  if (state.route !== ROUTES.HOME) return;

  const ballEl = document.querySelector(".homepage-tumbleweed");
  const stageEl = document.querySelector(".stage");
  if (!ballEl || !stageEl) return;

  const stageWidth = 1280;
  const stageHeight = 800;
  const ballWidth = 112;
  const ballHeight = 112;
  const normalSpeed = 1.75;
  const friction = 0.965;
  const bounceFactor = -0.86;
  const drift = 0.22;
  const ball = ensureHomeBallState();

  const tick = () => {
    if (state.route !== ROUTES.HOME) {
      homeBallAnimFrame = 0;
      return;
    }

    let speed = Math.hypot(ball.vx, ball.vy);

    if (!ball.boosted) {
      ball.vx += (Math.random() - 0.5) * drift;
      ball.vy += (Math.random() - 0.5) * drift;
      speed = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = (ball.vx / speed) * normalSpeed;
      ball.vy = (ball.vy / speed) * normalSpeed;
    } else {
      ball.vx *= friction;
      ball.vy *= friction;
      if (Math.hypot(ball.vx, ball.vy) <= normalSpeed + 0.15) {
        ball.boosted = false;
      }
    }

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.rotation += ball.vx * 1.45;

    const maxX = stageWidth - ballWidth;
    const maxY = stageHeight - ballHeight;

    if (ball.x < 0) {
      ball.x = 0;
      ball.vx *= bounceFactor;
    } else if (ball.x > maxX) {
      ball.x = maxX;
      ball.vx *= bounceFactor;
    }

    if (ball.y < 0) {
      ball.y = 0;
      ball.vy *= bounceFactor;
    } else if (ball.y > maxY) {
      ball.y = maxY;
      ball.vy *= bounceFactor;
    }

    ballEl.style.transform = `translate(${ball.x}px, ${ball.y}px) rotate(${ball.rotation}deg)`;
    homeBallAnimFrame = requestAnimationFrame(tick);
  };

  homeBallAnimFrame = requestAnimationFrame(tick);
}

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

  if (route === ROUTES.TODO) {
    normalizeTodoSelection();
    state.todoMode = "view";
    state.todoDraft = "";
    state.todoRemoveSelection = [];
  }

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
  if (state.guideActive && state.guidePhase !== 2 && !options.fromGuide) return;
  if (!options.fromPending) clearTimeout(pendingTimer);
  state.previousRoute = state.route;
  state.route = route;
  state.transition = direction;
  state.modal = null;
  if (mode !== "back") setHistory(route, mode);
  syncRouteState(route, { fresh: options.fresh ?? (mode === "push" && state.previousRoute === ROUTES.HOME) });
  render({ routeTransition: true });
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
  if (state.guideActive && state.guidePhase !== 2 && !state.guideShowBackArrow) return;
  clearTimeout(pendingTimer);
  const previous = state.history.length > 1 ? state.history[state.history.length - 2] : ROUTES.HOME;
  state.history = state.history.slice(0, -1);
  state.previousRoute = state.route;
  state.route = previous;
  state.transition = "back";
  state.modal = null;
  state.history = state.history.length ? state.history : [ROUTES.HOME];
  syncRouteState(previous, { fresh: false });
  render({ routeTransition: true });
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

function guideResetStepState() {
  state.guideTriangle = false;
  state.guideOptions = false;
  state.guideAfterBranch = false;
  state.guideBranchTyping = false;
  state.guideNeedsTyping = false;
  state.guideDisplayedText = "";
}

function guideStopTimers() {
  clearInterval(guideTimer);
  clearTimeout(guideFadeTimer);
  guideTimer = null;
  guideFadeTimer = null;
}

function guideTextForCurrentState() {
  if (state.guidePhase === 2) {
    if (state.guideMenuHint) return "请先点击右侧的展开菜单按钮，打开功能面板。";
    const feature = phase2Features[state.guideFeatureIdx];
    if (!feature) return "";
    if (state.guideInFeature) {
      return state.guideShowBackArrow ? "请点击左上角返回按钮，继续下一个功能。" : feature.explain;
    }
    return feature.tip;
  }

  const step = guideCurrentStep();
  if (!step) return "";
  if (step.segments) return step.segments[state.guideSegment] || "";
  return step.text || "";
}

function guideShowTriangle() {
  if (state.guidePhase === 2) {
    state.guideTriangle = Boolean(state.guideInFeature && !state.guideShowBackArrow);
  } else {
    state.guideTriangle = true;
  }
  render();
}

function guideShowText() {
  const text = guideTextForCurrentState();
  if (!text) {
    guideShowTriangle();
    return;
  }

  guideStopTimers();
  state.guideNeedsTyping = true;
  state.guideTriangle = false;
  state.guideDisplayedText = "";
  guideFullText = text;
  guideTypedIndex = 0;
  render();

  guideTimer = setInterval(() => {
    if (guideTypedIndex < guideFullText.length) {
      state.guideDisplayedText += guideFullText.charAt(guideTypedIndex);
      guideTypedIndex += 1;
      render();
      return;
    }

    guideStopTimers();
    state.guideNeedsTyping = false;
    guideShowTriangle();
  }, 26);
}

function guideAdvanceToNextStep() {
  const steps = guideCurrentSteps();
  if (!steps) return;
  if (state.guideStep < steps.length - 1) {
    state.guideStep += 1;
    state.guideSegment = 0;
    guideResetStepState();
    render();
    guideShowText();
    return;
  }
  guideNextPhase();
}

function guideNextPhase() {
  guideStopTimers();

  if (state.guidePhase === 1) {
    state.guidePhase = 2;
    state.guideStep = 0;
    state.guideSegment = 0;
    state.menuOpen = false;
    state.guideMenuHint = true;
    state.guideReplayMode = false;
    state.guideInFeature = false;
    state.guideShowBackArrow = false;
    guideResetStepState();
    if (state.route !== ROUTES.HOME) {
      navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
    } else {
      render();
      guideShowText();
    }
    return;
  }

  if (state.guidePhase === 2) {
    state.guidePhase = 3;
    state.guideStep = 0;
    state.guideSegment = 0;
    state.guideMenuHint = false;
    state.guideReplayMode = false;
    state.guideInFeature = false;
    state.guideShowBackArrow = false;
    guideResetStepState();
    if (state.route !== ROUTES.HOME) {
      navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
    } else {
      render();
      guideShowText();
    }
    return;
  }

  completeGuide();
}

function guideRestartPhase2() {
  guideStopTimers();
  state.guideActive = true;
  state.guidePhase = 2;
  state.guideStep = 0;
  state.guideSegment = 0;
  state.menuOpen = false;
  state.guideMenuHint = true;
  state.guideReplayMode = true;
  state.guideInFeature = false;
  state.guideShowBackArrow = false;
  guideResetStepState();
  if (state.route !== ROUTES.HOME) {
    navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
  } else {
    render();
    guideShowText();
  }
}

function guideHandleOption(indexOrKey, isBranch) {
  const step = guideCurrentStep();
  if (!step) return;

  state.guideOptions = false;
  if (isBranch) {
    const branch = step.branches?.find((item) => item.key === indexOrKey);
    if (!branch) return;
    if (branch.loop) {
      guideRestartPhase2();
      return;
    }

    guideStopTimers();
    state.guideBranchTyping = true;
    state.guideDisplayedText = "";
    guideFullText = branch.response || "";
    guideTypedIndex = 0;
    render();
    guideTimer = setInterval(() => {
      if (guideTypedIndex < guideFullText.length) {
        state.guideDisplayedText += guideFullText.charAt(guideTypedIndex);
        guideTypedIndex += 1;
        render();
        return;
      }

      guideStopTimers();
      state.guideBranchTyping = false;
      state.guideAfterBranch = true;
      state.guideTriangle = true;
      render();
    }, 28);
    return;
  }

  guideAdvanceToNextStep();
}

function guideAdvance() {
  if (state.guideOptions) return;
  if (state.guideNeedsTyping) {
    guideStopTimers();
    state.guideDisplayedText = guideFullText;
    state.guideNeedsTyping = false;
    if (state.guideBranchTyping) {
      state.guideBranchTyping = false;
      state.guideAfterBranch = true;
    }
    guideShowTriangle();
    return;
  }

  if (!state.guideTriangle) return;

  state.guideTriangle = false;
  if (state.guidePhase !== 2) {
    const step = guideCurrentStep();
    if (!step) return;
    if (step.isEnd) {
      guideNextPhase();
      return;
    }
    if (state.guideAfterBranch) {
      state.guideAfterBranch = false;
      guideAdvanceToNextStep();
      return;
    }
    if (step.segments && state.guideSegment < step.segments.length - 1) {
      state.guideSegment += 1;
      guideShowText();
      return;
    }
    if (step.branches || step.options) {
      state.guideOptions = true;
      render();
      return;
    }
    guideAdvanceToNextStep();
    return;
  }

  render();
}

function guidePositionArrow() {
  const arrow = document.getElementById("guideArrow");
  const bubble = document.getElementById("guideBubble");
  if (!arrow) return;

  const stage = document.querySelector(".stage");
  if (!stage) return;
  const stageRect = stage.getBoundingClientRect();
  const scale = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stage-scale")) || 1;

  const placeArrow = (element, offsetX = 8, offsetY = -30) => {
    const rect = element.getBoundingClientRect();
    const centerY = (rect.top + rect.height / 2 - stageRect.top) / scale;
    const rightX = (rect.right - stageRect.left) / scale;
    arrow.style.display = "block";
    arrow.style.left = `${rightX + offsetX}px`;
    arrow.style.top = `${centerY + offsetY}px`;
    arrow.classList.add("point-left");
  };

  if (state.guideMenuHint) {
    const toggle = document.querySelector(".home-toggle-hotspot");
    if (!toggle) {
      arrow.style.display = "none";
      return;
    }
    placeArrow(toggle, 8, -30);
    if (bubble) {
      bubble.classList.remove("guide-bubble-feature");
      bubble.classList.add("guide-bubble-hint");
      bubble.style.left = "176px";
      bubble.style.top = "24px";
      bubble.style.width = "527px";
      bubble.style.height = "527px";
      bubble.style.transform = "none";
    }
    return;
  }

  if (state.guideInFeature) {
    if (!state.guideShowBackArrow) {
      arrow.style.display = "none";
      return;
    }
    const backBtn = document.querySelector(".back-btn, .back-hotspot, [data-action='back']");
    if (!backBtn) {
      arrow.style.display = "none";
      return;
    }
    placeArrow(backBtn, 8, -35);
    if (bubble) {
      bubble.classList.remove("guide-bubble-feature");
      bubble.classList.add("guide-bubble-hint");
    }
    return;
  }

  const feature = phase2Features[state.guideFeatureIdx];
  if (!feature || state.route !== ROUTES.HOME) {
    arrow.style.display = "none";
    return;
  }
  const btn = document.querySelector(feature.selector);
  if (!btn) {
    arrow.style.display = "none";
    return;
  }
  placeArrow(btn, -6, -30);
  if (bubble) {
    bubble.classList.remove("guide-bubble-hint");
    bubble.classList.add("guide-bubble-feature");
  }
}

function guideMarkup() {
  if (!state.guideActive) return "";

  const phase = state.guidePhase;
  let markup = `<div class="guide-overlay${state.guidePhase === 2 ? " guide-overlay-stage2" : ""}" id="guideOverlay">`;

  if (phase === 2) {
    const bubbleText = state.guideDisplayedText || guideTextForCurrentState();
    const bubbleClass = `guide-bubble ${state.guideMenuHint ? "guide-bubble-hint" : state.guideInFeature ? "guide-bubble-feature" : ""}`;
    markup += `
      <div class="${bubbleClass}" id="guideBubble">
        <img src="${asset("大气泡.png")}" alt="" class="guide-bubble-bg" />
        <span class="guide-bubble-text" id="guideDialogText">${bubbleText}</span>
      </div>
      <div class="guide-arrow-overlay" id="guideArrow"><img src="${asset("指引箭头.png")}" alt="" /></div>
    `;
  } else {
    const step = guideCurrentStep();
    const text = state.guideDisplayedText || guideTextForCurrentState();
    markup += `
      <div class="guide-bg-layer"><img src="${asset("大背景.png")}" alt="" /></div>
      <div class="guide-character-layer"><img src="${beetles.king}" alt="" /></div>
      <div class="guide-dialog-bg"><img src="${asset("对话框.png")}" alt="" /></div>
      <div class="guide-dialog-text" id="guideDialogText">${text}</div>
      <div class="guide-character-label">螂王</div>
      <div class="guide-triangle ${state.guideTriangle ? "" : "hidden"}"><img src="${asset("三角标.png")}" alt="" /></div>
    `;

    if (step?.options?.length || step?.branches?.length) {
      const items = step.branches
        ? step.branches.map((branch) => `<button class="guide-option-btn" data-branch="${branch.key}">${branch.label}</button>`).join("")
        : step.options.map((option, index) => `<button class="guide-option-btn" data-idx="${index}">${option}</button>`).join("");
      markup += `
        <div class="guide-options-overlay ${state.guideOptions ? "visible" : ""}" id="guideOptionsOverlay">
          <div class="guide-options-container">${items}</div>
        </div>
      `;
    }
  }

  const clickOverlayClass = state.guidePhase === 2 || state.guideOptions
    ? "guide-click-overlay is-disabled"
    : "guide-click-overlay is-active";
  markup += `<div class="${clickOverlayClass}" id="guideClickOverlay"></div></div>`;
  return markup;
}

function completeGuide() {
  guideStopTimers();
  const returnHome = state.route !== ROUTES.HOME;
  state.guideActive = false;
  state.guidePhase = 4;
  state.guideStep = 0;
  state.guideSegment = 0;
  state.guideTriangle = false;
  state.guideOptions = false;
  state.guideMenuHint = false;
  state.guideReplayMode = false;
  state.guideInFeature = false;
  state.guideShowBackArrow = false;
  state.guideFeatureIdx = 0;
  state.guideAfterBranch = false;
  state.guideBranchTyping = false;
  state.guideNeedsTyping = false;
  state.guideDisplayedText = "";
  try {
    localStorage.setItem(GUIDE_SEEN_STORAGE_KEY, "1");
  } catch {}
  state.homeAnimationsEnabled = true;
  persistHomeAnimationsEnabled(true);

  if (returnHome) {
    navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
  } else {
    render();
  }
}

function startGuide() {
  if (state.guideActive) return;
  guideStopTimers();
  state.guideActive = true;
  state.guidePhase = 1;
  state.guideStep = 0;
  state.guideSegment = 0;
  state.menuOpen = true;
  state.guideMenuHint = false;
  state.guideReplayMode = false;
  state.guideInFeature = false;
  state.guideShowBackArrow = false;
  state.guideFeatureIdx = 0;
  state.guideAfterBranch = false;
  state.guideBranchTyping = false;
  state.guideNeedsTyping = false;
  state.guideDisplayedText = "";

  if (state.route !== ROUTES.HOME) {
    navigate(ROUTES.HOME, { mode: "reset", direction: "back", fromGuide: true });
  } else {
    render();
    guideShowText();
  }
}

function checkAutoGuide() {
  if (!state.authUser) return;
  if (!state.authLoading) {
    try {
      if (localStorage.getItem(GUIDE_SEEN_STORAGE_KEY) === "1") return;
    } catch {}
    setTimeout(() => startGuide(), 120);
  }
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

function sortedTodosForView() {
  const indexedTodos = state.todos.map((todo, index) => ({ todo, index }));
  const sorted = [...indexedTodos];

  if (state.todoSortMode === "active-first") {
    sorted.sort((a, b) => Number(a.todo.done) - Number(b.todo.done) || a.index - b.index);
  }

  if (state.todoSortMode === "done-first") {
    sorted.sort((a, b) => Number(b.todo.done) - Number(a.todo.done) || a.index - b.index);
  }

  return sorted.map((item) => item.todo);
}

function todoDisplayName(todo) {
  return String(todo.name || "").replace(/^任务名：/, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toggleTodoSelection(todoId) {
  const id = Number(todoId);
  if (!Number.isFinite(id)) return;
  if (state.todoRemoveSelection.includes(id)) {
    state.todoRemoveSelection = state.todoRemoveSelection.filter((value) => value !== id);
  } else {
    state.todoRemoveSelection = [...state.todoRemoveSelection, id];
  }
  render();
}

function nextTodoSortMode() {
  const modes = ["default", "active-first", "done-first"];
  const currentIndex = modes.indexOf(state.todoSortMode);
  return modes[(currentIndex + 1) % modes.length];
}

function currentDrawPool() {
  if (state.drawMode === DRAW_MODES.ACTION) return actionCards;
  return state.drawPool.length ? state.drawPool : cards.slice(0, 6);
}

function startDrawMode(mode) {
  state.drawMode = mode;
  state.drawPool = mode === DRAW_MODES.ACTION ? [...actionCards] : cards.slice(0, 6);
  state.drawnCard = null;
  state.drawPhase = "selecting";
  closeModal();
  navigate(ROUTES.DRAW, { mode: "push", direction: "forward", fresh: true });
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

function formatUserDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatUserTime(date = new Date()) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatReviewDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未知日期";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatReviewDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
}

function groupCompletedTasksByDate() {
  return state.completedTasks.reduce((groups, item) => {
    const key = formatReviewDate(item.completedAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

function isCardUnlocked(cardId) {
  return state.unlockedCardIds.includes(Number(cardId));
}

function latestCompletionForCard(cardId) {
  return state.completedTasks.find((item) => item.unlockedCardId === Number(cardId)) || null;
}

function pulseAchievement() {
  state.completionPulse += 1;
  const current = state.completionPulse;
  setTimeout(() => {
    if (state.completionPulse === current) {
      state.completionPulse = 0;
      render();
    }
  }, 520);
}

function createCompletionRecord(task, reward) {
  const now = new Date();
  return {
    id: Date.now(),
    taskId: task.id,
    taskName: task.name,
    unlockedCardId: reward.id,
    completedAt: now.toISOString(),
    completedDate: formatReviewDate(now),
    completedAtText: `${formatReviewDate(now)} ${formatUserTime(now)}`,
  };
}

function markTaskComplete() {
  if (state.executeStatus === "complete") return;

  const task = state.selectedTask || tasks[0];
  const reward = rewardCardForTask(task);
  const record = createCompletionRecord(task, reward);

  state.completedTasks = [record, ...state.completedTasks];
  if (!state.unlockedCardIds.includes(reward.id)) {
    state.unlockedCardIds = [...state.unlockedCardIds, reward.id];
  }
  state.achievementCount = state.completedTasks.length;
  state.recentUnlockedCardId = reward.id;
  pulseAchievement();
  persistJourneyProgress();

  state.todos = state.todos.map((todo) =>
    todo.id === state.selectedTodoId || taskFromTodo(todo).id === task.id
      ? { ...todo, done: true }
      : todo,
  );
}

function userPanel() {
  const name = state.authUser ? authName(state.authUser) : "游客螂";
  const date = new Date();
  return `
    <button class="home-user-panel ${state.authUser ? "is-authed" : "is-guest"}" data-modal="${state.authUser ? "account" : "auth"}" aria-label="${state.authUser ? `账号：${name}` : "注册或登录"}">
      <span class="home-user-avatar" aria-hidden="true"></span>
      <span class="home-user-copy">
        <b>${name}</b>
        <span>Lv.3</span>
        <time datetime="${date.toISOString()}">${formatUserDate(date)} ${formatUserTime(date)}</time>
      </span>
    </button>
  `;
}

function homeTools() {
  return `
    <div class="floating-tools">
      <button class="tool-btn tool-gear" data-route="profile" data-profile-tab="settings" aria-label="settings"><img src="${asset("操作按钮1.png")}" alt="" /></button>
      <button class="tool-btn tool-mail" data-modal="message" aria-label="messages"><img src="${asset("操作按钮2.png")}" alt="" /></button>
      <button class="tool-btn tool-bell" data-modal="notice" aria-label="notifications"><img src="${asset("操作按钮3.png")}" alt="" /></button>
    </div>
  `;
}

function homeAnimationToggle() {
  if (state.route !== ROUTES.HOME) return "";

  return `
    <button class="home-animation-toggle ${state.homeAnimationsEnabled ? "is-on" : "is-off"}" data-action="toggle-home-animations" aria-label="homepage animations" aria-pressed="${state.homeAnimationsEnabled}">
      <img src="${asset("button_ani.png")}" alt="" />
    </button>
  `;
}

function renderHomeBottomControls() {
  if (state.route !== ROUTES.HOME) return "";
  return `
    <div class="home-bottom-controls">
      ${renderMusicControl()}
      ${homeAnimationToggle()}
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
      ${homeTools()}
      ${userPanel()}
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
            <button class="hotspot home-menu-hotspot menu-draw" data-action="open-draw-choice" aria-label="任务选择"></button>
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

function isLocalPreviewAuthReady() {
  return IS_LOCAL_PREVIEW;
}

function renderAi() {
  if (state.aiPhase === "generated" || state.aiPhase === "confirmed") {
    return `
      <section class="page ai-page">
        <div class="page-design ai-design generated" style="background-image:url('${design("AI任务拆解2.2-汪嫣然.png")}')"></div>
        <button class="hotspot back-hotspot" data-action="back" aria-label="返回"></button>
        <div class="ai-result-live" aria-live="polite">
          <div class="ai-result-header">
            <span>AI 拆解结果</span>
            <strong>选择一步查看详情，确认后加入待办</strong>
          </div>
          ${state.aiSteps
            .slice(0, 4)
            .map(
              (step, index) => `
                <button class="ai-result-card result-${index + 1}" data-action="toast" data-toast="${step.detail}">
                  <i>${index + 1}</i>
                  <span>
                    <strong>${step.title}</strong>
                    <em>${step.detail}</em>
                  </span>
                </button>
              `,
            )
            .join("")}
          <div class="ai-result-actions">
            <button class="ai-result-reset" data-action="reset-ai">重新拆解</button>
            <button class="ai-result-confirm" data-action="confirm-ai">${state.aiPhase === "confirmed" ? "已加入待办" : "确认加入待办"}</button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="page ai-page">
      <div class="page-design ai-design initial" style="background-image:url('${design("AI任务拆解2.1-汪嫣然.png")}')"></div>
      <button class="hotspot back-hotspot" data-action="back" aria-label="返回"></button>
      <div class="ai-input-panel">
        <textarea class="ai-task-input" aria-label="输入要拆解的大任务" placeholder="请输入文本（支持文件上传）">${state.aiInput}</textarea>
        <div class="ai-input-actions">
          <label class="ai-file-button" aria-label="上传任务文件">
            <input class="ai-file-input" type="file" accept=".txt,.md,.csv,.json,.doc,.docx,.pdf" />
            <span>＋</span>
          </label>
          <button class="ai-submit-button" data-action="start-ai" ${state.aiLoading ? "disabled" : ""}>
            ${state.aiLoading ? "拆解中" : "开始拆解"}
          </button>
        </div>
        <div class="ai-file-name">${state.aiAttachment ? state.aiAttachment.name : "支持 .txt / .md / .csv / .json 文件正文读取"}</div>
      </div>
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
  const visibleTodos = sortedTodosForView();
  const hasTodos = visibleTodos.length > 0;
  const addMode = state.todoMode === "add";
  const removeMode = state.todoMode === "remove";
  return `
    <section class="page todo-page">
      ${designFrame("待办事项2-王紫涵.png", "todo-design")}
      <button class="hotspot todo-back-hotspot" data-action="back" aria-label="返回"></button>
      <button class="hotspot todo-draw-hotspot" data-action="open-draw-choice" aria-label="抽卡"></button>
      <button class="hotspot todo-add-hotspot" data-action="todo-enter-add" aria-label="新增任务"></button>
      <button class="hotspot todo-remove-hotspot" data-action="todo-enter-remove" aria-label="删除待办"></button>
      <button class="hotspot todo-detail-hotspot" data-action="todo-enter-view" aria-label="任务详情"></button>
      <button class="hotspot todo-execute-hotspot" data-action="execute-selected" aria-label="开始执行"></button>
      <button class="hotspot todo-side-hotspot side-one" data-action="toast" data-toast="已切换卡片视图" aria-label="卡片视图"></button>
      <button class="hotspot todo-side-hotspot side-two" data-action="toggle-todo-sort" aria-label="排序"></button>
      <button class="hotspot todo-side-hotspot side-three" data-action="toast" data-toast="插图功能稍后接入" aria-label="图片"></button>
      <button class="hotspot todo-side-hotspot side-four" data-action="todo-enter-add" aria-label="编辑"></button>
      <div class="todo-shell ${addMode ? "is-add" : removeMode ? "is-remove" : "is-view"}">
        <div class="todo-shell-left">
          <div class="todo-title">我的待办事项</div>
          <div class="todo-list">
                ${hasTodos
              ? visibleTodos
                  .map(
                    (todo) => `
                      <div class="todo-row ${state.selectedTodoId === todo.id ? "selected" : ""} ${todo.done ? "is-done" : ""} ${state.todoRemoveSelection.includes(todo.id) ? "is-marked" : ""}">
                        <input
                          type="checkbox"
                          class="${removeMode ? "todo-remove-check" : "todo-done-check"}"
                          data-todo="${todo.id}"
                          ${removeMode ? (state.todoRemoveSelection.includes(todo.id) ? "checked" : "") : todo.done ? "checked" : ""}
                        />
                        <button class="todo-row-name" data-action="select-todo" data-todo-id="${todo.id}">${escapeHtml(todoDisplayName(todo))}</button>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="todo-empty">还没有待办，先用右侧加号添加一个吧。</div>`}
          </div>
        </div>
        <div class="todo-shell-right">
          ${addMode
            ? `
              <div class="todo-acorn-panel">
                <div class="todo-acorn-plus">+</div>
                <textarea class="todo-draft-input" maxlength="120" placeholder="填写要新增的待办说明">${escapeHtml(state.todoDraft)}</textarea>
                <button class="todo-panel-action" data-action="todo-add-submit">+</button>
              </div>
            `
            : removeMode
              ? `
                <div class="todo-sweeper-panel">
                  <img src="${asset("透明保洁螂.png")}" alt="透明保洁螂" />
                  <button class="todo-panel-action" data-action="todo-remove-submit">-</button>
                </div>
              `
              : `
                <div class="todo-view-panel">
                  <img src="${asset("透明螂王.png")}" alt="螂王" class="todo-king-image" />
                  <div class="todo-view-hint">点击 + 进入新增，点击 - 进入删除</div>
                </div>
              `}
        </div>
      </div>
      <button class="todo-cheer-hotspot" data-action="toast" data-toast="加油，准备好了就开始吧" aria-label="加油"></button>
      <button class="todo-king-hotspot" data-route="profile" aria-label="螂王"></button>
      <button class="todo-acorn-plus-hotspot" data-action="todo-enter-add" aria-label="橡果加号"></button>
      <button class="todo-acorn-minus-hotspot" data-action="todo-enter-remove" aria-label="橡果减号"></button>
    </section>
  `;
}

function renderCards() {
  const unlockedCount = state.unlockedCardIds.length;
  const body =
    state.cardTab === "cards"
      ? `<div class="library-panel tab-panel">
          ${cards
            .map(
              (card) => {
                const unlocked = isCardUnlocked(card.id);
                const recent = state.recentUnlockedCardId === card.id && state.completionPulse > 0;
                return `
                <button class="card-tile ${unlocked ? "is-unlocked" : "is-locked"} ${recent ? "is-recent-unlock" : ""}" data-card="${card.id}" ${unlocked ? "" : 'aria-disabled="true"'}>
                  <span>${card.date}</span>
                  <div class="card-face">
                    <img src="${unlocked ? card.character : asset("透明卡牌背面.png")}" alt="${card.title}" />
                    <strong>${card.title}</strong>
                    <small>${unlocked ? "已解锁" : "未解锁"}</small>
                  </div>
                </button>
              `;
              },
            )
            .join("")}
        </div>`
      : `<div class="achievement-panel tab-panel">
          <div class="achievement-total ${state.completionPulse > 0 ? "is-pulsing" : ""}">
            <span class="achievement-icon ${unlockedCount > 0 ? "is-lit" : ""}"></span>
            <strong>${String(unlockedCount).padStart(2, "0")}</strong>
            <small>张卡牌已点亮</small>
          </div>
          ${achievements
            .map(
              (item) => `
                <div class="achievement-row">
                  <span class="seal ${unlockedCount > 0 ? "is-lit" : ""}"></span>
                  <div><b>${item.title}</b><small>${item.desc}</small></div>
                  <strong>${item.progress}</strong>
                </div>
              `,
            )
            .join("")}
        </div>`;

  return `
    <section class="page cards-page">
      ${backButton()}
      <h1 class="page-title">卡牌库</h1>
      ${state.cardTab === "achievements" ? `<div class="search-pill">⌕ 解锁 ${unlockedCount}</div>` : ""}
      <nav class="library-tabs">
        <button class="tab ${state.cardTab === "cards" ? "active" : ""}" data-action="card-tab" data-tab="cards">卡牌</button>
        <button class="tab ${state.cardTab === "achievements" ? "active" : ""}" data-action="card-tab" data-tab="achievements">成就</button>
      </nav>
      ${body}
    </section>
  `;
}

function renderReview() {
  const groups = groupCompletedTasksByDate();
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const hasRecords = dates.length > 0;
  return `
    <section class="page review-page">
      ${backButton()}
      <h1 class="page-title">任务回顾</h1>
      <div class="review-book">
        ${
          hasRecords
            ? dates
                .map(
                  (date) => `
                    <div class="date-pill">${formatReviewDateLabel(date)}</div>
                    ${groups[date]
                      .map(
                        (item) => `
                          <button class="review-entry" data-action="toast" data-toast="完成时间 ${item.completedAtText}">
                            <span>✓</span>
                            <div>
                              <b>${item.taskName}</b>
                              <small>${item.completedAtText}</small>
                            </div>
                          </button>
                        `,
                      )
                      .join("")}
                  `,
                )
                .join("")
            : `<div class="review-empty">
                <b>还没有完成记录</b>
                <small>完成任务后，这里会按日期自动归档</small>
              </div>`
        }
      </div>
      <button class="cloud-note" data-action="toast" data-toast="${hasRecords ? "点击记录可查看完成时间" : "先完成任务再来回顾"}">${hasRecords ? "查看时间" : "暂无记录"}</button>
      <img class="review-character" src="${beetles.board}" alt="看板螂" />
      <div class="review-actions">
        <button data-route="cards"><img src="${asset("操作按钮1.png")}" alt="" /><span>卡牌</span></button>
        <button data-action="toast" data-toast="回顾内容会随着任务完成持续累积"><img src="${asset("操作按钮2.png")}" alt="" /><span>说明</span></button>
      </div>
    </section>
  `;
}

function openDrawModeChooser() {
  setModal("draw-choice");
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
  const pool = currentDrawPool();
  const isActionMode = state.drawMode === DRAW_MODES.ACTION;
  const renderDrawFace = (card) =>
    isActionMode
      ? `<strong class="action-card-title">${card.title}</strong><span class="action-card-text">${card.detail}</span>`
      : `<img src="${card.character}" alt="${card.title}" /><strong>${card.title}</strong>`;
  return `
    <section class="page draw-page">
      ${backButton()}
      <h1 class="page-title">${isActionMode ? "行动抽卡" : "抽卡"}</h1>
      <button class="history-btn" data-route="cards" data-mode="push"><img src="${asset("操作按钮4.png")}" alt="" /><span>历史</span></button>
      <img class="draw-king" src="${beetles.king}" alt="螂王" />
      <div class="pick-one">Pick One</div>
      <div class="card-fan ${state.drawPhase === "revealed" ? "has-pick" : ""}">
        <div class="card-fan-track">
          ${pool
            .map(
              (card, index) =>
                `<button class="fan-card fan-${index % 6} ${picked?.id === card.id ? "picked" : ""}" data-draw="${card.id}" ${picked ? "disabled" : ""}><img src="${asset("透明卡牌背面.png")}" alt="抽卡" /></button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="draw-tip">${isActionMode ? "选择一张行动卡，开启今天的行动吧!" : "选择一张卡片，开启你的任务之旅吧!"}</div>
      ${
        picked
          ? `<div class="draw-result">
              <div class="result-card ${isActionMode ? "is-action-result" : ""}">${renderDrawFace(picked)}</div>
              <div class="result-actions">${button("确认", "paper", 'data-action="confirm-draw"')}${isActionMode ? "" : button("重抽", "paper", 'data-action="redraw"')}</div>
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

  if (state.modal === "draw-choice") {
    return modalShell(`
      <div class="cloud-modal draw-choice-modal" role="dialog" aria-modal="true">
        <h2>请选择抽卡模式</h2>
        <p class="guide-confirm-text">任务抽卡用于进入任务流程，行动抽卡用于选择今日行动。</p>
        <div class="draw-choice-actions">
          ${button("任务抽卡", "orange", 'data-action="start-task-draw"')}
          ${button("行动抽卡", "orange", 'data-action="start-action-draw"')}
        </div>
      </div>
    `, "draw-choice-layer", { dismissible: false });
  }

  if (state.modal === "guide-confirm") {
    return modalShell(`
      <div class="cloud-modal guide-confirm-modal" role="dialog" aria-modal="true">
        <h2>是否要进入<br />新手引导？</h2>
        <p class="guide-confirm-text">点“是”会重新开始一遍引导。</p>
        ${button("是", "orange", 'data-action="confirm-guide-replay"')}
        ${button("否", "paper", 'data-action="close-modal"')}
      </div>
    `, "guide-confirm-layer", { dismissible: false });
  }

  if (state.modal === "auth") {
    const isSignup = state.authMode === "signup";
    const accountPlaceholder = "账号或邮箱";
    const passwordPlaceholder = "密码";
    const authHint = "测试账号：账号和密码都输入 123。其他账号仍走 Netlify Identity。";
    return modalShell(`
      <form class="auth-dialog" data-auth-form="${state.authMode}" role="dialog" aria-modal="true" novalidate>
        <h2>${IS_LOCAL_PREVIEW ? "本地预览登录" : isSignup ? "注册事克郎账号" : "登录事克郎账号"}</h2>
        <p>${IS_LOCAL_PREVIEW ? "输入本地测试账号即可预览完整功能。" : isSignup ? "创建账号后，你的任务旅程就能和邮箱身份绑定。" : "登录后继续你的任务拆解、待办与卡牌旅程。"}</p>
        ${isSignup ? `<input id="authName" name="name" autocomplete="name" placeholder="昵称" />` : ""}
        <input id="authEmail" name="email" type="text" inputmode="email" autocomplete="username email" autocapitalize="off" spellcheck="false" required placeholder="${accountPlaceholder}" />
        <input id="authPassword" name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" required placeholder="${passwordPlaceholder}" />
        ${state.authError ? `<div class="auth-error">${state.authError}</div>` : ""}
        <small class="auth-hint">${authHint}</small>
        <button class="auth-submit" type="submit" ${state.authSubmitting ? "disabled" : ""}>${state.authSubmitting ? "处理中..." : isSignup ? "注册" : "登录"}</button>
        ${IS_LOCAL_PREVIEW ? "" : `<button class="auth-switch" type="button" data-action="switch-auth">${isSignup ? "已有账号，去登录" : "没有账号，去注册"}</button>`}
      </form>
    `, "auth-modal-layer");
  }

  if (state.modal === "account") {
    return modalShell(`
      <div class="auth-dialog account-dialog" role="dialog" aria-modal="true">
        <h2>事克郎档案</h2>
        <p>${authName(state.authUser)}</p>
        <strong>${authEmail(state.authUser)}</strong>
        ${button("进入个人中心", "orange", 'data-route="profile"')}
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

  if (state.modal === "draw-choice") return "";

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
    const latestRecord = latestCompletionForCard(card.id);
    return modalShell(`
      <div class="card-detail-modal">
        <div class="collected-card">
          <img src="${card.character}" alt="${card.title}" />
          <strong>${latestRecord?.completedDate || card.date}收集</strong>
        </div>
        <div class="card-info">
          <p>▣ 收集时间：<b>${latestRecord?.completedAtText || card.date}</b></p>
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

function renderMusicControl() {
  return `
    <div class="music-control ${state.bgmPlaying ? "is-playing" : ""}" aria-label="背景音乐控制">
      <button class="music-toggle" data-action="toggle-bgm" aria-label="${state.bgmPlaying ? "暂停背景音乐" : "播放背景音乐"}" aria-pressed="${state.bgmPlaying}">
        <span aria-hidden="true">${state.bgmPlaying ? "停" : "乐"}</span>
      </button>
      <input class="music-volume-slider" type="range" min="0" max="1" step="0.01" value="${state.bgmVolume}" aria-label="背景音乐音量" />
    </div>
  `;
}

function render(options = {}) {
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

  const transitionClass = options.routeTransition ? " is-route-transition" : "";

  app.innerHTML = `
    <main class="stage ${routeClass()}">
      <div class="page-transition${transitionClass}" data-route="${state.route}">
        ${pages[state.route]()}
      </div>
      ${homeAnimationsMarkup()}
      ${guideMarkup()}
      ${state.route === ROUTES.HOME ? renderHomeBottomControls() : renderMusicControl()}
      ${modalMarkup()}
      ${toastMarkup()}
    </main>
  `;

  if (state.route === ROUTES.HOME) {
    setTimeout(() => animateHomeBall(), 0);
  } else {
    cancelHomeBallAnimation();
  }

  if (state.guideActive && state.guidePhase === 2) {
    setTimeout(() => guidePositionArrow(), 0);
  }
}

function handleRoute(target) {
  const tab = target.dataset.tab;
  const profileTab = target.dataset.profileTab;
  const mode = target.dataset.mode || "push";
  if (tab) state.cardTab = tab;
  if (profileTab) state.profileTab = profileTab;
  const route = target.dataset.route;
  if (state.guideActive && state.guidePhase === 2 && route) {
    navigate(route, { mode, fresh: true, fromGuide: true });
    return;
  }
  if (requiresAuth(route) && !state.authUser) {
    state.pendingRoute = route;
    state.authMode = "login";
    state.authError = IS_LOCAL_PREVIEW ? "请输入 123 / 123 进入本地预览。" : "请先注册或登录，再进入这个功能。";
    setModal("auth");
    return;
  }
  navigate(route, { mode, fresh: true });
}

function requiresAuth(route) {
  if (IS_LOCAL_PREVIEW) return false;
  return [ROUTES.AI, ROUTES.TODO, ROUTES.EXECUTE, ROUTES.REVIEW, ROUTES.CARDS, ROUTES.DRAW].includes(route);
}

async function handleAction(action, target) {
  if (action === "back") goBack();
  if (action === "toggle-bgm") {
    if (state.bgmPlaying) {
      bgmAudio.pause();
      state.bgmPlaying = false;
      try {
        localStorage.setItem(BGM_STORAGE_KEY, "paused");
      } catch {}
      render();
      return;
    }

    try {
      bgmAudio.volume = state.bgmVolume;
      await bgmAudio.play();
      state.bgmPlaying = true;
      try {
        localStorage.setItem(BGM_STORAGE_KEY, "playing");
      } catch {}
      render();
    } catch {
      state.bgmPlaying = false;
      showToast("音乐暂时无法播放，请再点一次试试");
    }
    return;
  }
  if (action === "boost-home-ball") {
    boostHomeBall();
    return;
  }
  if (action === "toggle-menu") {
    const wasOpen = state.menuOpen;
    state.menuOpen = !state.menuOpen;
    render();
    if (state.guideActive && state.guidePhase === 2 && state.guideMenuHint && state.menuOpen && !wasOpen) {
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
  if (action === "open-draw-choice") {
    openDrawModeChooser();
  }
  if (action === "start-task-draw") {
    startDrawMode(DRAW_MODES.TASK);
  }
  if (action === "start-action-draw") {
    startDrawMode(DRAW_MODES.ACTION);
  }
  if (action === "toggle-execute") {
    state.executeStatus = state.executeStatus === "running" ? "paused" : "running";
    render();
  }
  if (action === "complete-task") {
    markTaskComplete();
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
  if (action === "todo-enter-add") {
    state.todoMode = "add";
    state.todoDraft = "";
    state.todoRemoveSelection = [];
    render();
  }
  if (action === "todo-enter-remove") {
    state.todoMode = "remove";
    state.todoDraft = "";
    state.todoRemoveSelection = [];
    render();
  }
  if (action === "todo-enter-view") {
    state.todoMode = "view";
    state.todoDraft = "";
    state.todoRemoveSelection = [];
    render();
  }
  if (action === "todo-add-submit") {
    const value = state.todoDraft.trim();
    if (!value) {
      showToast("请先填写待办内容");
      return;
    }
    const todo = makeTodo(value);
    state.todos = [...state.todos, todo];
    state.selectedTodoId = todo.id;
    state.selectedTask = taskFromTodo(todo);
    state.todoMode = "view";
    state.todoDraft = "";
    state.todoRemoveSelection = [];
    showToast("已添加待办");
    render();
  }
  if (action === "todo-remove-submit") {
    if (!state.todoRemoveSelection.length) {
      showToast("先勾选要删除的待办");
      return;
    }
    state.todos = state.todos.filter((todo) => !state.todoRemoveSelection.includes(todo.id));
    normalizeTodoSelection();
    state.todoMode = "view";
    state.todoDraft = "";
    state.todoRemoveSelection = [];
    showToast("已删除待办");
    render();
  }
  if (action === "close-modal") closeModal();
  if (action === "confirm-guide-replay") {
    closeModal();
    startGuide();
  }
  if (action === "card-tab") {
    state.cardTab = target.dataset.tab;
    render();
  }
  if (action === "profile-tab") {
    state.profileTab = target.dataset.tab;
    showToast(target.dataset.tab === "mail" ? "消息设置已打开" : target.dataset.tab === "notice" ? "提醒设置已打开" : "设置已打开");
    render();
  }
  if (action === "toggle-todo-sort") {
    state.todoSortMode = nextTodoSortMode();
    const sortText = {
      default: "排序：默认顺序",
      "active-first": "排序：未完成优先",
      "done-first": "排序：已完成优先",
    };
    showToast(sortText[state.todoSortMode]);
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
    if (state.drawMode === DRAW_MODES.ACTION) return;
    state.drawnCard = null;
    state.drawPhase = "selecting";
    render();
  }
  if (action === "confirm-draw") {
    if (state.drawMode === DRAW_MODES.ACTION) {
      state.drawnCard = null;
      state.drawPhase = "selecting";
      state.drawMode = null;
      state.drawPool = [];
      finishToHome();
      return;
    }
    state.selectedTask = tasks.find((task) => task.name === state.drawnCard?.title) || tasks[0];
    state.executeStatus = "running";
    navigate(ROUTES.EXECUTE, { mode: "replace", direction: "forward" });
  }
  if (action === "confirm-logout") {
    state.authSubmitting = true;
    render();
    try {
      if (IS_LOCAL_PREVIEW) {
        setLocalPreviewSession(false);
      } else {
        await logoutCurrentUser();
      }
      state.authUser = null;
      state.homeAnimationsEnabled = false;
      persistHomeAnimationsEnabled(false);
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
  if (action === "toggle-home-animations") {
    if (!state.authUser) {
      state.homeAnimationsEnabled = false;
      persistHomeAnimationsEnabled(false);
      showToast("请先登录后再开启主页交互");
      render();
      return;
    }

    if (!hasSeenGuide() && !state.homeAnimationsEnabled) {
      showToast("请先完成一次新手引导后再开启主页交互");
      render();
      return;
    }

    state.homeAnimationsEnabled = !state.homeAnimationsEnabled;
    persistHomeAnimationsEnabled(state.homeAnimationsEnabled);
    showToast(state.homeAnimationsEnabled ? "主页交互已开启" : "主页交互已关闭");
    render();
    return;
  }
  if (action === "finish-to-cards") {
    state.cardTab = "cards";
    navigateFlowEnd(ROUTES.CARDS);
  }
  if (action === "finish-to-review") navigateFlowEnd(ROUTES.REVIEW);
  if (action === "finish-home") finishToHome();
  if (action === "toast") showToast(target.dataset.toast || "功能稍后接入");
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button, .ai-file-button");

  if (state.guideActive) {
    if (target?.classList.contains("guide-option-btn")) {
      guideHandleOption(target.dataset.branch ?? Number(target.dataset.idx), Boolean(target.dataset.branch));
      return;
    }

    if (state.guidePhase === 2 && !state.guideMenuHint && !state.guideInFeature && target?.dataset.route) {
      const feature = phase2Features[state.guideFeatureIdx];
      if (feature && target.dataset.route === feature.route) {
        state.guideInFeature = true;
        state.guideShowBackArrow = false;
        state.guideDisplayedText = "";
        handleRoute(target);
        setTimeout(() => guideShowText(), 20);
        return;
      }
      return;
    }

    if (state.guidePhase === 2 && state.guideInFeature && !state.guideShowBackArrow && event.target.closest(".guide-overlay")) {
      state.guideShowBackArrow = true;
      state.guideTriangle = false;
      render();
      return;
    }

    if (state.guidePhase === 2 && state.guideInFeature && target) {
      const isBack = target.dataset.action === "back" || target.classList.contains("back-btn") || target.classList.contains("back-hotspot");
      if (isBack) {
        const isLast = state.guideFeatureIdx >= phase2Features.length - 1;
        state.guideInFeature = false;
        state.guideShowBackArrow = false;
        state.guideDisplayedText = "";
        goBack();
        if (isLast) {
          guideNextPhase();
        } else {
          state.guideFeatureIdx += 1;
          setTimeout(() => guideShowText(), 20);
        }
        return;
      }
    }

    if (state.guidePhase !== 2 && event.target.closest(".guide-click-overlay")) {
      guideAdvance();
      return;
    }

    if (state.guidePhase !== 2) return;
  }

  if (target?.classList.contains("home-king-hotspot")) {
    if (state.authUser) {
      setModal("guide-confirm");
      return;
    }
  }

  const aiPanel = event.target.closest(".ai-input-panel");
  if (aiPanel && !target) {
    const rect = aiPanel.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const inActionColumn = localX > rect.width - 244;
    if (inActionColumn) {
      event.preventDefault();
      if (localX < rect.width - 150) {
        aiPanel.querySelector(".ai-file-input")?.click();
      } else {
        handleAction("start-ai", aiPanel);
      }
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
    const card = cards.find((item) => item.id === Number(target.dataset.card));
    if (!card) return;
    if (!isCardUnlocked(card.id)) {
      showToast("这张卡还没有解锁");
      return;
    }
    state.selectedCard = card;
    setModal("card-detail");
    return;
  }

  if (target.dataset.draw) {
    const drawId = target.dataset.draw;
    state.drawnCard = currentDrawPool().find((card) => String(card.id) === drawId) || null;
    if (!state.drawnCard) return;
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
    const user = await authenticateForm(email, password, name);
    state.authUser = user;
    state.homeAnimationsEnabled = readStoredHomeAnimationsEnabled(true);
    state.modal = null;
    showToast(user.emailVerified === false ? "注册成功，请前往邮箱确认账号。" : "登录成功");
    if (state.pendingRoute) {
      const route = state.pendingRoute;
      state.pendingRoute = null;
      navigate(route, { mode: "push", fresh: true });
      setTimeout(() => checkAutoGuide(), 120);
    } else {
      checkAutoGuide();
    }
  } catch (error) {
    state.authError = authErrorMessage(error);
  } finally {
    state.authSubmitting = false;
    render();
  }
});

async function authenticateForm(email, password, name) {
  if (email === "123" && password === "123") {
    setLocalPreviewSession(true);
    return { ...LOCAL_PREVIEW_USER, name: name || LOCAL_PREVIEW_USER.name };
  }

  if (IS_LOCAL_PREVIEW) {
    const error = new Error("本地预览账号或密码不正确，请输入 123 / 123。");
    error.status = 401;
    throw error;
  }

  if (!email.includes("@")) {
    const error = new Error("正式登录请填写邮箱地址；测试可直接输入 123 / 123。");
    error.status = 422;
    throw error;
  }

  return state.authMode === "signup" ? signupWithEmail(email, password, name) : loginWithEmail(email, password);
}

app.addEventListener("change", (event) => {
  const removeCheckbox = event.target.closest(".todo-remove-check");
  if (removeCheckbox) {
    toggleTodoSelection(removeCheckbox.dataset.todo);
    return;
  }

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
  if (event.target.classList.contains("music-volume-slider")) {
    const volume = Math.min(Math.max(Number(event.target.value), 0), 1);
    state.bgmVolume = Number.isFinite(volume) ? volume : 0.45;
    bgmAudio.volume = state.bgmVolume;
    try {
      localStorage.setItem(BGM_VOLUME_STORAGE_KEY, String(state.bgmVolume));
    } catch {}
    return;
  }

  if (event.target.classList.contains("ai-task-input")) {
    state.aiInput = event.target.value;
  }

  if (event.target.classList.contains("todo-draft-input")) {
    state.todoDraft = event.target.value;
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
clockTimer = setInterval(() => {
  if (state.route === ROUTES.HOME) render();
}, 60000);
updateStageScale();
render();

if (isLocalPreviewAuthReady()) {
  state.authLoading = false;
  state.homeAnimationsEnabled = readStoredHomeAnimationsEnabled(Boolean(state.authUser));
  render();
  checkAutoGuide();
} else {
  initializeAuth({
    onChange(user) {
      state.authUser = user || null;
      state.homeAnimationsEnabled = user ? readStoredHomeAnimationsEnabled(true) : false;
      state.authLoading = false;
      render();
      checkAutoGuide();
    },
    onMessage(message) {
      state.authLoading = false;
      showToast(message);
    },
  }).catch((error) => {
    state.authLoading = false;
    state.authError = authErrorMessage(error);
    if (state.modal === "auth") state.authSubmitting = false;
    render();
  });
}

window.startGuide = startGuide;
window.completeGuide = completeGuide;
window.skipGuide = completeGuide;
