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
import type { CrawlerStatus } from '../../types';
import {
  Play,
  Pause,
  Square,
  Copy,
  Download,
  Terminal as TerminalIcon,
  Trash2,
  HardDrive,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck,
  FileX,
  FileText,
  AlertCircle
} from 'lucide-react';

export const AutoCrawlerPanel: React.FC = () => {
  const { setCrawlerRunning } = useAppStore();

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

  const [copiedLogs, setCopiedLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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
                logs: [...prev.logs, data.entry].slice(-500),
              }));
            }
          } catch {}
        };

        sse.onerror = () => {
          sse.close();
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

  useEffect(() => {
    if (terminalBoxRef.current) {
      terminalBoxRef.current.scrollTop = terminalBoxRef.current.scrollHeight;
    }
  }, [status.logs]);

  // Crawler Controls
  const handleStart = async () => {
    setActionLoading(true);
    try {
      const s = await startCrawlerApi({
        baseUrl,
        startPage,
        endPage,
        delayMs,
        filterDuplicates,
        autoSave,
      });
      setStatus(s);
      setCrawlerRunning(true);
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      if (status.state === 'paused') {
        const s = await resumeCrawlerApi();
        setStatus(s);
      } else {
        const s = await pauseCrawlerApi();
        setStatus(s);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const s = await stopCrawlerApi();
      setStatus(s);
      setCrawlerRunning(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearTerminal = async () => {
    await clearCrawlerLogsApi();
    setStatus((prev) => ({ ...prev, logs: [] }));
  };

  const handleCopyLogs = () => {
    const text = status.logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = status.logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawler-logs-${new Date().toISOString().split('T')[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      
      {/* Column 1: Auto Scraper Engine */}
      <div className="lg:col-span-4 bg-[#131B2A] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Auto Scraper Engine</span>
            </h3>
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                status.state === 'running'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : status.state === 'paused'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status.state === 'running'
                    ? 'bg-emerald-400 animate-ping'
                    : status.state === 'paused'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              ></span>
              <span>{status.state.toUpperCase()}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Target Catalog URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://watchhentai.net/series/"
              className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block">Start Page</label>
              <input
                type="number"
                min={1}
                value={startPage}
                onChange={(e) => setStartPage(Number(e.target.value) || 1)}
                className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block">End Page</label>
              <input
                type="number"
                min={1}
                value={endPage}
                onChange={(e) => setEndPage(Number(e.target.value) || 1)}
                className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block">Crawl Delay</label>
              <select
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value={500}>500ms</option>
                <option value={800}>800ms</option>
                <option value={1200}>1200ms</option>
                <option value={2000}>2000ms</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterDuplicates}
                onChange={(e) => setFilterDuplicates(e.target.checked)}
                className="rounded border-slate-700 bg-[#0B0F17] text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span>Filter Out Duplicates</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded border-slate-700 bg-[#0B0F17] text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span>Auto-Save to Codebase Library</span>
            </label>
          </div>
        </div>

        {/* Start Auto Scrape Button */}
        <div className="pt-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={actionLoading || status.state === 'running'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Auto Scrape</span>
          </button>
        </div>
      </div>

      {/* Column 2: Crawler Status */}
      <div className="lg:col-span-3 bg-[#131B2A] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-100">Crawler Status</h3>
          </div>

          {/* 2x3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2">
            
            {/* Metric 1: STATE */}
            <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <Layers className="w-3 h-3 text-sky-400" />
                <span>STATE</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-100 uppercase truncate">
                {status.state}
              </div>
            </div>

            {/* Metric 2: PAGE */}
            <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <FileText className="w-3 h-3 text-indigo-400" />
                <span>PAGE</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-100 truncate">
                {status.currentPage} / {status.endPage}
              </div>
            </div>

            {/* Metric 3: SAVED */}
            <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <HardDrive className="w-3 h-3 text-emerald-400" />
                <span>SAVED</span>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 truncate">
                {status.totalSaved}
              </div>
            </div>

            {/* Metric 4: SKIPPED */}
            <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <FileX className="w-3 h-3 text-amber-400" />
                <span>SKIPPED</span>
              </div>
              <div className="text-xs font-mono font-bold text-amber-300 truncate">
                {status.totalSkipped}
              </div>
            </div>

            {/* Metric 5: PROCESSED */}
            <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <FileCheck className="w-3 h-3 text-blue-400" />
                <span>PROCESSED</span>
              </div>
              <div className="text-xs font-mono font-bold text-blue-300 truncate">
                {status.totalPagesProcessed}
              </div>
            </div>

            {/* Metric 6: ELAPSED */}
            <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>ELAPSED</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-slate-200 truncate">
                {formatSeconds(status.elapsedSeconds)}
              </div>
            </div>

          </div>
        </div>

        {/* Crawler Control Buttons: Pause / Stop */}
        <div className="pt-3 space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Crawler Control</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePause}
              disabled={actionLoading || status.state === 'idle'}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{status.state === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={handleStop}
              disabled={actionLoading || status.state === 'idle'}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>

      {/* Column 3: Crawler Terminal */}
      <div className="lg:col-span-5 bg-[#131B2A] border border-slate-800/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3 min-h-[220px]">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            <span>Crawler Terminal</span>
          </h3>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearTerminal}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="Clear terminal log view"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLogs}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="Copy terminal logs"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadLogs}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="Download terminal logs as .log file"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Terminal Log Box */}
        <div ref={terminalBoxRef} className="flex-1 bg-[#070A10] rounded-xl border border-slate-800 p-3 font-mono text-[11px] text-slate-300 max-h-52 overflow-y-auto space-y-1">
          {status.logs && status.logs.length > 0 ? (
            status.logs.map((log, i) => (
              <div key={i} className="leading-tight flex items-start gap-1.5">
                <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                <span
                  className={`font-bold shrink-0 ${
                    log.level === 'error'
                      ? 'text-rose-400'
                      : log.level === 'warn'
                      ? 'text-amber-400'
                      : log.level === 'success'
                      ? 'text-emerald-400'
                      : 'text-sky-400'
                  }`}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-600 py-4 text-center">
              [12:00:00] [INFO] Crawler initialized<br />
              [12:00:00] [INFO] Waiting for start...
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

    </div>
  );
};
