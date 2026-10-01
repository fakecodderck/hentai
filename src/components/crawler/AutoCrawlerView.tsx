import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  startCrawlerApi,
  stopCrawlerApi,
  pauseCrawlerApi,
  resumeCrawlerApi,
  fetchCrawlerStatusApi,
  clearCrawlerLogsApi,
} from '../../services/api';
import type { CrawlerStatus, CrawlerLogEntry, CrawlerConfig } from '../../types';
import {
  Terminal,
  Play,
  Square,
  Pause,
  RotateCcw,
  Copy,
  Download,
  Check,
  Search,
  Filter,
  Layers,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Sliders,
  Flame,
  AlertCircle,
  X
} from 'lucide-react';

export const AutoCrawlerView: React.FC = () => {
  const { setDataLibraryModalOpen, setCrawlerRunning } = useAppStore();

  const [status, setStatus] = useState<CrawlerStatus>({
    state: 'idle',
    currentPage: 1,
    startPage: 1,
    endPage: 5,
    totalPagesProcessed: 0,
    totalPostsFound: 0,
    totalSaved: 0,
    totalSkipped: 0,
    totalErrors: 0,
    elapsedSeconds: 0,
    logs: [],
    config: {
      baseUrl: 'https://watchhentai.net/series/',
      startPage: 1,
      endPage: 5,
      delayMs: 800,
      filterDuplicates: true,
      autoSave: true,
    },
  });

  // Local Form Controls
  const [baseUrl, setBaseUrl] = useState('https://watchhentai.net/series/');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(5);
  const [delayMs, setDelayMs] = useState(800);
  const [filterDuplicates, setFilterDuplicates] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  // Terminal UI State
  const [autoScroll, setAutoScroll] = useState(true);
  const [terminalFilter, setTerminalFilter] = useState('');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE stream on mount
  useEffect(() => {
    let sse: EventSource;

    const connectSSE = () => {
      try {
        sse = new EventSource('/api/crawler/events');
        eventSourceRef.current = sse;

        sse.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init' && data.status) {
              setStatus(data.status);
              setCrawlerRunning(data.status.state === 'running');
            } else if (data.type === 'status' && data.status) {
              setStatus(data.status);
              setCrawlerRunning(data.status.state === 'running');
            } else if (data.type === 'log' && data.entry) {
              setStatus((prev) => ({
                ...prev,
                logs: [...prev.logs, data.entry].slice(-1000),
              }));
            }
          } catch {}
        };

        sse.onerror = () => {
          sse.close();
          // Fallback poll every 3s if SSE drops
          setTimeout(pollStatus, 3000);
        };
      } catch {
        pollStatus();
      }
    };

    const pollStatus = async () => {
      try {
        const s = await fetchCrawlerStatusApi();
        if (s) {
          setStatus(s);
          setCrawlerRunning(s.state === 'running');
        }
      } catch {}
    };

    connectSSE();
    pollStatus();

    const interval = setInterval(pollStatus, 2500);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [setCrawlerRunning]);

  const terminalBoxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal container internally to bottom
  useEffect(() => {
    if (autoScroll && terminalBoxRef.current) {
      terminalBoxRef.current.scrollTop = terminalBoxRef.current.scrollHeight;
    }
  }, [status.logs, autoScroll]);

  // Crawler Actions
  const handleStart = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const config: CrawlerConfig = {
        baseUrl: baseUrl.trim() || 'https://watchhentai.net/series/',
        startPage: Math.max(1, Number(startPage) || 1),
        endPage: Math.max(1, Number(endPage) || 5),
        delayMs: Number(delayMs) || 800,
        filterDuplicates,
        autoSave,
      };
      const res = await startCrawlerApi(config);
      setStatus(res);
      setCrawlerRunning(true);
    } catch (err: any) {
      setErrorMessage(`Start failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await stopCrawlerApi();
      setStatus(res);
      setCrawlerRunning(false);
    } catch (err: any) {
      setErrorMessage(`Stop failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      const res = await pauseCrawlerApi();
      setStatus(res);
    } catch {}
  };

  const handleResume = async () => {
    try {
      const res = await resumeCrawlerApi();
      setStatus(res);
    } catch {}
  };

  const handleClearLogs = async () => {
    try {
      await clearCrawlerLogsApi();
      setStatus((prev) => ({ ...prev, logs: [] }));
    } catch {}
  };

  const copyAllLogs = () => {
    const text = status.logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const exportLogsTxt = () => {
    const text = status.logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telepost-crawler-log-${new Date().toISOString().substring(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isRunning = status.state === 'running';
  const isPaused = status.state === 'paused';

  // Format Elapsed Time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Filter terminal logs by search keyword
  const filteredLogs = terminalFilter.trim()
    ? status.logs.filter((l) => l.message.toLowerCase().includes(terminalFilter.toLowerCase()) || l.level.includes(terminalFilter.toLowerCase()))
    : status.logs;

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* 1. Header & Overview Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Auto Scraper Engine</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Multi-Page Series Crawler
                </span>
                {isRunning && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    ACTIVE (P.{status.currentPage})
                  </span>
                )}
                {isPaused && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    PAUSED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Crawls catalog pages sequentially, extracts all series post details, filters duplicates & saves to <code className="text-slate-300 font-mono">data/hntX</code> (10 posts/folder).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDataLibraryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 transition cursor-pointer shadow-sm"
              title="Open Codebase Data Library"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Data Library</span>
            </button>
          </div>
        </div>

        {/* In-app Error Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Crawler Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80">
          
          {/* Base URL */}
          <div className="lg:col-span-5 space-y-1">
            <label className="text-[11px] font-medium text-slate-400">Target Catalog URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={isRunning || isPaused}
              placeholder="https://watchhentai.net/series/"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
            />
          </div>

          {/* Start Page & End Page */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Start Page</label>
              <input
                type="number"
                min="1"
                value={startPage}
                onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isRunning || isPaused}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">End Page</label>
              <input
                type="number"
                min={startPage}
                value={endPage}
                onChange={(e) => setEndPage(Math.max(startPage, parseInt(e.target.value) || startPage))}
                disabled={isRunning || isPaused}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Delay selector */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-medium text-slate-400">Crawl Delay</label>
            <select
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              disabled={isRunning || isPaused}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 cursor-pointer"
            >
              <option value="400">0.4s (Ultra Fast)</option>
              <option value="800">0.8s (Fast - Recommended)</option>
              <option value="1500">1.5s (Balanced)</option>
              <option value="3000">3.0s (Gentle)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="lg:col-span-2 flex items-end gap-2">
            {!isRunning && !isPaused ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Auto Scrape</span>
              </button>
            ) : (
              <div className="w-full flex items-center gap-1.5">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-white" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition cursor-pointer"
                  title="Stop Crawler"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Toggles (Duplicate filter & Auto-save) */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition">
            <input
              type="checkbox"
              checked={filterDuplicates}
              onChange={(e) => setFilterDuplicates(e.target.checked)}
              disabled={isRunning || isPaused}
              className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
            />
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Filter Out Duplicates (Checks existing files in <code className="text-slate-400 font-mono">data/hntX</code>)
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              disabled={isRunning || isPaused}
              className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
            />
            <span className="flex items-center gap-1 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              Auto-Save to Codebase Library (<code className="text-slate-400 font-mono">data/hnt1, hnt2... 10 posts/folder</code>)
            </span>
          </label>
        </div>

      </div>

      {/* 2. Live Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Crawler State</div>
          <div className="flex items-center gap-1.5 font-bold text-sm uppercase">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-emerald-400 animate-ping' : isPaused ? 'bg-amber-400' : 'bg-slate-500'
              }`}
            ></span>
            <span
              className={
                isRunning
                  ? 'text-emerald-400'
                  : isPaused
                  ? 'text-amber-400'
                  : status.state === 'completed'
                  ? 'text-sky-400'
                  : 'text-slate-400'
              }
            >
              {status.state}
            </span>
          </div>
        </div>

        {/* Current Page */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Page Progress</div>
          <div className="text-base font-bold text-slate-100 font-mono">
            P. {status.currentPage}{' '}
            <span className="text-xs text-slate-500 font-normal">/ {status.endPage}</span>
          </div>
        </div>

        {/* Posts Saved */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Saved to Library</div>
          <div className="text-base font-bold text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>{status.totalSaved}</span>
          </div>
        </div>

        {/* Duplicates Filtered */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Duplicates Skipped</div>
          <div className="text-base font-bold text-purple-400 font-mono flex items-center gap-1">
            <Filter className="w-4 h-4" />
            <span>{status.totalSkipped}</span>
          </div>
        </div>

        {/* Total Posts Found */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Posts Processed</div>
          <div className="text-base font-bold text-sky-400 font-mono">
            {status.totalPostsFound}
          </div>
        </div>

        {/* Elapsed Time */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Elapsed Time</div>
          <div className="text-base font-bold text-slate-200 font-mono flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatTime(status.elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {/* 3. Live Streaming Terminal Console */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            </div>
            <div className="h-4 w-px bg-slate-700 mx-1"></div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span>telepost-scraper-terminal</span>
              <span className="text-[10px] text-slate-500">({filteredLogs.length} events)</span>
            </div>
          </div>

          {/* Terminal Actions */}
          <div className="flex items-center gap-2 text-xs">
            {/* Search inside terminal */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={terminalFilter}
                onChange={(e) => setTerminalFilter(e.target.value)}
                placeholder="Filter terminal..."
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 w-36 sm:w-44"
              />
            </div>

            {/* Auto Scroll */}
            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                autoScroll
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Toggle Auto-Scroll"
            >
              Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>

            {/* Copy All */}
            <button
              type="button"
              onClick={copyAllLogs}
              disabled={status.logs.length === 0}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Copy All Logs"
            >
              {copiedLogs ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Export Txt */}
            <button
              type="button"
              onClick={exportLogsTxt}
              disabled={status.logs.length === 0}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Export Log File (.txt)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Clear */}
            <button
              type="button"
              onClick={handleClearLogs}
              disabled={status.logs.length === 0}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Clear Terminal Log"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Screen (Monospace Dark Box) */}
        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 min-h-[380px] max-h-[550px] overflow-y-auto space-y-1.5 select-text selection:bg-sky-600 selection:text-white">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-slate-600 space-y-2 select-none">
              <Terminal className="w-8 h-8 opacity-40" />
              <p className="text-xs">Terminal ready. Click &quot;Start Auto Scrape&quot; to begin crawling.</p>
              <p className="text-[11px] text-slate-700">Live events will stream here with duplicate detection and folder allocation.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
              let textHighlight = 'text-slate-300';

              if (log.level === 'page') {
                badgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                textHighlight = 'text-sky-200 font-bold';
              } else if (log.level === 'scraping') {
                badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                textHighlight = 'text-amber-200';
              } else if (log.level === 'saved') {
                badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                textHighlight = 'text-emerald-300';
              } else if (log.level === 'duplicate') {
                badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
                textHighlight = 'text-slate-400';
              } else if (log.level === 'error') {
                badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                textHighlight = 'text-rose-300 font-semibold';
              } else if (log.level === 'warn') {
                badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                textHighlight = 'text-amber-300';
              } else if (log.level === 'success') {
                badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
                textHighlight = 'text-teal-200 font-semibold';
              }

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/40 px-1 py-0.5 rounded transition">
                  <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono shrink-0 uppercase border ${badgeColor}`}>
                    {log.level}
                  </span>
                  <span className={`flex-1 break-all ${textHighlight}`}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer Bar */}
        <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">●</span>
            <span>CLI Stream Active</span>
            <span>•</span>
            <span>Chunking: 10 posts/folder (<code className="text-slate-400">data/hnt1</code>, <code className="text-slate-400">hnt2</code>...)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Rate Limit: {delayMs}ms</span>
          </div>
        </div>

      </div>

    </div>
  );
};
