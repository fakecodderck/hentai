import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { scrapeWebsite, savePostToLibrary } from '../../services/api';
import { 
  Globe, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  RotateCcw,
  Folder,
  Save,
  Check
} from 'lucide-react';

export const WebsiteScraperBar: React.FC = () => {
  const { 
    post, 
    setPost, 
    isScraping, 
    setIsScraping,
    setActiveCatalogIndex,
    autoSaveToLibrary,
    setAutoSaveToLibrary,
    setDataLibraryModalOpen,
    lastSavedLocation,
    setLastSavedLocation
  } = useAppStore();

  const [inputUrl, setInputUrl] = useState(post.websiteUrl || '');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = useState<string | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleScrape = async (targetUrl?: string) => {
    const urlToScrape = (targetUrl || inputUrl).trim();
    if (!urlToScrape) {
      setScrapeError('Please enter a website URL to extract (e.g. series, movie, or catalog link)');
      return;
    }

    setScrapeError(null);
    setScrapeSuccess(null);
    setSaveSuccessMsg(null);
    setIsScraping(true);

    try {
      const extracted = await scrapeWebsite(urlToScrape);
      setPost(extracted);
      setInputUrl(extracted.websiteUrl);
      setActiveCatalogIndex(0);

      if (extracted.isCatalog && extracted.catalogPosts && extracted.catalogPosts.length > 0) {
        setScrapeSuccess(
          `Extracted ${extracted.catalogPosts.length} posts from archive! Broadcast all or select any post below.`
        );
      } else {
        setScrapeSuccess(
          `Successfully extracted "${extracted.title}" with ${extracted.episodes.length} episode links!`
        );
      }
    } catch (err: any) {
      setScrapeError(
        `${err.message || 'Scrape failed'}. Tip: You can adjust fields manually or use bulk links import below.`
      );
    } finally {
      setIsScraping(false);
    }
  };

  const handleManualSave = async () => {
    if (!post.title && !post.websiteUrl) {
      setScrapeError('Please extract or enter a post title before saving to library.');
      return;
    }
    setIsManualSaving(true);
    setScrapeError(null);
    try {
      const res = await savePostToLibrary(post);
      setLastSavedLocation({ folder: res.folder, filename: res.filename });
      setSaveSuccessMsg(`Saved to /data/${res.folder}/${res.filename} (${res.totalInFolder}/10 posts)`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setScrapeError(`Failed to save to library: ${err.message}`);
    } finally {
      setIsManualSaving(false);
    }
  };

  const handleClearWorkspace = () => {
    setInputUrl('');
    setScrapeError(null);
    setScrapeSuccess(null);
    setSaveSuccessMsg(null);
    setPost({
      websiteUrl: '',
      title: '',
      thumbnail: '',
      description: '',
      siteName: '',
      episodes: [],
      isCatalog: false,
      catalogPosts: [],
    });
  };

  return (
    <div className="bg-[#131B2A] border border-slate-800/90 rounded-2xl p-4 shadow-xl space-y-3">
      
      {/* Input Group */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            type="url"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleScrape();
              }
            }}
            placeholder="Enter post URL (e.g. https://watchhentai.net/series/...)"
            className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono min-h-[42px]"
          />
          {inputUrl && (
            <button
              type="button"
              onClick={() => {
                setInputUrl('');
                setScrapeError(null);
                setScrapeSuccess(null);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleScrape()}
          disabled={isScraping || !inputUrl.trim()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 transition shrink-0 cursor-pointer min-h-[42px]"
        >
          {isScraping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Scraping...</span>
            </>
          ) : (
            <>
              <Globe className="w-4 h-4" />
              <span>Scrape</span>
            </>
          )}
        </button>
      </div>

      {/* Storage Save Notification */}
      {saveSuccessMsg && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/30 text-sky-200 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate font-mono text-[11px]">{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg(null)}
            className="text-sky-400/70 hover:text-sky-300 shrink-0 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {scrapeSuccess && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{scrapeSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setScrapeSuccess(null)}
            className="text-emerald-400/70 hover:text-emerald-300 shrink-0 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {scrapeError && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{scrapeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setScrapeError(null)}
            className="text-rose-400/70 hover:text-rose-300 shrink-0 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
};
