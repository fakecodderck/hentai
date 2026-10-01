/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/layout/Sidebar';
import { BotSetupModal } from './components/BotSetupModal';
import { BulkEpisodesModal } from './components/BulkEpisodesModal';
import { DataLibraryModal } from './components/studio/DataLibraryModal';
import { WebsiteScraperBar } from './components/studio/WebsiteScraperBar';
import { MultiPostManager } from './components/studio/MultiPostManager';
import { PostEditor } from './components/studio/PostEditor';
import { TelegramPreview } from './components/studio/TelegramPreview';
import { TelegramSettingsCard } from './components/studio/TelegramSettingsCard';
import { AutoCrawlerPanel } from './components/crawler/AutoCrawlerPanel';
import { AutoCrawlerView } from './components/crawler/AutoCrawlerView';
import { BatchSender } from './components/batch/BatchSender';
import { HistoryList } from './components/history/HistoryList';
import {
  Search,
  Moon,
  LayoutDashboard,
  Bot,
  Folder,
  Send,
  History,
  Settings
} from 'lucide-react';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    dataLibraryModalOpen,
    botModalOpen,
    bulkEpisodesModalOpen,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex antialiased selection:bg-blue-600 selection:text-white">
      
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* Top Header Bar */}
        <header className="px-4 sm:px-6 py-4 border-b border-slate-800/80 bg-[#0B0F17] flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => useAppStore.getState().setSidebarCollapsed(!useAppStore.getState().sidebarCollapsed)}
              className="p-2 rounded-xl bg-[#131B2A] border border-slate-700/80 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              title="Toggle Sidebar"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">Studio</h1>
              <p className="text-xs text-slate-400">Scrape, edit and publish to Telegram</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="bg-[#131B2A] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-60 transition"
              />
            </div>

            {/* Dark Mode / Moon Icon Toggle */}
            <button
              type="button"
              className="p-2 rounded-xl bg-[#131B2A] border border-slate-700/80 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              title="Toggle Theme"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1600px] w-full mx-auto">
          
          {/* Main Studio Dashboard */}
          {activeTab === 'studio' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Scraper Bar */}
              <WebsiteScraperBar />

              {/* Multi-Post Catalog Selector if archive page was scraped */}
              <MultiPostManager />

              {/* Middle Section: 3-Column Grid (Post Editor | Telegram Preview | Telegram Settings) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                
                {/* Column 1: Post Editor */}
                <div className="lg:col-span-5 xl:col-span-4">
                  <PostEditor />
                </div>

                {/* Column 2: Telegram Preview */}
                <div className="lg:col-span-7 xl:col-span-4">
                  <TelegramPreview />
                </div>

                {/* Column 3: Telegram Settings */}
                <div className="lg:col-span-12 xl:col-span-4">
                  <TelegramSettingsCard />
                </div>

              </div>

              {/* Bottom Section: 3-Column Grid (Auto Scraper Engine | Crawler Status | Crawler Terminal) */}
              <AutoCrawlerPanel />

            </div>
          )}

          {/* Full Page Auto Crawler View */}
          {activeTab === 'crawler' && <AutoCrawlerView />}

          {/* Batch Broadcast Queue View */}
          {activeTab === 'batch' && <BatchSender />}

          {/* Sent History View */}
          {activeTab === 'history' && <HistoryList />}

        </main>
      </div>

      {/* Global Modals */}
      {botModalOpen && <BotSetupModal />}
      {bulkEpisodesModalOpen && <BulkEpisodesModal />}
      {dataLibraryModalOpen && <DataLibraryModal />}

    </div>
  );
}
