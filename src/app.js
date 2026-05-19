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
};

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
        <h2>${isSignup ? "注册事克郎账号" : "登录事克郎账号"}</h2>
        <p>${isSignup ? "创建账号后，你的任务旅程就能和邮箱身份绑定。" : "登录后继续你的任务拆解、待办与卡牌旅程。"}</p>
        ${isSignup ? `<input id="authName" name="name" autocomplete="name" placeholder="昵称" />` : ""}
        <input id="authEmail" name="email" type="email" autocomplete="email" required placeholder="邮箱" />
        <input id="authPassword" name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" required placeholder="密码" />
        ${state.authError ? `<div class="auth-error">${state.authError}</div>` : ""}
        <small class="auth-hint">首次部署后需在 Netlify 后台启用 Identity；测试时建议开启 Autoconfirm。</small>
        <button class="auth-submit" type="submit" ${state.authSubmitting ? "disabled" : ""}>${state.authSubmitting ? "处理中..." : isSignup ? "注册" : "登录"}</button>
        <button class="auth-switch" type="button" data-action="switch-auth">${isSignup ? "已有账号，去登录" : "没有账号，去注册"}</button>
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
      ${modalMarkup()}
      ${toastMarkup()}
    </main>
  `;
}

function handleRoute(target) {
  const tab = target.dataset.tab;
  const profileTab = target.dataset.profileTab;
  const mode = target.dataset.mode || "push";
  if (tab) state.cardTab = tab;
  if (profileTab) state.profileTab = profileTab;
  const route = target.dataset.route;
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
    state.menuOpen = !state.menuOpen;
    render();
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
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");

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
    showToast(user.emailVerified === false ? "注册成功，请前往邮箱确认账号。" : "登录成功");
    if (state.pendingRoute) {
      const route = state.pendingRoute;
      state.pendingRoute = null;
      navigate(route, { mode: "push", fresh: true });
    }
  } catch (error) {
    state.authError = authErrorMessage(error);
  } finally {
    state.authSubmitting = false;
    render();
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

initializeAuth({
  onChange(user) {
    state.authUser = user || null;
    state.authLoading = false;
    render();
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
