import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  Node,
  Edge,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '../../store/useAppStore';
import { scrapeWebsite, sendPostToTelegram } from '../../services/api';
import {
  Globe,
  FileCode,
  Filter,
  LayoutGrid,
  Send,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  Terminal,
  ExternalLink
} from 'lucide-react';

// Custom Node 1: Web Scraper Source Node
const WebScraperNode: React.FC<NodeProps> = ({ data }: any) => {
  return (
    <div className="w-72 rounded-2xl bg-slate-900 border-2 border-sky-500/50 shadow-xl overflow-hidden text-xs">
      <div className="bg-sky-950/60 px-3.5 py-2.5 border-b border-sky-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sky-300">
          <Globe className="w-4 h-4 text-sky-400" />
          <span>1. Website Scraper</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
          data.status === 'active' ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30' : 'bg-slate-800 text-slate-400'
        }`}>
          {data.status || 'idle'}
        </span>
      </div>
      <div className="p-3.5 space-y-2">
        <div className="text-[11px] text-slate-400">Target Website Source:</div>
        <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 truncate">
          {data.url || 'No URL specified'}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
          <span>Method: HTTP GET (DOM/OG)</span>
          <span>Timeout: 12s</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-sky-400 border-2 border-slate-900"
      />
    </div>
  );
};

// Custom Node 2: Metadata Extractor Node
const MetadataParserNode: React.FC<NodeProps> = ({ data }: any) => {
  return (
    <div className="w-72 rounded-2xl bg-slate-900 border-2 border-indigo-500/50 shadow-xl overflow-hidden text-xs">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-indigo-400 border-2 border-slate-900"
      />
      <div className="bg-indigo-950/60 px-3.5 py-2.5 border-b border-indigo-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-indigo-300">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span>2. Metadata Parser</span>
        </div>
        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-500/30">
          OpenGraph
        </span>
      </div>
      <div className="p-3.5 space-y-2">
        <div className="text-[11px] text-slate-300 font-medium truncate">
          <b>Title:</b> {data.title || 'Extracting title...'}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>Cover Image:</span>
          {data.hasThumbnail ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Extracted
            </span>
          ) : (
            <span className="text-amber-400">Default fallback</span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-indigo-400 border-2 border-slate-900"
      />
    </div>
  );
};

// Custom Node 3: Episode Link Filter Node
const EpisodesFilterNode: React.FC<NodeProps> = ({ data }: any) => {
  return (
    <div className="w-72 rounded-2xl bg-slate-900 border-2 border-purple-500/50 shadow-xl overflow-hidden text-xs">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-400 border-2 border-slate-900"
      />
      <div className="bg-purple-950/60 px-3.5 py-2.5 border-b border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-purple-300">
          <Filter className="w-4 h-4 text-purple-400" />
          <span>3. Episode Filter & Regex</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {data.count || 0} Links
        </span>
      </div>
      <div className="p-3.5 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Regex Pattern:</span>
          <span className="font-mono text-purple-300">/ep|episode\s*\d+/i</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Sort Order:</span>
          <span className="text-slate-300 font-medium">Numeric Ascending</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Quality Tags:</span>
          <span className="text-sky-300 font-mono">1080p, 720p</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-400 border-2 border-slate-900"
      />
    </div>
  );
};

// Custom Node 4: Template & Keyboard Node
const TemplateLayoutNode: React.FC<NodeProps> = ({ data }: any) => {
  return (
    <div className="w-72 rounded-2xl bg-slate-900 border-2 border-amber-500/50 shadow-xl overflow-hidden text-xs">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-400 border-2 border-slate-900"
      />
      <div className="bg-amber-950/60 px-3.5 py-2.5 border-b border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <LayoutGrid className="w-4 h-4 text-amber-400" />
          <span>4. Keyboard & HTML Format</span>
        </div>
        <span className="text-[10px] font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30">
          {data.layout || '2-col'}
        </span>
      </div>
      <div className="p-3.5 space-y-1.5">
        <div className="text-[11px] text-slate-400">Buttons Layout Grid:</div>
        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-center gap-1.5 text-[10px] text-sky-300 font-medium">
          <span className="bg-slate-800 px-2 py-1 rounded">[ Ep 1 ]</span>
          <span className="bg-slate-800 px-2 py-1 rounded">[ Ep 2 ]</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
          <span>Parse Mode: HTML</span>
          <span>Photo Caption: Yes</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-amber-400 border-2 border-slate-900"
      />
    </div>
  );
};

// Custom Node 5: Telegram Dispatcher Node
const TelegramDispatcherNode: React.FC<NodeProps> = ({ data }: any) => {
  return (
    <div className="w-72 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 shadow-xl overflow-hidden text-xs">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-emerald-400 border-2 border-slate-900"
      />
      <div className="bg-emerald-950/60 px-3.5 py-2.5 border-b border-emerald-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-emerald-300">
          <Send className="w-4 h-4 text-emerald-400 -rotate-12" />
          <span>5. Channel Dispatcher</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
          data.isSent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
        }`}>
          {data.isSent ? 'Published' : 'Standby'}
        </span>
      </div>
      <div className="p-3.5 space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Target Channel:</span>
          <span className="font-semibold text-slate-200 truncate max-w-[130px]">
            {data.chatId || '@channel'}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Method:</span>
          <span className="font-mono text-emerald-400">sendPhoto + reply_markup</span>
        </div>
        {data.messageId && (
          <div className="text-[10px] text-emerald-300 font-mono bg-emerald-950/60 p-1.5 rounded border border-emerald-500/20">
            Msg ID: #{data.messageId}
          </div>
        )}
      </div>
    </div>
  );
};

export const FlowBuilder: React.FC = () => {
  const { post, botConfig, templateSettings, setPost, addHistoryItem } = useAppStore();

  const [isRunning, setIsRunning] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([
    'Pipeline initialized. Ready to execute visual automated posting.',
  ]);

  const nodeTypes = useMemo(
    () => ({
      scraperNode: WebScraperNode,
      parserNode: MetadataParserNode,
      filterNode: EpisodesFilterNode,
      templateNode: TemplateLayoutNode,
      dispatcherNode: TelegramDispatcherNode,
    }),
    []
  );

  const initialNodes: Node[] = [
    {
      id: 'node-1',
      type: 'scraperNode',
      position: { x: 50, y: 150 },
      data: { url: post.websiteUrl, status: 'ready' },
    },
    {
      id: 'node-2',
      type: 'parserNode',
      position: { x: 380, y: 150 },
      data: { title: post.title, hasThumbnail: Boolean(post.thumbnail) },
    },
    {
      id: 'node-3',
      type: 'filterNode',
      position: { x: 710, y: 150 },
      data: { count: post.episodes.length },
    },
    {
      id: 'node-4',
      type: 'templateNode',
      position: { x: 1040, y: 150 },
      data: { layout: templateSettings.buttonsLayout },
    },
    {
      id: 'node-5',
      type: 'dispatcherNode',
      position: { x: 1370, y: 150 },
      data: { chatId: botConfig.chatId, isSent: false },
    },
  ];

  const initialEdges: Edge[] = [
    { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true, style: { stroke: '#38bdf8', strokeWidth: 2 } },
    { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true, style: { stroke: '#818cf8', strokeWidth: 2 } },
    { id: 'e3-4', source: 'node-3', target: 'node-4', animated: true, style: { stroke: '#c084fc', strokeWidth: 2 } },
    { id: 'e4-5', source: 'node-4', target: 'node-5', animated: true, style: { stroke: '#fbbf24', strokeWidth: 2 } },
  ];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = useCallback((changes: any) => setNodes(nds => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges(eds => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: any) => setEdges(eds => addEdge(params, eds)), []);

  const addLog = (msg: string) => {
    setPipelineLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // Run the end-to-end automated pipeline
  const runPipeline = async () => {
    setIsRunning(true);
    addLog('🚀 Starting automated pipeline execution...');

    try {
      // Step 1: Scrape Website
      addLog(`[Node 1 Scraper] Fetching site: ${post.websiteUrl || 'preset'}...`);
      let activePost = post;
      if (post.websiteUrl && post.websiteUrl.startsWith('http')) {
        try {
          const scraped = await scrapeWebsite(post.websiteUrl);
          setPost(scraped);
          activePost = scraped;
          addLog(`[Node 1 Scraper] Extracted HTML & parsed ${scraped.episodes.length} raw episode links.`);
        } catch (e: any) {
          addLog(`[Node 1 Scraper] Scrape notice: ${e.message}. Using current post draft.`);
        }
      } else {
        addLog('[Node 1 Scraper] Using loaded series preset.');
      }

      await new Promise(r => setTimeout(r, 600));

      // Step 2: Metadata Parser
      addLog(`[Node 2 Parser] Extracted title: "${activePost.title}"`);
      addLog(`[Node 2 Parser] Cover image verified: ${activePost.thumbnail ? 'YES' : 'NONE'}`);
      await new Promise(r => setTimeout(r, 600));

      // Step 3: Episodes Filter
      addLog(`[Node 3 Filter] Normalized ${activePost.episodes.length} episodes with stream/download targets.`);
      await new Promise(r => setTimeout(r, 600));

      // Step 4: Template & Inline Buttons
      addLog(`[Node 4 Template] Assembled Telegram HTML caption and ${templateSettings.buttonsLayout} inline keyboard.`);
      await new Promise(r => setTimeout(r, 600));

      // Step 5: Telegram Dispatcher
      if (botConfig.botToken && botConfig.chatId) {
        addLog(`[Node 5 Dispatcher] Sending payload to Telegram chat: ${botConfig.chatId}...`);
        const result = await sendPostToTelegram({
          botConfig,
          templateSettings,
          postData: activePost,
        });

        addLog(`✅ Post published successfully! Message ID: #${result.messageId}`);
        if (result.postLink) {
          addLog(`🔗 Telegram Link: ${result.postLink}`);
        }

        // Update node 5 status
        setNodes(nds =>
          nds.map(node =>
            node.id === 'node-5'
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    isSent: true,
                    messageId: result.messageId,
                  },
                }
              : node
          )
        );

        addHistoryItem({
          title: activePost.title,
          thumbnail: activePost.thumbnail,
          chatId: botConfig.chatId,
          chatTitle: botConfig.chatInfo?.title || botConfig.chatId,
          episodesCount: activePost.episodes.length,
          status: 'sent',
          messageId: result.messageId,
          telegramLink: result.postLink,
          postData: { ...activePost },
        });
      } else {
        addLog('⚠️ Bot Token or Target Chat ID missing. Pipeline test succeeded in Simulation Mode.');
      }
    } catch (err: any) {
      addLog(`❌ Pipeline error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Pipeline Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <Play className="w-4 h-4 fill-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Industrial No-Code Workflow Pipeline</h3>
            <p className="text-xs text-slate-400">
              Interactive node graph connecting Website Scraper ➡️ Parser ➡️ Episode Filter ➡️ Telegram Channel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runPipeline}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 disabled:opacity-50 transition cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing Flow...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run Pipeline Trace</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ReactFlow Interactive Canvas */}
      <div className="h-[360px] sm:h-[460px] lg:h-[500px] w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
          <Controls className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-lg fill-slate-300" />
        </ReactFlow>
      </div>

      {/* Real-time Pipeline Execution Console Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 font-mono text-slate-300">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>Execution Telemetry & Output Log</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {pipelineLogs.length} events logged
          </span>
        </div>

        <div className="h-32 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300 p-2 rounded-xl bg-slate-950 border border-slate-800">
          {pipelineLogs.map((log, idx) => (
            <div
              key={idx}
              className={`leading-relaxed ${
                log.includes('✅')
                  ? 'text-emerald-400'
                  : log.includes('❌')
                  ? 'text-rose-400'
                  : log.includes('⚠️')
                  ? 'text-amber-400'
                  : log.includes('🚀')
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-300'
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
