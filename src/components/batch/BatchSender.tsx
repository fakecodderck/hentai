import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { scrapeWebsite, sendPostToTelegram } from '../../services/api';
import { BatchItem } from '../../types';
import {
  Layers,
  Play,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock
} from 'lucide-react';

export const BatchSender: React.FC = () => {
  const {
    batchItems,
    setBatchItems,
    addBatchUrl,
    clearBatch,
    botConfig,
    templateSettings,
    setBotModalOpen,
    addHistoryItem
  } = useAppStore();

  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);
  const [delayMs, setDelayMs] = useState(2500);

  const handleAddUrls = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) return;

    urls.forEach(u => addBatchUrl(u));
    setUrlInput('');
  };

  // Run the batch pipeline (Scrape + Send with delay)
  const handleStartBatch = async () => {
    if (batchItems.length === 0) return;

    if (!botConfig.botToken || !botConfig.chatId) {
      setBotModalOpen(true);
      return;
    }

    setIsProcessing(true);

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];
      if (item.status === 'sent') continue; // skip already sent

      setCurrentProcessingIndex(i);

      // 1. Scrape Website Post
      setBatchItems(prev =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'scraping', error: undefined } : it))
      );

      let postData = item.postData;
      if (!postData) {
        try {
          postData = await scrapeWebsite(item.url);
          setBatchItems(prev =>
            prev.map((it, idx) => (idx === i ? { ...it, postData, status: 'ready' } : it))
          );
        } catch (err: any) {
          setBatchItems(prev =>
            prev.map((it, idx) =>
              idx === i ? { ...it, status: 'failed', error: `Scrape error: ${err.message}` } : it
            )
          );
          continue;
        }
      }

      // 2. Dispatch to Telegram
      setBatchItems(prev =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'sending' } : it))
      );

      try {
        const sendResult = await sendPostToTelegram({
          botConfig,
          templateSettings,
          postData,
        });

        setBatchItems(prev =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'sent',
                  messageId: sendResult.messageId,
                  telegramLink: sendResult.postLink,
                }
              : it
          )
        );

        addHistoryItem({
          title: postData.title,
          thumbnail: postData.thumbnail,
          chatId: botConfig.chatId,
          chatTitle: botConfig.chatInfo?.title || botConfig.chatId,
          episodesCount: postData.episodes.length,
          status: 'sent',
          messageId: sendResult.messageId,
          telegramLink: sendResult.postLink,
          postData: { ...postData },
        });
      } catch (err: any) {
        setBatchItems(prev =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'failed', error: `Telegram error: ${err.message}` } : it
          )
        );
      }

      // Wait delay to avoid Telegram rate limits
      if (i < batchItems.length - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    setIsProcessing(false);
    setCurrentProcessingIndex(null);
  };

  const completedCount = batchItems.filter(i => i.status === 'sent').length;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Inputs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Batch Website Post Queue</h2>
              <p className="text-xs text-slate-400">
                Queue multiple website URLs to scrape & broadcast to Telegram sequentially with flood control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
              {batchItems.length} in queue
            </span>
          </div>
        </div>

        {/* Add URLs Textarea */}
        <form onSubmit={handleAddUrls} className="space-y-3">
          <textarea
            rows={3}
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder={`Enter website URLs to scrape and post (one URL per line):
https://example-anime.net/series/post-1
https://example-anime.net/series/post-2
https://example-drama.com/episodes/queen-of-tears`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Delay between posts:</span>
              <select
                aria-label="Delay between posts"
                value={delayMs}
                onChange={e => setDelayMs(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 text-xs"
              >
                <option value={1500}>1.5s</option>
                <option value={2500}>2.5s (Safe)</option>
                <option value={4000}>4.0s (Anti-Flood)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {batchItems.length > 0 && (
                <button
                  type="button"
                  onClick={clearBatch}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  Clear Queue
                </button>
              )}
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Add to Queue</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Queue Execution Status & Action */}
      {batchItems.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-200">
                Queue Progress: {completedCount} / {batchItems.length} published
              </span>
              <div className="w-64 h-2 bg-slate-950 rounded-full mt-1.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${(completedCount / batchItems.length) * 100}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isProcessing || completedCount === batchItems.length}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 disabled:opacity-50 transition cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Queue...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Broadcast Queue to Telegram</span>
                </>
              )}
            </button>
          </div>

          {/* Queue Items List */}
          <div className="space-y-2">
            {batchItems.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-4 transition ${
                  currentProcessingIndex === idx
                    ? 'bg-sky-950/40 border-sky-500/50 ring-1 ring-sky-500/30'
                    : item.status === 'sent'
                    ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-300'
                    : item.status === 'failed'
                    ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 truncate flex-1">
                  <span className="font-mono text-slate-500 w-5">#{idx + 1}</span>
                  
                  {item.postData?.thumbnail ? (
                    <img
                      src={item.postData.thumbnail}
                      alt=""
                      className="w-10 h-10 object-cover rounded-lg bg-slate-900 shrink-0 border border-slate-800"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                  )}

                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">
                      {item.postData?.title || item.url}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                      <span className="truncate max-w-sm font-mono">{item.url}</span>
                      {item.postData?.episodes && (
                        <span className="text-sky-400 font-mono shrink-0">
                          ({item.postData.episodes.length} episodes)
                        </span>
                      )}
                    </div>
                    {item.error && (
                      <div className="text-[10px] text-rose-400 mt-0.5">{item.error}</div>
                    )}
                  </div>
                </div>

                {/* Status Indicator & Links */}
                <div className="flex items-center gap-3 shrink-0">
                  {item.status === 'idle' && (
                    <span className="text-[11px] text-slate-500 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      Pending
                    </span>
                  )}
                  {item.status === 'scraping' && (
                    <span className="text-[11px] text-sky-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scraping...
                    </span>
                  )}
                  {item.status === 'ready' && (
                    <span className="text-[11px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                      Ready
                    </span>
                  )}
                  {item.status === 'sending' && (
                    <span className="text-[11px] text-sky-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                    </span>
                  )}
                  {item.status === 'sent' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                      </span>
                      {item.telegramLink && (
                        <a
                          href={item.telegramLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-sky-400 transition"
                          title="Open Telegram post"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                  {item.status === 'failed' && (
                    <span className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
