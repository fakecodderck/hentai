import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Plus,
  Maximize2,
  Check,
  X,
  Sparkles
} from 'lucide-react';

interface GalleryDisplayProps {
  images: string[];
  currentCover?: string;
  onSelectCover: (url: string) => void;
  onRemoveImage: (index: number) => void;
  onAddImage?: (url: string) => void;
  onClearAll?: () => void;
}

export const GalleryDisplay: React.FC<GalleryDisplayProps> = ({
  images = [],
  currentCover = '',
  onSelectCover,
  onRemoveImage,
  onAddImage,
  onClearAll,
}) => {
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newImageUrl.trim();
    if (trimmed && onAddImage) {
      onAddImage(trimmed);
      setNewImageUrl('');
      setShowAddInput(false);
    }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-800/80">
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <ImageIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Post Gallery & Screenshots</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20">
            {images.length} {images.length === 1 ? 'image' : 'images'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddInput(!showAddInput)}
            className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 px-2 py-1 rounded-lg transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Screenshot</span>
          </button>

          {images.length > 0 && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] text-slate-500 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-950/20 transition cursor-pointer"
              title="Remove all gallery screenshots"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Optional Add Image Bar */}
      {showAddInput && (
        <form onSubmit={handleAddSubmit} className="flex items-center gap-2 p-2 bg-slate-950/80 rounded-xl border border-slate-800 animate-in fade-in duration-150">
          <input
            type="url"
            value={newImageUrl}
            onChange={e => setNewImageUrl(e.target.value)}
            placeholder="Paste direct screenshot or backdrop image URL (https://...)"
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newImageUrl.trim()}
            className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white text-xs font-medium transition cursor-pointer"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddInput(false);
              setNewImageUrl('');
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Gallery Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 max-h-72 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800/60">
          {images.map((imgUrl, idx) => {
            const isCover = currentCover === imgUrl;

            return (
              <div
                key={`${imgUrl}-${idx}`}
                className={`group relative rounded-xl overflow-hidden border transition-all duration-200 aspect-video bg-slate-900 shadow-sm ${
                  isCover
                    ? 'border-sky-500 ring-2 ring-sky-500/60 shadow-sky-500/20'
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* Image Thumbnail */}
                <img
                  src={imgUrl}
                  alt={`Screenshot ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105 cursor-pointer"
                  onClick={() => onSelectCover(imgUrl)}
                  title="Click to set as Main Cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.src.includes('/api/proxy-image')) {
                      img.src = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
                    }
                  }}
                />

                {/* Top Badges & Actions Overlay */}
                <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between pointer-events-none z-10">
                  {/* Active Cover Badge */}
                  {isCover ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500 text-[9px] font-bold text-white shadow-md">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      Cover
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-slate-300">
                      #{idx + 1}
                    </span>
                  )}

                  {/* Top Action Buttons (Removal & Zoom) */}
                  <div className="flex items-center gap-1 pointer-events-auto">
                    {/* Zoom / Lightbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxUrl(imgUrl);
                      }}
                      className="p-1 rounded-md bg-black/70 hover:bg-black text-slate-300 hover:text-white transition opacity-0 group-hover:opacity-100 shadow-sm cursor-pointer"
                      title="View full resolution"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>

                    {/* Delete / Remove Thumbnail Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveImage(idx);
                      }}
                      className="p-1 rounded-md bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition opacity-80 group-hover:opacity-100 shadow-sm cursor-pointer"
                      title="Remove this thumbnail from gallery"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Bottom Overlay: Click to Set Cover */}
                <div
                  className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                  onClick={() => onSelectCover(imgUrl)}
                >
                  <span className="text-[10px] font-semibold text-sky-200">
                    {isCover ? 'Active Post Cover' : 'Set as Cover'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-center space-y-2">
          <ImageIcon className="w-6 h-6 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">No screenshot thumbnails extracted for this post yet.</p>
          <button
            type="button"
            onClick={() => setShowAddInput(true)}
            className="text-[11px] text-sky-400 hover:text-sky-300 font-medium underline"
          >
            Add a screenshot URL manually
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <span className="truncate max-w-md font-mono text-[11px] text-slate-400">{lightboxUrl}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCover(lightboxUrl);
                    setLightboxUrl(null);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Set as Main Cover</span>
                </button>
                <a
                  href={lightboxUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-slate-950 min-h-[300px]">
              <img
                src={lightboxUrl}
                alt="Enlarged screenshot"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.includes('/api/proxy-image')) {
                    img.src = `/api/proxy-image?url=${encodeURIComponent(lightboxUrl)}`;
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
