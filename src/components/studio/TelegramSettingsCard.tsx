import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { sendPostToTelegram, verifyTelegramBot } from '../../services/api';
import {
  Send,
  Bot,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  Check,
  Hash,
  MessageSquare
} from 'lucide-react';

export const TelegramSettingsCard: React.FC = () => {
  const {
    botConfig,
    setBotConfig,
    templateSettings,
    setTemplateSettings,
    post,
    isSending,
    setIsSending,
    addHistoryItem
  } = useAppStore();

  const [showToken, setShowToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ success: boolean; msg: string } | null>(null);
  const [sendFeedback, setSendFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Auto-Wait on 429 State
  const [autoWait429, setAutoWait429] = useState(true);

  // Verify connection
  const handleVerify = async () => {
    if (!botConfig.botToken) {
      setVerifyStatus({ success: false, msg: 'Please enter a Bot Token' });
      return;
    }
    setIsVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await verifyTelegramBot(botConfig.botToken, botConfig.chatId);
      const botInfo = {
        id: res.bot?.id || 0,
        username: res.bot?.username || 'bot',
        firstName: res.bot?.first_name || res.bot?.username || 'Bot',
      };
      setBotConfig({ verified: true, botInfo });
      setVerifyStatus({ success: true, msg: `Connected to @${botInfo.username} (${botInfo.firstName})` });
    } catch (err: any) {
      setBotConfig({ verified: false });
      setVerifyStatus({ success: false, msg: err.message || 'Verification failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Send to Telegram
  const handleSend = async () => {
    setSendFeedback(null);
    if (!botConfig.botToken || !botConfig.chatId) {
      setSendFeedback({ success: false, msg: 'Bot Token and Target Channel are required' });
      return;
    }

    setIsSending(true);
    try {
      const res = await sendPostToTelegram({
        botConfig,
        templateSettings,
        postData: post,
      });

      setSendFeedback({
        success: true,
        msg: `Successfully sent to ${botConfig.chatId}! (Msg ID: ${res.messageId})`,
      });

      addHistoryItem({
        title: post.title || 'Untitled Post',
        thumbnail: post.thumbnail || '',
        chatId: botConfig.chatId,
        chatTitle: botConfig.chatInfo?.title || botConfig.chatId,
        episodesCount: post.episodes.length,
        status: 'sent',
        messageId: res.messageId,
        telegramLink: res.postLink,
        postData: { ...post },
      });
    } catch (err: any) {
      const errMsg = err.message || 'Failed to send to Telegram';
      setSendFeedback({ success: false, msg: errMsg });

      addHistoryItem({
        title: post.title || 'Untitled Post',
        thumbnail: post.thumbnail || '',
        chatId: botConfig.chatId,
        chatTitle: botConfig.chatInfo?.title || botConfig.chatId,
        episodesCount: post.episodes.length,
        status: 'failed',
        errorMessage: errMsg,
        postData: { ...post },
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#131B2A] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between h-full">
      
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>Telegram Settings</span>
          </h3>
          {botConfig.verified && botConfig.botInfo && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              @{botConfig.botInfo.username}
            </span>
          )}
        </div>

        {/* Bot Token Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">Bot Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={botConfig.botToken || ''}
              onChange={e => setBotConfig({ botToken: e.target.value.trim(), verified: false })}
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ"
              className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 pr-10 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Target Channel / Group ID Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">Target Channel / Group ID</label>
          <input
            type="text"
            value={botConfig.chatId || ''}
            onChange={e => setBotConfig({ chatId: e.target.value.trim() })}
            placeholder="@your_channel"
            className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Forum Topic / Thread ID (optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Forum Topic / Thread ID <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={botConfig.topicId || ''}
            onChange={e => setBotConfig({ topicId: e.target.value.trim() })}
            placeholder="e.g. 12345"
            className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Button Columns & consecutive delay & max retries */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Button Columns</label>
            <select
              value={templateSettings.buttonsLayout || '2-col'}
              onChange={e => setTemplateSettings({ buttonsLayout: e.target.value as any })}
              className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
            >
              <option value="2-col">2 Columns</option>
              <option value="1-col">1 Column</option>
              <option value="3-col">3 Columns</option>
              <option value="4-col">4 Columns</option>
              <option value="none">No Buttons</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Consecutive Upload Delay</label>
            <select
              defaultValue="1500ms"
              className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
            >
              <option value="500ms">500ms</option>
              <option value="800ms">800ms</option>
              <option value="1000ms">1000ms</option>
              <option value="1500ms">1500ms</option>
              <option value="2000ms">2000ms</option>
              <option value="3000ms">3000ms</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Max Retries</label>
            <select
              defaultValue="3"
              className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </div>

          {/* Checkbox: Auto-Wait on Telegram 429 */}
          <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoWait429}
              onChange={e => setAutoWait429(e.target.checked)}
              className="rounded border-slate-700 bg-[#0B0F17] text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Auto-Wait on Telegram 429</span>
          </label>
        </div>

        {/* Verification Status Feedback */}
        {verifyStatus && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 font-mono ${
              verifyStatus.success
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}
          >
            {verifyStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="truncate">{verifyStatus.msg}</span>
          </div>
        )}

        {/* Send Status Feedback */}
        {sendFeedback && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 font-mono ${
              sendFeedback.success
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}
          >
            {sendFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="truncate">{sendFeedback.msg}</span>
          </div>
        )}
      </div>

      {/* Buttons: Verify Connection & Send to Telegram */}
      <div className="space-y-2 pt-3">
        {/* Verify Connection Button */}
        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-blue-600/10 text-blue-400 border border-blue-500/40 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
        >
          {isVerifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          <span>{isVerifying ? 'Verifying...' : 'Verify Connection'}</span>
        </button>

        {/* Send to Telegram Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{isSending ? 'Publishing...' : 'Send to Telegram'}</span>
        </button>
      </div>

    </div>
  );
};
