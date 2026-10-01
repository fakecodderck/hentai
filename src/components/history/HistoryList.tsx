import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Trash2,
  Layers,
  Calendar,
  Send
} from 'lucide-react';

export const HistoryList: React.FC = () => {
  const { history, clearHistory, removeHistoryItem, setPost, setActiveTab } = useAppStore();

  const handleReopenInStudio = (postData: any) => {
    setPost({ ...postData });
    setActiveTab('studio');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Broadcast History & Audit Log</h2>
            <p className="text-xs text-slate-400">All published posts, Telegram message IDs, and delivery status</p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 space-y-2">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 font-medium">No messages sent yet</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Extract a post in the Studio and click "Send Post to Telegram Channel" to see records here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
            >
              
              {/* Left Info: Thumbnail + Title + Meta */}
              <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                    <Send className="w-5 h-5 -rotate-12" />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  <div className="font-semibold text-slate-200 text-sm truncate">
                    {item.title}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-sky-400">{item.chatTitle || item.chatId}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {item.episodesCount} episodes
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {item.status === 'failed' && item.errorMessage && (
                    <div className="text-[11px] text-rose-400 font-mono">
                      Error: {item.errorMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Actions: Status Badge, Open Link, Reopen in Studio, Delete */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                {item.status === 'sent' ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Sent #{item.messageId}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                )}

                {item.telegramLink && (
                  <a
                    href={item.telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition"
                  >
                    <span>View Post</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleReopenInStudio(item.postData)}
                  title="Reopen in Studio editor"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 bg-slate-900 border border-slate-800 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => removeHistoryItem(item.id)}
                  title="Delete log entry"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
