import { create } from 'zustand';
import type { PostData, BotConfig, TemplateSettings, HistoryItem, BatchItem, CatalogPostItem, EpisodeItem } from '../types';

interface AppState {
  activeTab: 'studio' | 'crawler' | 'batch' | 'flow' | 'history';
  setActiveTab: (tab: 'studio' | 'crawler' | 'batch' | 'flow' | 'history') => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  crawlerRunning: boolean;
  setCrawlerRunning: (running: boolean) => void;

  post: PostData;
  setPost: (post: Partial<PostData> | ((prev: PostData) => PostData)) => void;
  resetPost: () => void;

  addEpisode: (episode: Omit<EpisodeItem, 'id'>) => void;
  updateEpisode: (id: string, updates: Partial<EpisodeItem>) => void;
  removeEpisode: (id: string) => void;
  reorderEpisodes: (episodes: EpisodeItem[]) => void;
  clearEpisodes: () => void;

  botConfig: BotConfig;
  setBotConfig: (config: Partial<BotConfig>) => void;
  botModalOpen: boolean;
  setBotModalOpen: (open: boolean) => void;

  templateSettings: TemplateSettings;
  setTemplateSettings: (settings: Partial<TemplateSettings>) => void;

  bulkEpisodesModalOpen: boolean;
  setBulkEpisodesModalOpen: (open: boolean) => void;
  dataLibraryModalOpen: boolean;
  setDataLibraryModalOpen: (open: boolean) => void;
  autoSaveToLibrary: boolean;
  setAutoSaveToLibrary: (enabled: boolean) => void;
  lastSavedLocation: { folder: string; filename: string } | null;
  setLastSavedLocation: (loc: { folder: string; filename: string } | null) => void;
  isScraping: boolean;
  setIsScraping: (loading: boolean) => void;
  isSending: boolean;
  setIsSending: (loading: boolean) => void;

  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  removeHistoryItem: (id: string) => void;

  batchItems: BatchItem[];
  setBatchItems: (items: BatchItem[] | ((prev: BatchItem[]) => BatchItem[])) => void;
  addBatchUrl: (url: string) => void;
  clearBatch: () => void;

  activeCatalogIndex: number;
  setActiveCatalogIndex: (index: number) => void;
  updateCatalogPost: (id: string, updates: Partial<CatalogPostItem>) => void;
}

const DEFAULT_POST: PostData = {
  websiteUrl: '',
  title: '',
  thumbnail: '',
  description: '',
  synopsis: '',
  galleryImages: [],
  siteName: '',
  episodes: [],
  isCatalog: false,
  catalogPosts: [],
};

const DEFAULT_TEMPLATE: TemplateSettings = {
  captionTemplate: `🍿 <b>{title}</b>\n\n🎬 <b>Episodes:</b>\n{episodes_list}\n\n🔗 <b>Post Link:</b> {post_url}`,
  buttonsLayout: '2-col',
  includeTextLinks: true,
  includeSynopsis: false,
  sendAsPhoto: true,
  sendGalleryAlbum: true,
  maxGalleryImages: 5,
  disableNotification: false,
  protectContent: false,
  pinMessage: false,
  parseMode: 'HTML',
  rateLimitDelayMs: 1500,
};

const STORAGE_KEY = 'telepost_config_v1';

function safeGetStorage(key: string): any {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

function safeSetStorage(key: string, val: any): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(val));
    }
  } catch (e) {}
}

const savedState = safeGetStorage(STORAGE_KEY) || {};

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'studio',
  setActiveTab: tab => set({ activeTab: tab }),

  sidebarCollapsed: false,
  setSidebarCollapsed: collapsed => set({ sidebarCollapsed: collapsed }),

  crawlerRunning: false,
  setCrawlerRunning: running => set({ crawlerRunning: running }),

  post: DEFAULT_POST,
  setPost: newPost =>
    set(state => {
      const updated = typeof newPost === 'function' ? newPost(state.post) : { ...state.post, ...newPost };
      return { post: updated };
    }),
  resetPost: () => set({ post: DEFAULT_POST, activeCatalogIndex: 0 }),

  addEpisode: episode =>
    set(state => {
      const newEp: EpisodeItem = {
        ...episode,
        id: Math.random().toString(36).substring(2, 9),
      };
      return { post: { ...state.post, episodes: [...state.post.episodes, newEp] } };
    }),

  updateEpisode: (id, updates) =>
    set(state => ({
      post: {
        ...state.post,
        episodes: state.post.episodes.map(ep => (ep.id === id ? { ...ep, ...updates } : ep)),
      },
    })),

  removeEpisode: id =>
    set(state => ({
      post: {
        ...state.post,
        episodes: state.post.episodes.filter(ep => ep.id !== id),
      },
    })),

  reorderEpisodes: episodes =>
    set(state => ({
      post: { ...state.post, episodes },
    })),

  clearEpisodes: () =>
    set(state => ({
      post: { ...state.post, episodes: [] },
    })),

  botConfig: savedState.botConfig || {
    botToken: '',
    chatId: '',
    topicId: '',
    verified: false,
    rateLimitDelayMs: 1500,
    autoRetryOn429: true,
    maxRetries: 3,
  },
  setBotConfig: config =>
    set(state => {
      const updated = { ...state.botConfig, ...config };
      safeSetStorage(STORAGE_KEY, { ...safeGetStorage(STORAGE_KEY), botConfig: updated });
      return { botConfig: updated };
    }),

  botModalOpen: false,
  setBotModalOpen: open => set({ botModalOpen: open }),

  templateSettings: savedState.templateSettings || DEFAULT_TEMPLATE,
  setTemplateSettings: settings =>
    set(state => {
      const updated = { ...state.templateSettings, ...settings };
      safeSetStorage(STORAGE_KEY, { ...safeGetStorage(STORAGE_KEY), templateSettings: updated });
      return { templateSettings: updated };
    }),

  bulkEpisodesModalOpen: false,
  setBulkEpisodesModalOpen: open => set({ bulkEpisodesModalOpen: open }),
  dataLibraryModalOpen: false,
  setDataLibraryModalOpen: open => set({ dataLibraryModalOpen: open }),
  autoSaveToLibrary: savedState.autoSaveToLibrary ?? true,
  setAutoSaveToLibrary: enabled => {
    safeSetStorage(STORAGE_KEY, { ...safeGetStorage(STORAGE_KEY), autoSaveToLibrary: enabled });
    set({ autoSaveToLibrary: enabled });
  },
  lastSavedLocation: null,
  setLastSavedLocation: loc => set({ lastSavedLocation: loc }),

  isScraping: false,
  setIsScraping: loading => set({ isScraping: loading }),
  isSending: false,
  setIsSending: loading => set({ isSending: loading }),

  history: savedState.history || [],
  addHistoryItem: item =>
    set(state => {
      const newItem: HistoryItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
      };
      const updated = [newItem, ...state.history].slice(0, 50);
      safeSetStorage(STORAGE_KEY, { ...safeGetStorage(STORAGE_KEY), history: updated });
      return { history: updated };
    }),
  clearHistory: () => {
    safeSetStorage(STORAGE_KEY, { ...safeGetStorage(STORAGE_KEY), history: [] });
    set({ history: [] });
  },
  removeHistoryItem: id =>
    set(state => {
      const updated = state.history.filter(h => h.id !== id);
      safeSetStorage(STORAGE_KEY, { ...safeGetStorage(STORAGE_KEY), history: updated });
      return { history: updated };
    }),

  batchItems: [],
  setBatchItems: items =>
    set(state => ({
      batchItems: typeof items === 'function' ? items(state.batchItems) : items,
    })),
  addBatchUrl: url =>
    set(state => ({
      batchItems: [
        ...state.batchItems,
        {
          id: Math.random().toString(36).substring(2, 9),
          url,
          status: 'pending',
        },
      ],
    })),
  clearBatch: () => set({ batchItems: [] }),

  activeCatalogIndex: 0,
  setActiveCatalogIndex: index => set({ activeCatalogIndex: index }),
  updateCatalogPost: (id, updates) =>
    set(state => {
      if (!state.post.catalogPosts) return state;
      const updatedCatalog = state.post.catalogPosts.map(cp => (cp.id === id ? { ...cp, ...updates } : cp));
      return { post: { ...state.post, catalogPosts: updatedCatalog } };
    }),
}));
