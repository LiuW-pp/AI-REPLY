"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Check, Sparkles, Loader2, Image, X, Clock, Trash2, ChevronRight, Wand2, Plus } from "lucide-react";

// ---- 类型 ----
type PresetScene = "职场沟通" | "日常社交" | "网络对线";
type PresetTone = "高情商" | "幽默风趣" | "阴阳怪气" | "专业严谨";

interface ReplyItem { id: number; tone: string; text: string; }
interface UploadedImage { base64: string; name: string; }

/** 场景/情绪值：__auto__ | 预设 | 自定义 */
type TagValue = "__auto__" | PresetScene | PresetTone | (string & {});

interface HistoryEntry {
  id: string;
  timestamp: number;
  originalText: string;
  scene: TagValue;
  emotion: TagValue;
  persona: string;
  replies: string[];
}

// ---- 常量 ----
const PRESET_SCENES: PresetScene[] = ["职场沟通", "日常社交", "网络对线"];
const PRESET_TONES: PresetTone[] = ["高情商", "幽默风趣", "阴阳怪气", "专业严谨"];
const HISTORY_KEY = "ai-reply-history";
const AUTO_VALUE = "__auto__";

// ================================================
// localStorage
// ================================================
function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch {}
}

// ================================================
// Toast
// ================================================
interface ToastMessage { id: number; text: string; }
let toastIdCounter = 0;
function emitToast(text: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: { id: ++toastIdCounter, text } }));
}
function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, text } = (e as CustomEvent).detail as ToastMessage;
      setToasts((prev) => [...prev, { id, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000);
    };
    window.addEventListener("toast", handler);
    return () => window.removeEventListener("toast", handler);
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="animate-[toast-in_0.3s_ease-out] rounded-2xl bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.15)]">{t.text}</div>
      ))}
    </div>
  );
}

// ================================================
// ✅ 智能 Pill 组（Auto + 预设 + 自定义标签 + 输入框）
// ================================================
function SmartPillGroup({
  presets, value, onChange, placeholder,
}: {
  presets: string[];
  value: TagValue;
  onChange: (v: TagValue) => void;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 当前活跃标签列表 = Auto + 预设 + 已添加的自定义标签
  const customTags = (typeof value === "string" && value !== AUTO_VALUE && !presets.includes(value as never))
    ? [value] : [];
  const allTags = [AUTO_VALUE, ...presets, ...customTags];

  const isAuto = value === AUTO_VALUE;

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onChange(trimmed as TagValue);
      emitToast(`已添加：${trimmed}`);
    }
    setDraft("");
    setEditing(false);
  };

  // 选择已有标签
  const select = (tag: string) => {
    setEditing(false);
    setDraft("");
    onChange(tag as TagValue);
  };

  // 进入编辑模式
  const startEditing = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allTags.map((tag) => {
        const active = value === tag;
        if (tag === AUTO_VALUE) {
          // Auto 按钮 — 渐变发光边框
          return (
            <button key={AUTO_VALUE} type="button" onClick={() => select(AUTO_VALUE)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium leading-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 ${
                isAuto
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.35)] ring-1 ring-violet-400/50"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              }`}>
              <Wand2 size={13} strokeWidth={1.5} className={isAuto ? "text-violet-200" : "text-gray-400"} />
              ✨ 智能感知
            </button>
          );
        }
        return (
          <button key={tag} type="button" onClick={() => select(tag)}
            className={`relative inline-flex items-center rounded-full px-5 py-2 text-sm font-medium leading-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 ${
              active
                ? "bg-gray-900 text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }`}>
            {tag}
            {/* 自定义标签显示删除按钮 */}
            {!presets.includes(tag as never) && active && (
              <X size={12} strokeWidth={2} className="ml-1 text-gray-400 hover:text-white" onClick={(e) => { e.stopPropagation(); onChange(AUTO_VALUE); }} />
            )}
          </button>
        );
      })}

      {/* + 自定义按钮 / 输入框 */}
      {editing ? (
        <input ref={inputRef} type="text" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setEditing(false); setDraft(""); } }}
          onBlur={() => { if (!draft.trim()) setEditing(false); }}
          placeholder={placeholder}
          className="rounded-full border-0 bg-white px-4 py-2 text-sm font-medium text-gray-800 placeholder:text-gray-300 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,0,0,0.15)]" />
      ) : (
        <button type="button" onClick={startEditing}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-200 bg-transparent px-4 py-2 text-sm font-medium text-gray-400 transition-all duration-200 hover:border-gray-300 hover:text-gray-600">
          <Plus size={13} strokeWidth={1.5} /> 自定义
        </button>
      )}
    </div>
  );
}

// ================================================
// 结果卡片
// ================================================
function ReplyCard({ reply, index }: { reply: ReplyItem; index: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(reply.text); setCopied(true); emitToast("已复制到剪贴板"); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <div className="group relative rounded-2xl border border-gray-100 bg-white p-6 opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] animate-[fade-in_0.45s_ease-out_forwards]"
      style={{ animationDelay: `${index * 120}ms` }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-400">{reply.tone}</span>
        <button type="button" onClick={handleCopy} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-all duration-200 ease-out hover:bg-gray-50 hover:text-gray-700 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20" aria-label="复制回复">
          {copied ? <Check size={15} strokeWidth={1.5} className="text-emerald-500" /> : <Copy size={15} strokeWidth={1.5} />}
        </button>
      </div>
      <p className="text-[15px] leading-relaxed text-gray-700 tracking-[0.01em]">{reply.text}</p>
    </div>
  );
}

// ================================================
// 图片上传
// ================================================
function ImageUploader({ image, onUpload, onRemove }: { image: UploadedImage | null; onUpload: (img: UploadedImage) => void; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { emitToast("请选择图片文件"); return; }
    if (file.size > 10 * 1024 * 1024) { emitToast("图片不能超过 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => onUpload({ base64: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  };
  if (image) return (
    <div className="relative inline-block"><img src={image.base64} alt={image.name} className="h-20 w-20 rounded-xl object-cover ring-1 ring-gray-100" />
      <button type="button" onClick={onRemove} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm transition-transform hover:scale-110 active:scale-90" aria-label="删除图片"><X size={11} strokeWidth={2.5} /></button></div>
  );
  return (<><input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-medium text-gray-400 transition-all duration-200 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-500"><Image size={15} strokeWidth={1.5} />附加截图</button></>);
}

// ================================================
// 历史记录 Drawer
// ================================================
function HistoryDrawer({ open, onClose, history, onDelete, onLoadEntry }: {
  open: boolean; onClose: () => void; history: HistoryEntry[]; onDelete: (id: string) => void; onLoadEntry: (entry: HistoryEntry) => void;
}) {
  const formatTime = (ts: number) => {
    const d = new Date(ts); const now = new Date(); const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "刚刚"; if (diffMin < 60) return `${diffMin} 分钟前`; if (diffMin < 1440) return `${Math.floor(diffMin / 60)} 小时前`;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };
  const displayTag = (v: TagValue) => v === AUTO_VALUE ? "✨ 自动" : v;
  if (!open) return null;
  return (<>
    <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md animate-[slide-in_0.3s_ease-out] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2.5"><Clock size={17} strokeWidth={1.5} className="text-gray-400" /><h3 className="text-[15px] font-semibold text-gray-900">我的记录</h3><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-400">{history.length}</span></div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600"><X size={17} strokeWidth={1.5} /></button>
      </div>
      <div className="h-[calc(100vh-65px)] overflow-y-auto px-6 py-4">
        {history.length === 0 ? (<div className="py-20 text-center"><p className="text-sm text-gray-300">暂无历史记录</p><p className="mt-1 text-xs text-gray-300">生成回复后会自动保存在这里</p></div>) : (
          <div className="space-y-3">{history.map((entry, idx) => (
            <div key={entry.id} className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] opacity-0 animate-[fade-in_0.35s_ease-out_forwards]" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-400">{displayTag(entry.scene)}</span><span className="text-[11px] text-gray-300">·</span><span className="text-[11px] text-gray-400">{displayTag(entry.emotion)}</span></div>
                <span className="text-[11px] text-gray-300">{formatTime(entry.timestamp)}</span>
              </div>
              <p className="mb-2 line-clamp-1 text-[13px] leading-relaxed text-gray-400">对方：{entry.originalText}</p>
              <div className="space-y-1.5">{entry.replies.map((r, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-gray-50/70 px-3 py-2"><p className="flex-1 text-[13px] leading-relaxed text-gray-600">{r}</p>
                  <button onClick={async () => { try { await navigator.clipboard.writeText(r); emitToast("已复制到剪贴板"); } catch {} }} className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors" aria-label="复制"><Copy size={12} strokeWidth={1.5} /></button></div>))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-2.5">
                <button onClick={() => onLoadEntry(entry)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-700">回填到输入框 <ChevronRight size={11} /></button>
                <button onClick={() => onDelete(entry.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"><Trash2 size={12} strokeWidth={1.5} /></button>
              </div>
            </div>))}
          </div>)}
      </div>
    </div>
    <style jsx>{`@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
  </>);
}

// ================================================
// 主页
// ================================================

export default function Home() {
  const [persona, setPersona] = useState("");
  const [inputText, setInputText] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [scene, setScene] = useState<TagValue>(AUTO_VALUE);
  const [tone, setTone] = useState<TagValue>(AUTO_VALUE);
  const [results, setResults] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const saveToHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    const newEntry: HistoryEntry = { ...entry, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, timestamp: Date.now() };
    setHistory((prev) => { const updated = [newEntry, ...prev].slice(0, 50); saveHistory(updated); return updated; });
  }, []);

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistory((prev) => { const updated = prev.filter((e) => e.id !== id); saveHistory(updated); return updated; });
    emitToast("已删除");
  }, []);

  const loadHistoryEntry = useCallback((entry: HistoryEntry) => {
    setPersona(entry.persona || ""); setInputText(entry.originalText); setScene(entry.scene); setTone(entry.emotion); setDrawerOpen(false); emitToast("已回填到输入框");
  }, []);

  const canGenerate = inputText.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true); setError(null); setResults([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: inputText.trim(),
          scenario: scene === AUTO_VALUE ? "auto" : scene,
          emotion: tone === AUTO_VALUE ? "auto" : tone,
          persona: persona.trim() || undefined,
          extraNote: extraNote.trim() || undefined,
          image: image?.base64 || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || `请求失败 (${res.status})`); }
      else if (data.replies?.length > 0) {
        const replies: string[] = data.replies;
        setResults(replies.map((text, i) => ({ id: Date.now() + i, tone: typeof tone === "string" ? tone : "AI 回复", text })));
        saveToHistory({ originalText: inputText.trim(), scene, emotion: tone, persona: persona.trim(), replies });
      } else { setError("模型返回了空内容，请重试"); }
    } catch (err) { setError("网络请求失败，请检查服务是否正常运行"); }
    finally { setLoading(false); }
  }, [canGenerate, inputText, scene, tone, persona, extraNote, image, saveToHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleGenerate(); }
  }, [handleGenerate]);

  return (
    <div className="min-h-screen bg-stone-50 font-sans antialiased">
      <header className="border-b border-gray-100/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">AI Reply</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700">
              <Clock size={13} strokeWidth={1.5} />我的记录{history.length > 0 && <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">{history.length}</span>}
            </button>
            <span className="text-xs font-medium text-gray-300">嘴替引擎</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10"><h2 className="mb-2 text-[28px] font-semibold leading-tight tracking-tight text-gray-900">让对方的话，<br />变成你的高光时刻</h2><p className="text-[15px] leading-relaxed text-gray-400">设定你的人设，粘贴对方的消息，选好情绪——剩下的交给 AI。</p></div>

        {/* 人设 */}
        <div className="mb-6"><label className="mb-3 block text-xs font-medium uppercase tracking-widest text-gray-300">我的人设</label>
          <input type="text" value={persona} onChange={(e) => setPersona(e.target.value)} onKeyDown={handleKeyDown} placeholder="可选：用一句话描述你的人设（如：00后暴躁打工人、卑微乙方面试者）…" className="w-full rounded-2xl border-0 bg-white px-5 py-3 text-[15px] leading-relaxed text-gray-800 placeholder:text-gray-300 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-gray-100 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-gray-300" />
          <p className="mt-1.5 text-[11px] text-gray-300">设定人设后，AI 会以你的身份和性格来组织语言</p></div>

        {/* 消息内容 */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between"><label className="text-xs font-medium uppercase tracking-widest text-gray-300">对方的话</label><span className="text-[11px] text-gray-300">Ctrl + Enter 发送</span></div>
          <div className={`rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-gray-100 transition-all duration-200 ${inputText.trim() ? "ring-gray-300" : "focus-within:ring-2 focus-within:ring-gray-300"}`}>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} placeholder="请粘贴对方发来的话..." rows={4} className="w-full resize-none rounded-t-2xl border-0 bg-transparent px-5 pb-2 pt-4 text-[16px] leading-relaxed text-gray-800 placeholder:text-gray-300 focus:outline-none" />
            <div className="flex items-center gap-3 border-t border-gray-50 px-5 py-2.5">
              <ImageUploader image={image} onUpload={setImage} onRemove={() => setImage(null)} />
              <input type="text" value={extraNote} onChange={(e) => setExtraNote(e.target.value)} onKeyDown={handleKeyDown} placeholder="附加要求（可选）…" className="flex-1 bg-transparent text-[13px] text-gray-600 placeholder:text-gray-300 focus:outline-none" /></div>
          </div>
        </div>

        {/* ✅ 选项区 — 使用 SmartPillGroup */}
        <div className="mb-6 space-y-5">
          <div><label className="mb-3 block text-xs font-medium uppercase tracking-widest text-gray-300">场景</label>
            <SmartPillGroup presets={PRESET_SCENES} value={scene} onChange={setScene} placeholder="输入场景，如「深夜emo」" /></div>
          <div><label className="mb-3 block text-xs font-medium uppercase tracking-widest text-gray-300">情绪</label>
            <SmartPillGroup presets={PRESET_TONES} value={tone} onChange={setTone} placeholder="输入情绪，如「林黛玉语气」" /></div>
        </div>

        {/* 操作区 */}
        <div className="mb-12">
          <button type="button" onClick={handleGenerate} disabled={loading || !canGenerate}
            className={`group relative inline-flex w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-[15px] font-medium text-white transition-all duration-300 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 focus-visible:ring-offset-2 ${loading ? "cursor-wait bg-gray-700 opacity-70 shadow-[0_2px_8px_rgba(0,0,0,0.06)]" : "bg-gray-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:bg-gray-800 hover:shadow-[0_6px_28px_rgba(0,0,0,0.12)]"} ${!canGenerate && !loading ? "cursor-not-allowed opacity-40" : ""}`}>
            {loading ? (<><Loader2 size={18} strokeWidth={1.5} className="animate-spin" />思考中...</>) : (<><Sparkles size={18} strokeWidth={1.5} className="transition-transform duration-300 group-hover:rotate-12" />一键生成回复</>)}
          </button>
        </div>

        {/* 结果 */}
        <div>
          <div className="mb-5 flex items-center gap-3"><span className="text-xs font-medium uppercase tracking-widest text-gray-300">生成结果</span><span className="h-px flex-1 bg-gray-100" /><span className="text-xs font-medium text-gray-300">{results.length} 条</span></div>
          {error && <div className="mb-4 rounded-2xl border border-red-100 bg-red-50/50 px-5 py-3 text-sm text-red-600">{error}</div>}
          {!loading && !error && results.length === 0 && (<div className="py-16 text-center"><p className="text-sm text-gray-300">输入对方的话，选择场景与情绪，然后点击生成</p></div>)}
          <div className="space-y-4">{results.map((reply, index) => (<ReplyCard key={reply.id} reply={reply} index={index} />))}</div>
        </div>
      </main>

      <footer className="border-t border-gray-100/80 py-8 text-center"><p className="text-xs text-gray-300">AI Internet Mouthpiece — 让每一次回应都恰如其分</p></footer>
      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} history={history} onDelete={deleteHistoryEntry} onLoadEntry={loadHistoryEntry} />
      <ToastContainer />
    </div>
  );
}
