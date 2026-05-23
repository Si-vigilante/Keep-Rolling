import { cards, tasks } from "./data.js";

export function createAiTaskBreakdown() {
  return [
    { id: "ai-1", title: "整理目标", detail: "把今天最想完成的事情写成一句话" },
    { id: "ai-2", title: "拆成小步", detail: "挑出 3 个可以马上开始的动作" },
    { id: "ai-3", title: "放进任务池", detail: "确认优先级和预计时间" },
    { id: "ai-4", title: "开始滚动", detail: "选择一张任务卡进入执行" },
  ];
}

export function createTodosFromAi(steps) {
  return steps.map((step, index) => ({
    id: Date.now() + index,
    name: `任务名：${step.title}`,
    done: false,
  }));
}

export function makeTodo(name) {
  return {
    id: Date.now(),
    name: name.startsWith("任务名：") ? name : `任务名：${name}`,
    done: false,
  };
}

export function taskFromTodo(todo) {
  const cleanName = todo.name.replace(/^任务名：/, "");
  const matchedTask = tasks.find((task) => task.id === Number(todo.id) || task.name === cleanName);
  if (matchedTask) return matchedTask;

  return {
    id: todo.id,
    name: cleanName,
    owner: "待办任务",
    time: "待开始",
    status: todo.done ? "complete" : "pending",
    detail: ["确认任务目标", "整理所需材料", "专注完成当前步骤"],
    reward: "今日坚持卡",
  };
}

export function resolveTask(taskId) {
  return tasks.find((task) => task.id === Number(taskId)) || tasks[0];
}

export function rewardCardForTask(task) {
  return cards.find((card) => card.title === task.name) || cards[0];
}
