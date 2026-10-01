import React, { useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { scrapeWebsite, sendPostToTelegram } from '../../services/api';
import { CatalogPostItem } from '../../types';
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Search,
  Filter,
  Eye,
  Check,
  Zap,
  ArrowRight
} from 'lucide-react';

export const MultiPostManager: React.FC = () => {
  const {
    post,
    setPost,
    botConfig,
    templateSettings,
    setBotModalOpen,
    addHistoryItem,
    addBatchUrl,
    setActiveTab,
    activeCatalogIndex,
    setActiveCatalogIndex,
    updateCatalogPost
  } = useAppStore();

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isCrawlingAll, setIsCrawlingAll] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{
    currentIndex: number;
    total: number;
    currentTitle: string;
    sentCount: number;
    failedCount: number;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const stopRequestedRef = useRef(false);

  const catalogPosts = post.catalogPosts || [];
  if (!post.isCatalog || catalogPosts.length <= 1) {
    return null;
  }

  const currentActivePost = catalogPosts[activeCatalogIndex] || catalogPosts[0];

  // Switch to a specific post and load it into Studio Editor & Telegram Simulator
  const handleSelectPost = async (index: number) => {
    const targetPost = catalogPosts[index];
    if (!targetPost) return;

    setActiveCatalogIndex(index);

    // If the post already has episodes cached
    if (targetPost.episodes && targetPost.episodes.length > 0) {
      setPost(prev => ({
        ...prev,
        websiteUrl: targetPost.url || targetPost.websiteUrl || '',
        title: targetPost.title || '',
        thumbnail: targetPost.thumbnail || prev.thumbnail || '',
        description: targetPost.description || prev.description || '',
        synopsis: targetPost.synopsis || targetPost.description || prev.synopsis || '',
        galleryImages: targetPost.galleryImages || prev.galleryImages || [],
        episodes: targetPost.episodes || [],
      }));
      return;
    }

    // Otherwise, fetch episodes for this post
    try {
      updateCatalogPost(targetPost.id, { status: 'scraping' });
      const targetUrl = targetPost.url || targetPost.websiteUrl || '';
      const seriesData = await scrapeWebsite(targetUrl);
      
      updateCatalogPost(targetPost.id, {
        status: 'ready',
        episodes: seriesData.episodes,
        description: seriesData.description,
        synopsis: seriesData.synopsis,
        galleryImages: seriesData.galleryImages,
        thumbnail: seriesData.thumbnail || targetPost.thumbnail,
      });

      setPost(prev => ({
        ...prev,
        websiteUrl: targetUrl,
        title: seriesData.title || targetPost.title || '',
        thumbnail: seriesData.thumbnail || targetPost.thumbnail || prev.thumbnail || '',
        description: seriesData.description || prev.description || '',
        synopsis: seriesData.synopsis || prev.synopsis || '',
        galleryImages: seriesData.galleryImages || prev.galleryImages || [],
        episodes: seriesData.episodes || [],
      }));
    } catch {
      // Fallback: load title & thumbnail
      updateCatalogPost(targetPost.id, { status: 'ready' });
      const targetUrl = targetPost.url || targetPost.websiteUrl || '';
      setPost(prev => ({
        ...prev,
        websiteUrl: targetUrl,
        title: targetPost.title || '',
        thumbnail: targetPost.thumbnail || prev.thumbnail || '',
        description: `Episodes from ${targetPost.title || ''}`,
        synopsis: `Episodes from ${targetPost.title || ''}`,
        galleryImages: targetPost.galleryImages || [],
        episodes: [],
      }));
    }
  };

  // Previous post in carousel
  const handlePrevPost = () => {
    const nextIdx = activeCatalogIndex > 0 ? activeCatalogIndex - 1 : catalogPosts.length - 1;
    handleSelectPost(nextIdx);
  };

  // Next post in carousel
  const handleNextPost = () => {
    const nextIdx = activeCatalogIndex < catalogPosts.length - 1 ? activeCatalogIndex + 1 : 0;
    handleSelectPost(nextIdx);
  };

  // Quick Send a single post directly from the card
  const handleQuickSendSingle = async (p: CatalogPostItem, idx: number) => {
    if (!botConfig.botToken || !botConfig.chatId) {
      setBotModalOpen(true);
      return;
    }

    try {
      updateCatalogPost(p.id, { status: 'sending' });

      // Ensure episodes are fetched
      let episodes = p.episodes;
      let thumbnail = p.thumbnail;
      let description = p.description || `Episodes from ${p.title}`;

      if (!episodes || episodes.length === 0) {
        try {
          const fetched = await scrapeWebsite(p.url);
          episodes = fetched.episodes;
          thumbnail = fetched.thumbnail || thumbnail;
          description = fetched.description || description;
        } catch {}
      }

      const postToSend = {
        websiteUrl: p.url,
        title: p.title,
        thumbnail,
        description,
        siteName: post.siteName,
        episodes: episodes || [],
      };

      const result = await sendPostToTelegram({
        botConfig,
        templateSettings,
        postData: postToSend,
      });

      updateCatalogPost(p.id, {
        status: 'sent',
        messageId: result.messageId,
        telegramLink: result.postLink,
      });

      addHistoryItem({
        title: p.title,
        thumbnail,
        chatId: botConfig.chatId,
        chatTitle: botConfig.chatInfo?.title,
        episodesCount: episodes?.length || 0,
        status: 'sent',
        messageId: result.messageId,
        telegramLink: result.postLink,
        postData: postToSend,
      });
    } catch (err: any) {
      updateCatalogPost(p.id, {
        status: 'failed',
        error: err.message,
      });
    }
  };

  // Broadcast all posts sequentially with rate limit delay
  const handleBroadcastAll = async () => {
    if (!botConfig.botToken || !botConfig.chatId) {
      setBotModalOpen(true);
      return;
    }

    stopRequestedRef.current = false;
    setIsBroadcasting(true);

    const postsToBroadcast = selectedPostIds.size > 0
      ? catalogPosts.filter(p => selectedPostIds.has(p.id))
      : catalogPosts;

    setBroadcastProgress({
      currentIndex: 0,
      total: postsToBroadcast.length,
      currentTitle: postsToBroadcast[0]?.title || '',
      sentCount: 0,
      failedCount: 0,
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < postsToBroadcast.length; i++) {
      if (stopRequestedRef.current) break;

      const p = postsToBroadcast[i];
      setBroadcastProgress({
        currentIndex: i + 1,
        total: postsToBroadcast.length,
        currentTitle: p.title,
        sentCount: sent,
        failedCount: failed,
      });

      updateCatalogPost(p.id, { status: 'sending' });

      try {
        // 1. Fetch episodes if missing
        let episodes = p.episodes;
        let thumbnail = p.thumbnail;
        let description = p.description || `Episodes from ${p.title}`;

        if (!episodes || episodes.length === 0) {
          try {
            const fetched = await scrapeWebsite(p.url);
            episodes = fetched.episodes;
            thumbnail = fetched.thumbnail || thumbnail;
            description = fetched.description || description;
            updateCatalogPost(p.id, { episodes, thumbnail, description });
          } catch {}
        }

        const postPayload = {
          websiteUrl: p.url,
          title: p.title,
          thumbnail,
          description,
          siteName: post.siteName,
          episodes: episodes || [],
        };

        // 2. Dispatch to Telegram
        const result = await sendPostToTelegram({
          botConfig,
          templateSettings,
          postData: postPayload,
        });

        sent++;
        updateCatalogPost(p.id, {
          status: 'sent',
          messageId: result.messageId,
          telegramLink: result.postLink,
        });

        addHistoryItem({
          title: p.title,
          thumbnail,
          chatId: botConfig.chatId,
          chatTitle: botConfig.chatInfo?.title,
          episodesCount: episodes?.length || 0,
          status: 'sent',
          messageId: result.messageId,
          telegramLink: result.postLink,
          postData: postPayload,
        });
      } catch (err: any) {
        failed++;
        updateCatalogPost(p.id, {
          status: 'failed',
          error: err.message,
        });
      }

      setBroadcastProgress(prev => prev ? {
        ...prev,
        sentCount: sent,
        failedCount: failed,
      } : null);

      // Flood protection delay: wait 2.5s between broadcasts
      if (i < postsToBroadcast.length - 1 && !stopRequestedRef.current) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    setIsBroadcasting(false);
  };

  // Stop broadcasting
  const handleStopBroadcast = () => {
    stopRequestedRef.current = true;
    setIsBroadcasting(false);
  };

  // Auto crawl episodes for all posts in background
  const handleCrawlAllEpisodes = async () => {
    setIsCrawlingAll(true);
    for (let i = 0; i < catalogPosts.length; i++) {
      const p = catalogPosts[i];
      if (p.episodes && p.episodes.length > 0) continue;

      try {
        updateCatalogPost(p.id, { status: 'scraping' });
        const fetched = await scrapeWebsite(p.url);
        updateCatalogPost(p.id, {
          status: 'ready',
          episodes: fetched.episodes,
          thumbnail: fetched.thumbnail || p.thumbnail,
          description: fetched.description,
        });
      } catch {
        updateCatalogPost(p.id, { status: 'ready' });
      }
      await new Promise(r => setTimeout(r, 800));
    }
    setIsCrawlingAll(false);
  };

  // Add all to Batch Queue
  const handleAddAllToBatchQueue = () => {
    catalogPosts.forEach(p => addBatchUrl(p.url));
    setActiveTab('batch');
  };

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedPostIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPostIds(next);
  };

  const handleSelectAll = () => {
    if (selectedPostIds.size === catalogPosts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(catalogPosts.map(p => p.id)));
    }
  };

  // Filter posts by search query
  const filteredPosts = catalogPosts.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || (p.badge && p.badge.toLowerCase().includes(q)) || (p.year && p.year.includes(q));
  });

  return (
    <div className="bg-slate-900/95 border-2 border-sky-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 animate-in fade-in backdrop-blur-md">
      
      {/* 1. Header Banner & Big Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 shrink-0 ring-1 ring-sky-400/40">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                All Extracted Posts
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                {catalogPosts.length} Posts Extracted
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Broadcast all {catalogPosts.length} posts to your Telegram channel or click any post to inspect and customize.
            </p>
          </div>
        </div>

        {/* Master Actions Bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Big Broadcast All Button */}
          {!isBroadcasting ? (
            <button
              type="button"
              onClick={handleBroadcastAll}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 transition cursor-pointer min-h-[40px]"
            >
              <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
              <span>
                {selectedPostIds.size > 0
                  ? `Broadcast Selected (${selectedPostIds.size}) to Telegram`
                  : `Broadcast All (${catalogPosts.length}) to Telegram`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopBroadcast}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition cursor-pointer min-h-[40px]"
            >
              <Pause className="w-4 h-4" />
              <span>Stop Broadcast</span>
            </button>
          )}

          {/* Background Auto-Crawl Episodes */}
          <button
            type="button"
            onClick={handleCrawlAllEpisodes}
            disabled={isCrawlingAll || isBroadcasting}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition cursor-pointer min-h-[40px]"
            title="Auto-fetch episode buttons for all posts"
          >
            {isCrawlingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>Crawling Episodes...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Fetch Episodes for All</span>
              </>
            )}
          </button>

          {/* Queue All in Batch Manager */}
          <button
            type="button"
            onClick={handleAddAllToBatchQueue}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer min-h-[40px]"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>To Batch Queue</span>
          </button>
        </div>
      </div>

      {/* 2. Live Broadcast Progress Bar (when broadcasting) */}
      {broadcastProgress && (
        <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-2.5 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Loader2 className={`w-4 h-4 text-sky-400 ${isBroadcasting ? 'animate-spin' : ''}`} />
              <span className="font-semibold text-slate-100">
                Broadcasting Post {broadcastProgress.currentIndex} of {broadcastProgress.total}:
              </span>
              <span className="font-medium text-sky-300 truncate max-w-xs sm:max-w-md">
                "{broadcastProgress.currentTitle}"
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-emerald-400">✓ Sent: {broadcastProgress.sentCount}</span>
              {broadcastProgress.failedCount > 0 && (
                <span className="text-rose-400">✗ Failed: {broadcastProgress.failedCount}</span>
              )}
              <span className="text-slate-400">
                {Math.round((broadcastProgress.currentIndex / broadcastProgress.total) * 100)}%
              </span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${(broadcastProgress.currentIndex / broadcastProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. Post Carousel Navigator (lets user easily cycle through all posts) */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrevPost}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-sky-500/50 text-slate-300 hover:text-white transition cursor-pointer"
            title="Previous post"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 truncate">
            {currentActivePost.thumbnail ? (
              <img
                src={currentActivePost.thumbnail}
                alt=""
                className="w-9 h-11 object-cover rounded-md bg-slate-900 border border-slate-800 shrink-0"
              />
            ) : (
              <div className="w-9 h-11 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            )}
            <div className="truncate">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <span>Active in Studio:</span>
                <span className="text-sky-400 font-bold">
                  Post {activeCatalogIndex + 1} of {catalogPosts.length}
                </span>
                {currentActivePost.status === 'sent' && (
                  <span className="text-emerald-400 font-bold">✓ Sent</span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-100 truncate max-w-xs sm:max-w-md" title={currentActivePost.title}>
                {currentActivePost.title}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextPost}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-sky-500/50 text-slate-300 hover:text-white transition cursor-pointer"
            title="Next post"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Quick Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Filter among ${catalogPosts.length} posts...`}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 whitespace-nowrap cursor-pointer"
          >
            {selectedPostIds.size === catalogPosts.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

      </div>

      {/* 4. Full Visual Gallery of All Extracted Posts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[380px] overflow-y-auto pr-1">
        {filteredPosts.map((p, idx) => {
          const isCurrentActive = activeCatalogIndex === idx;
          const isSelected = selectedPostIds.has(p.id);

          return (
            <div
              key={p.id}
              onClick={() => handleSelectPost(idx)}
              className={`group rounded-xl border p-2 text-xs flex flex-col justify-between gap-2 transition cursor-pointer relative ${
                isCurrentActive
                  ? 'bg-sky-950/40 border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {/* Checkbox select */}
              <div
                className="absolute top-3 left-3 z-10"
                onClick={e => {
                  e.stopPropagation();
                  handleToggleSelect(p.id);
                }}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-sky-500 border-sky-400 text-white'
                      : 'bg-black/60 border-slate-600 hover:border-sky-400 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>

              {/* Status pill top-right */}
              {p.status && (
                <div className="absolute top-3 right-3 z-10">
                  {p.status === 'sent' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/90 text-white shadow">
                      Sent ✓
                    </span>
                  )}
                  {p.status === 'sending' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/90 text-white shadow animate-pulse">
                      Sending...
                    </span>
                  )}
                  {p.status === 'failed' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/90 text-white shadow">
                      Failed
                    </span>
                  )}
                </div>
              )}

              {/* Poster Thumbnail */}
              <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80">
                {p.thumbnail ? (
                  <img
                    src={p.thumbnail}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Layers className="w-6 h-6" />
                  </div>
                )}

                {/* Badges */}
                <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-1">
                  {p.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 backdrop-blur-xs text-sky-400 border border-sky-400/30">
                      {p.badge}
                    </span>
                  )}
                  {p.year && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/70 backdrop-blur-xs text-slate-300">
                      {p.year}
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Index */}
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 font-mono">
                  #{idx + 1}
                </div>
                <div
                  className="font-semibold text-slate-200 line-clamp-2 text-[11px] leading-tight"
                  title={p.title}
                >
                  {p.title}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleSelectPost(idx)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg font-semibold text-[10px] transition cursor-pointer ${
                    isCurrentActive
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>{isCurrentActive ? 'Editing' : 'Load'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSendSingle(p, idx)}
                  disabled={p.status === 'sending'}
                  className="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white transition cursor-pointer"
                  title="Send this post to Telegram now"
                >
                  <Send className="w-3 h-3 -rotate-12" />
                </button>

                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded text-slate-500 hover:text-slate-200 transition"
                  title="Open source URL"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
