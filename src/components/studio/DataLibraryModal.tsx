import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  fetchDataLibrary,
  loadPostFromFile,
  deleteFileFromLibrary,
  deleteFolderFromLibrary,
  savePostToLibrary,
  clearWholeLibraryDatabase,
  uploadDataZipToTelegram,
  sendPostToTelegram,
  fetchMainIndexApi,
  reindexDatabaseApi,
} from '../../services/api';
import type { LibraryManifest, FolderMeta, SavedPostFileMeta, ScrapedPost, BotConfig } from '../../types';
import {
  Folder,
  FolderOpen,
  FileJson,
  Download,
  Trash2,
  RefreshCw,
  X,
  Search,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  Layers,
  Image as ImageIcon,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Plus,
  Eye,
  Film,
  Play,
  Maximize2,
  Send,
  Archive,
  Bot,
  Hash,
  FileArchive,
  Radio,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  Loader2,
  FileCode,
  RotateCcw,
  ListTree
} from 'lucide-react';

interface ConfirmDialogState {
  isOpen: boolean;
  type: 'delete_file' | 'delete_folder' | 'clear_all';
  title: string;
  message: string;
  targetName?: string;
  folder?: string;
  filename?: string;
}

interface AutoUploadQueueItem {
  id: string;
  folder: string;
  filename: string;
  title: string;
  thumbnail: string;
  episodeCount: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  telegramLink?: string;
  messageId?: number;
}

export const DataLibraryModal: React.FC = () => {
  const {
    dataLibraryModalOpen,
    setDataLibraryModalOpen,
    post,
    setPost,
    botConfig,
    templateSettings,
    autoSaveToLibrary,
    setAutoSaveToLibrary,
    setLastSavedLocation,
    addHistoryItem
  } = useAppStore();

  const [manifest, setManifest] = useState<LibraryManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFolderIndex, setActiveFolderIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Inspector & Details States
  const [selectedPostMeta, setSelectedPostMeta] = useState<{ folder: string; meta: SavedPostFileMeta } | null>(null);
  const [rawJsonContent, setRawJsonContent] = useState<string | null>(null);
  const [isLoadingJson, setIsLoadingJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  
  // Full Post Details Modal State
  const [detailedPost, setDetailedPost] = useState<{
    folder: string;
    filename: string;
    data: ScrapedPost;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);

  // Telegram ZIP Upload State
  const [telegramZipModalOpen, setTelegramZipModalOpen] = useState(false);
  const [zipBotToken, setZipBotToken] = useState(botConfig.botToken || '');
  const [zipChatId, setZipChatId] = useState(botConfig.chatId || '');
  const [zipThreadId, setZipThreadId] = useState(botConfig.topicId || '');
  const [zipCaption, setZipCaption] = useState('');
  const [zipDelayMs, setZipDelayMs] = useState(1500);
  const [zipAutoRetry, setZipAutoRetry] = useState(true);
  const [zipMaxRetries, setZipMaxRetries] = useState(3);
  const [isUploadingZip, setIsUploadingZip] = useState(false);

  // Auto-Upload Database Posts to Telegram State
  const [autoUploadModalOpen, setAutoUploadModalOpen] = useState(false);
  const [uploadScope, setUploadScope] = useState<'current_folder' | 'all_folders'>('current_folder');
  const [autoUploadBotToken, setAutoUploadBotToken] = useState(botConfig.botToken || '');
  const [autoUploadChatId, setAutoUploadChatId] = useState(botConfig.chatId || '');
  const [autoUploadThreadId, setAutoUploadThreadId] = useState(botConfig.topicId || '');
  const [autoUploadDelayMs, setAutoUploadDelayMs] = useState(2000);
  const [autoUploadIncludeSynopsis, setAutoUploadIncludeSynopsis] = useState(false);

  // Auto-Upload Execution Engine State
  const [isAutoUploading, setIsAutoUploading] = useState(false);
  const [isAutoUploadPaused, setIsAutoUploadPaused] = useState(false);
  const [autoUploadQueue, setAutoUploadQueue] = useState<AutoUploadQueueItem[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const [autoUploadStats, setAutoUploadStats] = useState({ total: 0, sent: 0, failed: 0 });

  const stopAutoUploadRef = useRef(false);
  const pauseAutoUploadRef = useRef(false);

  // Main Index JSON State
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexData, setIndexData] = useState<any | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(false);

  const handleOpenIndexModal = async () => {
    setIndexModalOpen(true);
    setLoadingIndex(true);
    try {
      const data = await fetchMainIndexApi();
      setIndexData(data);
    } catch (err: any) {
      setFeedbackMsg({ text: `Failed to fetch index.json: ${err.message}`, type: 'error' });
    } finally {
      setLoadingIndex(false);
    }
  };

  const handleReindexDatabase = async () => {
    setReindexing(true);
    try {
      const data = await reindexDatabaseApi();
      setIndexData(data);
      setFeedbackMsg({
        text: `Re-indexed database! ${data.totalPosts} posts mapped in data/index.json`,
        type: 'success',
      });
      await loadManifest();
    } catch (err: any) {
      setFeedbackMsg({ text: `Re-index failed: ${err.message}`, type: 'error' });
    } finally {
      setReindexing(false);
    }
  };

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSavingCurrent, setIsSavingCurrent] = useState(false);
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

  // In-App Confirmation Modal Dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    type: 'delete_file',
    title: '',
    message: '',
  });

  const loadManifest = async () => {
    setLoading(true);
    try {
      const data = await fetchDataLibrary();
      setManifest(data);
      if (data.folders.length > 0 && activeFolderIndex >= data.folders.length) {
        setActiveFolderIndex(0);
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to load library', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataLibraryModalOpen) {
      loadManifest();
      setFeedbackMsg(null);
      setSelectedPostMeta(null);
      setRawJsonContent(null);
      setDetailedPost(null);
      setSelectedGalleryImage(null);
      setTelegramZipModalOpen(false);
      
      // Auto-sync Telegram credentials from botConfig if available
      if (botConfig.botToken) {
        setZipBotToken(botConfig.botToken);
        setAutoUploadBotToken(botConfig.botToken);
      }
      if (botConfig.chatId) {
        setZipChatId(botConfig.chatId);
        setAutoUploadChatId(botConfig.chatId);
      }
      if (botConfig.topicId) {
        setZipThreadId(botConfig.topicId);
        setAutoUploadThreadId(botConfig.topicId);
      }
    }
  }, [dataLibraryModalOpen, botConfig]);

  if (!dataLibraryModalOpen) return null;

  const currentFolder: FolderMeta | undefined = manifest?.folders[activeFolderIndex];

  // Search filter across folders
  const allFilesAcrossFolders: Array<{ folder: string; file: SavedPostFileMeta }> = [];
  if (manifest?.folders) {
    for (const f of manifest.folders) {
      for (const file of f.files) {
        allFilesAcrossFolders.push({ folder: f.name, file });
      }
    }
  }

  const isSearching = searchQuery.trim().length > 0;
  const filteredFiles: Array<{ folder: string; file: SavedPostFileMeta }> = isSearching
    ? allFilesAcrossFolders.filter(
        item =>
          item.file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.file.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.file.websiteUrl && item.file.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : (currentFolder?.files || []).map(file => ({ folder: currentFolder?.name || 'hnt1', file }));

  // 1-Click Load into Studio Editor
  const handleLoadPost = async (folder: string, filename: string) => {
    try {
      setLoading(true);
      const loaded = await loadPostFromFile(folder, filename);
      setPost(loaded);
      setLastSavedLocation({ folder, filename });
      setFeedbackMsg({ text: `Loaded "${loaded.title}" into Studio Editor!`, type: 'success' });
      setDetailedPost(null);
      setTimeout(() => {
        setDataLibraryModalOpen(false);
      }, 600);
    } catch (err: any) {
      setFeedbackMsg({ text: `Failed to load: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // View full details popup on click
  const handleOpenPostDetails = async (folder: string, file: SavedPostFileMeta) => {
    setLoadingDetail(true);
    try {
      const fullData = await loadPostFromFile(folder, file.filename);
      setDetailedPost({
        folder,
        filename: file.filename,
        data: fullData,
      });
      setSelectedGalleryImage(null);
    } catch (err: any) {
      setFeedbackMsg({ text: `Failed to open post details: ${err.message}`, type: 'error' });
    } finally {
      setLoadingDetail(false);
    }
  };

  // Inspect Raw JSON
  const handleViewRawJson = async (folder: string, meta: SavedPostFileMeta) => {
    setSelectedPostMeta({ folder, meta });
    setIsLoadingJson(true);
    setCopiedJson(false);
    try {
      const res = await fetch(`/api/storage/file?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(meta.filename)}`);
      const json = await res.json();
      if (json.ok) {
        setRawJsonContent(JSON.stringify(json.data, null, 2));
      } else {
        setRawJsonContent(JSON.stringify({ error: json.error }, null, 2));
      }
    } catch (err: any) {
      setRawJsonContent(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsLoadingJson(false);
    }
  };

  // Handle Uploading Data ZIP to Telegram
  const handleSendZipToTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipBotToken.trim() || !zipChatId.trim()) {
      setFeedbackMsg({ text: 'Bot Token and Chat ID are required to upload to Telegram', type: 'error' });
      return;
    }

    setIsUploadingZip(true);
    try {
      await uploadDataZipToTelegram({
        botToken: zipBotToken.trim(),
        chatId: zipChatId.trim(),
        messageThreadId: zipThreadId.trim() || undefined,
        caption: zipCaption.trim() || undefined,
        rateLimitDelayMs: zipDelayMs,
        autoRetryOn429: zipAutoRetry,
        maxRetries: zipMaxRetries,
      });
      setFeedbackMsg({
        text: `Successfully uploaded entire data/ folder archive (.zip) to Telegram!`,
        type: 'success',
      });
      setTelegramZipModalOpen(false);
    } catch (err: any) {
      setFeedbackMsg({ text: `ZIP Upload failed: ${err.message}`, type: 'error' });
    } finally {
      setIsUploadingZip(false);
    }
  };

  // Prepare Auto-Upload Queue
  const prepareAutoUploadQueue = () => {
    const targetFiles: Array<{ folder: string; file: SavedPostFileMeta }> = [];
    if (uploadScope === 'current_folder' && currentFolder) {
      for (const file of currentFolder.files) {
        targetFiles.push({ folder: currentFolder.name, file });
      }
    } else if (uploadScope === 'all_folders' && manifest) {
      for (const f of manifest.folders) {
        for (const file of f.files) {
          targetFiles.push({ folder: f.name, file });
        }
      }
    }

    const newQueue: AutoUploadQueueItem[] = targetFiles.map(({ folder, file }, idx) => ({
      id: `${folder}-${file.filename}-${idx}`,
      folder,
      filename: file.filename,
      title: file.title,
      thumbnail: file.thumbnail,
      episodeCount: file.episodeCount,
      status: 'pending',
    }));

    setAutoUploadQueue(newQueue);
    setAutoUploadStats({ total: newQueue.length, sent: 0, failed: 0 });
    setCurrentUploadIndex(-1);
    setIsAutoUploading(false);
    setIsAutoUploadPaused(false);
  };

  // Run Auto-Upload Queue
  const startAutoUploadProcess = async () => {
    if (!autoUploadBotToken.trim() || !autoUploadChatId.trim()) {
      setFeedbackMsg({ text: 'Please provide both Bot Token and Chat ID', type: 'error' });
      return;
    }

    if (autoUploadQueue.length === 0) {
      prepareAutoUploadQueue();
    }

    setIsAutoUploading(true);
    setIsAutoUploadPaused(false);
    stopAutoUploadRef.current = false;
    pauseAutoUploadRef.current = false;

    const customBotConfig: BotConfig = {
      botToken: autoUploadBotToken.trim(),
      chatId: autoUploadChatId.trim(),
      topicId: autoUploadThreadId.trim(),
      messageThreadId: autoUploadThreadId.trim(),
      verified: true,
      isVerified: true,
    };

    let sentCount = autoUploadStats.sent;
    let failedCount = autoUploadStats.failed;

    for (let i = 0; i < autoUploadQueue.length; i++) {
      if (stopAutoUploadRef.current) break;

      // Handle pause state
      while (pauseAutoUploadRef.current && !stopAutoUploadRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }

      if (stopAutoUploadRef.current) break;

      // Skip already sent
      if (autoUploadQueue[i].status === 'sent') continue;

      setCurrentUploadIndex(i);

      // Update item status to sending
      setAutoUploadQueue(prev =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'sending' } : item))
      );

      const targetItem = autoUploadQueue[i];

      try {
        // Load full post data from storage
        const postData = await loadPostFromFile(targetItem.folder, targetItem.filename);

        // Send to Telegram
        const result = await sendPostToTelegram({
          postData,
          botConfig: customBotConfig,
          templateSettings: {
            ...templateSettings,
            includeSynopsis: autoUploadIncludeSynopsis,
          },
        });

        if (result.ok) {
          sentCount++;
          setAutoUploadStats(prev => ({ ...prev, sent: sentCount }));

          setAutoUploadQueue(prev =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'sent',
                    messageId: result.messageId,
                    telegramLink: result.postLink,
                  }
                : item
            )
          );

          // Record in history
          addHistoryItem({
            title: postData.title,
            thumbnail: postData.thumbnail,
            chatId: customBotConfig.chatId,
            chatTitle: customBotConfig.chatInfo?.title || customBotConfig.chatId,
            episodesCount: postData.episodes.length,
            status: 'sent',
            messageId: result.messageId,
            telegramLink: result.postLink,
            postData,
          });
        } else {
          throw new Error('Telegram send returned false');
        }
      } catch (err: any) {
        failedCount++;
        setAutoUploadStats(prev => ({ ...prev, failed: failedCount }));

        setAutoUploadQueue(prev =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'failed',
                  error: err.message || 'Send failed',
                }
              : item
          )
        );
      }

      // Delay between posts to respect rate limits
      if (i < autoUploadQueue.length - 1 && !stopAutoUploadRef.current) {
        await new Promise(r => setTimeout(r, autoUploadDelayMs));
      }
    }

    setIsAutoUploading(false);
    setCurrentUploadIndex(-1);
    if (!stopAutoUploadRef.current) {
      setFeedbackMsg({
        text: `Auto-upload finished! ${sentCount} sent successfully, ${failedCount} failed.`,
        type: failedCount === 0 ? 'success' : 'error',
      });
    }
  };

  const pauseAutoUploadProcess = () => {
    pauseAutoUploadRef.current = true;
    setIsAutoUploadPaused(true);
  };

  const resumeAutoUploadProcess = () => {
    pauseAutoUploadRef.current = false;
    setIsAutoUploadPaused(false);
  };

  const stopAutoUploadProcess = () => {
    stopAutoUploadRef.current = true;
    pauseAutoUploadRef.current = false;
    setIsAutoUploading(false);
    setIsAutoUploadPaused(false);
  };

  // Open in-app delete file confirmation popup
  const promptDeleteFile = (folder: string, filename: string, title?: string) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete_file',
      title: 'Delete Post File',
      message: `Are you sure you want to permanently delete this JSON post file? This action cannot be undone.`,
      targetName: `data/${folder}/${filename}${title ? ` ("${title}")` : ''}`,
      folder,
      filename,
    });
  };

  // Open in-app delete folder confirmation popup
  const promptDeleteFolder = (folder: string, count: number) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete_folder',
      title: 'Delete Folder',
      message: `Are you sure you want to delete folder data/${folder} containing ${count} post file(s)?`,
      targetName: `data/${folder}/ (${count} posts)`,
      folder,
    });
  };

  // Open in-app clear database confirmation popup
  const promptClearDatabase = () => {
    const totalPosts = manifest?.totalPosts || 0;
    const totalFolders = manifest?.totalFolders || 0;
    setConfirmDialog({
      isOpen: true,
      type: 'clear_all',
      title: 'Clear Whole Database',
      message: `Warning: This will permanently delete all ${totalPosts} scraped post JSON files across all ${totalFolders} hnt folders and reset the storage to a fresh data/hnt1 directory.`,
      targetName: `All data/hnt* folders (${totalPosts} total posts)`,
    });
  };

  // Execute confirmed delete action
  const handleExecuteConfirmedAction = async () => {
    setIsExecutingDelete(true);
    try {
      if (confirmDialog.type === 'delete_file' && confirmDialog.folder && confirmDialog.filename) {
        await deleteFileFromLibrary(confirmDialog.folder, confirmDialog.filename);
        setFeedbackMsg({ text: `Deleted ${confirmDialog.filename} successfully`, type: 'success' });
        if (selectedPostMeta?.meta.filename === confirmDialog.filename) {
          setSelectedPostMeta(null);
          setRawJsonContent(null);
        }
        if (detailedPost?.filename === confirmDialog.filename) {
          setDetailedPost(null);
        }
      } else if (confirmDialog.type === 'delete_folder' && confirmDialog.folder) {
        await deleteFolderFromLibrary(confirmDialog.folder);
        setFeedbackMsg({ text: `Deleted folder data/${confirmDialog.folder}`, type: 'success' });
        setActiveFolderIndex(0);
        setSelectedPostMeta(null);
        setRawJsonContent(null);
        setDetailedPost(null);
      } else if (confirmDialog.type === 'clear_all') {
        const result = await clearWholeLibraryDatabase();
        setFeedbackMsg({
          text: `Database cleared! Deleted ${result.deletedFiles} post files across ${result.deletedFolders} folders. Fresh data/hnt1 is ready.`,
          type: 'success',
        });
        setActiveFolderIndex(0);
        setSelectedPostMeta(null);
        setRawJsonContent(null);
        setDetailedPost(null);
      }

      await loadManifest();
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      setFeedbackMsg({ text: `Action failed: ${err.message}`, type: 'error' });
    } finally {
      setIsExecutingDelete(false);
    }
  };

  // Download JSON file
  const handleDownloadJson = (filename: string, contentStr: string) => {
    const blob = new Blob([contentStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save current Studio post
  const handleSaveCurrentPost = async () => {
    if (!post.title && !post.websiteUrl) {
      setFeedbackMsg({ text: 'Current post has no content to save', type: 'error' });
      return;
    }
    setIsSavingCurrent(true);
    try {
      const res = await savePostToLibrary(post);
      setLastSavedLocation({ folder: res.folder, filename: res.filename });
      setFeedbackMsg({
        text: `Saved to data/${res.folder}/${res.filename} (${res.totalInFolder}/10 posts)`,
        type: 'success',
      });
      await loadManifest();
    } catch (err: any) {
      setFeedbackMsg({ text: `Save failed: ${err.message}`, type: 'error' });
    } finally {
      setIsSavingCurrent(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-100">Codebase Database Library</h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  data/hntX (10 posts/folder)
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Click any post to view details, or auto-upload posts / ZIP archive directly to Telegram.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Upload Posts to Telegram Button */}
            <button
              type="button"
              onClick={() => {
                setAutoUploadBotToken(botConfig.botToken || autoUploadBotToken);
                setAutoUploadChatId(botConfig.chatId || autoUploadChatId);
                setAutoUploadThreadId(botConfig.topicId || autoUploadThreadId);
                prepareAutoUploadQueue();
                setAutoUploadModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-emerald-600/20"
              title="Auto-upload individual posts from database to Telegram channel"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
              <span>Auto-Upload Posts</span>
            </button>

            {/* Send ZIP to Telegram Button */}
            <button
              type="button"
              onClick={() => {
                setZipBotToken(botConfig.botToken || zipBotToken);
                setZipChatId(botConfig.chatId || zipChatId);
                setZipThreadId(botConfig.topicId || zipThreadId);
                setTelegramZipModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-sky-500/20"
              title="Upload entire data/ folder as ZIP to Telegram"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send ZIP</span>
            </button>

            {/* Direct Browser Download ZIP */}
            <a
              href="/api/storage/export-zip"
              download
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
              title="Download data directory as ZIP file"
            >
              <FileArchive className="w-3.5 h-3.5 text-amber-400" />
              <span>Export .ZIP</span>
            </a>

            {/* View & Inspect data/index.json */}
            <button
              type="button"
              onClick={handleOpenIndexModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-purple-600/20"
              title="View and inspect auto-indexed data/index.json mapping"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-200" />
              <span>index.json</span>
            </button>

            {/* Clear Entire Database Button */}
            {(manifest?.totalPosts || 0) > 0 && (
              <button
                type="button"
                onClick={promptClearDatabase}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition cursor-pointer shadow-sm"
                title="Clear all posts & folders in the database"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadManifest}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title="Refresh Library"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setDataLibraryModalOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center justify-between border-b ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="hover:opacity-80 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Stats Bar & Search */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Folders Tab Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full sm:max-w-2xl no-scrollbar">
            {manifest?.folders && manifest.folders.length > 0 ? (
              manifest.folders.map((f, idx) => {
                const isActive = !isSearching && activeFolderIndex === idx;
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFolderIndex(idx);
                      setSelectedPostMeta(null);
                      setRawJsonContent(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                        : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isActive ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                    <span>{f.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : f.isFull
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {f.count}/{f.max}
                    </span>
                  </button>
                );
              })
            ) : (
              <span className="text-xs text-slate-500">No hnt folders created yet.</span>
            )}
          </div>

          {/* Search Input & Active Folder Controls */}
          <div className="flex items-center gap-2 min-w-[200px] flex-1 sm:flex-initial">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search posts by title or URL..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Delete current folder button */}
            {currentFolder && !isSearching && manifest && manifest.folders.length > 1 && (
              <button
                type="button"
                onClick={() => promptDeleteFolder(currentFolder.name, currentFolder.count)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition cursor-pointer shrink-0"
                title={`Delete folder data/${currentFolder.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Files Grid List: 2-column on mobile, scaling up to 6-column on wide screens */}
          <div className={`overflow-y-auto p-3 sm:p-4 space-y-3 ${selectedPostMeta ? 'md:col-span-7' : 'md:col-span-12'}`}>
            
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
              <span className="font-semibold text-slate-300">
                {isSearching ? (
                  `Search Results (${filteredFiles.length} posts matching "${searchQuery}")`
                ) : (
                  `Posts in data/${currentFolder?.name || 'hnt1'} (${filteredFiles.length} of ${currentFolder?.max || 10})`
                )}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Total Library: {manifest?.totalPosts || 0} posts in {manifest?.totalFolders || 0} folders
              </span>
            </div>

            {filteredFiles.length > 0 ? (
              <div
                className={`grid grid-cols-2 gap-2.5 sm:gap-3.5 ${
                  selectedPostMeta
                    ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3'
                    : 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                }`}
              >
                {filteredFiles.map(({ folder, file }) => {
                  const isCurrentActive = selectedPostMeta?.meta.filename === file.filename;

                  return (
                    <div
                      key={`${folder}-${file.filename}`}
                      onClick={() => handleOpenPostDetails(folder, file)}
                      className={`group relative rounded-xl border transition-all duration-200 flex flex-col justify-between bg-slate-950/70 hover:bg-slate-950 cursor-pointer overflow-hidden shadow-sm hover:shadow-xl hover:border-sky-500/60 ${
                        isCurrentActive
                          ? 'border-sky-500 ring-2 ring-sky-500/40'
                          : 'border-slate-800/90'
                      }`}
                    >
                      {/* Top Poster Image Area */}
                      <div className="w-full aspect-[3/4] relative bg-slate-900 overflow-hidden">
                        {file.thumbnail ? (
                          <img
                            src={file.thumbnail}
                            alt={file.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={e => {
                              const img = e.currentTarget;
                              if (!img.src.includes('/api/proxy-image')) {
                                img.src = `/api/proxy-image?url=${encodeURIComponent(file.thumbnail)}`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 p-2 text-center">
                            <FileJson className="w-8 h-8 mb-1" />
                            <span className="text-[10px] text-slate-500">No Image</span>
                          </div>
                        )}

                        {/* Top Gradient Overlay with Folder Tag */}
                        <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/90 text-white shadow-sm backdrop-blur-sm">
                            {folder}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/60 text-slate-300 border border-white/10 backdrop-blur-sm">
                            {(file.sizeBytes / 1024).toFixed(0)}KB
                          </span>
                        </div>

                        {/* Bottom Gradient Overlay on Image with Badges */}
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-600/90 text-white shadow-sm backdrop-blur-sm flex items-center gap-1">
                            <Film className="w-2.5 h-2.5" />
                            {file.episodeCount} eps
                          </span>
                          {file.galleryCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-pink-600/90 text-white shadow-sm backdrop-blur-sm flex items-center gap-1">
                              <ImageIcon className="w-2.5 h-2.5" />
                              {file.galleryCount}
                            </span>
                          )}
                        </div>

                        {/* Hover Overlay "Click to View Details" */}
                        <div className="absolute inset-0 bg-sky-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/30 transform -translate-y-1 group-hover:translate-y-0 transition-transform">
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </div>
                        </div>
                      </div>

                      {/* Content Info */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200 line-clamp-2 leading-tight group-hover:text-sky-300 transition">
                            {file.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-1 font-mono">
                            {file.slug}
                          </p>
                        </div>

                        {/* Quick Action Footer */}
                        <div
                          className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadPost(folder, file.filename)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-[11px] font-medium transition cursor-pointer border border-sky-500/30"
                            title="Load directly into Studio Post Editor"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span className="truncate">Load</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleViewRawJson(folder, file)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Inspect JSON"
                          >
                            <FileJson className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => promptDeleteFile(folder, file.filename, file.title)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-3">
                <HardDrive className="w-10 h-10 text-slate-700" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-300">
                    {isSearching ? 'No matching posts found' : `No posts in data/${currentFolder?.name || 'hnt1'}`}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {isSearching
                      ? 'Try searching with a different title, slug or URL keyword.'
                      : 'Posts scraped with Auto Scraper or saved from Studio Editor will appear here.'}
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Raw JSON Inspector Drawer (Right Panel) */}
          {selectedPostMeta && (
            <div className="md:col-span-5 bg-slate-950 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col h-full max-h-[60vh] md:max-h-full">
              {/* Top Drawer Bar */}
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200 truncate font-mono">
                    {selectedPostMeta.folder}/{selectedPostMeta.meta.filename}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {rawJsonContent && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(rawJsonContent)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        title="Copy JSON"
                      >
                        {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadJson(selectedPostMeta.meta.filename, rawJsonContent)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        title="Download JSON file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPostMeta(null);
                      setRawJsonContent(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* JSON Editor/Viewer Box */}
              <div className="flex-1 overflow-auto p-3 bg-slate-950 font-mono text-[11px] text-slate-300 leading-relaxed">
                {isLoadingJson ? (
                  <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    <span>Loading file content...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap word-break">{rawJsonContent}</pre>
                )}
              </div>

              {/* Bottom Actions inside JSON Sidebar */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  {(selectedPostMeta.meta.sizeBytes / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadPost(selectedPostMeta.folder, selectedPostMeta.meta.filename)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load into Studio</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Storage Location: <code className="text-slate-200">/data/hntX</code> (JSON database)</span>
          </div>

          <div className="flex items-center gap-2">
            {post.title && (
              <button
                type="button"
                onClick={handleSaveCurrentPost}
                disabled={isSavingCurrent}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>{isSavingCurrent ? 'Saving...' : 'Save Current Studio Post'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDataLibraryModalOpen(false)}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* AUTO-UPLOAD DATABASE POSTS TO TELEGRAM POPUP MODAL */}
        {autoUploadModalOpen && (
          <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Auto Upload Header */}
              <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Auto-Upload Database Posts to Telegram</h3>
                    <p className="text-xs text-slate-400">
                      Sequentially uploads post cards with thumbnail, description, and episode links to Telegram
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopAutoUploadProcess();
                    setAutoUploadModalOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Auto Upload Configuration & Live Status Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                
                {/* Scope Selection & Config Form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                  
                  {/* Scope Selector */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-slate-300 font-semibold flex items-center justify-between">
                      <span>Source Posts Scope</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {uploadScope === 'current_folder'
                          ? `${currentFolder?.files.length || 0} posts in ${currentFolder?.name || 'hnt1'}`
                          : `${manifest?.totalPosts || 0} posts across ${manifest?.totalFolders || 0} folders`}
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isAutoUploading}
                        onClick={() => {
                          setUploadScope('current_folder');
                          setTimeout(prepareAutoUploadQueue, 50);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                          uploadScope === 'current_folder'
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Folder className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold block truncate text-slate-200">Current Folder</span>
                          <span className="text-[10px] text-slate-400 font-mono">data/{currentFolder?.name || 'hnt1'}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={isAutoUploading}
                        onClick={() => {
                          setUploadScope('all_folders');
                          setTimeout(prepareAutoUploadQueue, 50);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                          uploadScope === 'all_folders'
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <HardDrive className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold block truncate text-slate-200">Entire Database</span>
                          <span className="text-[10px] text-slate-400 font-mono">All data/hnt* folders</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Target Bot Token */}
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Bot Token</label>
                    <input
                      type="password"
                      value={autoUploadBotToken}
                      disabled={isAutoUploading}
                      onChange={e => setAutoUploadBotToken(e.target.value)}
                      placeholder="123456789:ABCdef..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>

                  {/* Target Chat ID */}
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Target Channel / Chat ID</label>
                    <input
                      type="text"
                      value={autoUploadChatId}
                      disabled={isAutoUploading}
                      onChange={e => setAutoUploadChatId(e.target.value)}
                      placeholder="-100123456789 or @channel"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>

                  {/* Delay Between Posts */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-300 font-medium flex items-center justify-between">
                      <span>Rate Limit Delay Between Posts</span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {(autoUploadDelayMs / 1000).toFixed(1)}s per post
                      </span>
                    </label>
                    <select
                      value={autoUploadDelayMs}
                      disabled={isAutoUploading}
                      onChange={e => setAutoUploadDelayMs(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer disabled:opacity-60"
                    >
                      <option value={1000}>1.0 second (Fast - For small channels)</option>
                      <option value={1500}>1.5 seconds (Standard)</option>
                      <option value={2000}>2.0 seconds (Recommended - Safe rate limit)</option>
                      <option value={3000}>3.0 seconds (Extra Safe)</option>
                      <option value={5000}>5.0 seconds (Maximum spacing)</option>
                    </select>
                  </div>

                  {/* Include Synopsis Checkbox */}
                  <div className="sm:col-span-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoUploadIncludeSynopsis}
                        disabled={isAutoUploading}
                        onChange={e => setAutoUploadIncludeSynopsis(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-500 bg-slate-900 border-slate-700"
                      />
                      <span className="text-slate-300 text-xs">Include post synopsis/description in Telegram caption</span>
                    </label>
                  </div>

                </div>

                {/* Progress Bar & Stats Summary */}
                <div className="space-y-2 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span>Upload Queue Progress</span>
                    </div>
                    <span className="font-mono text-emerald-400">
                      {autoUploadStats.sent + autoUploadStats.failed} / {autoUploadStats.total} posts
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                      style={{
                        width: `${
                          autoUploadStats.total > 0
                            ? Math.min(100, Math.round(((autoUploadStats.sent + autoUploadStats.failed) / autoUploadStats.total) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sent: {autoUploadStats.sent}
                      </span>
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Failed: {autoUploadStats.failed}
                      </span>
                    </div>
                    <span>
                      Remaining: {Math.max(0, autoUploadStats.total - (autoUploadStats.sent + autoUploadStats.failed))}
                    </span>
                  </div>
                </div>

                {/* Queue Items List */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-300 flex items-center justify-between">
                    <span>Database Posts Queue ({autoUploadQueue.length})</span>
                    {isAutoUploading && currentUploadIndex >= 0 && (
                      <span className="text-emerald-400 font-mono font-normal flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Posting #{currentUploadIndex + 1}...
                      </span>
                    )}
                  </h4>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-800/80 rounded-xl p-2 bg-slate-950/60">
                    {autoUploadQueue.map((item, idx) => {
                      const isCurrent = currentUploadIndex === idx;

                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition ${
                            isCurrent
                              ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                              : item.status === 'sent'
                              ? 'bg-slate-950 border-emerald-500/20 text-slate-300'
                              : item.status === 'failed'
                              ? 'bg-slate-950 border-rose-500/30 text-slate-300'
                              : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Poster Thumbnail */}
                            <div className="w-8 h-10 rounded bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                              {item.thumbnail ? (
                                <img
                                  src={item.thumbnail}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    const img = e.currentTarget;
                                    if (!img.src.includes('/api/proxy-image')) {
                                      img.src = `/api/proxy-image?url=${encodeURIComponent(item.thumbnail)}`;
                                    }
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700">
                                  <FileJson className="w-4 h-4" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300 shrink-0">
                                  {item.folder}
                                </span>
                                <h5 className="font-bold text-slate-200 truncate text-xs">
                                  {item.title}
                                </h5>
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {item.episodeCount} episode links attached
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 flex items-center gap-2">
                            {item.status === 'sent' && (
                              <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Sent
                                </span>
                                {item.telegramLink && (
                                  <a
                                    href={item.telegramLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                                    title="View on Telegram"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            )}

                            {item.status === 'failed' && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1"
                                title={item.error}
                              >
                                <XCircle className="w-3 h-3" /> Failed
                              </span>
                            )}

                            {item.status === 'sending' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> Sending
                              </span>
                            )}

                            {item.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 text-slate-500 border border-slate-800">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Auto Upload Control Footer */}
              <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopAutoUploadProcess();
                    setAutoUploadModalOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {isAutoUploading ? (
                    <>
                      {isAutoUploadPaused ? (
                        <button
                          type="button"
                          onClick={resumeAutoUploadProcess}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer shadow-md"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseAutoUploadProcess}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-amber-600 hover:bg-amber-500 transition cursor-pointer shadow-md"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={stopAutoUploadProcess}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition cursor-pointer shadow-md"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startAutoUploadProcess}
                      disabled={autoUploadQueue.length === 0 || !autoUploadBotToken.trim() || !autoUploadChatId.trim()}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
                    >
                      <Radio className="w-4 h-4 text-emerald-200" />
                      <span>Start Auto-Uploading Posts</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* UPLOAD ZIP TO TELEGRAM POPUP MODAL */}
        {telegramZipModalOpen && (
          <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <form
              onSubmit={handleSendZipToTelegram}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Upload Data ZIP to Telegram</h3>
                    <p className="text-xs text-slate-400">
                      Compresses all {manifest?.totalPosts || 0} posts into a .ZIP document & posts to Telegram
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTelegramZipModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Bot Token */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium flex items-center justify-between">
                    <span>Bot Token</span>
                    {botConfig.isVerified && (
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <Check className="w-3 h-3" /> Configured
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Bot className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={zipBotToken}
                      onChange={e => setZipBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGHI..."
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Chat ID & Thread ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Chat / Channel ID</label>
                    <div className="relative">
                      <Send className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={zipChatId}
                        onChange={e => setZipChatId(e.target.value)}
                        placeholder="-100123456789 or @channel"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Topic ID (Optional)</label>
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={zipThreadId}
                        onChange={e => setZipThreadId(e.target.value)}
                        placeholder="Thread ID"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Telegram Rate Limit Settings */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>Telegram Rate Limit Safeguards</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400 font-mono">Delay Between Uploads</label>
                      <select
                        value={zipDelayMs}
                        onChange={e => setZipDelayMs(Number(e.target.value))}
                        className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value={1000}>1.0s delay</option>
                        <option value={1500}>1.5s delay (Recommended)</option>
                        <option value={2000}>2.0s delay</option>
                        <option value={3000}>3.0s delay</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 font-mono">Max 429 Retries</label>
                      <select
                        value={zipMaxRetries}
                        onChange={e => setZipMaxRetries(Number(e.target.value))}
                        className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value={1}>1 Retry</option>
                        <option value={2}>2 Retries</option>
                        <option value={3}>3 Retries (Default)</option>
                        <option value={5}>5 Retries</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zipAutoRetry}
                      onChange={e => setZipAutoRetry(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-slate-300 text-[11px]">Auto-wait & retry if Telegram returns HTTP 429 limit</span>
                  </label>
                </div>

                {/* Optional Custom Caption */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Custom Caption (Optional)</label>
                  <textarea
                    value={zipCaption}
                    onChange={e => setZipCaption(e.target.value)}
                    placeholder="Defaults to summary of total posts and export date..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTelegramZipModalOpen(false)}
                  disabled={isUploadingZip}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploadingZip || !zipBotToken.trim() || !zipChatId.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  {isUploadingZip ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Zipping & Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Upload ZIP Archive</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* FULL POST DETAILS & STREAMING LINKS POPUP MODAL */}
        {detailedPost && (
          <div className="fixed inset-0 z-[65] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Details Modal Header */}
              <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                    {detailedPost.folder}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                    {detailedPost.data.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {detailedPost.data.websiteUrl && (
                    <a
                      href={detailedPost.data.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      title="Open source website"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailedPost(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Details Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                
                {/* Hero Section: Poster + Metadata */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Poster */}
                  <div className="w-full sm:w-44 aspect-[3/4] sm:aspect-auto rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative shadow-lg">
                    {detailedPost.data.thumbnail ? (
                      <img
                        src={detailedPost.data.thumbnail}
                        alt={detailedPost.data.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={e => {
                          const img = e.currentTarget;
                          if (!img.src.includes('/api/proxy-image')) {
                            img.src = `/api/proxy-image?url=${encodeURIComponent(detailedPost.data.thumbnail)}`;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <FileJson className="w-10 h-10" />
                      </div>
                    )}
                  </div>

                  {/* Info Details */}
                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                        {detailedPost.data.title}
                      </h2>
                      {detailedPost.data.siteName && (
                        <span className="text-xs text-sky-400 font-mono">
                          Source: {detailedPost.data.siteName}
                        </span>
                      )}
                    </div>

                    {/* Synopsis */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Synopsis / Summary
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto">
                        {detailedPost.data.synopsis || detailedPost.data.description || 'No synopsis recorded.'}
                      </p>
                    </div>

                    {/* Quick Stats Badges */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        {detailedPost.data.episodes?.length || 0} Episodes
                      </span>
                      <span className="px-2.5 py-1 rounded-lg font-mono bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {detailedPost.data.galleryImages?.length || 0} Backdrops
                      </span>
                      <span className="px-2.5 py-1 rounded-lg font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        File: {detailedPost.filename}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Backdrop Screenshots Gallery */}
                {detailedPost.data.galleryImages && detailedPost.data.galleryImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-pink-400" />
                        <span>Backdrop Screenshots Gallery ({detailedPost.data.galleryImages.length})</span>
                      </h4>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {detailedPost.data.galleryImages.map((imgUrl: string, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedGalleryImage(imgUrl)}
                          className="aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 hover:border-pink-500/50 cursor-pointer relative group transition-all"
                        >
                          <img
                            src={imgUrl}
                            alt={`Backdrop ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            onError={e => {
                              const img = e.currentTarget;
                              if (!img.src.includes('/api/proxy-image')) {
                                img.src = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
                              }
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episodes List & Direct Links */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-indigo-400" />
                      <span>Episodes & Stream Links ({detailedPost.data.episodes?.length || 0})</span>
                    </h4>
                  </div>

                  {detailedPost.data.episodes && detailedPost.data.episodes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {detailedPost.data.episodes.map((ep: any, idx: number) => (
                        <div
                          key={ep.id || `detail-ep-${idx}`}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-2 hover:border-slate-700 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                              {ep.number || idx + 1}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-slate-200 truncate block">
                                {ep.label || `Episode ${idx + 1}`}
                              </span>
                              {ep.quality && (
                                <span className="text-[10px] text-amber-400 font-mono">
                                  {ep.quality}
                                </span>
                              )}
                            </div>
                          </div>

                          {ep.url && (
                            <a
                              href={ep.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition shrink-0 shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Stream</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                      No separate episodes attached to this post.
                    </div>
                  )}
                </div>

              </div>

              {/* Details Modal Actions Bottom Bar */}
              <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadJson(detailedPost.filename, JSON.stringify(detailedPost.data, null, 2))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => promptDeleteFile(detailedPost.folder, detailedPost.filename, detailedPost.data.title)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailedPost(null)}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPost(detailedPost.folder, detailedPost.filename)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-sky-500/25"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load into Studio Editor</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* FULL IMAGE PREVIEW LIGHTBOX */}
        {selectedGalleryImage && (
          <div
            className="fixed inset-0 z-[75] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setSelectedGalleryImage(null)}
          >
            <div className="relative max-w-4xl max-h-[85vh] rounded-xl overflow-hidden">
              <img
                src={selectedGalleryImage}
                alt="Enlarged gallery backdrop"
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
              <button
                type="button"
                onClick={() => setSelectedGalleryImage(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* IN-APP CONFIRMATION MODAL POPUP */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                  {confirmDialog.type === 'clear_all' ? (
                    <AlertTriangle className="w-6 h-6 text-rose-400" />
                  ) : (
                    <Trash2 className="w-6 h-6 text-rose-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-100">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{confirmDialog.message}</p>
                  {confirmDialog.targetName && (
                    <div className="mt-2.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-amber-300 break-all">
                      {confirmDialog.targetName}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isExecutingDelete}
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteConfirmedAction}
                  disabled={isExecutingDelete}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isExecutingDelete ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{confirmDialog.type === 'clear_all' ? 'Yes, Clear Entire Database' : 'Yes, Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN INDEX.JSON INSPECTOR & AUTO-INDEXER MODAL */}
        {indexModalOpen && (
          <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Header */}
              <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">data/index.json Auto-Index Manifest</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Auto-Indexed
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Central directory listing all {indexData?.totalPosts || 0} posts and their exact file paths (e.g. hnt10/file.json)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReindexDatabase}
                    disabled={reindexing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-purple-600/20 disabled:opacity-50"
                    title="Re-scan database directory and update index.json"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
                    <span>{reindexing ? 'Indexing...' : 'Re-Index All Files'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIndexModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-3 font-mono text-slate-300">
                  <span>File Location: <code className="text-purple-300 font-bold">data/index.json</code></span>
                  <span>•</span>
                  <span>Total Mapped Posts: <strong className="text-emerald-400">{indexData?.totalPosts || 0}</strong></span>
                  <span>•</span>
                  <span>Folders: <strong className="text-sky-400">{indexData?.totalFolders || 0}</strong></span>
                </div>

                {indexData?.updatedAt && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Last Indexed: {new Date(indexData.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Content Body: Split view with Location List & Raw JSON */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingIndex ? (
                  <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <span className="text-xs font-mono">Loading data/index.json...</span>
                  </div>
                ) : indexData ? (
                  <div className="space-y-4">
                    
                    {/* Visual Location Mapping List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ListTree className="w-4 h-4 text-purple-400" />
                          <span>Index Post Locations ({indexData.posts?.length || 0})</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Format: post "Title" available in hntX/file.json file
                        </span>
                      </h4>

                      <div className="max-h-64 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
                        {indexData.posts && indexData.posts.length > 0 ? (
                          indexData.posts.map((entry: any, idx: number) => (
                            <div
                              key={`${entry.file || idx}-${idx}`}
                              className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-purple-500/40 flex items-center justify-between gap-2 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {entry.thumbnail ? (
                                  <img
                                    src={entry.thumbnail}
                                    alt={entry.title}
                                    className="w-7 h-7 object-cover rounded-md border border-slate-700 shrink-0"
                                    onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                    {entry.file ? entry.file.split('/')[0] : 'hnt'}
                                  </span>
                                )}
                                <span className="text-slate-200 truncate font-semibold">
                                  {entry.title || 'Untitled'}
                                </span>
                              </div>

                              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                                {entry.file}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-500 text-xs font-sans">
                            No posts indexed yet in database.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Raw JSON Preview Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <FileCode className="w-4 h-4 text-amber-400" />
                          <span>Raw data/index.json Code</span>
                        </h4>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(indexData, null, 2));
                              setCopiedIndex(true);
                              setTimeout(() => setCopiedIndex(false), 2000);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
                          >
                            {copiedIndex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedIndex ? 'Copied!' : 'Copy JSON'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadJson('index.json', JSON.stringify(indexData, null, 2))}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download index.json</span>
                          </button>
                        </div>
                      </div>

                      <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-56 overflow-auto whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(indexData, null, 2)}
                      </pre>
                    </div>

                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Failed to render index data.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">
                  Accessible via GET route <code className="text-purple-300">/data/index.json</code>
                </span>

                <button
                  type="button"
                  onClick={() => setIndexModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
