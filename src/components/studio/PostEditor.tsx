import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { GalleryDisplay } from './GalleryDisplay';
import { savePostToLibrary } from '../../services/api';
import {
  Image as ImageIcon,
  Type,
  FileText,
  ListPlus,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
  Layers,
  ArrowUpDown,
  Tag,
  Sliders,
  Check,
  Save,
  Folder
} from 'lucide-react';

export const PostEditor: React.FC = () => {
  const {
    post,
    setPost,
    addEpisode,
    updateEpisode,
    removeEpisode,
    reorderEpisodes,
    clearEpisodes,
    templateSettings,
    setTemplateSettings,
    setBulkEpisodesModalOpen,
    setDataLibraryModalOpen,
    setLastSavedLocation
  } = useAppStore();

  const [newEpLabel, setNewEpLabel] = useState('');
  const [newEpUrl, setNewEpUrl] = useState('');
  const [newEpQuality, setNewEpQuality] = useState('1080p');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [isSavingLib, setIsSavingLib] = useState(false);
  const [saveLibFeedback, setSaveLibFeedback] = useState<string | null>(null);

  // Save current post to /data/hntX/ library
  const handleSaveToLibrary = async () => {
    if (!post.title && !post.websiteUrl) return;
    setIsSavingLib(true);
    try {
      const res = await savePostToLibrary(post);
      setLastSavedLocation({ folder: res.folder, filename: res.filename });
      setSaveLibFeedback(`Saved to data/${res.folder}/${res.filename}`);
      setTimeout(() => setSaveLibFeedback(null), 3000);
    } catch (err: any) {
      setSaveLibFeedback(`Error: ${err.message}`);
      setTimeout(() => setSaveLibFeedback(null), 4000);
    } finally {
      setIsSavingLib(false);
    }
  };

  // Quick single add handler
  const handleAddSingleEpisode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEpUrl.trim()) return;

    const label = newEpLabel.trim() || `Episode ${post.episodes.length + 1}`;
    addEpisode({
      label: newEpQuality !== 'none' && !label.includes(newEpQuality) ? `${label} [${newEpQuality}]` : label,
      url: newEpUrl.trim(),
      quality: newEpQuality !== 'none' ? newEpQuality : undefined,
      number: post.episodes.length + 1,
    });

    setNewEpLabel('');
    setNewEpUrl('');
    setShowAddForm(false);
  };

  // Sort episodes numerically
  const handleSortEpisodes = () => {
    const sorted = [...post.episodes].sort((a, b) => {
      const numA = a.number ?? parseInt(a.label.replace(/\D/g, '') || '0', 10);
      const numB = b.number ?? parseInt(b.label.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });
    reorderEpisodes(sorted);
  };

  // Insert tag into caption template
  const insertTemplateTag = (tag: string) => {
    const current = templateSettings.captionTemplate;
    setTemplateSettings({ captionTemplate: `${current} ${tag}` });
  };

  return (
    <div className="bg-[#131B2A] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <span>Post Editor</span>
        </h3>
        {saveLibFeedback && (
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 animate-in fade-in">
            {saveLibFeedback}
          </span>
        )}
      </div>

        {/* Thumbnail Preview & URL */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
          <div className="sm:col-span-1">
            <div className="relative aspect-video sm:aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group">
              {post.thumbnail ? (
                <>
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.src.includes('/api/proxy-image')) {
                        img.src = `/api/proxy-image?url=${encodeURIComponent(post.thumbnail)}`;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <a
                      href={post.thumbnail}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-black/60 rounded-lg text-white hover:text-sky-300 transition"
                      title="Open image in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center p-3 text-slate-600">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px]">No Thumbnail</span>
                </div>
              )}
            </div>
          </div>

          <div className="sm:col-span-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Thumbnail / Cover Image URL</span>
                <span className="text-[11px] text-slate-500">Displayed in Telegram photo header</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={post.thumbnail}
                  onChange={e => setPost({ thumbnail: e.target.value })}
                  placeholder="https://example.com/image.jpg..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Series / Post Title</span>
                <span className="text-[11px] text-slate-500 font-mono">{(post?.title || '').length} chars</span>
              </label>
              <input
                type="text"
                value={post?.title || ''}
                onChange={e => setPost({ title: e.target.value })}
                placeholder="Enter series or movie title..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[42px]"
              />
            </div>
          </div>
        </div>

        {/* Description / Synopsis */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              Synopsis / Description
            </span>
            <div className="flex items-center gap-2">
              {post?.synopsis && post.synopsis !== post.description && (
                <button
                  type="button"
                  onClick={() => setPost({ description: post.synopsis })}
                  className="text-[10px] text-sky-400 hover:text-sky-300 underline"
                >
                  Reset to Original Synopsis
                </button>
              )}
              <span className="text-[11px] text-slate-500 font-mono">{(post?.description || '').length} chars</span>
            </div>
          </label>
          <textarea
            rows={4}
            value={post?.description || ''}
            onChange={e => setPost({ description: e.target.value })}
            placeholder="Series synopsis, storyline, or episode breakdown..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-y leading-relaxed"
          />
        </div>

        {/* 1.5 Images Gallery (Screenshots / Backdrops) */}
        <GalleryDisplay
          images={post?.galleryImages || []}
          currentCover={post?.thumbnail || ''}
          onSelectCover={(url) => setPost({ thumbnail: url })}
          onRemoveImage={(removeIdx) => {
            const current = post?.galleryImages || [];
            const nextImages = current.filter((_, i) => i !== removeIdx);
            setPost({ galleryImages: nextImages });
          }}
          onAddImage={(newUrl) => {
            const current = post?.galleryImages || [];
            if (!current.includes(newUrl)) {
              setPost({ galleryImages: [...current, newUrl] });
            }
          }}
          onClearAll={() => setPost({ galleryImages: [] })}
        />

      {/* 2. Episode Links Manager Card */}
      <div className="pt-2 space-y-4">
        
        {/* Episodes Header & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-200">Episode Links</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {(post?.episodes || []).length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>Add Episode</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkEpisodesModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 transition"
            >
              <ListPlus className="w-3.5 h-3.5 text-purple-400" />
              <span>Bulk Paste</span>
            </button>

            {(post?.episodes || []).length > 1 && (
              <button
                type="button"
                onClick={handleSortEpisodes}
                title="Sort episodes numerically"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800/80 border border-slate-700"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            )}

            {(post?.episodes || []).length > 0 && (
              <button
                type="button"
                onClick={clearEpisodes}
                title="Clear all episodes"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-800/80 border border-slate-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Add Form Drawer */}
        {showAddForm && (
          <form onSubmit={handleAddSingleEpisode} className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/30 space-y-3 animate-in fade-in">
            <div className="text-xs font-semibold text-sky-400">Add New Episode Link:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newEpLabel}
                onChange={e => setNewEpLabel(e.target.value)}
                placeholder={`Episode ${(post?.episodes || []).length + 1}`}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <input
                type="url"
                required
                value={newEpUrl}
                onChange={e => setNewEpUrl(e.target.value)}
                placeholder="https://download-or-stream-url..."
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="flex items-center gap-2">
                <select
                  aria-label="Quality"
                  value={newEpQuality}
                  onChange={e => setNewEpQuality(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-sky-500"
                >
                  <option value="none">No Quality</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="4K">4K</option>
                </select>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition"
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Episodes List */}
        {post.episodes.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No episode links attached yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Extract from a website above or click "Bulk Paste" to insert multiple stream/download links.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {post.episodes.map((ep, idx) => (
              <div
                key={ep.id || `ep-${idx}-${ep.url || ep.label || idx}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs transition group"
              >
                {/* Index / Badge */}
                <span className="w-6 text-center font-mono text-[11px] text-slate-500 shrink-0">
                  #{idx + 1}
                </span>

                {/* Editable Label */}
                <input
                  type="text"
                  value={ep.label}
                  onChange={e => updateEpisode(ep.id, { label: e.target.value })}
                  placeholder="Episode Label"
                  className="w-36 sm:w-44 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                />

                {/* Editable URL */}
                <input
                  type="url"
                  value={ep.url}
                  onChange={e => updateEpisode(ep.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 truncate"
                />

                {/* Quality Badge Selector */}
                <select
                  aria-label="Episode Quality"
                  value={ep.quality || 'none'}
                  onChange={e => updateEpisode(ep.id, { quality: e.target.value === 'none' ? undefined : e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 font-mono focus:ring-1 focus:ring-sky-500 shrink-0"
                >
                  <option value="none">-</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="4K">4K</option>
                </select>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={ep.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded text-slate-500 hover:text-sky-400 transition"
                    title="Test destination link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeEpisode(ep.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                    title="Delete episode"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 3. Telegram Caption Template & Button Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <button
          type="button"
          onClick={() => setShowTemplateSettings(!showTemplateSettings)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold text-slate-200">Telegram Formatting & Buttons Layout</span>
            <span className="text-xs text-sky-400 font-medium ml-2">
              [{templateSettings.buttonsLayout.toUpperCase()}]
            </span>
          </div>
          {showTemplateSettings ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showTemplateSettings && (
          <div className="p-5 border-t border-slate-800 space-y-4 bg-slate-950/40">
            
            {/* Inline Buttons Layout Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Telegram Inline Keyboard Buttons Grid Layout:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {(['1-col', '2-col', '3-col', '4-col', 'none'] as const).map(layout => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setTemplateSettings({ buttonsLayout: layout })}
                    className={`px-3 py-2 rounded-xl border text-center font-medium transition ${
                      templateSettings.buttonsLayout === layout
                        ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {layout === 'none' ? 'No Buttons' : `${layout.replace('-col', '')} Column${layout === '1-col' ? '' : 's'}`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                2 Columns (e.g. [Ep 1] [Ep 2]) is optimal for mobile Telegram users.
              </p>
            </div>

            {/* Caption Template */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Caption Template (Supports Telegram HTML tags: &lt;b&gt;, &lt;i&gt;, &lt;a&gt;)
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-500">Insert tag:</span>
                  {['{title}', '{synopsis}', '{description}', '{episodes_list}', '{post_url}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTemplateTag(tag)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 hover:bg-sky-500 hover:text-white transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={5}
                value={templateSettings.captionTemplate}
                onChange={e => setTemplateSettings({ captionTemplate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-sky-500 resize-y"
              />
            </div>

            {/* Delivery Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateSettings.sendAsPhoto}
                  onChange={e => setTemplateSettings({ sendAsPhoto: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <span>Send as Photo Cover with Caption</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateSettings.sendGalleryAlbum !== false}
                  onChange={e => setTemplateSettings({ sendGalleryAlbum: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-pink-500 focus:ring-pink-500"
                />
                <span className="flex items-center gap-1.5 text-pink-300 font-medium">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Upload Gallery Photos as Album (MediaGroup)
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateSettings.includeTextLinks}
                  onChange={e => setTemplateSettings({ includeTextLinks: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <span>Include episode text hyperlinks in caption</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateSettings.disableNotification}
                  onChange={e => setTemplateSettings({ disableNotification: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <span>Silent Notification (Do not ring members)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateSettings.pinMessage}
                  onChange={e => setTemplateSettings({ pinMessage: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <span>Pin Message in Channel</span>
              </label>

              {templateSettings.sendGalleryAlbum !== false && (
                <div className="flex items-center gap-2 text-slate-400">
                  <span>Max Album Photos:</span>
                  <div className="flex items-center gap-1">
                    {[2, 4, 6, 8, 10].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setTemplateSettings({ maxGalleryImages: count })}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition ${
                          (templateSettings.maxGalleryImages || 5) === count
                            ? 'bg-pink-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
