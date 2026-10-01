import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import type { ScrapedPost, EpisodeItem, CatalogPostItem, CrawlerStatus, CrawlerLogEntry, CrawlerConfig } from '../types';
import { savePostToJson, getMainIndexJson } from './storageManager';
import { extractCatalogPosts } from './apiHandler';
import type { ServerResponse } from 'http';
import { EventEmitter } from 'events';

export function getPageUrl(baseUrl: string, pageNum: number): string {
  const clean = baseUrl.trim().replace(/\/page\/\d+\/?$/i, '').replace(/\/$/, '');
  if (pageNum === 1) {
    return `${clean}/`;
  }
  return `${clean}/page/${pageNum}/`;
}

export async function scrapeWebsitePage(targetUrl: string): Promise<ScrapedPost> {
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Target website returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract catalog post links if this is a listing page
  const catalogPosts = extractCatalogPosts(html, targetUrl);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1.entry-title').text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Scraped Post';

  const thumbnail =
    $('meta[property="og:image"]').attr('content') ||
    $('div.poster img').attr('src') ||
    $('article img').first().attr('src') ||
    '';

  const synopsis =
    $('meta[property="og:description"]').attr('content') ||
    $('div.entry-content p').first().text().trim() ||
    '';

  const siteName = $('meta[property="og:site_name"]').attr('content') || (function() {
    try { return new URL(targetUrl).hostname; } catch { return 'Website'; }
  })();

  // Extract Gallery Backdrop Images
  const galleryImages: string[] = [];
  $('div.gallery-item img, div.entry-content img, article img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !galleryImages.includes(src) && src !== thumbnail) {
      galleryImages.push(src);
    }
  });

  // Extract Episode Streams & Download Links
  const episodes: EpisodeItem[] = [];
  $('a[href*="download"], a[href*="stream"], div.episodelist ul li a, ul.episodes-list a, .episode-link a').each((idx, el) => {
    const href = $(el).attr('href');
    const label = $(el).text().trim() || `Episode ${idx + 1}`;
    if (href && href.startsWith('http')) {
      episodes.push({
        id: `ep-${idx + 1}`,
        label,
        url: href,
        number: idx + 1,
      });
    }
  });

  const isCatalog = catalogPosts.length > 0;

  return {
    websiteUrl: targetUrl,
    title,
    thumbnail,
    description: synopsis,
    synopsis,
    galleryImages: galleryImages.slice(0, 8),
    siteName,
    episodes,
    isCatalog,
    catalogCount: catalogPosts.length,
    catalogPosts: catalogPosts.map(cp => ({
      ...cp,
      websiteUrl: cp.url,
      episodes: [],
    })),
  };
}

class CrawlerEngine extends EventEmitter {
  private status: CrawlerStatus = {
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
  };

  private isPaused = false;
  private isStopped = true;
  private timer: NodeJS.Timeout | null = null;
  private sseClients: ServerResponse[] = [];

  public getStatus(): CrawlerStatus {
    return { ...this.status };
  }

  public addClient(res: ServerResponse) {
    this.sseClients.push(res);
  }

  public removeClient(res: ServerResponse) {
    this.sseClients = this.sseClients.filter(c => c !== res);
  }

  private broadcast(type: string, payload: any) {
    if (type === 'log') {
      this.emit('log', payload.entry);
    } else if (type === 'status') {
      this.emit('status', payload.status);
    }
    const data = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
    this.sseClients.forEach(res => {
      try {
        res.write(data);
      } catch (e) {}
    });
  }

  public log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
    const entry: CrawlerLogEntry = {
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      level,
      message,
    };
    this.status.logs = [...this.status.logs, entry].slice(-500);
    this.broadcast('log', { entry });
  }

  public clearLogs() {
    this.status.logs = [];
    this.broadcast('status', { status: this.getStatus() });
  }

  public async start(config: Partial<CrawlerConfig>): Promise<CrawlerStatus> {
    this.status.config = { ...this.status.config, ...config };
    this.status.state = 'running';
    this.status.currentPage = this.status.config.startPage;
    this.status.startPage = this.status.config.startPage;
    this.status.endPage = this.status.config.endPage;
    this.status.totalPagesProcessed = 0;
    this.status.totalPostsFound = 0;
    this.status.totalSaved = 0;
    this.status.totalSkipped = 0;
    this.status.totalErrors = 0;
    this.status.elapsedSeconds = 0;

    this.isPaused = false;
    this.isStopped = false;

    this.log('info', `Crawler initialized for ${this.status.config.baseUrl}`);
    this.log('info', `Pages ${this.status.config.startPage} to ${this.status.config.endPage} queued with ${this.status.config.delayMs}ms delay`);

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.status.state === 'running') {
        this.status.elapsedSeconds += 1;
        this.broadcast('status', { status: this.getStatus() });
      }
    }, 1000);

    this.runCrawlLoop();
    return this.getStatus();
  }

  private async runCrawlLoop() {
    const savedIndex = getMainIndexJson();
    const existingUrls = new Set<string>();
    if (Array.isArray(savedIndex)) {
      savedIndex.forEach(item => {
        if (item.websiteUrl) existingUrls.add(item.websiteUrl.toLowerCase().replace(/\/$/, ''));
      });
    }

    for (let page = this.status.startPage; page <= this.status.endPage; page++) {
      if (this.isStopped) break;

      while (this.isPaused) {
        await new Promise(r => setTimeout(r, 500));
        if (this.isStopped) break;
      }
      if (this.isStopped) break;

      this.status.currentPage = page;
      const pageUrl = getPageUrl(this.status.config.baseUrl, page);
      this.log('info', `Scraping page ${page} of ${this.status.endPage} (${pageUrl})...`);

      try {
        const pageData = await scrapeWebsitePage(pageUrl);

        if (pageData.isCatalog && pageData.catalogPosts && pageData.catalogPosts.length > 0) {
          this.log('info', `Found ${pageData.catalogPosts.length} series posts on page ${page}`);

          for (let i = 0; i < pageData.catalogPosts.length; i++) {
            if (this.isStopped) break;
            while (this.isPaused) {
              await new Promise(r => setTimeout(r, 500));
              if (this.isStopped) break;
            }
            if (this.isStopped) break;

            const postCard = pageData.catalogPosts[i];
            const cleanPostUrl = postCard.url.toLowerCase().replace(/\/$/, '');

            // Duplicate filter check
            if (this.status.config.filterDuplicates && existingUrls.has(cleanPostUrl)) {
              this.status.totalSkipped += 1;
              this.log('warn', `Skipped duplicate [${i + 1}/${pageData.catalogPosts.length}]: "${postCard.title}"`);
              continue;
            }

            try {
              this.log('info', `Fetching series [${i + 1}/${pageData.catalogPosts.length}]: "${postCard.title}"...`);
              const singlePost = await scrapeWebsitePage(postCard.url);

              this.status.totalPostsFound += 1;
              if (this.status.config.autoSave) {
                await savePostToJson(singlePost);
                existingUrls.add(cleanPostUrl);
                this.status.totalSaved += 1;
                this.log('success', `Saved series post [${i + 1}/${pageData.catalogPosts.length}]: "${singlePost.title}" (${singlePost.episodes.length} episodes)`);
              }
            } catch (postErr: any) {
              this.status.totalErrors += 1;
              this.log('error', `Error fetching post "${postCard.title}": ${postErr.message}`);
            }

            this.broadcast('status', { status: this.getStatus() });
            await new Promise(r => setTimeout(r, Math.max(300, Math.floor(this.status.config.delayMs / 2))));
          }
        } else if (pageData.title) {
          // Single post page
          const cleanPostUrl = pageUrl.toLowerCase().replace(/\/$/, '');
          if (this.status.config.filterDuplicates && existingUrls.has(cleanPostUrl)) {
            this.status.totalSkipped += 1;
            this.log('warn', `Skipped duplicate post: "${pageData.title}"`);
          } else {
            this.status.totalPostsFound += 1;
            if (this.status.config.autoSave) {
              await savePostToJson(pageData);
              existingUrls.add(cleanPostUrl);
              this.status.totalSaved += 1;
              this.log('success', `Saved single post: "${pageData.title}" (${pageData.episodes.length} episodes)`);
            }
          }
        }

        this.status.totalPagesProcessed += 1;
      } catch (err: any) {
        this.status.totalErrors += 1;
        this.log('error', `Error scraping page ${page}: ${err.message}`);
      }

      this.broadcast('status', { status: this.getStatus() });
      await new Promise(r => setTimeout(r, this.status.config.delayMs));
    }

    this.status.state = 'idle';
    this.isStopped = true;
    if (this.timer) clearInterval(this.timer);
    this.log('info', `Auto scrape cycle finished. Total saved: ${this.status.totalSaved}, Skipped: ${this.status.totalSkipped}`);
    this.broadcast('status', { status: this.getStatus() });
  }

  public async pause(): Promise<CrawlerStatus> {
    this.isPaused = true;
    this.status.state = 'paused';
    this.log('warn', 'Crawler paused');
    this.broadcast('status', { status: this.getStatus() });
    return this.getStatus();
  }

  public async resume(): Promise<CrawlerStatus> {
    this.isPaused = false;
    this.status.state = 'running';
    this.log('info', 'Crawler resumed');
    this.broadcast('status', { status: this.getStatus() });
    return this.getStatus();
  }

  public async stop(): Promise<CrawlerStatus> {
    this.isStopped = true;
    this.isPaused = false;
    this.status.state = 'idle';
    if (this.timer) clearInterval(this.timer);
    this.log('warn', 'Crawler stopped by user');
    this.broadcast('status', { status: this.getStatus() });
    return this.getStatus();
  }
}

export const crawlerService = new CrawlerEngine();
