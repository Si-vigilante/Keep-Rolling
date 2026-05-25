import { cards, tasks } from "./data.js";

export function createAiTaskBreakdown(taskText = "今天的任务") {
  const taskName = String(taskText).trim() || "今天的任务";
  return [
    { id: "ai-1", title: "整理目标", detail: `明确「${taskName}」的最终交付物` },
    { id: "ai-2", title: "拆成小步", detail: "挑出 3 个可以马上开始的动作" },
    { id: "ai-3", title: "安排顺序", detail: "按难度和截止时间排好优先级" },
    { id: "ai-4", title: "开始滚动", detail: "选择第一步进入执行页面" },
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
  if (task?.rewardCardId) {
    return cards.find((card) => card.id === Number(task.rewardCardId)) || cards[0];
  }
  return cards.find((card) => card.title === task.name) || cards[0];
}
