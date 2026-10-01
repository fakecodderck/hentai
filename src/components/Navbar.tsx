import React from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Sparkles,
  Bot,
  Layers,
  Send,
  History,
  HardDrive,
  Workflow,
  Radio,
  FileArchive,
  RefreshCw,
  Search
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    botConfig,
    setBotModalOpen,
    setDataLibraryModalOpen,
  } = useAppStore();

  return (
    <header className="bg-slate-900/90 border-b border-slate-800/90 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white">TelePost Studio</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Auto-Index v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Industrial Telegram Content Publisher & Multi-Folder JSON Storage Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800/90 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Poster</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('crawler')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'crawler'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Auto Scraper</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Database Library Modal Button */}
          <button
            type="button"
            onClick={() => setDataLibraryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm"
            title="Open Codebase Database & Master Index"
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Database Library</span>
          </button>

          {/* Bot Setup Config Button */}
          <button
            type="button"
            onClick={() => setBotModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
              botConfig.verified
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{botConfig.verified ? 'Bot Connected' : 'Setup Bot'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
