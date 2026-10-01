import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { EpisodeItem } from '../types';
import { X, ListPlus, Sparkles, Link, Trash2, Check } from 'lucide-react';

export const BulkEpisodesModal: React.FC = () => {
  const { bulkEpisodesModalOpen, setBulkEpisodesModalOpen, addEpisode, setPost } = useAppStore();
  const [rawText, setRawText] = useState('');
  const [defaultQuality, setDefaultQuality] = useState('1080p');
  const [mode, setMode] = useState<'append' | 'replace'>('append');

  if (!bulkEpisodesModalOpen) return null;

  // Real-time parsing of pasted text
  const parseLines = (text: string): Omit<EpisodeItem, 'id'>[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: Omit<EpisodeItem, 'id'>[] = [];

    lines.forEach((line, index) => {
      // Find URL in line
      const urlMatch = line.match(/(https?:\/\/[^\s]+|tg:\/\/[^\s]+)/i);
      if (!urlMatch) return;

      const url = urlMatch[1];
      let remaining = line.replace(url, '').replace(/[-–—:|()\[\]]/g, ' ').trim();

      // Extract quality if present
      const qMatch = line.match(/\b(360p|480p|720p|1080p|2160p|4k|hd|fhd)\b/i);
      const quality = qMatch ? qMatch[1].toUpperCase() : (defaultQuality !== 'none' ? defaultQuality : undefined);

      // Episode number matching
      const epMatch = line.match(/\b(?:ep|episode|eps|e)[\s._-]*([0-9]{1,4})\b/i);
      const epNumber = epMatch ? parseInt(epMatch[1], 10) : index + 1;

      let label = remaining.trim();
      if (!label || label.length > 35) {
        label = `Episode ${epNumber}`;
      }
      if (quality && !label.includes(quality)) {
        label = `${label} [${quality}]`;
      }

      parsed.push({
        label,
        url,
        quality,
        number: epNumber,
      });
    });

    return parsed;
  };

  const parsedItems = parseLines(rawText);

  const handleApply = () => {
    if (parsedItems.length === 0) return;

    if (mode === 'replace') {
      const episodesWithId: EpisodeItem[] = parsedItems.map((ep, idx) => ({
        id: `ep-${Date.now()}-${idx}`,
        ...ep,
      }));
      setPost({ episodes: episodesWithId });
    } else {
      parsedItems.forEach(ep => addEpisode(ep));
    }

    setRawText('');
    setBulkEpisodesModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Bulk Episode Links Parser</h2>
              <p className="text-xs text-slate-400">Paste multiple episode links or lines to generate buttons instantly</p>
            </div>
          </div>
          <button
            onClick={() => setBulkEpisodesModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* Options Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Mode:</span>
              <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('append')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    mode === 'append' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Append to existing
                </button>
                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    mode === 'replace' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Replace all
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Default Quality:</span>
              <select
                aria-label="Default Quality"
                value={defaultQuality}
                onChange={e => setDefaultQuality(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-sky-500"
              >
                <option value="none">None</option>
                <option value="1080p">1080p FHD</option>
                <option value="720p">720p HD</option>
                <option value="480p">480p SD</option>
                <option value="4K">4K UHD</option>
              </select>
            </div>
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Paste Links (1 per line or with titles):</span>
              <span className="text-[11px] text-slate-500 font-mono">
                {parsedItems.length} valid links detected
              </span>
            </label>
            <textarea
              rows={7}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Example formats accepted:
Episode 1 - https://stream.io/watch/ep01
Ep 02 [1080p] https://stream.io/watch/ep02
Episode 03 https://stream.io/watch/ep03
https://stream.io/watch/ep04`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Parsed Preview */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Preview of Detected Episode Buttons ({parsedItems.length}):
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-950/80 border border-slate-800 p-2 space-y-1.5">
                {parsedItems.map((ep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-200">{ep.label}</span>
                      <span className="text-[11px] text-slate-500 truncate max-w-xs font-mono">{ep.url}</span>
                    </div>
                    {ep.quality && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                        {ep.quality}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRawText('')}
            disabled={!rawText}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Input
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkEpisodesModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={parsedItems.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Apply {parsedItems.length} Episodes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
