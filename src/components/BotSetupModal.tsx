import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { verifyTelegramBot as verifyBotConfig } from '../services/api';
import { Bot, Send, Hash, Check, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';

export const BotSetupModal: React.FC = () => {
  const { botConfig, setBotConfig, botModalOpen, setBotModalOpen } = useAppStore();

  const [botToken, setBotToken] = useState(botConfig.botToken || '');
  const [chatId, setChatId] = useState(botConfig.chatId || '');
  const [topicId, setTopicId] = useState(botConfig.topicId || '');
  const [delayMs, setDelayMs] = useState(botConfig.rateLimitDelayMs || 1500);
  const [autoRetry, setAutoRetry] = useState(botConfig.autoRetryOn429 ?? true);
  const [maxRetries, setMaxRetries] = useState(botConfig.maxRetries || 3);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!botModalOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await verifyBotConfig(botToken.trim(), chatId.trim() || undefined);
      setBotConfig({
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        topicId: topicId.trim(),
        verified: true,
        isVerified: true,
        rateLimitDelayMs: delayMs,
        autoRetryOn429: autoRetry,
        maxRetries,
        botInfo: res.bot,
        chatInfo: res.chat,
        warning: res.warning,
      });

      setSuccessMsg(`Connected as @${res.bot.username || res.bot.first_name}!`);
      setTimeout(() => {
        setBotModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Telegram Bot Credentials</h3>
              <p className="text-xs text-slate-400">Configure your bot token & target channel/chat ID</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBotModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleTestAndSave} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Bot Token (from @BotFather)</label>
            <input
              type="password"
              required
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHI..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Target Chat / Channel ID</label>
              <input
                type="text"
                required
                value={chatId}
                onChange={e => setChatId(e.target.value)}
                placeholder="-100123456789 or @channel"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Topic / Forum ID (Optional)</label>
              <input
                type="text"
                value={topicId}
                onChange={e => setTopicId(e.target.value)}
                placeholder="Topic ID"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300">Rate Limiting & Safeguards</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400">Delay between calls</label>
                <select
                  value={delayMs}
                  onChange={e => setDelayMs(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                >
                  <option value={1000}>1.0s delay</option>
                  <option value={1500}>1.5s delay (Default)</option>
                  <option value={2000}>2.0s delay</option>
                  <option value={3000}>3.0s delay</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400">Max 429 Retries</label>
                <select
                  value={maxRetries}
                  onChange={e => setMaxRetries(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                >
                  <option value={1}>1 Retry</option>
                  <option value={2}>2 Retries</option>
                  <option value={3}>3 Retries</option>
                  <option value={5}>5 Retries</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRetry}
                onChange={e => setAutoRetry(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-900 border-slate-700"
              />
              <span className="text-slate-300 text-[11px]">Auto-wait on Telegram HTTP 429 rate limit</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setBotModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !botToken.trim() || !chatId.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Save Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
