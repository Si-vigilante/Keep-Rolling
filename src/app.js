import { achievements, asset, beetles, cards, navItems, profileRows, tasks, todos as todoSeed } from "./data.js";
import { createAiTaskBreakdown, createTodosFromAi, makeTodo, resolveTask, rewardCardForTask } from "./mockServices.js";

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
  toast: null,
  selectedTask: tasks[0],
  selectedCard: cards[0],
  todos: structuredClone(todoSeed),
  aiPhase: "input",
  aiSteps: [],
  cardTab: "cards",
  profileTab: "settings",
  executeStatus: "idle",
  drawnCard: null,
  drawPhase: "selecting",
};

const app = document.querySelector("#app");
let toastTimer;

function updateStageScale() {
  const scale = Math.max(window.innerWidth / 1280, window.innerHeight / 800);
  document.documentElement.style.setProperty("--stage-scale", scale.toString());
}

function routeClass() {
  return `route-${state.route} nav-${state.transition}`;
}

function navigate(route, direction = "forward") {
  if (!route || route === state.route) return;
  state.previousRoute = state.route;
  state.route = route;
  state.transition = direction;
  state.modal = null;
  if (direction === "forward") {
    state.history.push(route);
  }
  if (route === ROUTES.EXECUTE && state.executeStatus === "idle") {
    state.executeStatus = "running";
  }
  if (route === ROUTES.DRAW && state.drawPhase !== "revealed") {
    state.drawnCard = null;
    state.drawPhase = "selecting";
  }
  render();
}

function goBack() {
  if (state.route === ROUTES.HOME) return;
  const previous = state.history.length > 1 ? state.history[state.history.length - 2] : ROUTES.HOME;
  state.history = state.history.slice(0, -1);
  navigate(previous, "back");
  state.history = state.history.length ? state.history : [ROUTES.HOME];
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

function button(label, className = "", attrs = "") {
  return `<button class="ui-btn ${className}" ${attrs}>${label}</button>`;
}

function backButton(extra = "") {
  return `<button class="round-btn back-btn" data-action="${extra || "back"}" aria-label="返回">←</button>`;
}

function homeTools() {
  return `
    <div class="floating-tools">
      <button class="tool-btn" data-route="profile" data-profile-tab="settings" aria-label="设置">⚙</button>
      <button class="tool-btn" data-modal="message" aria-label="消息">✉</button>
      <button class="tool-btn" data-modal="notice" aria-label="提醒">♟</button>
    </div>
  `;
}

function profileCard() {
  return `
    <button class="profile-card" data-route="profile">
      <span class="avatar-orb"></span>
      <span class="profile-text">
        <b>金螂XXX</b>
        <small>Lv.3</small>
        <small>2024.10.27</small>
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
  const nav = navItems
    .map((item) => {
      const target = item.id === "tasks" ? ROUTES.DRAW : item.id;
      return `<button class="menu-paper" data-route="${target}">${item.label}</button>`;
    })
    .join("");

  return `
    <section class="page home-page">
      ${profileCard()}
      ${homeTools()}
      <aside class="home-menu ${state.menuOpen ? "open" : "closed"}">
        <div class="menu-inner">${nav}</div>
        <button class="menu-toggle" data-action="toggle-menu">«</button>
      </aside>
      <div class="home-cloud"></div>
      ${kingMascot()}
    </section>
  `;
}

function renderAi() {
  if (state.aiPhase === "generated" || state.aiPhase === "confirmed") {
    return `
      <section class="page ai-page">
        ${backButton()}
        <div class="ai-orbit">
          ${state.aiSteps
            .map((step, index) => `<button class="cloud-choice choice-${String.fromCharCode(97 + index)}" data-action="toast" data-toast="${step.detail}">${String.fromCharCode(65 + index)}</button>`)
            .join("")}
        </div>
        <div class="task-steps">
          ${state.aiSteps.map((step) => `<button class="paper-step" data-action="toast" data-toast="${step.detail}">${step.title}</button>`).join("")}
        </div>
        <button class="ai-core" data-action="confirm-ai">${state.aiPhase === "confirmed" ? "Added!" : "Go For It!"}</button>
        <button class="sync-btn" data-action="reset-ai" aria-label="重新拆解">↻</button>
      </section>
    `;
  }

  return `
    <section class="page ai-page">
      ${backButton()}
      <button class="ai-cloud-prompt" data-action="start-ai">今天想<br />做些什么？</button>
      <button class="mud-core" data-action="start-ai">Click Me</button>
    </section>
  `;
}

function renderExecute() {
  const task = state.selectedTask;
  const running = state.executeStatus === "running";
  const paused = state.executeStatus === "paused";
  const label = running ? "正在执行：" : paused ? "暂停：" : "准备开始：";
  const digits = running ? ["0", "1", ":", "2", "3", ":", "4", "6"] : ["0", "0", ":", "0", "0", ":", "0", "0"];
  return `
    <section class="page execute-page">
      ${backButton("ask-abandon")}
      <div class="status-pill">${label}&nbsp;&nbsp;${task.owner}</div>
      <div class="timer-row">
        ${digits.map((d) => (d === ":" ? `<span class="colon">:</span>` : `<span class="timer-card">${d}</span>`)).join("")}
      </div>
      <div class="execute-actions">
        ${button("完成", "orange", 'data-action="complete-task"')}
        ${button(running ? "暂停" : "开始", "orange", 'data-action="toggle-execute"')}
        ${button("取消", "orange", 'data-action="ask-abandon"')}
      </div>
      <img class="worker-push ${running ? "is-running" : ""}" src="${beetles.worker}" alt="执行任务的屎壳郎" />
    </section>
  `;
}

function renderTodo() {
  return `
    <section class="page todo-page">
      ${backButton()}
      <button class="mini-cards" data-route="draw" aria-label="抽卡">▰▰</button>
      <div class="todo-board">
        <div class="todo-left">
          <h1>我的待办事项</h1>
          <div class="todo-list">
            ${state.todos
              .map(
                (todo) => `
                  <label class="todo-item ${state.selectedTask.id === todo.id ? "selected" : ""}">
                    <input type="checkbox" data-todo="${todo.id}" ${todo.done ? "checked" : ""} />
                    <button data-action="select-todo" data-task="${todo.id}">${todo.name}</button>
                  </label>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="todo-divider"></div>
        <div class="todo-right">
          <button class="circle-plus" data-modal="todo-new" aria-label="新增任务">＋</button>
          <button class="circle-minus" data-action="ask-remove-done" aria-label="删除已完成">－</button>
          <button class="acorn-card" data-modal="todo-detail">
            <strong>${state.selectedTask.name}</strong>
            ${state.selectedTask.detail.map((line) => `<span>${line}</span>`).join("")}
          </button>
        </div>
      </div>
      <div class="side-tools">
        <button data-action="toast" data-toast="已切换卡片视图">□<small>2</small></button>
        <button data-action="toast" data-toast="排序方式已更新">A↓</button>
        <button data-action="toast" data-toast="插图功能稍后接入">🖼</button>
        <button data-modal="todo-new">✎</button>
      </div>
      <button class="cheer-cloud" data-route="execute">加油!</button>
      ${kingMascot()}
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
        <button data-action="toast" data-toast="分享面板稍后接入">⌯<span>分享</span></button>
        <button data-action="toast" data-toast="已切换回顾样式">⇄<span>切换</span></button>
      </div>
    </section>
  `;
}

function renderProfile() {
  const labels = [
    ["settings", "⚙"],
    ["mail", "✉"],
    ["notice", "♟"],
  ];
  return `
    <section class="page profile-page">
      ${backButton()}
      <h1 class="page-title">个人中心</h1>
      <nav class="profile-tabs">
        ${labels.map(([tab, icon]) => `<button class="${state.profileTab === tab ? "active" : ""}" data-action="profile-tab" data-tab="${tab}">${icon}</button>`).join("")}
      </nav>
      <div class="profile-grid tab-panel">
        <div class="profile-panel">
          <div class="profile-head">
            <img src="${beetles.king}" alt="金角大螂" />
            <div class="name-strip"><b>金角大螂</b><span>Lv.3</span></div>
          </div>
          ${profileRows.map((row) => `<button class="setting-row" data-action="toast" data-toast="${row[0]}编辑稍后接入"><span>${row[0]}</span><b>${row[1]}</b><em>›</em></button>`).join("")}
          <label class="export-row">一键导出任务记录 <input type="checkbox" /></label>
        </div>
        <div class="profile-panel">
          <div class="volume-row"><span>⌕×</span><i></i><b>⌕</b></div>
          ${["帮助与反馈", "内存", "语言", "字体", "桌宠功能", "兑换码"].map((label, idx) => `<button class="setting-row" data-action="toast" data-toast="${label}设置稍后接入"><span>${label}</span><b>${idx === 1 ? "100MB" : idx === 2 ? "中文" : idx === 3 ? "默认" : idx === 4 ? "开启" : ""}</b><em>›</em></button>`).join("")}
          <button class="code-input" data-action="toast" data-toast="兑换入口稍后接入">✎ 输入…… <em>›</em></button>
          <button class="logout" data-modal="logout">退出登录 ⏻</button>
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
      <button class="history-btn" data-route="cards">历史</button>
      <img class="draw-king" src="${beetles.king}" alt="螂王" />
      <div class="pick-one">Pick One</div>
      <div class="card-fan ${state.drawPhase === "revealed" ? "has-pick" : ""}">
        ${cards.slice(0, 6).map((card, index) => `<button class="fan-card fan-${index} ${picked?.id === card.id ? "picked" : ""}" data-draw="${card.id}"><img src="${asset("透明卡牌背面.png")}" alt="抽卡" /></button>`).join("")}
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

function modalShell(content, className = "") {
  return `<div class="modal-layer ${className}" data-action="close-modal">${content}</div>`;
}

function modalMarkup() {
  if (!state.modal) return "";

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
        ${button("查看卡牌", "orange", 'data-route="cards" data-tab="cards"')}
        ${button("任务回顾", "orange", 'data-route="review"')}
        <img src="${beetles.worker}" alt="小二螂" />
        <img class="gold-ball" src="${asset("Golden Dung Ball.jpg")}" alt="奖励金球" />
      </div>
    `, "golden");
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
    `, "dark");
  }

  if (state.modal === "todo-new" || state.modal === "todo-detail") {
    const isDetail = state.modal === "todo-detail";
    return modalShell(`
      <div class="paper-dialog">
        <h2>${isDetail ? "任务详情" : "新增任务"}</h2>
        <input id="newTaskName" value="${isDetail ? state.selectedTask.name : ""}" placeholder="任务名：请输入" />
        ${button(isDetail ? "保存" : "加入待办", "orange", `data-action="${isDetail ? "save-task" : "add-todo"}"`)}
        ${isDetail ? button("开始执行", "paper", 'data-route="execute"') : ""}
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
  if (tab) state.cardTab = tab;
  if (profileTab) state.profileTab = profileTab;
  navigate(target.dataset.route);
}

function handleAction(action, target) {
  if (action === "back") goBack();
  if (action === "toggle-menu") {
    state.menuOpen = !state.menuOpen;
    render();
  }
  if (action === "start-ai") {
    state.aiSteps = createAiTaskBreakdown();
    state.aiPhase = "generated";
    render();
  }
  if (action === "confirm-ai") {
    state.todos = [...createTodosFromAi(state.aiSteps), ...state.todos];
    state.aiPhase = "confirmed";
    showToast("已加入任务池");
    setTimeout(() => navigate(ROUTES.DRAW), 760);
  }
  if (action === "reset-ai") {
    state.aiPhase = "input";
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
  if (action === "abandon-task") navigate(ROUTES.HOME, "back");
  if (action === "ask-remove-done") setModal("remove-done");
  if (action === "remove-done") {
    state.todos = state.todos.filter((todo) => !todo.done);
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
    state.todos.push(makeTodo(value));
    closeModal();
    showToast("已加入待办");
  }
  if (action === "save-task") {
    const input = document.querySelector("#newTaskName");
    const value = input?.value?.trim();
    if (value) state.selectedTask = { ...state.selectedTask, name: value };
    closeModal();
    showToast("任务已更新");
  }
  if (action === "select-todo") {
    state.selectedTask = resolveTask(target.dataset.task);
    setModal("todo-detail");
  }
  if (action === "redraw") {
    state.drawnCard = null;
    state.drawPhase = "selecting";
    render();
  }
  if (action === "confirm-draw") {
    state.selectedTask = tasks.find((task) => task.name === state.drawnCard?.title) || tasks[0];
    state.executeStatus = "running";
    navigate(ROUTES.EXECUTE);
  }
  if (action === "confirm-logout") {
    closeModal();
    showToast("已退出登录");
  }
  if (action === "toast") showToast(target.dataset.toast || "功能稍后接入");
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");

  if (!target && event.target.classList.contains("modal-layer")) {
    closeModal();
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

app.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-todo]");
  if (!checkbox) return;
  const todo = state.todos.find((item) => item.id === Number(checkbox.dataset.todo));
  if (todo) todo.done = checkbox.checked;
  render();
});

window.addEventListener("resize", updateStageScale);
updateStageScale();
render();
