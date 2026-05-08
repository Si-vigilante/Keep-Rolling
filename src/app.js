import { achievements, asset, beetles, cards, navItems, profileRows, tasks, todos as todoSeed } from "./data.js";

const state = {
  route: "home",
  menuOpen: true,
  modal: null,
  selectedTask: tasks[0],
  selectedCard: cards[0],
  todos: structuredClone(todoSeed),
  aiStarted: false,
  drawnCard: null,
};

const app = document.querySelector("#app");

const routeClass = () => `route-${state.route}`;

function setRoute(route) {
  state.route = route;
  state.modal = null;
  if (route === "execute") state.selectedTask = tasks[0];
  render();
}

function setModal(modal) {
  state.modal = modal;
  render();
}

function button(label, className = "", attrs = "") {
  return `<button class="ui-btn ${className}" ${attrs}>${label}</button>`;
}

function backButton() {
  return `<button class="round-btn back-btn" data-route="home" aria-label="返回">←</button>`;
}

function homeTools() {
  return `
    <div class="floating-tools">
      <button class="tool-btn" data-route="profile" aria-label="设置">⚙</button>
      <button class="tool-btn" data-modal="message" aria-label="消息">✉</button>
      <button class="tool-btn" data-modal="message" aria-label="提醒">♟</button>
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
    .map((item) => `<button class="menu-paper" data-route="${item.id}">${item.label}</button>`)
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
  if (state.aiStarted) {
    return `
      <section class="page ai-page">
        ${backButton()}
        <div class="ai-orbit">
          <button class="cloud-choice choice-a">A</button>
          <button class="cloud-choice choice-b">B</button>
          <button class="cloud-choice choice-c">C</button>
          <button class="cloud-choice choice-d">D</button>
        </div>
        <div class="task-steps">
          ${["步骤1：A", "步骤2：B", "步骤3：C", "步骤4：D"].map((step) => `<div class="paper-step">${step}</div>`).join("")}
        </div>
        <div class="ai-core">Go For It!</div>
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
  const digits = task.time === "01:23:46" ? ["0", "1", ":", "2", "3", ":", "4", "6"] : ["0", "0", ":", "0", "0", ":", "0", "0"];
  return `
    <section class="page execute-page">
      <div class="status-pill">${task.status === "paused" ? "暂停：" : "正在执行："}&nbsp;&nbsp;${task.owner}</div>
      <div class="timer-row">
        ${digits.map((d) => (d === ":" ? `<span class="colon">:</span>` : `<span class="timer-card">${d}</span>`)).join("")}
      </div>
      <div class="execute-actions">
        ${button("完成", "orange", 'data-modal="complete"')}
        ${button(task.status === "paused" ? "继续" : "暂停", "orange", 'data-action="pause-task"')}
        ${button("取消", "orange", 'data-modal="cancel"')}
      </div>
      <img class="worker-push" src="${beetles.worker}" alt="执行任务的屎壳郎" />
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
                  <label class="todo-item">
                    <input type="checkbox" data-todo="${todo.id}" ${todo.done ? "checked" : ""} />
                    <span>${todo.name}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="todo-divider"></div>
        <div class="todo-right">
          <button class="circle-plus" data-modal="todo-new">＋</button>
          <button class="circle-minus" data-action="remove-done">－</button>
          <div class="acorn-card">
            <strong>${state.selectedTask.name}</strong>
            ${state.selectedTask.detail.map((line) => `<span>${line}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="side-tools">
        <button>□<small>2</small></button>
        <button>A↓</button>
        <button>🖼</button>
        <button>✎</button>
      </div>
      <button class="cheer-cloud" data-route="execute">加油!</button>
      ${kingMascot()}
    </section>
  `;
}

function renderCards() {
  return `
    <section class="page cards-page">
      ${backButton()}
      <h1 class="page-title">卡牌库</h1>
      <nav class="library-tabs">
        <button class="tab active" data-action="card-tab" data-tab="cards">卡牌</button>
        <button class="tab" data-action="card-tab" data-tab="achievements">成就</button>
      </nav>
      <div class="library-panel">
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
      </div>
    </section>
  `;
}

function renderAchievements() {
  return `
    <section class="page cards-page">
      ${backButton()}
      <h1 class="page-title">卡牌库</h1>
      <div class="search-pill">⌕ 搜索成就</div>
      <nav class="library-tabs">
        <button class="tab" data-route="cards">卡牌</button>
        <button class="tab active">成就</button>
      </nav>
      <div class="achievement-panel">
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
      </div>
      <div class="achievement-total">已完成 12/50</div>
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
      <button class="cloud-note">太厉害!</button>
      <img class="review-character" src="${beetles.board}" alt="看板螂" />
      <div class="review-actions">
        <button>⌯<span>分享</span></button>
        <button>⇄<span>切换</span></button>
      </div>
    </section>
  `;
}

function renderProfile() {
  return `
    <section class="page profile-page">
      ${backButton()}
      <h1 class="page-title">个人中心</h1>
      <div class="profile-grid">
        <div class="profile-panel">
          <div class="profile-head">
            <img src="${beetles.king}" alt="金角大螂" />
            <div class="name-strip"><b>金角大螂</b><span>Lv.3</span></div>
          </div>
          ${profileRows.map((row) => `<div class="setting-row"><span>${row[0]}</span><b>${row[1]}</b><em>›</em></div>`).join("")}
          <label class="export-row">一键导出任务记录 <input type="checkbox" /></label>
        </div>
        <div class="profile-panel">
          <div class="volume-row"><span>⌕×</span><i></i><b>⌕</b></div>
          ${["帮助与反馈", "内存", "语言", "字体", "桌宠功能", "兑换码"].map((label, idx) => `<div class="setting-row"><span>${label}</span><b>${idx === 1 ? "100MB" : idx === 2 ? "中文" : idx === 3 ? "默认" : idx === 4 ? "开启" : ""}</b><em>›</em></div>`).join("")}
          <div class="code-input">✎ 输入…… <em>›</em></div>
          <div class="logout">退出登录 ⏻</div>
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
      <img class="draw-king" src="${beetles.king}" alt="螂王" />
      <div class="pick-one">Pick One</div>
      <div class="card-fan">
        ${cards.slice(0, 6).map((card, index) => `<button class="fan-card fan-${index}" data-draw="${card.id}"><img src="${asset("透明卡牌背面.png")}" alt="抽卡" /></button>`).join("")}
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

function modalMarkup() {
  if (!state.modal) return "";

  if (state.modal === "message") {
    return `
      <div class="modal-layer" data-action="close-modal">
        <div class="message-modal" role="dialog" aria-modal="true">
          <h2>消息</h2>
          <p>任务A正在等待拆解结果，今日还有 3 条待办未完成。</p>
          ${button("查看任务", "orange", 'data-route="todo"')}
        </div>
      </div>
    `;
  }

  if (state.modal === "complete") {
    return `
      <div class="modal-layer golden" data-action="close-modal">
        <div class="cloud-modal">
          <h2>我就知道<br />你可以的</h2>
          ${button("下一个任务", "orange", 'data-route="todo"')}
          ${button("返回首页", "orange", 'data-route="home"')}
          <img src="${beetles.worker}" alt="小二螂" />
          <img class="gold-ball" src="${asset("Golden Dung Ball.jpg")}" alt="奖励金球" />
        </div>
      </div>
    `;
  }

  if (state.modal === "cancel") {
    return `
      <div class="modal-layer dark" data-action="close-modal">
        <div class="cloud-modal cancel-modal">
          <h2>真的要放弃吗</h2>
          <img src="${beetles.cleaner}" alt="保洁螂" />
          ${button("再想想", "orange", 'data-action="close-modal"')}
          <button class="text-choice" data-route="home">确定</button>
        </div>
      </div>
    `;
  }

  if (state.modal === "todo-new") {
    return `
      <div class="modal-layer" data-action="close-modal">
        <div class="paper-dialog">
          <h2>新增任务</h2>
          <input id="newTaskName" placeholder="任务名：请输入" />
          ${button("加入待办", "orange", 'data-action="add-todo"')}
        </div>
      </div>
    `;
  }

  if (state.modal === "card-detail") {
    const card = state.selectedCard;
    return `
      <div class="modal-layer card-modal-layer" data-action="close-modal">
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
      </div>
    `;
  }

  return "";
}

function render() {
  const pages = {
    home: renderHome,
    ai: renderAi,
    tasks: renderDraw,
    execute: renderExecute,
    todo: renderTodo,
    cards: renderCards,
    achievements: renderAchievements,
    review: renderReview,
    profile: renderProfile,
    draw: renderDraw,
  };

  app.innerHTML = `
    <main class="stage ${routeClass()}">
      ${pages[state.route]()}
      ${modalMarkup()}
    </main>
  `;
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button, .modal-layer");
  if (!target) return;

  if (target.dataset.route) {
    setRoute(target.dataset.route);
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
    render();
    return;
  }

  const action = target.dataset.action;
  if (!action) return;

  if (action === "toggle-menu") {
    state.menuOpen = !state.menuOpen;
    render();
  }
  if (action === "start-ai") {
    state.aiStarted = true;
    render();
  }
  if (action === "reset-ai") {
    state.aiStarted = false;
    render();
  }
  if (action === "pause-task") {
    state.selectedTask = { ...state.selectedTask, status: state.selectedTask.status === "paused" ? "running" : "paused" };
    render();
  }
  if (action === "close-modal") {
    state.modal = null;
    render();
  }
  if (action === "remove-done") {
    state.todos = state.todos.filter((todo) => !todo.done);
    render();
  }
  if (action === "card-tab") {
    setRoute("achievements");
  }
  if (action === "add-todo") {
    const input = document.querySelector("#newTaskName");
    const value = input?.value?.trim() || "任务名：新的任务";
    state.todos.push({ id: Date.now(), name: value, done: false });
    state.modal = null;
    render();
  }
  if (action === "redraw") {
    state.drawnCard = null;
    render();
  }
  if (action === "confirm-draw") {
    setRoute("execute");
  }
});

app.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-todo]");
  if (!checkbox) return;
  const todo = state.todos.find((item) => item.id === Number(checkbox.dataset.todo));
  if (todo) todo.done = checkbox.checked;
  render();
});

render();
