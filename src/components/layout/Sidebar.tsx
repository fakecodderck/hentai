import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  LayoutDashboard,
  Bot,
  Folder,
  Send,
  History,
  Settings,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    setDataLibraryModalOpen,
    setBotModalOpen,
    crawlerRunning
  } = useAppStore();

  const navItems = [
    {
      id: 'studio' as const,
      label: 'Studio',
      icon: LayoutDashboard,
      action: () => setActiveTab('studio'),
    },
    {
      id: 'crawler' as const,
      label: 'Auto Crawler',
      icon: Bot,
      badge: crawlerRunning ? 'RUNNING' : undefined,
      action: () => setActiveTab('crawler'),
    },
    {
      id: 'library' as const,
      label: 'Data Library',
      icon: Folder,
      action: () => setDataLibraryModalOpen(true),
    },
    {
      id: 'batch' as const,
      label: 'Batch Broadcast',
      icon: Send,
      action: () => setActiveTab('batch'),
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: History,
      action: () => setActiveTab('history'),
    },
    {
      id: 'bot_setup' as const,
      label: 'Bot Setup',
      icon: Settings,
      action: () => setBotModalOpen(true),
    },
  ];

  return (
    <aside
      className={`flex flex-col border-r border-slate-800/80 bg-[#0B0F17] transition-all duration-300 select-none shrink-0 sticky top-0 h-screen z-30 ${
        sidebarCollapsed ? 'w-16 sm:w-20' : 'w-56 sm:w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        {!sidebarCollapsed && (
          <div className="truncate">
            <h1 className="font-bold text-sm text-slate-100 tracking-tight truncate">Hentai Studio</h1>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />

              {!sidebarCollapsed && (
                <div className="flex-1 text-left min-w-0 flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-400 text-slate-950 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Collapse Toggle Button */}
      <div className="p-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition cursor-pointer text-xs"
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>

    </aside>
  );
};
