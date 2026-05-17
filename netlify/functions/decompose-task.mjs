const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_BASE_URL = "https://api.deepseek.com";

function readEnv(name) {
  if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name);
  return globalThis.process?.env?.[name];
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function buildPrompt(taskText, attachmentText = "") {
  return [
    `用户的大任务：${taskText}`,
    attachmentText ? `用户补充文件内容：${attachmentText}` : "",
    "请拆成 4 个适合学生马上执行的子任务。每个子任务要有标题、说明、优先级、预估分钟数、截止建议和 1-3 个步骤。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Missing DEEPSEEK_API_KEY" }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const taskText = body.taskText?.trim();
  if (!taskText) {
    return jsonResponse({ error: "taskText is required" }, 400);
  }

  const model = readEnv("DEEPSEEK_MODEL") || DEFAULT_MODEL;
  const baseUrl = readEnv("DEEPSEEK_BASE_URL") || DEFAULT_BASE_URL;
  const attachmentText = body.attachment?.content?.trim() || "";

  const deepseekResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "你是一个任务拆解助手。必须只返回 JSON 对象，格式为 {\"tasks\":[{\"title\":\"...\",\"detail\":\"...\",\"priority\":\"高/中/低\",\"estimatedMinutes\":30,\"deadlineHint\":\"...\",\"steps\":[\"...\"]}]}。不要输出 Markdown。",
        },
        {
          role: "user",
          content: buildPrompt(taskText, attachmentText),
        },
      ],
    }),
  });

  if (!deepseekResponse.ok) {
    return jsonResponse(
      {
        error: "DeepSeek request failed",
        status: deepseekResponse.status,
        detail: await deepseekResponse.text(),
      },
      502,
    );
  }

  const data = await deepseekResponse.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return jsonResponse({ error: "DeepSeek returned empty content" }, 502);
  }

  try {
    return jsonResponse(JSON.parse(content));
  } catch {
    return jsonResponse({ error: "DeepSeek returned invalid JSON", raw: content }, 502);
  }
};

export const config = {
  path: "/api/decompose-task",
  method: ["POST"],
};
