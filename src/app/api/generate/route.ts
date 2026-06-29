import { NextRequest, NextResponse } from "next/server";

// ============================================================
// 类型定义
// ============================================================

interface GenerateRequest {
  originalText: string;
  scenario: "职场沟通" | "日常社交" | "网络对线";
  emotion: "高情商" | "幽默风趣" | "阴阳怪气" | "专业严谨";
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// ============================================================
// System Prompt 模板
// ============================================================

function buildSystemPrompt(scenario: string, emotion: string): string {
  return `你是一位具备顶级「网感」与超高情商的沟通大师。你的任务是根据用户提供的"对方原话"，生成 3 条不同角度的回复。

## 核心身份
你深谙人际沟通的底层逻辑，懂得如何在复杂的社交场景中游刃有余。你的回复永远自然、精炼、有「人味儿」，拒绝一切 AI 机械感、土味说教、以及僵硬的话术模板。

## 场景：${scenario}
## 情绪/语气：${emotion}

## 输出要求
1. 生成恰好 3 条回复，每条从不同角度切入。
2. 每条回复必须严格匹配「${emotion}」的语气和「${scenario}」的场景。
3. 字数控制在 20-80 字之间，简洁有力，不啰嗦。
4. 拒绝网络烂梗、拒绝爹味说教、拒绝假大空的鸡汤。
5. 读起来要像是一个真实、聪明、有品位的人打出来的字，而不是 AI 生成的。

## 输出格式（严格遵守）
你必须只输出一个合法的 JSON 数组，不要带任何其他文字、解释或 Markdown 标记。
数组包含恰好 3 个字符串元素。

示例格式：
["回复一的内容", "回复二的内容", "回复三的内容"]`;
}

// ============================================================
// JSON 解析（容错）
// ============================================================

function parseReplies(raw: string): string[] {
  // 去除首尾空白
  let text = raw.trim();

  // 如果被包在 Markdown 代码块里，剥掉
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 尝试直接解析（也处理截断：尝试补全末尾缺失的 ]）
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 尝试补全截断的数组
    if (text.startsWith("[") && !text.endsWith("]")) {
      try {
        parsed = JSON.parse(text + "]");
      } catch {
        parsed = undefined;
      }
    }
  }

  if (Array.isArray(parsed)) {
    const flat: string[] = [];
    for (const item of parsed as unknown[]) {
      if (typeof item === "string") {
        flat.push(item);
      }
    }
    if (flat.length >= 1) return flat.slice(0, 3);
  }

  // 尝试用正则提取引号内的字符串数组元素
  const stringMatch = text.match(/\[([\s\S]*)\]/);
  if (stringMatch) {
    const inner = stringMatch[1];
    // 匹配双引号字符串（处理转义）
    const strings: string[] = [];
    const strRegex = /"((?:[^"\\]|\\.)*)"/g;
    let match: RegExpExecArray | null;
    while ((match = strRegex.exec(inner)) !== null) {
      strings.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"));
    }
    if (strings.length >= 1) {
      return strings.slice(0, 3);
    }
  }

  // 最后兜底：按换行符分割
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\d]+[\.\)、]\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((l) => l.length > 5);

  return lines.slice(0, 3);
}

// ============================================================
// POST /api/generate
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body: GenerateRequest = await request.json();
    const { originalText, scenario, emotion } = body;

    // 参数校验
    if (!originalText || typeof originalText !== "string" || originalText.trim().length === 0) {
      return NextResponse.json(
        { error: "缺少参数 originalText" },
        { status: 400 },
      );
    }

    const validScenarios = ["职场沟通", "日常社交", "网络对线"];
    const validEmotions = ["高情商", "幽默风趣", "阴阳怪气", "专业严谨"];

    if (!validScenarios.includes(scenario)) {
      return NextResponse.json(
        { error: `无效的 scenario，支持: ${validScenarios.join(", ")}` },
        { status: 400 },
      );
    }

    if (!validEmotions.includes(emotion)) {
      return NextResponse.json(
        { error: `无效的 emotion，支持: ${validEmotions.join(", ")}` },
        { status: 400 },
      );
    }

    // 读取环境变量
    const baseURL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return NextResponse.json(
        { error: "服务端未配置 AI_API_KEY，请在 .env 中设置" },
        { status: 500 },
      );
    }

    // 构建消息
    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(scenario, emotion) },
      { role: "user", content: `对方原话："""${originalText.trim()}"""\n\n请生成 3 条不同角度的回复。` },
    ];

    // 调用大模型 API
    const apiUrl = `${baseURL.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate] API 请求失败:", response.status, errorText);
      return NextResponse.json(
        { error: `AI 服务请求失败 (${response.status})，请检查 API 配置` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[generate] 模型返回为空:", JSON.stringify(data));
      return NextResponse.json(
        { error: "模型返回了空内容，请稍后重试" },
        { status: 502 },
      );
    }

    // 解析回复
    const replies = parseReplies(content);

    if (replies.length === 0) {
      return NextResponse.json(
        { error: "无法解析模型返回的回复内容" },
        { status: 502 },
      );
    }

    // 成功返回
    return NextResponse.json({ replies });
  } catch (error) {
    console.error("[generate] 未知错误:", error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 },
    );
  }
}
