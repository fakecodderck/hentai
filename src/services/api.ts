import type { PostData, BotConfig, TemplateSettings, EpisodeItem } from '../types';

export const SAMPLE_POSTS: Array<{ name: string; url: string; data: PostData }> = [
  {
    name: 'Anime: Solo Leveling Season 2 (Batch & Weekly)',
    url: 'https://example-anime.net/series/solo-leveling-arise-s2',
    data: {
      websiteUrl: 'https://example-anime.net/series/solo-leveling-arise-s2',
      title: 'Solo Leveling: Arise from the Shadow [Season 2]',
      thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80',
      description: 'Sung Jinwoo faces off against monarch monarchs as the Hunter Association mobilizes S-Rank guilds worldwide. Subbed & Dubbed in 1080p Ultra HD.',
      siteName: 'AnimeStreamHub',
      episodes: [
        { id: 'ep-1', label: 'Episode 01 [1080p]', url: 'https://t.me/example_channel/101', quality: '1080p', number: 1 },
        { id: 'ep-2', label: 'Episode 02 [1080p]', url: 'https://t.me/example_channel/102', quality: '1080p', number: 2 },
        { id: 'ep-3', label: 'Episode 03 [1080p]', url: 'https://t.me/example_channel/103', quality: '1080p', number: 3 },
        { id: 'ep-4', label: 'Episode 04 [1080p]', url: 'https://t.me/example_channel/104', quality: '1080p', number: 4 },
        { id: 'ep-5', label: 'Episode 05 [1080p]', url: 'https://t.me/example_channel/105', quality: '1080p', number: 5 },
        { id: 'ep-6', label: 'Episode 06 [1080p]', url: 'https://t.me/example_channel/106', quality: '1080p', number: 6 },
        { id: 'ep-7', label: 'Episode 07 [1080p]', url: 'https://t.me/example_channel/107', quality: '1080p', number: 7 },
        { id: 'ep-8', label: 'Episode 08 [1080p]', url: 'https://t.me/example_channel/108', quality: '1080p', number: 8 },
      ],
    },
  },
  {
    name: 'K-Drama: Queen of Tears (Complete Series)',
    url: 'https://kdramaworld.org/drama/queen-of-tears-full',
    data: {
      websiteUrl: 'https://kdramaworld.org/drama/queen-of-tears-full',
      title: 'Queen of Tears (눈물의 여왕) - Complete Series',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80',
      description: 'The queen of department stores and her small-town husband weather a marital crisis until love miraculously begins to bloom again.',
      siteName: 'KDramaWorld',
      episodes: [
        { id: 'ep-1', label: 'Ep 01 [720p]', url: 'https://example.com/stream/ep1', quality: '720p', number: 1 },
        { id: 'ep-2', label: 'Ep 02 [720p]', url: 'https://example.com/stream/ep2', quality: '720p', number: 2 },
        { id: 'ep-3', label: 'Ep 03 [720p]', url: 'https://example.com/stream/ep3', quality: '720p', number: 3 },
        { id: 'ep-4', label: 'Ep 04 [720p]', url: 'https://example.com/stream/ep4', quality: '720p', number: 4 },
        { id: 'ep-5', label: 'Ep 05 [720p]', url: 'https://example.com/stream/ep5', quality: '720p', number: 5 },
        { id: 'ep-6', label: 'Ep 06 [720p]', url: 'https://example.com/stream/ep6', quality: '720p', number: 6 },
      ],
    },
  },
  {
    name: 'Tech Masterclass: Full-Stack React & Node Course',
    url: 'https://codetutorials.io/courses/industrial-react-telegram-bot',
    data: {
      websiteUrl: 'https://codetutorials.io/courses/industrial-react-telegram-bot',
      title: 'Building Automated Media Bots with Node.js & React',
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80',
      description: 'Comprehensive 6-part video course covering Telegram Bot API webhooks, inline keyboards, web scrapers, and cloud deployment.',
      siteName: 'CodeTutorials Hub',
      episodes: [
        { id: 'ep-1', label: 'Part 1: BotFather & Setup', url: 'https://youtu.be/sample1', quality: 'HD', number: 1 },
        { id: 'ep-2', label: 'Part 2: Express Scraper Engine', url: 'https://youtu.be/sample2', quality: 'HD', number: 2 },
        { id: 'ep-3', label: 'Part 3: Inline Keyboard Grids', url: 'https://youtu.be/sample3', quality: 'HD', number: 3 },
        { id: 'ep-4', label: 'Part 4: Channel Publishing & Pin', url: 'https://youtu.be/sample4', quality: 'HD', number: 4 },
      ],
    },
  },
];

export async function scrapeWebsite(url: string): Promise<PostData> {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP error ${res.status}`);
  }

  const data = json.data;
  const episodes: EpisodeItem[] = (data.episodes || []).map((ep: any, index: number) => ({
    id: `ep-${Date.now()}-${index}`,
    label: ep.label || `Episode ${index + 1}`,
    url: ep.url,
    quality: ep.quality,
    number: ep.number ?? index + 1,
  }));

  return {
    websiteUrl: data.url || url,
    title: data.title || 'Untitled Post',
    thumbnail: data.thumbnail || '',
    description: data.description || '',
    synopsis: data.synopsis || data.description || '',
    galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
    siteName: data.siteName || '',
    episodes,
    isCatalog: Boolean(data.isCatalog),
    catalogPosts: Array.isArray(data.catalogPosts)
      ? data.catalogPosts.map((cp: any) => ({
          ...cp,
          galleryImages: cp.galleryImages || (cp.thumbnail ? [cp.thumbnail] : []),
          synopsis: cp.synopsis || cp.description || '',
        }))
      : [],
  };
}

export async function verifyTelegramBot(botToken: string, chatId?: string): Promise<{
  bot: any;
  chat?: any;
  warning?: string;
}> {
  const res = await fetch('/api/telegram/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken, chatId }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Telegram verification failed`);
  }

  return {
    bot: json.bot,
    chat: json.chat,
    warning: json.chatWarning,
  };
}

export interface SendTelegramParams {
  botConfig: BotConfig;
  templateSettings: TemplateSettings;
  postData: PostData;
}

export function formatCaption(
  post: PostData,
  template: string,
  includeTextLinks: boolean,
  includeSynopsis: boolean = false
): string {
  let episodesText = '';
  if (post.episodes && post.episodes.length > 0) {
    if (includeTextLinks) {
      episodesText = post.episodes
        .map(ep => `• <a href="${ep.url}">${escapeHtml(ep.label)}</a>`)
        .join('\n');
    } else {
      episodesText = post.episodes.map(ep => `• ${escapeHtml(ep.label)}`).join('\n');
    }
  } else {
    episodesText = 'No episode links found.';
  }

  // Format actual post link
  const actualPostLink = post.websiteUrl ? `<a href="${post.websiteUrl}">${escapeHtml(post.websiteUrl)}</a>` : '';

  const synopsisVal = includeSynopsis ? (post.synopsis || post.description || '') : '';

  let formatted = template
    .replace(/📝\s*\{description\}/g, escapeHtml(synopsisVal ? `📝 ${synopsisVal}` : ''))
    .replace(/📝\s*\{synopsis\}/g, escapeHtml(synopsisVal ? `📝 ${synopsisVal}` : ''))
    .replace(/\{title\}/g, escapeHtml(post.title || 'Untitled'))
    .replace(/\{description\}/g, escapeHtml(synopsisVal))
    .replace(/\{synopsis\}/g, escapeHtml(synopsisVal))
    .replace(/\{post_url\}/g, actualPostLink)
    .replace(/\{website_url\}/g, actualPostLink)
    .replace(/\{episodes_list\}/g, episodesText)
    .replace(/\{tags\}/g, '')
    .replace(/\{episodes_count\}/g, String(post.episodes?.length || 0));

  // Clean up any extraneous blank lines from removed synopsis or tags
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendPostToTelegram(params: SendTelegramParams): Promise<{
  ok: boolean;
  messageId: number;
  postLink?: string;
  chat?: any;
}> {
  const { botConfig, templateSettings, postData } = params;

  if (!botConfig.botToken) {
    throw new Error('Please configure your Telegram Bot Token');
  }
  if (!botConfig.chatId) {
    throw new Error('Please specify your Target Channel or Group ID (e.g., @mychannel or -100...)');
  }

  const caption = formatCaption(
    postData,
    templateSettings.captionTemplate,
    templateSettings.includeTextLinks,
    templateSettings.includeSynopsis ?? false
  );

  const res = await fetch('/api/telegram/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      botToken: botConfig.botToken,
      chatId: botConfig.chatId,
      messageThreadId: botConfig.topicId ? Number(botConfig.topicId) : undefined,
      thumbnailUrl: templateSettings.sendAsPhoto && postData.thumbnail ? postData.thumbnail : undefined,
      galleryImages: templateSettings.sendGalleryAlbum ? (postData.galleryImages || []) : [],
      sendGalleryAlbum: templateSettings.sendGalleryAlbum,
      maxGalleryImages: templateSettings.maxGalleryImages || 5,
      caption,
      parseMode: templateSettings.parseMode,
      episodes: postData.episodes,
      buttonsLayout: templateSettings.buttonsLayout,
      disableNotification: templateSettings.disableNotification,
      protectContent: templateSettings.protectContent,
      pinMessage: templateSettings.pinMessage,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Telegram sending failed: HTTP ${res.status}`);
  }

  return {
    ok: true,
    messageId: json.messageId,
    postLink: json.postLink,
    chat: json.chat,
  };
}

// Storage API client methods
export async function savePostToLibrary(post: PostData): Promise<{
  folder: string;
  filename: string;
  filePath: string;
  isUpdate: boolean;
  totalInFolder: number;
}> {
  const res = await fetch('/api/storage/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to save post to library');
  }
  return json.data;
}

export async function batchSavePostsToLibrary(posts: PostData[]): Promise<Array<{
  slug: string;
  folder: string;
  filename: string;
  isUpdate: boolean;
}>> {
  const res = await fetch('/api/storage/batch-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to batch save posts');
  }
  return json.data;
}

export async function fetchDataLibrary(): Promise<{
  folders: any[];
  totalPosts: number;
  totalFolders: number;
}> {
  const res = await fetch('/api/storage/library');
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to fetch data library manifest');
  }
  return json.data;
}

export async function loadPostFromFile(folder: string, filename: string): Promise<PostData> {
  const res = await fetch(`/api/storage/file?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`);
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to load post file');
  }
  const data = json.data;
  return {
    websiteUrl: data.websiteUrl || '',
    title: data.title || filename.replace('.json', ''),
    thumbnail: data.thumbnail || '',
    description: data.description || '',
    synopsis: data.synopsis || data.description || '',
    galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : [],
    siteName: data.siteName || '',
    episodes: Array.isArray(data.episodes)
      ? data.episodes.map((ep: any, idx: number) => ({
          id: ep.id || `ep-file-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          label: ep.label || `Episode ${idx + 1}`,
          url: ep.url || '',
          quality: ep.quality,
          number: ep.number ?? idx + 1,
        }))
      : [],
    isCatalog: false,
    catalogPosts: [],
  };
}

export async function deleteFileFromLibrary(folder: string, filename: string): Promise<boolean> {
  const res = await fetch('/api/storage/file', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, filename }),
  });
  const json = await res.json();
  return Boolean(json.ok && json.success);
}

export async function deleteFolderFromLibrary(folder: string): Promise<boolean> {
  const res = await fetch('/api/storage/folder', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  const json = await res.json();
  return Boolean(json.ok && json.success);
}

// Crawler API methods
export async function startCrawlerApi(config: any): Promise<any> {
  const res = await fetch('/api/crawler/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to start auto scraper');
  }
  return json.data;
}

export async function stopCrawlerApi(): Promise<any> {
  const res = await fetch('/api/crawler/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  return json.data;
}

export async function pauseCrawlerApi(): Promise<any> {
  const res = await fetch('/api/crawler/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  return json.data;
}

export async function resumeCrawlerApi(): Promise<any> {
  const res = await fetch('/api/crawler/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  return json.data;
}

export async function fetchCrawlerStatusApi(): Promise<any> {
  const res = await fetch('/api/crawler/status');
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to fetch crawler status');
  }
  return json.data;
}

export async function clearCrawlerLogsApi(): Promise<boolean> {
  const res = await fetch('/api/crawler/clear-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  return Boolean(json.ok);
}

export async function clearWholeLibraryDatabase(): Promise<{ deletedFolders: number; deletedFiles: number }> {
  const res = await fetch('/api/storage/clear-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to clear database');
  }
  return json.data;
}

export async function uploadDataZipToTelegram(payload: {
  botToken: string;
  chatId: string;
  messageThreadId?: string;
  caption?: string;
  rateLimitDelayMs?: number;
  autoRetryOn429?: boolean;
  maxRetries?: number;
}): Promise<any> {
  const res = await fetch('/api/telegram/upload-data-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to upload ZIP archive to Telegram');
  }
  return json.data;
}

export async function fetchMainIndexApi(): Promise<any> {
  const res = await fetch('/data/index.json');
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to fetch main index.json');
  }
  return json.data;
}

export async function reindexDatabaseApi(): Promise<any> {
  const res = await fetch('/api/storage/reindex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to re-index database');
  }
  return json.data;
}


