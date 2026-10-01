export interface EpisodeItem {
  id: string;
  label: string;
  url: string;
  quality?: string;
  number?: number;
}

export interface CatalogPostItem {
  id: string;
  title: string;
  thumbnail: string;
  websiteUrl: string;
  url?: string;
  description?: string;
  synopsis?: string;
  galleryImages?: string[];
  status?: string;
  error?: string;
  messageId?: number;
  telegramLink?: string;
  badge?: string;
  year?: string;
  episodes: EpisodeItem[];
}

export interface PostData {
  websiteUrl: string;
  title: string;
  thumbnail: string;
  description: string;
  synopsis?: string;
  galleryImages?: string[];
  siteName: string;
  episodes: EpisodeItem[];
  isCatalog?: boolean;
  catalogCount?: number;
  catalogPosts?: CatalogPostItem[];
}

export type ScrapedPost = PostData;

export interface BotConfig {
  botToken: string;
  chatId: string;
  topicId: string;
  messageThreadId?: string;
  verified: boolean;
  isVerified?: boolean;
  rateLimitDelayMs?: number;
  autoRetryOn429?: boolean;
  maxRetries?: number;
  botInfo?: {
    username?: string;
    firstName?: string;
    id?: number;
  };
  chatInfo?: {
    title?: string;
    username?: string;
    type?: string;
    id?: number | string;
  };
  warning?: string;
}

export interface TemplateSettings {
  captionTemplate: string;
  buttonsLayout: '1-col' | '2-col' | '3-col' | '4-col' | 'none';
  includeTextLinks: boolean;
  includeSynopsis?: boolean;
  sendAsPhoto: boolean;
  sendGalleryAlbum?: boolean;
  maxGalleryImages?: number;
  disableNotification: boolean;
  protectContent: boolean;
  pinMessage: boolean;
  parseMode: 'HTML' | 'MarkdownV2';
  rateLimitDelayMs?: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  title: string;
  thumbnail: string;
  chatId: string;
  chatTitle?: string;
  episodesCount: number;
  status: 'sent' | 'failed' | 'queued';
  messageId?: number;
  telegramLink?: string;
  postData?: PostData;
  error?: string;
  errorMessage?: string;
}

export interface BatchItem {
  id: string;
  url: string;
  status: 'pending' | 'scraping' | 'scraped' | 'sending' | 'sent' | 'failed' | 'ready' | 'idle';
  postData?: PostData;
  error?: string;
  telegramLink?: string;
}

export interface SavedPostFileMeta {
  filename: string;
  slug: string;
  title: string;
  thumbnail: string;
  websiteUrl: string;
  episodeCount: number;
  galleryCount: number;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

export interface FolderMeta {
  name: string;
  path: string;
  count: number;
  max: number;
  isFull: boolean;
  files: SavedPostFileMeta[];
}

export interface LibraryManifest {
  folders: FolderMeta[];
  totalPosts: number;
  totalFolders: number;
}

export interface IndexEntry {
  title: string;
  slug: string;
  folder: string;
  filename: string;
  path: string;
  fullPath: string;
  thumbnail: string;
  websiteUrl: string;
  episodeCount: number;
  galleryCount: number;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

export interface CrawlerConfig {
  baseUrl: string;
  startPage: number;
  endPage: number;
  delayMs: number;
  filterDuplicates: boolean;
  autoSave: boolean;
}

export interface CrawlerLogEntry {
  id?: string;
  timestamp: string;
  level: string;
  message: string;
}

export interface CrawlerStatus {
  state: string;
  currentPage: number;
  startPage: number;
  endPage: number;
  totalPagesProcessed: number;
  totalPostsFound: number;
  totalSaved: number;
  totalSkipped: number;
  totalErrors: number;
  elapsedSeconds: number;
  logs: CrawlerLogEntry[];
  config: CrawlerConfig;
}
