import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export interface SavedPostFileMeta {
  filename: string;
  slug: string;
  title: string;
  thumbnail: string;
  synopsis?: string;
  description?: string;
  websiteUrl?: string;
  episodeCount: number;
  galleryCount: number;
  savedAt: string;
  sizeBytes: number;
}

export interface FolderMeta {
  name: string;
  number: number;
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

export interface IndexPostEntry {
  title: string;
  file: string;
  thumbnail: string;
}

export interface MainIndexManifest {
  updatedAt: string;
  totalPosts: number;
  posts: IndexPostEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const POSTS_PER_FOLDER = 10;

const GUIDE_MD_CONTENT = `# 📦 AI Agent Guide: Database Structure & Processing Instructions

This database repository is structured for fast, deterministic consumption by **AI Agents**, **LLM Pipelines**, **Telegram Bots**, and **Scraper Services**.

---

## 📂 1. Directory Architecture

When unzipping the exported \`codebase-data-backup.zip\` file or inspecting the \`/data\` directory, you will see the following organization:

\`\`\`text
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
\`\`\`

---

## ⚡ 2. Master Entry Point: \`data/index.json\`

The \`data/index.json\` file provides a lightweight index of all saved posts in the database.

### Schema (\`data/index.json\`)
\`\`\`json
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
\`\`\`

### Field Specifications:
- \`updatedAt\`: ISO 8601 timestamp of last index update.
- \`totalPosts\`: Integer count of total indexed post files.
- \`posts\`: Array of lightweight post entry objects:
  - \`title\`: Human-readable post title.
  - \`file\`: Relative filepath to the full post JSON file (e.g., \`hnt1/solo-leveling-episode-12.json\`).
  - \`thumbnail\`: Direct HTTP/HTTPS cover image URL.

---

## 📄 3. Individual Post File Schema (\`data/hntX/xxx.json\`)

Each JSON file inside \`data/hntX/\` contains complete post metadata and video streaming links.

\`\`\`json
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
\`\`\`

---

## 🤖 4. How AI Agents Should Read & Process This Data

### Step 1: Read Master Index
Load \`data/index.json\` first. Filter posts by \`title\`, \`file\`, or \`thumbnail\` before opening heavy single files.

### Step 2: Retrieve Full Details
Use the \`file\` relative path from the index entry to load the target post JSON directly (e.g. \`data/hnt1/solo-leveling-episode-12.json\`).

### Python Example
\`\`\`python
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
\`\`\`

### Node.js / TypeScript Example
\`\`\`typescript
import fs from 'fs';
import path from 'path';

const indexPath = path.join(__dirname, 'data', 'index.json');
const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

for (const postMeta of indexData.posts) {
  const fullPath = path.join(__dirname, 'data', postMeta.file);
  if (fs.existsSync(fullPath)) {
    const post = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    console.log(\`\${postMeta.title} -> \${post.episodes.length} episodes\`);
  }
}
\`\`\`

---

## 🛠️ 5. Key Guarantees
- **Auto-Indexing:** \`data/index.json\` is kept in sync with the files in \`data/hntX/\`.
- **Folder Capping:** Folders are capped at **10 posts per folder** (\`hnt1\`, \`hnt2\`, etc.).
- **Encoding:** UTF-8 encoded with 2-space formatted JSON.
`;

// Ensure base data directory exists and guide.md is present
export function ensureDataDir(): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  ensureGuideFile();
  return DATA_DIR;
}

// Generate data/guide.md documentation
export function ensureGuideFile(): void {
  const guidePath = path.join(DATA_DIR, 'guide.md');
  try {
    fs.writeFileSync(guidePath, GUIDE_MD_CONTENT, 'utf-8');
  } catch (err) {
    console.error('Failed to write data/guide.md:', err);
  }
}

// Generate clean URL/file slug
export function generateSlug(title: string, url?: string): string {
  let base = title || '';
  if (!base && url) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      base = segments[segments.length - 1] || 'post';
    } catch {
      base = 'post';
    }
  }

  const slug = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 48)
    .replace(/^-+|-+$/g, '');

  return slug || `post-${Date.now()}`;
}

// Generate or Update the compact data/index.json file containing all post title-to-filepath mappings
export function generateMainIndexJson(): MainIndexManifest {
  ensureDataDir();
  ensureGuideFile();

  const manifest = getDataLibraryManifestRaw();
  const posts: IndexPostEntry[] = [];

  for (const folder of manifest.folders) {
    for (const file of folder.files) {
      posts.push({
        title: file.title,
        file: `${folder.name}/${file.filename}`,
        thumbnail: file.thumbnail || '',
      });
    }
  }

  const indexManifest: MainIndexManifest = {
    updatedAt: new Date().toISOString(),
    totalPosts: posts.length,
    posts,
  };

  const indexPath = path.join(DATA_DIR, 'index.json');
  try {
    fs.writeFileSync(indexPath, JSON.stringify(indexManifest, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write data/index.json:', err);
  }

  return indexManifest;
}

// Read data/index.json or auto-generate if missing
export function getMainIndexJson(): MainIndexManifest {
  ensureDataDir();
  const indexPath = path.join(DATA_DIR, 'index.json');
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      // Fallback if corrupt
    }
  }
  return generateMainIndexJson();
}

// Internal raw manifest builder without recursive call
function getDataLibraryManifestRaw(): LibraryManifest {
  ensureDataDir();

  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const hntFolderNames = entries
    .filter(e => e.isDirectory() && /^hnt\d+$/i.test(e.name))
    .map(e => e.name)
    .sort((a, b) => {
      const numA = parseInt(a.replace('hnt', ''), 10) || 0;
      const numB = parseInt(b.replace('hnt', ''), 10) || 0;
      return numA - numB;
    });

  const folders: FolderMeta[] = [];
  let totalPosts = 0;

  for (const folder of hntFolderNames) {
    const num = parseInt(folder.replace('hnt', ''), 10) || 1;
    const folderPath = path.join(DATA_DIR, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json') && f !== 'index.json');

    const fileMetas: SavedPostFileMeta[] = [];

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      try {
        const stats = fs.statSync(fullPath);
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        fileMetas.push({
          filename: file,
          slug: content.slug || file.replace('.json', ''),
          title: content.title || file.replace('.json', ''),
          thumbnail: content.thumbnail || '',
          synopsis: content.synopsis || content.description || '',
          description: content.description || '',
          websiteUrl: content.websiteUrl || '',
          episodeCount: Array.isArray(content.episodes) ? content.episodes.length : 0,
          galleryCount: Array.isArray(content.galleryImages) ? content.galleryImages.length : 0,
          savedAt: content.savedAt || stats.mtime.toISOString(),
          sizeBytes: stats.size,
        });
        totalPosts++;
      } catch (err) {
        // Skip corrupted files
      }
    }

    folders.push({
      name: folder,
      number: num,
      count: fileMetas.length,
      max: POSTS_PER_FOLDER,
      isFull: fileMetas.length >= POSTS_PER_FOLDER,
      files: fileMetas,
    });
  }

  return {
    folders,
    totalPosts,
    totalFolders: folders.length,
  };
}

// Get Library Manifest & ensure auto-indexing
export function getDataLibraryManifest(): LibraryManifest {
  const manifest = getDataLibraryManifestRaw();
  // Auto-update data/index.json on manifest fetch
  generateMainIndexJson();
  return manifest;
}

// Find existing post across all hnt folders by slug or URL
export function findExistingPostFile(slug: string, websiteUrl?: string): { folder: string; filename: string; filePath: string } | null {
  ensureDataDir();
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const hntFolders = entries
    .filter(e => e.isDirectory() && /^hnt\d+$/i.test(e.name))
    .map(e => e.name);

  const targetFilename = `${slug}.json`;

  for (const folder of hntFolders) {
    const folderPath = path.join(DATA_DIR, folder);
    const directFile = path.join(folderPath, targetFilename);
    if (fs.existsSync(directFile)) {
      return { folder, filename: targetFilename, filePath: directFile };
    }

    // Also check if websiteUrl matches inside any file
    if (websiteUrl) {
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json') && f !== 'index.json');
      for (const file of files) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf-8'));
          if (content.websiteUrl && content.websiteUrl === websiteUrl) {
            return { folder, filename: file, filePath: path.join(folderPath, file) };
          }
        } catch {}
      }
    }
  }

  return null;
}

// Determine target folder for next new post (hnt1, hnt2, etc. with < 10 files)
export function getNextAvailableFolder(): { folderName: string; folderPath: string; count: number } {
  ensureDataDir();
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const hntFolderNames = entries
    .filter(e => e.isDirectory() && /^hnt\d+$/i.test(e.name))
    .map(e => e.name)
    .sort((a, b) => {
      const numA = parseInt(a.replace('hnt', ''), 10) || 0;
      const numB = parseInt(b.replace('hnt', ''), 10) || 0;
      return numA - numB;
    });

  // Check existing folders in order
  for (const folder of hntFolderNames) {
    const folderPath = path.join(DATA_DIR, folder);
    const jsonFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.json') && f !== 'index.json');
    if (jsonFiles.length < POSTS_PER_FOLDER) {
      return { folderName: folder, folderPath, count: jsonFiles.length };
    }
  }

  // If all existing are full or none exist, create the next sequential folder
  const nextNum = hntFolderNames.length > 0 
    ? (parseInt(hntFolderNames[hntFolderNames.length - 1].replace('hnt', ''), 10) || 0) + 1 
    : 1;

  const nextFolderName = `hnt${nextNum}`;
  const nextFolderPath = path.join(DATA_DIR, nextFolderName);
  if (!fs.existsSync(nextFolderPath)) {
    fs.mkdirSync(nextFolderPath, { recursive: true });
  }

  return { folderName: nextFolderName, folderPath: nextFolderPath, count: 0 };
}

// Save or Update a single post
export async function savePostToJson(postData: any): Promise<{
  folder: string;
  filename: string;
  filePath: string;
  isUpdate: boolean;
  totalInFolder: number;
}> {
  ensureDataDir();

  const slug = postData.slug || generateSlug(postData.title, postData.websiteUrl);
  const existing = findExistingPostFile(slug, postData.websiteUrl);

  let targetFolder: string;
  let targetFilename: string;
  let targetFilePath: string;
  let isUpdate = false;

  if (existing) {
    targetFolder = existing.folder;
    targetFilename = existing.filename;
    targetFilePath = existing.filePath;
    isUpdate = true;
  } else {
    const { folderName, folderPath } = getNextAvailableFolder();
    targetFolder = folderName;
    targetFilename = `${slug}.json`;
    targetFilePath = path.join(folderPath, targetFilename);
  }

  const payload = {
    slug,
    title: postData.title || 'Untitled Post',
    websiteUrl: postData.websiteUrl || '',
    thumbnail: postData.thumbnail || '',
    description: postData.description || '',
    synopsis: postData.synopsis || postData.description || '',
    siteName: postData.siteName || '',
    galleryImages: Array.isArray(postData.galleryImages) ? postData.galleryImages : [],
    episodes: Array.isArray(postData.episodes) ? postData.episodes : [],
    savedAt: new Date().toISOString(),
    folder: targetFolder,
    filename: targetFilename,
    location: `post "${postData.title || 'Untitled Post'}" available in ${targetFolder}/${targetFilename} file`,
  };

  fs.writeFileSync(targetFilePath, JSON.stringify(payload, null, 2), 'utf-8');

  const folderPath = path.join(DATA_DIR, targetFolder);
  const totalInFolder = fs.readdirSync(folderPath).filter(f => f.endsWith('.json') && f !== 'index.json').length;

  // Auto update data/index.json
  generateMainIndexJson();

  return {
    folder: targetFolder,
    filename: targetFilename,
    filePath: targetFilePath,
    isUpdate,
    totalInFolder,
  };
}

// Batch save multiple posts
export async function batchSavePosts(posts: any[]): Promise<Array<{
  slug: string;
  folder: string;
  filename: string;
  isUpdate: boolean;
}>> {
  const results = [];
  for (const post of posts) {
    if (!post || (!post.title && !post.url && !post.websiteUrl)) continue;
    const res = await savePostToJson(post);
    results.push({
      slug: post.slug || generateSlug(post.title, post.websiteUrl),
      folder: res.folder,
      filename: res.filename,
      isUpdate: res.isUpdate,
    });
  }

  // Auto update data/index.json after batch
  generateMainIndexJson();

  return results;
}

// Get raw JSON file content
export function getPostFile(folder: string, filename: string): any | null {
  ensureDataDir();
  const safeFolder = path.basename(folder);
  const safeFile = path.basename(filename);

  // If requesting index.json directly
  if (safeFolder === 'data' && safeFile === 'index.json') {
    return getMainIndexJson();
  }

  const fullPath = path.join(DATA_DIR, safeFolder, safeFile);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  } catch {
    return null;
  }
}

// Delete specific JSON file
export function deletePostFile(folder: string, filename: string): boolean {
  ensureDataDir();
  const safeFolder = path.basename(folder);
  const safeFile = path.basename(filename);
  const fullPath = path.join(DATA_DIR, safeFolder, safeFile);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    // Auto update data/index.json
    generateMainIndexJson();
    return true;
  }
  return false;
}

// Delete folder if empty or forced
export function deleteFolder(folder: string): boolean {
  ensureDataDir();
  const safeFolder = path.basename(folder);
  const fullPath = path.join(DATA_DIR, safeFolder);

  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    // Auto update data/index.json
    generateMainIndexJson();
    return true;
  }
  return false;
}

// Clear all database posts across all hnt folders
export function clearAllLibraryData(): { deletedFolders: number; deletedFiles: number } {
  ensureDataDir();
  let deletedFolders = 0;
  let deletedFiles = 0;

  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && /^hnt\d+$/i.test(entry.name)) {
      const folderPath = path.join(DATA_DIR, entry.name);
      try {
        const files = fs.readdirSync(folderPath);
        deletedFiles += files.length;
        fs.rmSync(folderPath, { recursive: true, force: true });
        deletedFolders++;
      } catch (e) {
        console.error(`Failed to delete folder ${entry.name}:`, e);
      }
    }
  }

  // Ensure fresh empty hnt1 directory is ready
  const hnt1Path = path.join(DATA_DIR, 'hnt1');
  if (!fs.existsSync(hnt1Path)) {
    fs.mkdirSync(hnt1Path, { recursive: true });
  }

  // Regenerate main index.json
  generateMainIndexJson();

  return { deletedFolders, deletedFiles };
}

// Create a ZIP archive buffer of the entire data folder (including index.json)
export function createDataZipBuffer(): Buffer {
  ensureDataDir();
  generateMainIndexJson();

  const zip = new AdmZip();
  if (fs.existsSync(DATA_DIR)) {
    zip.addLocalFolder(DATA_DIR, 'data');
  }
  return zip.toBuffer();
}

// Generate index.json on module load
generateMainIndexJson();
