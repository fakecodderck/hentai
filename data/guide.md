# 📦 AI Agent Guide: Database Structure & Processing Instructions

This database repository is structured for fast, deterministic consumption by **AI Agents**, **LLM Pipelines**, **Telegram Bots**, and **Scraper Services**.

---

## 📂 1. Directory Architecture

When unzipping the exported `codebase-data-backup.zip` file or inspecting the `/data` directory, you will see the following organization:

```text
data/
├── index.json        <-- ⚡ PRIMARY ENTRY POINT (Auto-indexed master directory)
├── guide.md          <-- 📄 Documentation & Processing Instructions
└── hnt1/             <-- 📁 Post Storage Folder (10 posts max per folder)
    ├── post-1.json
    ├── post-2.json
    └── ...
└── hnt2/
    ├── post-11.json
    └── ...
```

---

## ⚡ 2. Master Entry Point: `data/index.json`

The `data/index.json` file provides a lightweight index of all saved posts in the database.

### Schema (`data/index.json`)
```json
{
  "updatedAt": "2026-09-28T19:12:00.000Z",
  "totalPosts": 42,
  "posts": [
    {
      "title": "Solo Leveling Episode 12",
      "file": "hnt1/solo-leveling-episode-12.json",
      "thumbnail": "https://example.com/cover.jpg"
    }
  ]
}
```

### Field Specifications:
- `updatedAt`: ISO 8601 timestamp of last index update.
- `totalPosts`: Integer count of total indexed post files.
- `posts`: Array of lightweight post entry objects:
  - `title`: Human-readable post title.
  - `file`: Relative filepath to the full post JSON file (e.g., `hnt1/solo-leveling-episode-12.json`).
  - `thumbnail`: Direct HTTP/HTTPS cover image URL.

---

## 📄 3. Individual Post File Schema (`data/hntX/xxx.json`)

Each JSON file inside `data/hntX/` contains complete post metadata and video streaming links.

```json
{
  "slug": "solo-leveling-episode-12",
  "title": "Solo Leveling Episode 12",
  "websiteUrl": "https://example.com/watch/solo-leveling-12",
  "thumbnail": "https://example.com/cover.jpg",
  "description": "Full post description...",
  "synopsis": "Short synopsis...",
  "siteName": "HentaiMama",
  "galleryImages": [
    "https://example.com/screenshot1.jpg",
    "https://example.com/screenshot2.jpg"
  ],
  "episodes": [
    {
      "label": "Episode 1 (720p)",
      "url": "https://example.com/stream/ep1",
      "quality": "720p"
    }
  ],
  "savedAt": "2026-09-28T18:45:00.000Z",
  "folder": "hnt1",
  "filename": "solo-leveling-episode-12.json"
}
```

---

## 🤖 4. How AI Agents Should Read & Process This Data

### Step 1: Read Master Index
Load `data/index.json` first. Filter posts by `title`, `file`, or `thumbnail` before opening heavy single files.

### Step 2: Retrieve Full Details
Use the `file` relative path from the index entry to load the target post JSON directly (e.g. `data/hnt1/solo-leveling-episode-12.json`).

### Python Example
```python
import json
import zipfile
from pathlib import Path

# Extract ZIP if needed
with zipfile.ZipFile('data-backup.zip', 'r') as zip_ref:
    zip_ref.extractall('extracted_data')

# Read index
index_path = Path('extracted_data/data/index.json')
with open(index_path, 'r', encoding='utf-8') as f:
    index_data = json.load(f)

print(f"Total posts found: {index_data['totalPosts']}")

# Process each post
for post_meta in index_data['posts']:
    post_file = Path('extracted_data/data') / post_meta['file']
    if post_file.exists():
        with open(post_file, 'r', encoding='utf-8') as pf:
            full_post = json.load(pf)
            print(f"[{post_meta['file']}] {full_post['title']} - {len(full_post.get('episodes', []))} episodes")
```

### Node.js / TypeScript Example
```typescript
import fs from 'fs';
import path from 'path';

const indexPath = path.join(__dirname, 'data', 'index.json');
const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

for (const postMeta of indexData.posts) {
  const fullPath = path.join(__dirname, 'data', postMeta.file);
  if (fs.existsSync(fullPath)) {
    const post = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    console.log(`${postMeta.title} -> ${post.episodes.length} episodes`);
  }
}
```

---

## 🛠️ 5. Key Guarantees
- **Auto-Indexing:** `data/index.json` is kept in sync with the files in `data/hntX/`.
- **Folder Capping:** Folders are capped at **10 posts per folder** (`hnt1`, `hnt2`, etc.).
- **Encoding:** UTF-8 encoded with 2-space formatted JSON.
