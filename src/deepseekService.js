function normalizeTask(rawTask, index) {
  const title = String(rawTask.title || rawTask.name || `子任务 ${index + 1}`).trim();
  const detailSource = rawTask.detail || rawTask.description || rawTask.reason || "";
  const steps = Array.isArray(rawTask.steps) ? rawTask.steps.filter(Boolean).slice(0, 3) : [];
  const detail = String(detailSource || steps.join(" / ") || "从一个清晰的小步骤开始推进").trim();

  return {
    id: `deepseek-${Date.now()}-${index}`,
    title,
    detail,
    priority: rawTask.priority || "中",
    estimatedMinutes: Number(rawTask.estimatedMinutes || rawTask.minutes || 30),
    deadlineHint: rawTask.deadlineHint || rawTask.deadline || "",
  };
}

export function normalizeBreakdownPayload(payload) {
  const taskList = Array.isArray(payload.tasks) ? payload.tasks : payload.subtasks;

  if (!Array.isArray(taskList) || !taskList.length) {
    throw new Error("AI 返回内容缺少 tasks 数组");
  }

  return taskList.slice(0, 4).map(normalizeTask);
}

export async function decomposeTaskWithDeepSeek(taskText, attachment = null) {
  const response = await fetch("/api/decompose-task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskText,
      attachment,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `AI 请求失败：${response.status}`);
  }

  return normalizeBreakdownPayload(await response.json());
}
