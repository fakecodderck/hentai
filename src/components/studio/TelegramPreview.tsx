import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { sendPostToTelegram, formatCaption } from '../../services/api';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Bot,
  Hash,
  Share2,
  Pin,
  BellOff
} from 'lucide-react';

export const TelegramPreview: React.FC = () => {
  const {
    post,
    botConfig,
    templateSettings,
    setBotModalOpen,
    isSending,
    setIsSending,
    addHistoryItem
  } = useAppStore();

  const [sendResult, setSendResult] = useState<{
    success: boolean;
    messageId?: number;
    postLink?: string;
    error?: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);

  const formattedHtml = formatCaption(
    post,
    templateSettings.captionTemplate,
    templateSettings.includeTextLinks,
    templateSettings.includeSynopsis ?? false
  );

  const getButtonsRows = () => {
    if (templateSettings.buttonsLayout === 'none' || !post.episodes || post.episodes.length === 0) {
      return [];
    }
    let cols = 2;
    if (templateSettings.buttonsLayout === '1-col') cols = 1;
    if (templateSettings.buttonsLayout === '3-col') cols = 3;
    if (templateSettings.buttonsLayout === '4-col') cols = 4;

    const rows: typeof post.episodes[] = [];
    for (let i = 0; i < post.episodes.length; i += cols) {
      rows.push(post.episodes.slice(i, i + cols));
    }
    return rows;
  };

  const buttonRows = getButtonsRows();

  const handleSend = async () => {
    setSendResult(null);

    if (!botConfig.botToken || !botConfig.chatId) {
      setBotModalOpen(true);
      return;
    }

    setIsSending(true);
    try {
      const res = await sendPostToTelegram({
        botConfig,
        templateSettings,
        postData: post,
      });

      setSendResult({
        success: true,
        messageId: res.messageId,
        postLink: res.postLink,
      });

      addHistoryItem({
        title: post.title || 'Untitled Post',
        thumbnail: post.thumbnail,
        chatId: botConfig.chatId,
        chatTitle: res.chat?.title || botConfig.chatId,
        episodesCount: (post?.episodes || []).length,
        status: 'sent',
        messageId: res.messageId,
        telegramLink: res.postLink,
        postData: post,
      });
    } catch (err: any) {
      setSendResult({
        success: false,
        error: err.message || 'Transmission error',
      });
    } finally {
      setIsSending(false);
    }
  };

  const copyPostLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <h3 className="text-sm font-bold text-slate-100">Telegram Live Preview</h3>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
          HTML Parse Mode
        </span>
      </div>

      {sendResult && (
        <div
          className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
            sendResult.success
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              {sendResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sent to Telegram Channel!
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Sending Failed
                </>
              )}
            </span>
            {sendResult.messageId && (
              <span className="font-mono text-[10px]">ID: #{sendResult.messageId}</span>
            )}
          </div>

          {sendResult.error && <p className="text-[11px] font-mono">{sendResult.error}</p>}

          {sendResult.postLink && (
            <div className="flex items-center gap-2 pt-1">
              <a
                href={sendResult.postLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in Telegram</span>
              </a>
              <button
                type="button"
                onClick={() => copyPostLink(sendResult.postLink!)}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-emerald-900/50"
                title="Copy link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mock Telegram Message Bubble */}
      <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 space-y-3 font-sans text-slate-200 relative shadow-inner">
        {post.thumbnail && templateSettings.sendAsPhoto && (
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative">
            <img
              src={post.thumbnail}
              alt="Poster Preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={e => {
                const img = e.currentTarget;
                if (!img.src.includes('/api/proxy-image')) {
                  img.src = `/api/proxy-image?url=${encodeURIComponent(post.thumbnail)}`;
                }
              }}
            />
          </div>
        )}

        <div
          className="text-xs leading-relaxed space-y-2 whitespace-pre-wrap break-words font-sans text-slate-100"
          dangerouslySetInnerHTML={{ __html: formattedHtml || '<i>No preview content available...</i>' }}
        />

        {/* Mock Inline Buttons */}
        {buttonRows.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            {buttonRows.map((row, rIdx) => (
              <div key={rIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                {row.map((ep, cIdx) => (
                  <div
                    key={cIdx}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-[11px] font-semibold text-sky-300 text-center truncate shadow-sm"
                  >
                    {ep.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target Channel Banner & Send Action */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-sky-400" />
            <span>Target: <code className="text-slate-200">{botConfig.chatId || 'Not set'}</code></span>
          </div>
          <button
            type="button"
            onClick={() => setBotModalOpen(true)}
            className="text-[11px] text-sky-400 hover:underline cursor-pointer"
          >
            Configure Bot
          </button>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !post.title}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/20 transition cursor-pointer disabled:opacity-50"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Transmitting to Telegram...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Publish Post to Telegram</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
