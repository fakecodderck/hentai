import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import {
  savePostToJson,
  batchSavePosts,
  getDataLibraryManifest,
  getPostFile,
  deletePostFile,
  deleteFolder,
  clearAllLibraryData,
  createDataZipBuffer,
  getMainIndexJson,
  generateMainIndexJson
} from './storageManager';
import { crawlerService } from './crawlerService';


interface ScrapeResult {
  title: string;
  thumbnail: string;
  description: string;
  synopsis?: string;
  galleryImages?: string[];
  siteName: string;
  url: string;
  episodes: Array<{
    label: string;
    url: string;
    quality?: string;
    number?: number;
  }>;
  isCatalog?: boolean;
  catalogCount?: number;
  catalogPosts?: Array<{
    id: string;
    title: string;
    thumbnail: string;
    url: string;
    year?: string;
    badge?: string;
    synopsis?: string;
    galleryImages?: string[];
  }>;
}

// Helper to read JSON body from request
async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Safeguard against huge payloads (5MB max)
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

// Helper to resolve relative URLs to absolute
function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}

function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*[-–—|]\s*(?:Watch\s+Hentai|Watch\s+Online|Stream\s+Online|Free\s+Hentai|English\s+Subbed).*$/i, '')
    .replace(/\s*[-–—|]\s*(?:Watch\s+Free|HD\s+Free|Watch\s+Full).*$/i, '')
    .trim();
}

// Extract posts from catalog / series listing / archive pages
export function extractCatalogPosts(html: string, pageUrl: string): Array<{
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  year?: string;
  badge?: string;
}> {
  // Strip out related widgets / footer suggestions so single posts with related sections are not mistaken for catalogs
  const cleanHtml = html
    .replace(/<div\s+id=["']dt-related["'][\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<section\s+class=["'][^"']*tv-single-related[^"']*["'][\s\S]*?<\/section>/gi, '');

  const posts: Array<{
    id: string;
    title: string;
    thumbnail: string;
    url: string;
    year?: string;
    badge?: string;
  }> = [];
  const seenUrls = new Set<string>();

  // 1. Scan for <article ...> ... </article>
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articleRegex.exec(cleanHtml)) !== null) {
    const artHtml = articleMatch[1];

    // Find main link
    const linkMatch = artHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (!linkMatch) continue;

    const rawUrl = linkMatch[1];
    if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) continue;
    const fullUrl = resolveUrl(rawUrl, pageUrl);

    if (seenUrls.has(fullUrl)) continue;

    // Find Title: check serie+h3, alt, h3, h2
    let title = '';
    const serieMatch = artHtml.match(/class=["'][^"']*serie[^"']*["'][^>]*>([^<]+)<\/span>/i);
    const h3Match = artHtml.match(/<h[2-4][^>]*>(?:<strong>)?(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?(?:<\/strong>)?<\/h[2-4]>/i);
    const altMatch = artHtml.match(/alt=["']([^"']+)["']/i) || artHtml.match(/title=["']([^"']+)["']/i);

    if (serieMatch && h3Match) {
      title = `${cleanTitle(decodeHtmlEntities(stripHtml(serieMatch[1]).trim()))} - ${cleanTitle(decodeHtmlEntities(stripHtml(h3Match[1]).trim()))}`;
    } else if (altMatch && altMatch[1]) {
      title = cleanTitle(decodeHtmlEntities(altMatch[1].trim()));
    } else if (h3Match) {
      title = cleanTitle(decodeHtmlEntities(stripHtml(h3Match[1]).trim()));
    }

    if (!title || title.length < 2 || title.toLowerCase() === 'sponsor' || title.toLowerCase() === 'close') continue;

    // Find Thumbnail Image: check data-src, data-lazy-src, data-original, or src
    let thumbnail = '';
    const dataSrcMatch = artHtml.match(/data-src=["']([^"']+)["']/i) ||
                         artHtml.match(/data-lazy-src=["']([^"']+)["']/i) ||
                         artHtml.match(/data-original=["']([^"']+)["']/i);
    if (dataSrcMatch && !dataSrcMatch[1].startsWith('data:image')) {
      thumbnail = resolveUrl(dataSrcMatch[1], pageUrl);
    } else {
      const srcMatch = artHtml.match(/src=["']([^"']+)["']/i);
      if (srcMatch && !srcMatch[1].startsWith('data:image') && !srcMatch[1].endsWith('.svg')) {
        thumbnail = resolveUrl(srcMatch[1], pageUrl);
      }
    }

    // Find year & badge
    const yearMatch = artHtml.match(/class=["'][^"']*buttonyear[^"']*["'][^>]*>(?:<span[^>]*>)?([^<]+)/i) ||
                      artHtml.match(/\b(19\d\d|20\d\d)\b/);
    const badgeMatch = artHtml.match(/class=["'][^"']*buttoncensured[^"']*["'][^>]*>(?:<span[^>]*>)?([^<]+)/i) ||
                       artHtml.match(/\b(CEN|UNCEN|SUB|DUB|HD|FHD)\b/i);

    seenUrls.add(fullUrl);
    posts.push({
      id: `post-${posts.length + 1}`,
      title,
      thumbnail,
      url: fullUrl,
      year: yearMatch ? yearMatch[1].trim() : undefined,
      badge: badgeMatch ? badgeMatch[1].trim() : undefined,
    });
  }

  // 2. Fallback to <div class="item ..."> or cards if no articles
  if (posts.length === 0) {
    const itemRegex = /<div[^>]*class=["'][^"']*(?:item|card|poster|video-item|film|post-item)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(cleanHtml)) !== null && posts.length < 60) {
      const itHtml = itemMatch[1];
      const lMatch = itHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
      if (!lMatch) continue;
      const fUrl = resolveUrl(lMatch[1], pageUrl);
      if (seenUrls.has(fUrl)) continue;

      const tMatch = itHtml.match(/alt=["']([^"']+)["']/i) || itHtml.match(/title=["']([^"']+)["']/i);
      const title = tMatch ? cleanTitle(decodeHtmlEntities(tMatch[1].trim())) : '';
      if (!title || title.length < 3) continue;

      const imgM = itHtml.match(/data-src=["']([^"']+)["']/i) || itHtml.match(/src=["']([^"']+)["']/i);
      const thumb = imgM && !imgM[1].startsWith('data:image') ? resolveUrl(imgM[1], pageUrl) : '';

      seenUrls.add(fUrl);
      posts.push({
        id: `post-${posts.length + 1}`,
        title,
        thumbnail: thumb,
        url: fUrl,
      });
    }
  }

  return posts.slice(0, 100);
}

// Extract clean metadata and episodes from HTML
export function extractFromHtml(html: string, pageUrl: string): ScrapeResult {
  const result: ScrapeResult = {
    title: '',
    thumbnail: '',
    description: '',
    siteName: '',
    url: pageUrl,
    episodes: [],
  };

  try {
    const parsedBase = new URL(pageUrl);
    result.siteName = parsedBase.hostname.replace(/^www\./, '');
  } catch {
    result.siteName = '';
  }

  // 1. Detect if this is a Single Series/Post page OR a Multi-Post Catalog/Archive
  const isSinglePage = html.includes('single-tvshows') ||
                       html.includes('id="single"') ||
                       html.includes("id='single'") ||
                       html.includes('class="sbox" id="episodes"') ||
                       html.includes("class='sbox' id='episodes'");

  // If this is a Catalog, Archive, or Category page with multiple posts:
  if (!isSinglePage) {
    const catalogPosts = extractCatalogPosts(html, pageUrl);
    if (catalogPosts.length > 1) {
      result.isCatalog = true;
      result.catalogCount = catalogPosts.length;
      result.catalogPosts = catalogPosts;
      result.title = `${catalogPosts.length} Posts from ${result.siteName}`;
      result.thumbnail = catalogPosts[0]?.thumbnail || '';
      result.description = `Multi-post archive with ${catalogPosts.length} posts`;
      result.episodes = [];
      return result;
    }
  }

  // 2. Title Extraction
  const ogTitleMatch = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const twitterTitleMatch = html.match(/<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
  const htmlTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  if (ogTitleMatch && ogTitleMatch[1]) {
    result.title = cleanTitle(decodeHtmlEntities(ogTitleMatch[1].trim()));
  } else if (twitterTitleMatch && twitterTitleMatch[1]) {
    result.title = cleanTitle(decodeHtmlEntities(twitterTitleMatch[1].trim()));
  } else if (h1Match && h1Match[1]) {
    result.title = cleanTitle(decodeHtmlEntities(stripHtml(h1Match[1]).trim()));
  } else if (htmlTitleMatch && htmlTitleMatch[1]) {
    result.title = cleanTitle(decodeHtmlEntities(htmlTitleMatch[1].trim()));
  }

  // 3. Image & Gallery Extraction (og:image, twitter, backdrops, screenshots)
  const galleryImages: string[] = [];
  const seenGalleryUrls = new Set<string>();

  function cleanImageUrl(raw: string): string {
    if (!raw) return '';
    return decodeHtmlEntities(raw).replace(/[\r\n\t\s]/g, '').trim();
  }

  function addGalleryImage(candidateUrl: string | undefined | null) {
    if (!candidateUrl) return;
    const cleaned = cleanImageUrl(candidateUrl);
    if (!cleaned || !cleaned.startsWith('http')) return;
    
    // Ignore icons, avatars, social share badges
    if (
      cleaned.includes('avatar') ||
      cleaned.includes('logo') ||
      cleaned.includes('.svg') ||
      cleaned.includes('sidebar.php') ||
      cleaned.includes('fb.') ||
      cleaned.includes('x.') ||
      cleaned.includes('pin.svg') ||
      cleaned.includes('whatsapp') ||
      cleaned.includes('telegram.svg')
    ) {
      return;
    }

    // Normalize thumbnail suffixes (_thumb.jpg, -150x150.jpg) to full resolution
    const highResUrl = cleaned
      .replace(/_thumb(\.(?:jpe?g|png|webp|avif))/i, '$1')
      .replace(/-\d+x\d+(\.(?:jpe?g|png|webp|avif))/i, '$1');

    const resolved = resolveUrl(highResUrl, pageUrl);
    if (!seenGalleryUrls.has(resolved)) {
      seenGalleryUrls.add(resolved);
      galleryImages.push(resolved);
    }
  }

  // 3a. Scan ALL og:image & twitter:image meta tags in the document (watchhentai lists all backdrops as og:image)
  const allOgMatches = [
    ...html.matchAll(/<meta\s+[^>]*(?:property|name)=["'](?:og:image|twitter:image|image)["'][^>]*content=["']([^"']+)["']/gi),
    ...html.matchAll(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image|image)["']/gi),
    ...html.matchAll(/<meta\s+[^>]*itemprop=["']image["'][^>]*content=["']([^"']+)["']/gi),
  ];

  for (const m of allOgMatches) {
    if (m[1]) {
      addGalleryImage(m[1]);
    }
  }

  // 3b. Determine primary series upload folder prefix if available (e.g. /uploads/2023/7/mahou-shoujo-noble-rose-the-animation/)
  let primaryUploadFolder = '';
  for (const g of galleryImages) {
    const folderMatch = g.match(/(https?:\/\/[^\/]+\/uploads\/(?:\d+\/(?:\d+\/)?)?[^\/]+\/)/i);
    if (folderMatch) {
      primaryUploadFolder = folderMatch[1];
      break;
    }
  }

  // 3c. Scan main content area before sidebars / footers for backdrop / gallery items
  const mainContent = html.split(/id=["']sidebar["']|class=["'][^"']*sidebar|<footer/i)[0] || html;

  // Scan .g-item, .gallery-item, or .galeria
  const gItemRegex = /<(?:div|li|figure|a)[^>]*class=["'][^"']*(?:g-item|gallery-item|screenshot-item|galeria-item)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|li|figure|a)>/gi;
  let gMatch;
  while ((gMatch = gItemRegex.exec(mainContent)) !== null) {
    const itemHtml = gMatch[1];
    const linkM = itemHtml.match(/<a[^>]*href=["']([^"']+\.(?:jpe?g|png|webp|avif)(?:\?[^"']*)?)["']/i);
    const imgM = itemHtml.match(/data-src=["']([^"']+)["']/i) || itemHtml.match(/src=["']([^"']+)["']/i);
    const candidate = linkM ? linkM[1] : (imgM ? imgM[1] : null);
    if (candidate) addGalleryImage(candidate);
  }

  // Scan all image and anchor links in main content
  const allImgLinks = [...mainContent.matchAll(/(?:href|src|data-src|data-lazy-src|data-original)=["'](https?:\/\/[^"'\s>]+\.(?:jpe?g|png|webp|avif)(?:\?[^"'\s>]*)?)["']/gi)];
  for (const m of allImgLinks) {
    const raw = m[1];
    if (primaryUploadFolder && raw.startsWith(primaryUploadFolder)) {
      addGalleryImage(raw);
    } else if (raw.includes('backdrop') || raw.includes('screenshot') || raw.includes('/uploads/')) {
      addGalleryImage(raw);
    }
  }

  // Also check data-backdrops attribute if present
  const backdropsMatch = html.match(/data-backdrops=["'](\[[^"']+\])["']/i);
  if (backdropsMatch) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(backdropsMatch[1]));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') addGalleryImage(item);
        }
      }
    } catch {}
  }

  // Select best cover thumbnail: prefer poster.jpg if found, otherwise first backdrop
  let finalGallery = galleryImages;
  if (primaryUploadFolder) {
    const postSpecific = galleryImages.filter(u => u.startsWith(primaryUploadFolder) || u.includes('backdrop') || u.includes('screenshot'));
    if (postSpecific.length > 0) {
      finalGallery = postSpecific;
    }
  }

  const posterCandidate = finalGallery.find(u => u.toLowerCase().includes('poster.jpg') || u.toLowerCase().includes('cover.jpg'));
  result.thumbnail = posterCandidate || finalGallery[0] || '';
  result.galleryImages = finalGallery.slice(0, 30);

  // 4. Rich Synopsis & Description extraction
  let extractedSynopsis = '';

  // Priority 1: DooPlay / ToroPlay single synopsis body
  const dooplaySynMatch = html.match(/<div[^>]*class=["'][^"']*(?:tv-single-synopsis__body|tv-single-synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (dooplaySynMatch && dooplaySynMatch[1]) {
    extractedSynopsis = stripHtml(dooplaySynMatch[1]);
  }

  // Priority 2: Generic synopsis / description / entry-content containers
  if (!extractedSynopsis || extractedSynopsis.length < 15) {
    const genericSynMatch = html.match(/<(?:div|section|article)[^>]*(?:id|class)=["'][^"']*(?:synopsis|entry-synopsis|post-content|anime-description|storyline|movie-description)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
    if (genericSynMatch && genericSynMatch[1]) {
      extractedSynopsis = stripHtml(genericSynMatch[1]);
    }
  }

  // Priority 3: Heading "Synopsis" or "Storyline" followed by text
  if (!extractedSynopsis || extractedSynopsis.length < 15) {
    const headingSynMatch = html.match(/<h[2-5][^>]*>(?:Synopsis|Storyline|About|Plot|Story)<\/h[2-5]>([\s\S]*?)(?:<h[2-5]|<div class=["']sbox|<footer|$)/i);
    if (headingSynMatch && headingSynMatch[1]) {
      extractedSynopsis = stripHtml(headingSynMatch[1]);
    }
  }

  // Priority 4: Fallback to Meta og:description or description
  const ogDescMatch = html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const metaDesc = (ogDescMatch && ogDescMatch[1]) ? decodeHtmlEntities(ogDescMatch[1].trim()) : '';

  // Clean and format synopsis
  if (extractedSynopsis) {
    extractedSynopsis = decodeHtmlEntities(extractedSynopsis)
      .replace(/^Synopsis\s*[:\-\.]?\s*/i, '')
      .replace(/^Storyline\s*[:\-\.]?\s*/i, '')
      .replace(/^Plot\s*[:\-\.]?\s*/i, '')
      .trim();
  }

  if (extractedSynopsis && extractedSynopsis.length > 20) {
    result.synopsis = extractedSynopsis;
    result.description = extractedSynopsis;
  } else if (metaDesc) {
    result.description = metaDesc;
    result.synopsis = metaDesc;
  }

  // 6. Episode Links Extraction
  // Pattern A: DooPlay / ToroPlay themes (.tv-ep-card-link, .episodios)
  const dooplayRegex = /<a[^>]*class=["'][^"']*(?:tv-ep-card-link|episodios)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const rawEpisodes: Array<{ label: string; url: string; quality?: string; number?: number }> = [];
  const seenUrls = new Set<string>();

  let dpMatch;
  while ((dpMatch = dooplayRegex.exec(html)) !== null) {
    const epHref = dpMatch[1]?.trim();
    const epContent = dpMatch[2] || '';
    if (!epHref || epHref.startsWith('#')) continue;

    const fullHref = resolveUrl(epHref, pageUrl);
    if (seenUrls.has(fullHref)) continue;

    const epTitleMatch = epContent.match(/class=["'][^"']*(?:eptitle|episodiotitle)[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
                         epContent.match(/alt=["']([^"']+)["']/i) ||
                         dpMatch[0].match(/title=["']([^"']+)["']/i);
    let label = epTitleMatch ? decodeHtmlEntities(stripHtml(epTitleMatch[1]).trim()) : '';

    const numMatch = label.match(/\b(?:ep|episode|eps|e)[\s._-]*([0-9]{1,4})\b/i) || fullHref.match(/episode-?([0-9]{1,4})/i);
    const epNumber = numMatch ? parseInt(numMatch[1], 10) : undefined;
    if (!label) {
      label = epNumber ? `Episode ${epNumber}` : `Episode ${rawEpisodes.length + 1}`;
    }

    seenUrls.add(fullHref);
    rawEpisodes.push({
      label,
      url: fullHref,
      number: epNumber,
    });
  }

  // Pattern B: General Link Scan for Episode patterns
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1]?.trim();
    const rawText = stripHtml(match[2] || '').trim();

    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) {
      continue;
    }

    const fullHref = resolveUrl(rawHref, pageUrl);
    if (seenUrls.has(fullHref)) {
      continue;
    }

    const combinedStr = `${rawText} ${rawHref}`;

    const epPattern = /\b(ep|episode|eps|e)[\s._-]*([0-9]{1,4})\b/i;
    const downloadPattern = /\b(download|watch|stream|server\s*\d+|fast|mega|gdrive|drive|torrent|mirror)\b/i;
    const qualityPattern = /\b(360p|480p|720p|1080p|2160p|4k|fhd|hd)\b/i;

    const epMatch = combinedStr.match(epPattern);
    const hasEp = Boolean(epMatch);
    const hasDownload = downloadPattern.test(combinedStr);
    const qualityMatch = combinedStr.match(qualityPattern);

    if (hasEp || (hasDownload && /\b\d+\b/.test(rawText))) {
      let label = rawText || 'Episode Link';
      let epNumber: number | undefined;

      if (epMatch) {
        epNumber = parseInt(epMatch[2], 10);
        if (!rawText || rawText.length < 3 || rawText.length > 50) {
          label = `Episode ${epNumber}`;
        }
      }

      if (label.length > 40) {
        if (epNumber !== undefined) {
          label = `Episode ${epNumber}`;
        } else {
          label = label.slice(0, 37) + '...';
        }
      }

      if (qualityMatch && !label.toLowerCase().includes(qualityMatch[1].toLowerCase())) {
        label = `${label} [${qualityMatch[1].toUpperCase()}]`;
      }

      seenUrls.add(fullHref);
      rawEpisodes.push({
        label,
        url: fullHref,
        quality: qualityMatch ? qualityMatch[1].toUpperCase() : undefined,
        number: epNumber,
      });
    }
  }

  // Sort episodes by episode number if available
  if (rawEpisodes.some(e => e.number !== undefined)) {
    rawEpisodes.sort((a, b) => {
      if (a.number !== undefined && b.number !== undefined) {
        return a.number - b.number;
      }
      return 0;
    });
  }

  result.episodes = rawEpisodes.slice(0, 100);
  return result;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

// Rate Limit Manager for Telegram API
let lastTelegramCallTimestamp = 0;

async function enforceTelegramRateLimit(minDelayMs: number = 1500) {
  const now = Date.now();
  const timeSinceLast = now - lastTelegramCallTimestamp;
  if (timeSinceLast < minDelayMs) {
    const waitMs = minDelayMs - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  lastTelegramCallTimestamp = Date.now();
}

// Telegram API Helper with Rate Limiting & 429 Auto-Retry
async function callTelegramApi(
  botToken: string,
  method: string,
  payload: any,
  options?: { rateLimitDelayMs?: number; autoRetryOn429?: boolean; maxRetries?: number }
) {
  const delayMs = options?.rateLimitDelayMs ?? 1500;
  const autoRetry = options?.autoRetryOn429 ?? true;
  const maxRetries = options?.maxRetries ?? 3;

  const url = `https://api.telegram.org/bot${botToken}/${method}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await enforceTelegramRateLimit(delayMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Handle Telegram Rate Limit 429
      if (!data.ok && data.error_code === 429 && autoRetry && attempt < maxRetries) {
        const retryAfterSec = data.parameters?.retry_after || 3;
        console.warn(`[Telegram RateLimit] 429 Limit Hit on ${method}. Waiting ${retryAfterSec}s (Attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryAfterSec * 1000 + 300));
        continue;
      }

      return data;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { ok: false, error: 'Telegram request failed after rate limit retries' };
}

// Telegram Document Upload Helper with Rate Limiting & 429 Auto-Retry
async function sendTelegramDocument(
  botToken: string,
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string,
  messageThreadId?: string,
  options?: { rateLimitDelayMs?: number; autoRetryOn429?: boolean; maxRetries?: number }
) {
  const delayMs = options?.rateLimitDelayMs ?? 1500;
  const autoRetry = options?.autoRetryOn429 ?? true;
  const maxRetries = options?.maxRetries ?? 3;

  const formData = new FormData();
  formData.append('chat_id', chatId.trim());
  if (caption) formData.append('caption', caption);
  if (messageThreadId) formData.append('message_thread_id', messageThreadId);
  formData.append('parse_mode', 'HTML');

  const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/zip' });
  formData.append('document', fileBlob, filename);

  const url = `https://api.telegram.org/bot${botToken.trim()}/sendDocument`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await enforceTelegramRateLimit(delayMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.ok && data.error_code === 429 && autoRetry && attempt < maxRetries) {
        const retryAfterSec = data.parameters?.retry_after || 5;
        console.warn(`[Telegram RateLimit] Document upload 429 limit. Waiting ${retryAfterSec}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryAfterSec * 1000 + 500));
        continue;
      }

      return data;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { ok: false, error: 'Telegram document upload failed after retries' };
}

// Helper to fetch HTML with realistic headers
export async function fetchPageHtml(targetUrl: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const fetchResp = await fetch(targetUrl, {
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TelePost/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  clearTimeout(timeout);

  if (!fetchResp.ok) {
    throw new Error(`HTTP ${fetchResp.status}: ${fetchResp.statusText}`);
  }

  return await fetchResp.text();
}

// Main API Handler router
export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return true;
  }

  // 0. Image Proxy Endpoint (Bypasses hotlinking protection and CORS issues)
  if (url.startsWith('/api/proxy-image') && req.method === 'GET') {
    try {
      const parsedUrl = new URL(url, 'http://localhost:3000');
      const targetImgUrl = parsedUrl.searchParams.get('url');

      if (!targetImgUrl || !targetImgUrl.startsWith('http')) {
        res.statusCode = 400;
        res.end('Valid image URL is required');
        return true;
      }

      let refererUrl = '';
      try {
        const u = new URL(targetImgUrl);
        refererUrl = `${u.protocol}//${u.host}/`;
      } catch {}

      const imgResp = await fetch(targetImgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': refererUrl || targetImgUrl,
        },
      });

      if (!imgResp.ok) {
        res.statusCode = imgResp.status;
        res.end(`Image fetch failed: ${imgResp.statusText}`);
        return true;
      }

      const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await imgResp.arrayBuffer();

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(Buffer.from(arrayBuf));
      return true;
    } catch (err: any) {
      res.statusCode = 500;
      res.end(`Proxy error: ${err.message}`);
      return true;
    }
  }

  // 1. Scrape Website Post or Catalog Endpoint
  if (url.startsWith('/api/scrape') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const targetUrl = body.url?.trim();

      if (!targetUrl) {
        sendJson(res, 400, { ok: false, error: 'URL is required' });
        return true;
      }

      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Only HTTP/HTTPS URLs are supported');
        }
      } catch (err: any) {
        sendJson(res, 400, { ok: false, error: `Invalid URL format: ${err.message}` });
        return true;
      }

      const html = await fetchPageHtml(targetUrl, 14000);
      const extracted = extractFromHtml(html, targetUrl);

      // If page is a catalog with multiple series and 0 direct episode links on the archive page itself:
      // Auto-crawl the first series so the user immediately gets a full post draft with cover, synopsis and episode links!
      if (extracted.isCatalog && extracted.catalogPosts && extracted.catalogPosts.length > 0 && extracted.episodes.length === 0) {
        try {
          const firstSeries = extracted.catalogPosts[0];
          const firstHtml = await fetchPageHtml(firstSeries.url, 8000);
          const firstExtracted = extractFromHtml(firstHtml, firstSeries.url);

          extracted.title = firstExtracted.title || firstSeries.title;
          extracted.thumbnail = firstExtracted.thumbnail || firstSeries.thumbnail;
          extracted.description = firstExtracted.description || `Episodes from ${firstSeries.title}`;
          extracted.synopsis = firstExtracted.synopsis || firstExtracted.description;
          extracted.galleryImages = firstExtracted.galleryImages || [];
          extracted.episodes = firstExtracted.episodes;
        } catch {
          // If first series fetch fails, use catalog metadata
          const firstSeries = extracted.catalogPosts[0];
          extracted.title = firstSeries.title;
          extracted.thumbnail = firstSeries.thumbnail;
        }
      }

      // If user provided a title or custom fallback
      if (!extracted.title) {
        extracted.title = parsedUrl.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Untitled Post';
      }

      // Auto-save scraped post into codebase data/hntX/ structure if autoSave enabled
      let storageLocation: any = null;
      if (body.autoSave !== false && extracted.title && (extracted.episodes.length > 0 || extracted.description || extracted.thumbnail)) {
        try {
          storageLocation = await savePostToJson(extracted);
        } catch (err: any) {
          console.warn('[Storage] Auto-save warning:', err.message);
        }
      }

      sendJson(res, 200, {
        ok: true,
        data: extracted,
        storageLocation,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, {
        ok: false,
        error: err.name === 'AbortError' ? 'Website request timed out' : (err.message || 'Scrape failed'),
      });
      return true;
    }
  }

  // 2. Telegram Bot & Chat Verification Endpoint
  if (url.startsWith('/api/telegram/verify') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { botToken, chatId } = body;

      if (!botToken || !botToken.trim()) {
        sendJson(res, 400, { ok: false, error: 'Telegram Bot Token is required' });
        return true;
      }

      const meData = await callTelegramApi(botToken.trim(), 'getMe', {});
      if (!meData.ok) {
        sendJson(res, 400, {
          ok: false,
          error: `Bot verification failed: ${meData.description || 'Invalid token'}`,
        });
        return true;
      }

      let chatInfo: any = null;
      if (chatId && chatId.trim()) {
        const chatData = await callTelegramApi(botToken.trim(), 'getChat', { chat_id: chatId.trim() });
        if (chatData.ok) {
          chatInfo = {
            id: chatData.result.id,
            title: chatData.result.title || chatData.result.username || 'Direct Chat',
            type: chatData.result.type,
            username: chatData.result.username ? `@${chatData.result.username}` : undefined,
          };
        } else {
          sendJson(res, 200, {
            ok: true,
            bot: meData.result,
            chatWarning: `Bot is valid, but could not access chat: ${chatData.description}. Ensure the bot is added as an administrator to the channel/group.`,
          });
          return true;
        }
      }

      sendJson(res, 200, {
        ok: true,
        bot: meData.result,
        chat: chatInfo,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Telegram verification failed' });
      return true;
    }
  }

  // 3. Telegram Post Sender Endpoint
  if (url.startsWith('/api/telegram/send') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const {
        botToken,
        chatId,
        messageThreadId,
        thumbnailUrl,
        galleryImages = [],
        sendGalleryAlbum = false,
        maxGalleryImages = 5,
        caption,
        parseMode = 'HTML',
        episodes = [],
        buttonsLayout = '2-col',
        disableNotification = false,
        protectContent = false,
        pinMessage = false,
      } = body;

      if (!botToken || !chatId) {
        sendJson(res, 400, { ok: false, error: 'Both botToken and chatId are required' });
        return true;
      }

      let replyMarkup: any = undefined;
      const validEpisodes = episodes.filter((ep: any) => ep && ep.label && ep.url && (ep.url.startsWith('http://') || ep.url.startsWith('https://') || ep.url.startsWith('tg://')));

      if (buttonsLayout !== 'none' && validEpisodes.length > 0) {
        let cols = 2;
        if (buttonsLayout === '1-col') cols = 1;
        if (buttonsLayout === '3-col') cols = 3;
        if (buttonsLayout === '4-col') cols = 4;

        const keyboard: Array<Array<{ text: string; url: string }>> = [];
        for (let i = 0; i < validEpisodes.length; i += cols) {
          const row = validEpisodes.slice(i, i + cols).map((ep: any) => ({
            text: ep.label.trim(),
            url: ep.url.trim(),
          }));
          keyboard.push(row);
        }
        replyMarkup = { inline_keyboard: keyboard };
      }

      let sendResult: any;

      // Check if user wants to upload as a Photo Gallery Album (Telegram sendMediaGroup)
      const validGallery = Array.isArray(galleryImages) ? galleryImages.filter((u: string) => u && u.startsWith('http')) : [];
      const shouldSendAlbum = sendGalleryAlbum && (validGallery.length > 0 || (thumbnailUrl && validGallery.length > 0));

      if (shouldSendAlbum) {
        // Build album photos: cover first, then screenshots
        const allAlbumUrls: string[] = [];
        if (thumbnailUrl && thumbnailUrl.startsWith('http')) {
          allAlbumUrls.push(thumbnailUrl);
        }
        for (const gUrl of validGallery) {
          if (!allAlbumUrls.includes(gUrl)) {
            allAlbumUrls.push(gUrl);
          }
        }

        const selectedPhotos = allAlbumUrls.slice(0, Math.min(10, Math.max(2, maxGalleryImages || 5)));

        if (selectedPhotos.length >= 2) {
          const mediaGroupPayload: any = {
            chat_id: chatId.trim(),
            media: selectedPhotos.map((photoUrl, idx) => ({
              type: 'photo',
              media: photoUrl,
              caption: idx === 0 ? (caption || '') : undefined,
              parse_mode: idx === 0 ? parseMode : undefined,
            })),
            disable_notification: Boolean(disableNotification),
            protect_content: Boolean(protectContent),
          };
          if (messageThreadId) {
            mediaGroupPayload.message_thread_id = Number(messageThreadId);
          }

          sendResult = await callTelegramApi(botToken.trim(), 'sendMediaGroup', mediaGroupPayload);

          // If MediaGroup succeeded and we have inline episode buttons, send buttons in follow-up message
          if (sendResult.ok && replyMarkup) {
            const btnPayload: any = {
              chat_id: chatId.trim(),
              text: `🎬 <b>Stream / Download Episodes:</b>`,
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
              disable_notification: Boolean(disableNotification),
              protect_content: Boolean(protectContent),
            };
            if (messageThreadId) btnPayload.message_thread_id = Number(messageThreadId);
            await callTelegramApi(botToken.trim(), 'sendMessage', btnPayload);
          }
        }
      }

      // If not sent as album or album failed, send as single photo cover with buttons
      if (!sendResult || !sendResult.ok) {
        if (thumbnailUrl && thumbnailUrl.trim() && (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'))) {
          const photoPayload: any = {
            chat_id: chatId.trim(),
            photo: thumbnailUrl.trim(),
            caption: caption || '',
            parse_mode: parseMode,
            disable_notification: Boolean(disableNotification),
            protect_content: Boolean(protectContent),
          };
          if (messageThreadId) {
            photoPayload.message_thread_id = Number(messageThreadId);
          }
          if (replyMarkup) {
            photoPayload.reply_markup = replyMarkup;
          }

          sendResult = await callTelegramApi(botToken.trim(), 'sendPhoto', photoPayload);

          // Fallback: If sendPhoto failed due to URL download restriction, send as text message
          if (!sendResult.ok && sendResult.description && (sendResult.description.includes('wrong file identifier') || sendResult.description.includes('failed to get HTTP URL content') || sendResult.description.includes('PHOTO_INVALID_DIMENSIONS'))) {
            const textPayload: any = {
              chat_id: chatId.trim(),
              text: `${caption}\n\n🖼 <b>Thumbnail:</b> <a href="${thumbnailUrl.trim()}">View Cover Image</a>`,
              parse_mode: parseMode,
              disable_notification: Boolean(disableNotification),
              protect_content: Boolean(protectContent),
            };
            if (messageThreadId) textPayload.message_thread_id = Number(messageThreadId);
            if (replyMarkup) textPayload.reply_markup = replyMarkup;

            sendResult = await callTelegramApi(botToken.trim(), 'sendMessage', textPayload);
          }
        } else {
          const textPayload: any = {
            chat_id: chatId.trim(),
            text: caption || 'Empty Post',
            parse_mode: parseMode,
            disable_notification: Boolean(disableNotification),
            protect_content: Boolean(protectContent),
          };
          if (messageThreadId) textPayload.message_thread_id = Number(messageThreadId);
          if (replyMarkup) textPayload.reply_markup = replyMarkup;

          sendResult = await callTelegramApi(botToken.trim(), 'sendMessage', textPayload);
        }
      }

      if (!sendResult.ok) {
        sendJson(res, 400, {
          ok: false,
          error: sendResult.description || 'Telegram API rejected the request',
          details: sendResult,
        });
        return true;
      }

      const messageId = sendResult.result?.message_id;

      if (pinMessage && messageId) {
        try {
          await callTelegramApi(botToken.trim(), 'pinChatMessage', {
            chat_id: chatId.trim(),
            message_id: messageId,
            disable_notification: Boolean(disableNotification),
          });
        } catch {}
      }

      let postLink: string | undefined;
      const chatUsername = sendResult.result?.chat?.username;
      if (chatUsername && messageId) {
        postLink = `https://t.me/${chatUsername}/${messageId}`;
      } else if (chatId.startsWith('@') && messageId) {
        postLink = `https://t.me/${chatId.replace('@', '')}/${messageId}`;
      }

      sendJson(res, 200, {
        ok: true,
        messageId,
        postLink,
        date: sendResult.result?.date,
        chat: sendResult.result?.chat,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to dispatch Telegram message' });
      return true;
    }
  }

  // 4. AI-Powered Smart Extractor
  if (url.startsWith('/api/ai/parse') && req.method === 'POST') {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendJson(res, 400, { ok: false, error: 'GEMINI_API_KEY is not configured in server environment' });
        return true;
      }

      const body = await parseJsonBody(req);
      const { rawHtml, rawText, url: siteUrl } = body;

      if (!rawHtml && !rawText) {
        sendJson(res, 400, { ok: false, error: 'Content is required for AI parsing' });
        return true;
      }

      const ai = new GoogleGenAI();
      const prompt = `You are an expert web scraper for media, anime, dramas, and movie series websites.
Extract the post's core information from this content:
Page URL: ${siteUrl || 'unknown'}

Content snippet:
${(rawHtml || rawText).slice(0, 15000)}

Return ONLY valid JSON matching this schema:
{
  "title": "Clean series / movie / episode post title",
  "thumbnail": "Direct image URL if found, or empty string",
  "description": "Short synopsis or summary (1-2 sentences)",
  "episodes": [
    {
      "label": "Episode 1" or "Ep 01 [720p]",
      "url": "https://full-download-or-stream-url",
      "quality": "720p" or "1080p" (optional)
    }
  ]
}`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = aiResponse.text || '{}';
      const parsed = JSON.parse(text);
      sendJson(res, 200, { ok: true, data: parsed });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'AI parsing failed' });
      return true;
    }
  }

  // 5. Storage & Codebase Data Library Endpoints
  // Save single post to /data/hntX/
  if (url.startsWith('/api/storage/save') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const post = body.post || body;
      if (!post || (!post.title && !post.url && !post.websiteUrl)) {
        sendJson(res, 400, { ok: false, error: 'Valid post data is required to save' });
        return true;
      }
      const savedInfo = await savePostToJson(post);
      sendJson(res, 200, { ok: true, data: savedInfo });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to save post to storage' });
      return true;
    }
  }

  // Batch save multiple posts to /data/hntX/
  if (url.startsWith('/api/storage/batch-save') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const posts = body.posts || [];
      if (!Array.isArray(posts) || posts.length === 0) {
        sendJson(res, 400, { ok: false, error: 'Array of posts required' });
        return true;
      }
      const savedList = await batchSavePosts(posts);
      sendJson(res, 200, { ok: true, data: savedList });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to batch save posts' });
      return true;
    }
  }

  // Fetch library manifest (all hnt folders, file counts, and post summaries)
  if (url.startsWith('/api/storage/library') && req.method === 'GET') {
    try {
      const manifest = getDataLibraryManifest();
      sendJson(res, 200, { ok: true, data: manifest });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to fetch library manifest' });
      return true;
    }
  }

  // Fetch Main Index JSON (data/index.json listing all post locations)
  if ((url === '/data/index.json' || url.startsWith('/api/storage/index')) && req.method === 'GET') {
    try {
      const indexData = getMainIndexJson();
      sendJson(res, 200, { ok: true, data: indexData });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to fetch main index' });
      return true;
    }
  }

  // Force Re-Index All Files in Database
  if (url.startsWith('/api/storage/reindex') && req.method === 'POST') {
    try {
      const indexData = generateMainIndexJson();
      sendJson(res, 200, { ok: true, data: indexData });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to re-index database files' });
      return true;
    }
  }

  // Get single post file content
  if (url.startsWith('/api/storage/file') && req.method === 'GET') {
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const folder = parsedUrl.searchParams.get('folder');
      const filename = parsedUrl.searchParams.get('filename');

      if (!folder || !filename) {
        sendJson(res, 400, { ok: false, error: 'Folder and filename are required' });
        return true;
      }

      const postData = getPostFile(folder, filename);
      if (!postData) {
        sendJson(res, 404, { ok: false, error: 'File not found in storage' });
        return true;
      }

      sendJson(res, 200, { ok: true, data: postData });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to load post file' });
      return true;
    }
  }

  // Delete post file from storage
  if (url.startsWith('/api/storage/file') && req.method === 'DELETE') {
    try {
      const body = await parseJsonBody(req);
      const { folder, filename } = body;
      if (!folder || !filename) {
        sendJson(res, 400, { ok: false, error: 'Folder and filename required' });
        return true;
      }
      const success = deletePostFile(folder, filename);
      sendJson(res, 200, { ok: true, success });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to delete file' });
      return true;
    }
  }

  // Delete folder from storage
  if (url.startsWith('/api/storage/folder') && req.method === 'DELETE') {
    try {
      const body = await parseJsonBody(req);
      const { folder } = body;
      if (!folder) {
        sendJson(res, 400, { ok: false, error: 'Folder name required' });
        return true;
      }
      const success = deleteFolder(folder);
      sendJson(res, 200, { ok: true, success });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to delete folder' });
      return true;
    }
  }

  // Clear all data/hnt* folders
  if (url.startsWith('/api/storage/clear-all') && (req.method === 'POST' || req.method === 'DELETE')) {
    try {
      const result = clearAllLibraryData();
      sendJson(res, 200, { ok: true, data: result });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to clear database' });
      return true;
    }
  }

  // Download entire /data directory as ZIP
  if (url.startsWith('/api/storage/export-zip') && req.method === 'GET') {
    try {
      const zipBuffer = createDataZipBuffer();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `codebase-data-backup-${dateStr}.zip`;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.end(zipBuffer);
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to generate ZIP export' });
      return true;
    }
  }

  // Upload entire /data directory ZIP to Telegram as a document
  if (url.startsWith('/api/telegram/upload-data-zip') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { botToken, chatId, messageThreadId, caption: customCaption, rateLimitDelayMs, autoRetryOn429, maxRetries } = body;

      if (!botToken || !chatId) {
        sendJson(res, 400, { ok: false, error: 'Both botToken and chatId are required' });
        return true;
      }

      const zipBuffer = createDataZipBuffer();
      const manifest = getDataLibraryManifest();
      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const filename = `data-backup-${new Date().toISOString().split('T')[0]}.zip`;

      const caption = customCaption ||
        `📦 <b>Data Library Backup Archive</b>\n\n📁 <b>Path:</b> <code>/data</code>\n📊 <b>Total Posts:</b> ${manifest.totalPosts}\n📂 <b>Folders:</b> ${manifest.totalFolders} hnt folders\n📅 <b>Exported:</b> <code>${dateStr}</code>`;

      const result = await sendTelegramDocument(
        botToken,
        chatId,
        zipBuffer,
        filename,
        caption,
        messageThreadId,
        {
          rateLimitDelayMs: Number(rateLimitDelayMs) || 1500,
          autoRetryOn429: autoRetryOn429 !== false,
          maxRetries: Number(maxRetries) || 3
        }
      );

      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.description || 'Failed to send ZIP to Telegram' });
        return true;
      }

      sendJson(res, 200, { ok: true, data: result.result });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to upload ZIP to Telegram' });
      return true;
    }
  }

  // 6. Auto-Scraper / Crawler Endpoints
  // Start Crawler
  if (url.startsWith('/api/crawler/start') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const status = await crawlerService.start(body);
      sendJson(res, 200, { ok: true, data: status });
      return true;
    } catch (err: any) {
      sendJson(res, 400, { ok: false, error: err.message || 'Failed to start crawler' });
      return true;
    }
  }

  // Stop Crawler
  if (url.startsWith('/api/crawler/stop') && req.method === 'POST') {
    try {
      const status = crawlerService.stop();
      sendJson(res, 200, { ok: true, data: status });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to stop crawler' });
      return true;
    }
  }

  // Pause Crawler
  if (url.startsWith('/api/crawler/pause') && req.method === 'POST') {
    try {
      const status = crawlerService.pause();
      sendJson(res, 200, { ok: true, data: status });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to pause crawler' });
      return true;
    }
  }

  // Resume Crawler
  if (url.startsWith('/api/crawler/resume') && req.method === 'POST') {
    try {
      const status = crawlerService.resume();
      sendJson(res, 200, { ok: true, data: status });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to resume crawler' });
      return true;
    }
  }

  // Get Crawler Status & Logs
  if (url.startsWith('/api/crawler/status') && req.method === 'GET') {
    try {
      const status = crawlerService.getStatus();
      sendJson(res, 200, { ok: true, data: status });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to fetch crawler status' });
      return true;
    }
  }

  // Clear Crawler Logs
  if (url.startsWith('/api/crawler/clear-logs') && req.method === 'POST') {
    try {
      crawlerService.clearLogs();
      sendJson(res, 200, { ok: true });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message || 'Failed to clear logs' });
      return true;
    }
  }

  // SSE Stream for Live Terminal Console
  if (url.startsWith('/api/crawler/events') && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial status
    const initialStatus = crawlerService.getStatus();
    res.write(`data: ${JSON.stringify({ type: 'init', status: initialStatus })}\n\n`);

    const logListener = (entry: any) => {
      res.write(`data: ${JSON.stringify({ type: 'log', entry })}\n\n`);
    };

    const statusListener = (status: any) => {
      res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
    };

    crawlerService.on('log', logListener);
    crawlerService.on('status', statusListener);

    // Keep connection alive with heartbeat comment every 15s
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      crawlerService.off('log', logListener);
      crawlerService.off('status', statusListener);
    });

    return true;
  }

  return false;
}
