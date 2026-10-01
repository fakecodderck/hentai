# Implementation Plan: Auto Scraper Engine, Collapsible Sidebar & Live Terminal Console

## Overview
Implement an automated multi-page series crawler for `watchhentai.net/series/` that automatically crawls catalog pages (from `startPage` to `endPage`), crawls each series post page to extract complete metadata (title, synopsis, cover, all backdrop gallery screenshots, and episode stream links), automatically saves each post into chunked `/data/hnt1`, `/data/hnt2` folders (10 posts per folder), and skips duplicates.

The UI will feature a collapsible sidebar for navigation and a dedicated **Auto Scrape Engine** panel equipped with a live streaming **Terminal Log Console**, real-time metrics, page range inputs, and Start / Stop / Pause controls.

---

## 1. Collapsible Sidebar & Navigation Architecture

### Layout (`src/components/layout/Sidebar.tsx` & updated `src/App.tsx`)
- Modern responsive sidebar with compact / expanded states.
- Navigation items:
  - 🚀 **Studio Editor** (Single post editing, backdrop gallery, Telegram preview & dispatch)
  - 🤖 **Auto Crawler** (Multi-page series crawler with live terminal console)
  - 📁 **Data Library** (Browse, inspect, and reload `data/hntX` JSON files)
  - ⚡ **Batch Broadcast** (Queue & send to Telegram)
  - 📜 **Sent History**
  - ⚙️ **Bot Setup & Channel Settings**
- Collapsible on desktop, off-canvas drawer on mobile devices.

---

## 2. Server-Side Crawler Engine (`src/server/crawlerService.ts` & `src/server/apiHandler.ts`)

### Crawler Service Capabilities
1. **Multi-Page Pagination Loop:**
   - Starts at `baseUrl` (e.g. `https://watchhentai.net/series/` or `https://watchhentai.net/series/page/{N}/`).
   - Fetches archive catalog HTML and extracts all series post links.
   - For each series post on that page:
     - Checks if post slug or URL already exists in any `data/hntX/` folder.
     - If duplicate: logs `[DUPLICATE SKIPPED]` and moves to next without re-scraping.
     - If new: crawls series page, extracts all details (cover, synopsis, all backdrops, all episodes), and saves to next available `data/hntX` folder.
     - Emits structured log event to SSE stream / memory log buffer.
     - Sleeps for configured delay (`800ms` default).
   - Once all posts on page are complete, advances to `page/{N+1}/` up to `endPage`.
2. **Safety & Control:**
   - Server-side `stopRequested` flag for immediate stop on user command.
   - Pause / Resume state management.
   - Error handling with automatic retry or graceful skip on timeout.

### API Endpoints
- `POST /api/crawler/start`: Starts background crawler task with `{ startPage, endPage, delayMs, filterDuplicates, autoSave }`.
- `POST /api/crawler/stop`: Immediately terminates running crawler.
- `POST /api/crawler/pause` & `POST /api/crawler/resume`: Toggles pause state.
- `GET /api/crawler/status`: Returns current state, active page, active URL, metrics, and terminal logs.
- `GET /api/crawler/events`: Server-Sent Events (SSE) stream for live terminal logging.

---

## 3. Terminal Log Console & Auto Scraper UI (`src/components/crawler/AutoCrawlerView.tsx`)

### UI Components
1. **Crawler Control Bar:**
   - Start Page & End Page inputs (default: Page 1 to 5, or custom range).
   - Delay selector (0.8s default, 1.5s, 3.0s).
   - Toggles: `Filter Duplicates` (Checked), `Auto-Save to data/hntX` (Checked).
   - Buttons: **Start Auto Scrape** (Green gradient), **Stop** (Red), **Pause/Resume** (Amber).
2. **Live Metrics Ribbon:**
   - 📄 Current Page / Target Pages
   - ⚡ Posts Scraped & Saved
   - ⏭️ Duplicates Filtered
   - 📁 Active Folder (e.g. `data/hnt1` [6/10])
   - ⏱️ Elapsed Time & Crawl Speed
3. **Live Terminal Log Console:**
   - Monospace dark CLI terminal emulator.
   - Colorized log messages:
     - `[PAGE 1] Fetching https://watchhentai.net/series/ ...` (Cyan)
     - `[FOUND] 12 series posts on page 1` (Blue)
     - `[SCRAPING] Mahou Shoujo Noble Rose The Animation ...` (Yellow)
     - `[SAVED] -> data/hnt1/mahou-shoujo-noble-rose-the-animation.json (6 backdrops, 2 eps)` (Green)
     - `[DUPLICATE SKIPPED] Series-XYZ already exists in data/hnt1` (Purple/Muted)
     - `[STOPPED] Auto scraper halted by user` (Rose)
   - Terminal actions: Clear Console, Auto-Scroll toggle, Copy All Logs, Download Log `.txt`.

---

## 4. Verification Plan

1. **Test Crawler Engine:**
   - Start crawler with `startPage: 1, endPage: 2, delayMs: 800`.
   - Verify Page 1 extracts series list, fetches each post, and saves into `data/hnt1/`.
   - Verify Page 1 completes and crawler automatically moves to Page 2.
2. **Test Duplicate Filter:**
   - Re-run crawler on Page 1; verify terminal logs `[DUPLICATE SKIPPED]` and does not create duplicate JSON files.
3. **Test Stop / Pause Controls:**
   - Trigger Stop during crawl; verify crawler terminates cleanly within milliseconds.
4. **Test 10-Post Rollover:**
   - Verify posts 1-10 save into `data/hnt1/` and post 11+ automatically rollover into `data/hnt2/`.
5. **Compilation & Linting:**
   - Run `lint_applet` and `compile_applet` to ensure zero build errors.
