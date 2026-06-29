"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Check, Sparkles, Loader2 } from "lucide-react";

// ---- 类型定义 ----
type Scene = "职场沟通" | "日常社交" | "网络对线";
type Tone = "高情商" | "幽默风趣" | "阴阳怪气" | "专业严谨";

interface ReplyItem {
  id: number;
  tone: string;
  text: string;
}

// ---- 常量 ----
const SCENES: Scene[] = ["职场沟通", "日常社交", "网络对线"];
const TONES: Tone[] = ["高情商", "幽默风趣", "阴阳怪气", "专业严谨"];

// ================================================
// Toast 系统
// ================================================

interface ToastMessage {
  id: number;
  text: string;
}

let toastIdCounter = 0;
const toastListeners = new Set<() => void>();

function emitToast(text: string) {
  // 通过全局事件触发 Toast（跨组件通信）
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("toast", { detail: { id: ++toastIdCounter, text } })
    );
  }
}

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, text } = (e as CustomEvent).detail as ToastMessage;
      setToasts((prev) => [...prev, { id, text }]);
      // 2 秒后自动消失
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2000);
    };
    window.addEventListener("toast", handler);
    return () => window.removeEventListener("toast", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="
            animate-[toast-in_0.3s_ease-out]
            rounded-2xl bg-gray-900 px-6 py-3
            text-sm font-medium text-white
            shadow-[0_8px_30px_rgba(0,0,0,0.15)]
          "
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ================================================
// Pill Toggle 组件
// ================================================

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`
            relative inline-flex items-center rounded-full px-5 py-2
            text-sm font-medium leading-none
            transition-all duration-200 ease-out
            focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2
            ${
              value === option
                ? "bg-gray-900 text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }
          `}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

// ================================================
// 结果卡片组件（含淡入动画 + 复制 Toast）
// ================================================

function ReplyCard({
  reply,
  index,
}: {
  reply: ReplyItem;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reply.text);
      setCopied(true);
      emitToast("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="
        group relative rounded-2xl border border-gray-100
        bg-white p-6
        shadow-[0_8px_30px_rgba(0,0,0,0.04)]
        opacity-0 animate-[fade-in_0.45s_ease-out_forwards]
        transition-all duration-300 ease-out
        hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]
      "
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* 顶部：语气标签 + 复制按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-400">
          {reply.tone}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className="
            flex h-8 w-8 items-center justify-center rounded-full
            text-gray-300 transition-all duration-200 ease-out
            hover:bg-gray-50 hover:text-gray-700
            active:scale-90
            focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20
          "
          aria-label="复制回复"
        >
          {copied ? (
            <Check size={15} strokeWidth={1.5} className="text-emerald-500" />
          ) : (
            <Copy size={15} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* 回复文本 */}
      <p className="text-[15px] leading-relaxed text-gray-700 tracking-[0.01em]">
        {reply.text}
      </p>
    </div>
  );
}

// ================================================
// 主页
// ================================================

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [scene, setScene] = useState<Scene>("职场沟通");
  const [tone, setTone] = useState<Tone>("高情商");
  const [results, setResults] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: inputText.trim(),
          scenario: scene,
          emotion: tone,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `请求失败 (${res.status})`);
      } else if (data.replies && data.replies.length > 0) {
        setResults(
          data.replies.map((text: string, i: number) => ({
            id: Date.now() + i,
            tone: tone,
            text,
          }))
        );
      } else {
        setError("模型返回了空内容，请重试");
      }
    } catch (err) {
      setError("网络请求失败，请检查服务是否正常运行");
    } finally {
      setLoading(false);
    }
  }, [inputText, scene, tone]);

  // Ctrl+Enter 快捷键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans antialiased">
      {/* ---- 头部 ---- */}
      <header className="border-b border-gray-100/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">
            AI Reply
          </h1>
          <span className="text-xs font-medium text-gray-300">嘴替引擎</span>
        </div>
      </header>

      {/* ---- 主体 ---- */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* 标题区 */}
        <div className="mb-10">
          <h2 className="mb-2 text-[28px] font-semibold leading-tight tracking-tight text-gray-900">
            让对方的话，
            <br />
            变成你的高光时刻
          </h2>
          <p className="text-[15px] leading-relaxed text-gray-400">
            粘贴对方发来的消息，选择场景与语气，AI 帮你生成得体的回复。
          </p>
        </div>

        {/* ---- 输入区 ---- */}
        <div className="mb-8">
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-gray-300">
            消息内容
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请粘贴对方发来的话..."
            rows={4}
            className="
              w-full resize-none rounded-2xl border-0
              bg-white px-5 py-4
              text-[16px] leading-relaxed text-gray-800
              placeholder:text-gray-300
              shadow-[0_2px_12px_rgba(0,0,0,0.03)]
              ring-1 ring-gray-100
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-gray-300
            "
          />
          {/* 快捷键提示 */}
          <p className="mt-2 text-right text-[11px] text-gray-300">
            Ctrl + Enter 快速生成
          </p>
        </div>

        {/* ---- 选项区 ---- */}
        <div className="mb-6 space-y-5">
          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-gray-300">
              场景
            </label>
            <PillGroup<Scene>
              options={SCENES}
              value={scene}
              onChange={setScene}
            />
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-gray-300">
              情绪
            </label>
            <PillGroup<Tone>
              options={TONES}
              value={tone}
              onChange={setTone}
            />
          </div>
        </div>

        {/* ---- 操作区 ---- */}
        <div className="mb-12">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !inputText.trim()}
            className={`
              group relative inline-flex w-full items-center justify-center gap-2.5
              rounded-2xl px-8 py-4
              text-[15px] font-medium text-white
              transition-all duration-300 ease-out
              active:scale-[0.97]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 focus-visible:ring-offset-2
              ${
                loading
                  ? "cursor-wait bg-gray-700 opacity-70 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  : "bg-gray-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:bg-gray-800 hover:shadow-[0_6px_28px_rgba(0,0,0,0.12)]"
              }
              ${
                !inputText.trim() && !loading
                  ? "cursor-not-allowed opacity-40"
                  : ""
              }
            `}
          >
            {loading ? (
              <>
                <Loader2
                  size={18}
                  strokeWidth={1.5}
                  className="animate-spin"
                />
                思考中...
              </>
            ) : (
              <>
                <Sparkles
                  size={18}
                  strokeWidth={1.5}
                  className="transition-transform duration-300 group-hover:rotate-12"
                />
                一键生成回复
              </>
            )}
          </button>
        </div>

        {/* ---- 结果展示区 ---- */}
        <div>
          <div className="mb-5 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-300">
              生成结果
            </span>
            <span className="h-px flex-1 bg-gray-100" />
            <span className="text-xs font-medium text-gray-300">
              {results.length} 条
            </span>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50/50 px-5 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 空状态 */}
          {!loading && !error && results.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-300">
                输入对方的话，选择场景与情绪，然后点击生成
              </p>
            </div>
          )}

          {/* 结果卡片（staggered fade-in） */}
          <div className="space-y-4">
            {results.map((reply, index) => (
              <ReplyCard key={reply.id} reply={reply} index={index} />
            ))}
          </div>
        </div>
      </main>

      {/* ---- 页脚 ---- */}
      <footer className="border-t border-gray-100/80 py-8 text-center">
        <p className="text-xs text-gray-300">
          AI Internet Mouthpiece — 让每一次回应都恰如其分
        </p>
      </footer>

      {/* ---- 全局 Toast ---- */}
      <ToastContainer />
    </div>
  );
}
