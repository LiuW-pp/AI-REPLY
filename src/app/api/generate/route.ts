import { NextRequest, NextResponse } from "next/server";

// ============================================================
// 类型定义
// ============================================================

interface GenerateRequest {
  originalText: string;
  /** 场景：预设值 | "auto"（智能感知）| 任意自定义字符串 */
  scenario: string;
  /** 情绪：预设值 | "auto"（智能感知）| 任意自定义字符串 */
  emotion: string;
  persona?: string;
  extraNote?: string;
  customRequirement?: string;
  image?: string;
  imageBase64?: string;
}

// ============================================================
// System Prompt 模板
// ============================================================

const PRESET_SCENARIOS = ["职场沟通", "日常社交", "网络对线"];
const PRESET_EMOTIONS = ["高情商", "幽默风趣", "阴阳怪气", "专业严谨"];

function buildSystemPrompt(
  scenario: string,
  emotion: string,
  persona?: string,
  customReq?: string,
): string {
  const parts: string[] = [];

  // 判断模式
  const scenarioAuto = scenario === "auto";
  const emotionAuto = emotion === "auto";
  const scenarioCustom = !scenarioAuto && !PRESET_SCENARIOS.includes(scenario);
  const emotionCustom = !emotionAuto && !PRESET_EMOTIONS.includes(emotion);

  // 基础角色
  parts.push(
    "你是一位具备顶级「网感」与超高情商的沟通大师。你的任务是根据用户提供的「对方原话」，生成 3 条不同角度的回复。",
  );
  parts.push("");
  parts.push("## 核心原则");
  parts.push(
    "你的回复永远自然、精炼、有「人味儿」，拒绝一切 AI 机械感、土味说教、以及僵硬的话术模板。",
  );

  // --- 人设注入 ---
  if (persona && persona.trim()) {
    parts.push("");
    parts.push("## 🎭 你的说话身份（最高优先级指令）");
    parts.push(`你现在就是「${persona.trim()}」。`);
    parts.push(
      "你必须以这个人设来思考、感受和说话。回复要完全符合这个身份的语气、用词习惯、立场和社交习惯。",
    );
    parts.push(
      "不要使用 AI 味浓重的客套话，而是用这个人设真实会说的、有血有肉的语言。",
    );
  }

  // --- 场景指引 ---
  parts.push("");
  if (scenarioAuto) {
    parts.push("## 🔮 场景：智能感知");
    parts.push(
      "请首先隐式分析「对方原话」的内容，自行推断当前对话最可能发生的社交场景（如职场、日常闲聊、网络争执等），然后基于你推断的场景来生成回复。不需要在回复中提到你做的推断。",
    );
  } else if (scenarioCustom) {
    parts.push(`## 场景：${scenario}`);
    parts.push(`请严格按照「${scenario}」这个场景设定来生成回复，忠实理解这个场景的含义和氛围。`);
  } else {
    parts.push(`## 场景：${scenario}`);
  }

  // --- 情绪指引 ---
  if (emotionAuto) {
    parts.push("## 🔮 情绪：智能感知");
    parts.push(
      "请首先隐式分析「对方原话」中对方的语气、态度和情绪，自行判断最恰当的回应情绪（如高情商圆滑、幽默化解、犀利回怼、专业分析等），然后以你判断的情绪来生成回复。不需要在回复中提到你做的推断。",
    );
  } else if (emotionCustom) {
    parts.push(`## 情绪/语气：${emotion}`);
    parts.push(`请严格按照「${emotion}」这个情绪基调来生成回复。忠实理解这个情绪描述的含义、语气和表达方式。`);
  } else {
    parts.push(`## 情绪/语气：${emotion}`);
  }

  // --- 自定义要求 ---
  if (customReq && customReq.trim()) {
    parts.push("");
    parts.push("## 附加要求");
    parts.push(customReq.trim());
  }

  // --- 输出要求 ---
  parts.push("");
  parts.push("## 输出要求");
  parts.push("1. 生成恰好 3 条回复，每条从不同角度切入。");
  if (!scenarioAuto) {
    parts.push(`2. 每条回复必须严格匹配「${scenario}」的场景。`);
  }
  if (!emotionAuto) {
    parts.push(`3. 每条回复必须严格匹配「${emotion}」的语气。`);
  }
  parts.push("4. 字数控制在 20-80 字之间，简洁有力，不啰嗦。");
  parts.push("5. 拒绝网络烂梗、拒绝爹味说教、拒绝假大空的鸡汤。");
  parts.push("6. 读起来要像是一个真实、聪明、有品位的人打出来的字，而不是 AI 生成的。");
  parts.push("");
  parts.push("## 表情符号使用策略");
  parts.push("- 在轻松、幽默、日常社交场景中，可以适量使用 1-2 个 emoji 来增强表现力（如 😂💀👀🙃🤡🔥）。");
  parts.push("- emoji 必须点缀在句尾或自然位置，不要堆砌。");
  parts.push("- 在「专业严谨」「高情商」模式下，减少或不用 emoji。");
  parts.push("- 在「阴阳怪气」「发疯文学」「林黛玉语气」模式下，emoji 是绝佳武器——多用一个 😅 能气死对方。");

  parts.push("");
  parts.push("## 输出格式（严格遵守）");
  parts.push("你必须只输出一个合法的 JSON 数组，不要带任何其他文字、解释或 Markdown 标记。");
  parts.push("数组包含恰好 3 个字符串元素。");
  parts.push("");
  parts.push("示例格式：");
  parts.push('["回复一的内容", "回复二的内容", "回复三的内容"]');

  return parts.join("\n");
}

// ============================================================
// JSON 解析（容错）
// ============================================================

function parseReplies(raw: string): string[] {
  let text = raw.trim();

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) text = codeBlockMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (text.startsWith("[") && !text.endsWith("]")) {
      try { parsed = JSON.parse(text + "]"); } catch { /* ignore */ }
    }
  }

  if (Array.isArray(parsed)) {
    const flat: string[] = [];
    for (const item of parsed as unknown[]) {
      if (typeof item === "string") flat.push(item);
    }
    if (flat.length >= 1) return flat.slice(0, 3);
  }

  const bracketMatch = text.match(/\[([\s\S]*)\]/);
  if (bracketMatch) {
    const strings: string[] = [];
    const strRegex = /"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = strRegex.exec(bracketMatch[1])) !== null) {
      strings.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"));
    }
    if (strings.length >= 1) return strings.slice(0, 3);
  }

  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\d+[\.\)、]\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((l) => l.length > 5)
    .slice(0, 3);
}

// ============================================================
// POST /api/generate
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const originalText = body.originalText?.trim();
    const scenario = body.scenario || "auto";
    const emotion = body.emotion || "auto";
    const persona = body.persona?.trim();
    const customReq = body.customRequirement?.trim() || body.extraNote?.trim();
    const imageBase64 = body.imageBase64 || body.image;

    const hasImage = !!(imageBase64 && imageBase64.startsWith("data:image/"));
    const hasText = !!(originalText && originalText.length > 0);

    if (!hasText && !hasImage) {
      return NextResponse.json({ error: "请提供原话内容或上传截图" }, { status: 400 });
    }

    const validText = originalText || "";

    // ---- 智能模型切换 ----
    // 有图片 + 有 Kimi Key → 用 Kimi vision
    // 无图片 → 用 DeepSeek
    const kimiKey = process.env.KIMI_API_KEY;
    const useKimi = hasImage && !!kimiKey;

    let apiKey: string;
    let baseURL: string;
    let model: string;

    if (useKimi) {
      apiKey = kimiKey!;
      baseURL = "https://api.moonshot.cn/v1";
      model = "moonshot-v1-8k-vision-preview";
    } else {
      apiKey = process.env.AI_API_KEY || "";
      baseURL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
      model = process.env.AI_MODEL || "deepseek-chat";
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "服务端未配置 API Key" },
        { status: 500 },
      );
    }

    // 构建 user message — 有图走 vision 模式
    let userTextBase: string;
    if (useKimi) {
      userTextBase = `对方原话："""${validText}"""\n\n请仔细阅读图片中的聊天上下文，结合对方的原话，生成 3 条不同角度的回复。`;
    } else if (hasImage) {
      userTextBase = `对方原话："""${validText}"""\n\n（注：用户上传了一张截图，但未配置图片识别模型。请仅基于对方原话生成 3 条不同角度的回复。）`;
    } else {
      userTextBase = `对方原话："""${validText}"""\n\n请生成 3 条不同角度的回复。`;
    }

    const useVisionPayload = useKimi;

    const systemContent = buildSystemPrompt(scenario, emotion, persona, customReq);

    const messages: { role: string; content: unknown }[] = [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: useVisionPayload
          ? [
              { type: "text", text: userTextBase },
              { type: "image_url", image_url: { url: imageBase64, detail: "auto" } },
            ]
          : userTextBase,
      },
    ];

    const apiUrl = `${baseURL}/chat/completions`;
    const fetchStart = Date.now();

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: 2048 }),
      });
    } catch (err) {
      console.error("[generate] fetch 失败:", err);
      return NextResponse.json({ error: "无法连接到 AI 服务" }, { status: 502 });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[generate] API ${response.status}:`, errorText.slice(0, 300));
      return NextResponse.json(
        { error: `AI 服务返回错误 (${response.status})` },
        { status: 502 },
      );
    }

    let data: Record<string, unknown>;
    try { data = await response.json(); } catch {
      return NextResponse.json({ error: "AI 服务返回了无法解析的数据" }, { status: 502 });
    }

    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    const msg = choice?.message as Record<string, string> | undefined;
    const content = msg?.content;

    if (!content && msg?.reasoning_content) {
      return NextResponse.json(
        { error: "当前模型仅返回推理过程，请切换为非 reasoning 模型" },
        { status: 502 },
      );
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "模型返回了空内容" }, { status: 502 });
    }

    const replies = parseReplies(content);
    if (replies.length === 0) {
      return NextResponse.json({ error: "无法解析模型返回的回复内容" }, { status: 502 });
    }

    const elapsed = Date.now() - fetchStart;
    console.log(`[generate] OK — ${replies.length} replies, ${elapsed}ms, mode: ${scenario}/${emotion}`);

    return NextResponse.json({ replies });
  } catch (error) {
    console.error("[generate] 未捕获错误:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
