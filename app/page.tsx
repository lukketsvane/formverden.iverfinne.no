'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, BookOpen, ChevronDown, Play, Pause, RotateCcwSquare, RotateCwSquare, ExternalLink } from 'lucide-react';
import traktatData from '@/data/traktat.json';
import referencesData from '@/data/references.json';
import notesData from '@/data/notes.json';
import foreordData from '@/data/foreord.json';
import etterordData from '@/data/etterord.json';
import ordlisteData from '@/data/ordliste.json';

interface GlossaryEntry {
  term: string;
  body: string;
  ref: string;
  aliases?: string[];
}
const ordliste = ordlisteData as Record<string, GlossaryEntry>;

const termMatchers: { key: string; pattern: RegExp }[] = (() => {
  const entries: { key: string; variants: string[] }[] = [];
  for (const [key, entry] of Object.entries(ordliste)) {
    const variants = [entry.term.replace(/\s*\([^)]*\)\s*/, '').toLowerCase(), ...(entry.aliases ?? [])];
    entries.push({ key, variants: Array.from(new Set(variants)) });
  }
  entries.sort((a, b) => Math.max(...b.variants.map(v => v.length)) - Math.max(...a.variants.map(v => v.length)));
  return entries.map(({ key, variants }) => ({
    key,
    pattern: new RegExp(`\\b(${variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i'),
  }));
})();

const statusDefs: Record<string, { name: string; body: string }> = {
  d: { name: 'definisjon', body: 'Ein innføring av omgrep eller struktur som dei etterfølgjande proposisjonane byggjer på.' },
  a: { name: 'postulat', body: 'Ein grunnsetning som ikkje er avleia frå andre proposisjonar, men som rammeverket kviler på.' },
  t: { name: 'teorem', body: 'Ein påstand avleia frå definisjonar og postulat; falsifiserbar.' },
  o: { name: 'observasjon', body: 'Ein empirisk påstand som er open for måling og test.' },
  i: { name: 'illustrasjon', body: 'Eit eksempel som konkretiserer, ikkje utvidar, rammeverket.' },
};

function linkTerms(html: string): string {
  const parts = html.split(/(<[^>]+>)/g);
  return parts.map(part => {
    if (part.startsWith('<') || !part) return part;
    let out = part;
    for (const { key, pattern } of termMatchers) {
      out = out.replace(pattern, (match) => `<span class="term" data-term="${key}">${match}</span>`);
    }
    return out;
  }).join('');
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'signature'; text: string }
  | { type: 'stats'; items: { label: string; value: string; ref?: string }[] };

interface SectionData {
  title: string;
  blocks: Block[];
}

const foreord = foreordData as SectionData;
const etterord = etterordData as SectionData;

const references = referencesData as Record<string, { text: string; doi?: string; url?: string }>;

interface Note {
  kind: 'note' | 'falsifisering';
  label?: string;
  text: string;
}
const notes = notesData as Record<string, Note[]>;

function extractRefIds(html: string): string[] {
  const ids: string[] = [];
  const re = /<sup class="footnote-ref">([^<]+)<\/sup>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    m[1].split(/[,\s]+/).filter(Boolean).forEach(n => {
      if (!ids.includes(n)) ids.push(n);
    });
  }
  return ids;
}

function linkifyDoi(text: string): string {
  return text.replace(/\b(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)\b/gi, (doi) =>
    `<a href="https://doi.org/${doi}" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted hover:decoration-solid">doi:${doi}</a>`
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface Proposition {
  id: string;
  text: string;
  status?: string;
  children?: Proposition[];
}

interface FlattenedNode {
  node: Proposition;
  depth: number;
  parentId: string | null;
}

function getVisibleNodes(nodes: Proposition[], expandedIds: Set<string>, depth = 0, parentId: string | null = null): FlattenedNode[] {
  let result: FlattenedNode[] = [];
  for (const node of nodes) {
    result.push({ node, depth, parentId });
    if (expandedIds.has(node.id) && node.children && node.children.length > 0) {
      result = result.concat(getVisibleNodes(node.children, expandedIds, depth + 1, node.id));
    }
  }
  return result;
}

function Section({ data, onBlockClick, hideTitle, sectionRef }: { data: SectionData; onBlockClick: (id: string, text: string) => void; hideTitle?: boolean; sectionRef?: React.Ref<HTMLElement> }) {
  return (
    <section ref={sectionRef} className="my-16 md:my-24">
      {!hideTitle && (
        <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-black mb-6 md:mb-8">{data.title}</h2>
      )}
      <div className="flex flex-col gap-4 max-w-3xl">
        {data.blocks.map((block, i) => {
          const blockId = `${data.title} · §${i + 1}`;
          if (block.type === 'paragraph') {
            return (
              <p
                key={i}
                className="text-base md:text-xl font-serif text-black leading-snug traktat-content cursor-pointer -mx-2 px-2 py-1 rounded"
                onClick={() => onBlockClick(blockId, block.text)}
                dangerouslySetInnerHTML={{ __html: linkTerms(block.text) }}
              />
            );
          }
          if (block.type === 'signature') {
            return (
              <p key={i} className="text-lg md:text-xl font-serif italic text-black text-right mt-4">
                {block.text}
              </p>
            );
          }
          if (block.type === 'stats') {
            return (
              <dl key={i} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 my-4 font-mono text-sm md:text-base">
                {block.items.map((s, j) => (
                  <div key={j} className="contents">
                    <dt className="text-black">{s.label}</dt>
                    <dd className="text-black tabular-nums whitespace-nowrap">
                      {s.value}
                      {s.ref && <sup className="footnote-ref text-[10px] text-gray-400 ml-1">{s.ref}</sup>}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}

function computeSubDepth(node: Proposition): number {
  if (!node.children || node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(computeSubDepth));
}

function flattenAll(nodes: Proposition[], depth = 0, parentId: string | null = null): FlattenedNode[] {
  let result: FlattenedNode[] = [];
  for (const node of nodes) {
    result.push({ node, depth, parentId });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenAll(node.children, depth + 1, node.id));
    }
  }
  return result;
}

function audioUrlForNode(node: { id: string; status?: string }): string {
  const s = node.status ?? '';
  return `/audio/tts-enceladius/${node.id}${s}.wav`;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75];

function AudioPlayer({ src, nodeId, onEnded }: { src: string; nodeId: string; onEnded: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rateIdx, setRateIdx] = useState(0);
  const [available, setAvailable] = useState(true);
  // If the user was playing when a track advanced, keep playing on the next.
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    setAvailable(true);
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = PLAYBACK_RATES[rateIdx];
    if (wasPlayingRef.current) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = PLAYBACK_RATES[rateIdx];
  }, [rateIdx]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const skip = (s: number) => {
    const el = audioRef.current;
    if (!el) return;
    if (!isFinite(el.duration)) {
      el.currentTime = Math.max(0, el.currentTime + s);
      return;
    }
    el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + s));
  };

  const share = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/${nodeId}`;
    const nav = window.navigator;
    try {
      if (nav && typeof (nav as Navigator & { share?: (d: { title?: string; url: string }) => Promise<void> }).share === 'function') {
        await (nav as Navigator & { share: (d: { title?: string; url: string }) => Promise<void> }).share({ title: `formlære · ${nodeId}`, url });
        return;
      }
      if (nav && nav.clipboard) {
        await nav.clipboard.writeText(url);
      }
    } catch { /* user cancelled or unsupported */ }
  };

  // Layout tuned for iOS thumb reach:
  //   [ 1.0× ]          [ ⏪ ⏩ ]   [ ▶ ]   [ ↗ ]
  //   speed sits on the far left (rarely touched); skip pair, play, and
  //   share cluster in the bottom-right thumb zone on iPhone.
  return (
    <div className="flex items-center text-black/70 w-full">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => { wasPlayingRef.current = true; setIsPlaying(false); onEnded(); }}
        onError={() => setAvailable(false)}
        onLoadedData={() => setAvailable(true)}
        onPlay={() => { wasPlayingRef.current = true; setIsPlaying(true); }}
        onPause={() => { wasPlayingRef.current = false; setIsPlaying(false); }}
        preload="metadata"
      />
      <button
        onClick={() => setRateIdx((rateIdx + 1) % PLAYBACK_RATES.length)}
        className="font-mono text-sm px-1 py-0.5 tabular-nums hover:text-black"
        aria-label={`Hastigheit ${PLAYBACK_RATES[rateIdx]}×`}
        disabled={!available}
      >
        {PLAYBACK_RATES[rateIdx].toFixed(PLAYBACK_RATES[rateIdx] % 1 === 0 ? 1 : 2)}×
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <button
          onClick={() => skip(-10)}
          aria-label="Hopp 10s tilbake"
          className="hover:text-black p-2 disabled:opacity-30"
          disabled={!available}
        >
          <RotateCcwSquare size={22} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => skip(10)}
          aria-label="Hopp 10s fram"
          className="hover:text-black p-2 disabled:opacity-30"
          disabled={!available}
        >
          <RotateCwSquare size={22} strokeWidth={1.75} />
        </button>
      </div>
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Spel'}
        className="text-black p-2 ml-3 disabled:opacity-30"
        disabled={!available}
      >
        {isPlaying ? <Pause size={34} strokeWidth={1.75} fill="currentColor" /> : <Play size={34} strokeWidth={1.75} fill="currentColor" />}
      </button>
      <button
        onClick={share}
        aria-label="Del lenkje"
        title="Del lenkje"
        className="p-2 ml-2 hover:text-black"
      >
        <ExternalLink size={20} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export default function Home() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['1', '1.3', '1.31']));
  const [selectedId, setSelectedId] = useState<string>((traktatData as Proposition[])[0].id);
  // Audio has its own cursor. Scrolling never changes it — only explicit taps
  // on a row or the natural end-of-track auto-advance do.
  const [audioNodeId, setAudioNodeId] = useState<string>((traktatData as Proposition[])[0].id);
  const [showFootnotes, setShowFootnotes] = useState(false);

  const allNodesFlattened = useMemo(() => flattenAll(traktatData as Proposition[]), []);
  
  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    allNodesFlattened.forEach(n => {
      map.set(n.node.id, n.parentId);
    });
    return map;
  }, [allNodesFlattened]);

  const visibleNodes = useMemo(() => {
    return getVisibleNodes(traktatData as Proposition[], expandedIds);
  }, [expandedIds]);

  const safeSelectedIndex = useMemo(() => {
    const idx = visibleNodes.findIndex(n => n.node.id === selectedId);
    return idx !== -1 ? idx : 0;
  }, [visibleNodes, selectedId]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAncestors = useCallback((nodeId: string) => {
    const ancestors: string[] = [];
    let p = parentMap.get(nodeId);
    while (p) {
      ancestors.push(p);
      p = parentMap.get(p);
    }
    if (ancestors.length > 0) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        ancestors.forEach(a => next.add(a));
        return next;
      });
    }
  }, [parentMap]);

  const foreordRef = useRef<HTMLElement>(null);
  const etterordRef = useRef<HTMLElement>(null);
  const didInitialRouteRef = useRef(false);

  useEffect(() => {
    if (didInitialRouteRef.current) return;
    didInitialRouteRef.current = true;
    let slug = '';
    try {
      slug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, ''));
    } catch {
      slug = window.location.pathname.replace(/^\/+|\/+$/g, '');
    }
    if (!slug) return;
    const lower = slug.toLowerCase();
    if (lower === 'forord' || lower === 'føreord' || lower === 'foreord') {
      requestAnimationFrame(() => foreordRef.current?.scrollIntoView({ block: 'start' }));
      return;
    }
    if (lower === 'etterord') {
      requestAnimationFrame(() => etterordRef.current?.scrollIntoView({ block: 'start' }));
      return;
    }
    const found = allNodesFlattened.find(n => n.node.id === slug);
    if (found) {
      // Expand the target's ancestors AND the target itself (so its children show as context),
      // then select. The [selectedId] effect will scroll it into view.
      setExpandedIds(prev => {
        const next = new Set(prev);
        let p: string | null | undefined = found.node.id;
        while (p) {
          next.add(p);
          p = parentMap.get(p);
        }
        return next;
      });
      setSelectedId(found.node.id);
      setAudioNodeId(found.node.id);
    }
  }, [allNodesFlattened, expandAncestors, parentMap]);

  useEffect(() => {
    if (!didInitialRouteRef.current) return;
    const target = `/${selectedId}`;
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [selectedId]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [] as FlattenedNode[];
    return allNodesFlattened.filter(n =>
      n.node.id.toLowerCase().includes(q) ||
      stripHtml(n.node.text).toLowerCase().includes(q)
    );
  }, [searchQuery, allNodesFlattened]);

  const jumpToMatch = useCallback((nodeId: string) => {
    expandAncestors(nodeId);
    setSelectedId(nodeId);
  }, [expandAncestors]);

  useEffect(() => {
    if (searchMatches.length > 0 && searchQuery.trim().length >= 3) {
      jumpToMatch(searchMatches[0].node.id);
    }
  }, [searchMatches, searchQuery, jumpToMatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      if (searchOpen) {
        if (e.key === 'Escape') {
          setSearchOpen(false);
          setSearchQuery('');
        }
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key.toLowerCase() === 'h') {
        setShowFootnotes(prev => !prev);
        return;
      }

      const currentVisible = visibleNodes[safeSelectedIndex];
      if (!currentVisible) return;

      switch (e.key) {
        case 'ArrowDown': {
          const next = visibleNodes[safeSelectedIndex + 1];
          if (next) setSelectedId(next.node.id);
          break;
        }
        case 'ArrowUp': {
          const prev = visibleNodes[safeSelectedIndex - 1];
          if (prev) setSelectedId(prev.node.id);
          break;
        }
        case 'ArrowRight': {
          if (currentVisible.node.children && currentVisible.node.children.length > 0) {
            if (!expandedIds.has(currentVisible.node.id)) {
              toggleExpand(currentVisible.node.id);
            } else {
              const next = visibleNodes[safeSelectedIndex + 1];
              if (next) setSelectedId(next.node.id);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          if (expandedIds.has(currentVisible.node.id)) {
            toggleExpand(currentVisible.node.id);
          } else if (currentVisible.parentId) {
            setSelectedId(currentVisible.parentId);
          }
          break;
        }
        case 'Enter':
        case ' ': {
          if (currentVisible.node.children && currentVisible.node.children.length > 0) {
            toggleExpand(currentVisible.node.id);
          }
          break;
        }
        case 'n':
        case 'N': {
          const globalIdx = allNodesFlattened.findIndex(n => n.node.id === selectedId);
          if (globalIdx !== -1 && globalIdx < allNodesFlattened.length - 1) {
            const nextNode = allNodesFlattened[globalIdx + 1];
            expandAncestors(nextNode.node.id);
            setSelectedId(nextNode.node.id);
          }
          break;
        }
        case 'b':
        case 'B': {
          const globalIdx = allNodesFlattened.findIndex(n => n.node.id === selectedId);
          if (globalIdx > 0) {
            const prevNode = allNodesFlattened[globalIdx - 1];
            expandAncestors(prevNode.node.id);
            setSelectedId(prevNode.node.id);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleNodes, safeSelectedIndex, expandedIds, toggleExpand, selectedId, allNodesFlattened, expandAncestors, searchOpen]);

  // Horizontal swipes only — vertical is reserved for native iOS scroll.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx > 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }
  };

  const selectedRef = useRef<HTMLDivElement>(null);
  // Suppress programmatic scroll-into-view when the selection change came from the user's own scroll
  // (IntersectionObserver) or a tap on a visible row.
  const suppressScrollRef = useRef(false);
  // Track when we're scrolling programmatically so the IntersectionObserver doesn't fight back.
  const programmaticScrollUntilRef = useRef(0);
  useEffect(() => {
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    if (selectedRef.current) {
      programmaticScrollUntilRef.current = Date.now() + 600;
      selectedRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [selectedId]);

  // Scroll-driven panel updates: as the user reads, update the selected node so the
  // notes/references panel follows along. Suppress while we're programmatically scrolling.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const visibleMap = new Map<string, IntersectionObserverEntry>();
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < programmaticScrollUntilRef.current) return;
        entries.forEach(e => {
          const id = (e.target as HTMLElement).dataset.pid;
          if (id) visibleMap.set(id, e);
        });
        let topId: string | null = null;
        let topY = Infinity;
        visibleMap.forEach((e, id) => {
          if (e.isIntersecting) {
            const y = e.boundingClientRect.top;
            if (y < topY && y >= 0) { topY = y; topId = id; }
          }
        });
        if (topId && topId !== selectedId) {
          suppressScrollRef.current = true;
          setSelectedId(topId);
        }
      },
      { root, rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.25, 0.75, 1] }
    );
    const els = root.querySelectorAll<HTMLElement>('[data-pid]');
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [visibleNodes, selectedId]);

  const selectedNode = visibleNodes[safeSelectedIndex]?.node;
  const audioNode = useMemo(
    () => allNodesFlattened.find(n => n.node.id === audioNodeId)?.node ?? null,
    [allNodesFlattened, audioNodeId]
  );
  const currentRefIds = useMemo(
    () => (selectedNode ? extractRefIds(selectedNode.text) : []),
    [selectedNode]
  );
  const currentNotes = useMemo(
    () => (selectedNode ? notes[selectedNode.id] ?? [] : []),
    [selectedNode]
  );

  const [panel, setPanel] = useState<{ id: string; notes: Note[]; refIds: string[] } | null>(null);
  useEffect(() => {
    if (selectedNode && (currentNotes.length > 0 || currentRefIds.length > 0)) {
      setPanel({ id: selectedNode.id, notes: currentNotes, refIds: currentRefIds });
    }
  }, [selectedNode, currentNotes, currentRefIds]);

  const showBlockRefs = useCallback((id: string, text: string) => {
    const refIds = extractRefIds(text);
    if (refIds.length > 0) {
      setPanel({ id, notes: [], refIds });
    }
  }, []);

  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [highlightRef, setHighlightRef] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    const termEl = target.closest('[data-term]');
    if (termEl) {
      e.stopPropagation();
      const key = termEl.getAttribute('data-term');
      if (key && ordliste[key]) {
        setActiveTerm(key);
        setActiveStatus(null);
        setPanelCollapsed(false);
      }
      return;
    }

    const statusEl = target.closest('[data-status]');
    if (statusEl) {
      e.stopPropagation();
      const key = statusEl.getAttribute('data-status');
      if (key && statusDefs[key.toLowerCase()]) {
        setActiveStatus(key.toLowerCase());
        setActiveTerm(null);
        setPanelCollapsed(false);
      }
      return;
    }

    const refEl = target.closest('.footnote-ref');
    if (refEl) {
      e.stopPropagation();
      const raw = refEl.textContent ?? '';
      const first = raw.split(/[,\s]+/).filter(Boolean)[0];
      if (first) {
        setActiveTerm(null);
        setActiveStatus(null);
        setPanelCollapsed(false);
        setHighlightRef(first);
        setTimeout(() => {
          const node = panelRef.current?.querySelector(`[data-ref-id="${first}"]`);
          if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        setTimeout(() => setHighlightRef(null), 1500);
      }
      return;
    }
  }, []);

  useEffect(() => {
    setActiveTerm(null);
    setActiveStatus(null);
  }, [selectedId]);

  return (
    <main
      className={`h-[100dvh] w-screen overflow-hidden bg-white text-black ${showFootnotes ? 'show-footnotes' : 'hide-footnotes'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={scrollContainerRef}
        className="reader-scroll h-full w-full overflow-y-auto hide-scrollbar p-4 md:p-16 max-w-4xl mx-auto pb-[30vh] md:pb-[34vh]"
        onClick={handleContentClick}
      >
        <header className="mb-6 md:mb-8 shrink-0 flex items-start justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-black">formlære</h1>
          <div className="flex items-center gap-2 pt-2">
            {searchOpen ? (
              <>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchMatches.length > 0) {
                      jumpToMatch(searchMatches[0].node.id);
                    }
                  }}
                  placeholder="søk"
                  className="border-b border-black/30 focus:border-black outline-none bg-transparent text-sm font-mono py-0.5 w-40"
                />
                <button
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  className="text-black/60 hover:text-black"
                  aria-label="Lukk søk"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setGlossaryOpen(true)}
                  className="text-black/60 hover:text-black"
                  aria-label="Ordliste"
                >
                  <BookOpen size={18} />
                </button>
                <button
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }}
                  className="text-black/60 hover:text-black"
                  aria-label="Søk"
                >
                  <Search size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        <Section data={foreord} onBlockClick={showBlockRefs} hideTitle sectionRef={foreordRef} />

        <figure className="my-12 md:my-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fencing.png" alt="Fencing – illustrasjon" className="w-full max-w-3xl mx-auto" />
        </figure>

        <div className="flex flex-col gap-1">
          {visibleNodes.map((item, index) => {
            const isSelected = index === safeSelectedIndex;
            const isAbove = index < safeSelectedIndex;
            const isBelow = index > safeSelectedIndex;

            const rowOpacity = isBelow ? 'opacity-40' : 'opacity-100';
            const numberOpacity = isAbove ? 'opacity-40' : 'opacity-100';

            // Remove double superscript from text if it's already there
            const cleanText = item.node.text.replace(/^(<sup>[a-z]<\/sup>\s*)+/i, '');

            const hasChildren = !!(item.node.children && item.node.children.length > 0);
            return (
              <div
                key={item.node.id}
                data-pid={item.node.id}
                ref={isSelected ? selectedRef : null}
                className={`flex items-start py-1 cursor-pointer ${rowOpacity}`}
                onClick={() => {
                  // Single tap = select + toggle expansion + move audio cursor here.
                  // Suppress scroll-into-view since the user already chose where they're looking.
                  suppressScrollRef.current = true;
                  if (!isSelected) setSelectedId(item.node.id);
                  setAudioNodeId(item.node.id);
                  if (hasChildren) toggleExpand(item.node.id);
                }}
              >
                <div className={`flex items-baseline mr-4 md:mr-6 min-w-[3rem] md:min-w-[4rem] pt-0.5 gap-0.5 ${numberOpacity}`}>
                  <span className="text-base md:text-2xl font-bold text-black tabular-nums leading-none">
                    {item.node.id}
                  </span>
                  {item.node.status && (
                    <sup
                      data-status={item.node.status}
                      className="text-[10px] text-gray-400 font-mono font-bold uppercase cursor-pointer hover:text-black"
                    >
                      {item.node.status}
                    </sup>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base md:text-xl font-serif text-black leading-snug traktat-content">
                    <span dangerouslySetInnerHTML={{ __html: linkTerms(cleanText) }} />
                  </div>
                </div>
                <div className="ml-3 md:ml-4 flex flex-col items-center justify-start gap-0.5 pt-2 shrink-0 w-3">
                  {item.depth === 0 ? (
                    computeSubDepth(item.node) > 0 && (
                      <ChevronDown size={12} className="text-black/40" />
                    )
                  ) : (
                    Array.from({ length: computeSubDepth(item.node) + 1 }).map((_, i) => (
                      <span key={i} className="w-1 h-1 rounded-full bg-black/40" />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Section data={etterord} onBlockClick={showBlockRefs} sectionRef={etterordRef} />

        <figure className="mt-16 md:mt-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/footer.png" alt="" className="w-full block" />
        </figure>
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-black/10 pointer-events-auto flex flex-col ${
          panelCollapsed ? 'h-8' : 'h-[26vh] md:h-auto md:max-h-[30vh]'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          onClick={() => setPanelCollapsed(v => !v)}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-white border border-black/10 border-b-0 rounded-t px-3 py-0.5 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-black"
          aria-label={panelCollapsed ? 'Opne panel' : 'Lukk panel'}
        >
          {panelCollapsed ? '▲' : '▼'}
        </button>
        <div className={`max-w-4xl mx-auto w-full px-6 md:px-16 pt-1.5 md:pt-3 ${panelCollapsed ? 'hidden' : ''}`}>
          <h2 className="text-lg md:text-3xl font-serif font-bold tracking-tight text-black leading-none">notat</h2>
        </div>
        <div
          ref={panelRef}
          className={`flex-1 min-h-0 max-w-4xl mx-auto w-full px-6 md:px-16 pt-1 pb-1 overflow-y-auto hide-scrollbar flex flex-col text-[13px] md:text-base ${panelCollapsed ? 'hidden' : ''}`}
        >
          {activeTerm && ordliste[activeTerm] ? (
            <section>
              <div className="flex items-baseline justify-end mb-1">
                <button onClick={() => setActiveTerm(null)} className="text-gray-400 hover:text-black" aria-label="Lukk"><X size={14} /></button>
              </div>
              <ul className="flex flex-col gap-2">
                <li className="flex items-baseline gap-2 md:gap-3 text-sm md:text-base font-serif text-gray-800 leading-snug">
                  <span className="text-[9px] md:text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[4.5rem] md:min-w-[5.5rem] shrink-0">definisjon</span>
                  <span>
                    <b className="text-black">{ordliste[activeTerm].term}.</b> {ordliste[activeTerm].body}{' '}
                    <button onClick={() => jumpToMatch(ordliste[activeTerm].ref)} className="text-gray-400 font-mono text-xs underline decoration-dotted hover:decoration-solid hover:text-black ml-1">[{ordliste[activeTerm].ref}]</button>
                  </span>
                </li>
              </ul>
            </section>
          ) : activeStatus && statusDefs[activeStatus] ? (
            <section>
              <div className="flex items-baseline justify-end mb-1">
                <button onClick={() => setActiveStatus(null)} className="text-gray-400 hover:text-black" aria-label="Lukk"><X size={14} /></button>
              </div>
              <ul className="flex flex-col gap-2">
                <li className="flex items-baseline gap-2 md:gap-3 text-sm md:text-base font-serif text-gray-800 leading-snug">
                  <span className="text-[9px] md:text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[4.5rem] md:min-w-[5.5rem] shrink-0">status</span>
                  <span>
                    <b className="text-black">{activeStatus.toUpperCase()} · {statusDefs[activeStatus].name}.</b> {statusDefs[activeStatus].body}
                  </span>
                </li>
              </ul>
            </section>
          ) : panel ? (
            <>
              {panel.notes.length > 0 && (
                <section>
                  <ul className="flex flex-col gap-2">
                    {panel.notes.map((n, i) => (
                      <li key={i} className="flex items-baseline gap-2 md:gap-3 text-sm md:text-base font-serif text-gray-800 leading-snug">
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[4.5rem] md:min-w-[5.5rem] shrink-0">
                          {n.label ?? (n.kind === 'falsifisering' ? 'falsifisering' : 'notat')}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: n.text }} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {panel.refIds.length > 0 && (
                <section className="pt-3">
                  {panel.notes.length > 0 && (
                    <hr className="border-t border-black/20 mb-3" />
                  )}
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Referansar · {panel.id}
                  </div>
                  <ol className="flex flex-col gap-1.5">
                    {panel.refIds.map((n) => {
                      const ref = references[n];
                      if (!ref) return null;
                      const body = ref.doi
                        ? `${ref.text} <a href="https://doi.org/${ref.doi}" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted hover:decoration-solid">doi:${ref.doi}</a>`
                        : ref.url
                          ? `${ref.text} <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted hover:decoration-solid">↗</a>`
                          : linkifyDoi(ref.text);
                      return (
                        <li
                          key={n}
                          data-ref-id={n}
                          className={`flex items-baseline gap-2 text-sm font-serif text-gray-700 leading-snug transition-colors duration-300 rounded -mx-1 px-1 ${highlightRef === n ? 'bg-yellow-100' : ''}`}
                        >
                          <span className="tabular-nums text-gray-400 font-mono font-bold min-w-[1.5rem] text-right">
                            {n}
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: body }} />
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <section>
              <ul className="flex flex-col gap-2">
                <li className="flex items-baseline gap-2 md:gap-3 text-sm md:text-base font-serif text-gray-800 leading-snug">
                  <span className="text-[9px] md:text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[4.5rem] md:min-w-[5.5rem] shrink-0">nummer</span>
                  <span>Desimaltala angjev logisk vekt. n.1, n.2 osb. er utdjupingar av n; n.m1, n.m2 av n.m, og so vidare.</span>
                </li>
                <li className="flex items-baseline gap-2 md:gap-3 text-sm md:text-base font-serif text-gray-800 leading-snug">
                  <span className="text-[9px] md:text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[4.5rem] md:min-w-[5.5rem] shrink-0">status</span>
                  <span>
                    Kvar proposisjon har ein status:{' '}
                    <span data-status="d" className="cursor-pointer underline decoration-dotted hover:decoration-solid">d definisjon</span>,{' '}
                    <span data-status="a" className="cursor-pointer underline decoration-dotted hover:decoration-solid">a postulat</span>,{' '}
                    <span data-status="t" className="cursor-pointer underline decoration-dotted hover:decoration-solid">t teorem</span>,{' '}
                    <span data-status="o" className="cursor-pointer underline decoration-dotted hover:decoration-solid">o observasjon</span>,{' '}
                    <span data-status="i" className="cursor-pointer underline decoration-dotted hover:decoration-solid">i illustrasjon</span>.
                  </span>
                </li>
                <li className="flex items-baseline gap-2 md:gap-3 text-sm md:text-base font-serif text-gray-800 leading-snug">
                  <span className="text-[9px] md:text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[4.5rem] md:min-w-[5.5rem] shrink-0">djupne</span>
                  <span>Prikkar til høgre viser djupna: éin prikk = bladnode, fleire prikkar = under-proposisjonar finst. Pil ned på hovudnivå.</span>
                </li>
              </ul>
            </section>
          )}
        </div>
        {audioNode && !panelCollapsed && (
          <div className="border-t border-black/10 max-w-4xl mx-auto w-full px-6 md:px-16 py-1 md:py-2">
            <AudioPlayer
              src={audioUrlForNode(audioNode)}
              nodeId={audioNode.id}
              onEnded={() => {
                // Auto-advance the audio cursor only — do not yank the user's
                // scroll position or the notes panel.
                const idx = allNodesFlattened.findIndex(n => n.node.id === audioNode.id);
                if (idx !== -1 && idx < allNodesFlattened.length - 1) {
                  setAudioNodeId(allNodesFlattened[idx + 1].node.id);
                }
              }}
            />
          </div>
        )}
      </div>

      {glossaryOpen && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto hide-scrollbar">
          <div className="max-w-4xl mx-auto px-6 md:px-16 py-6 md:py-12">
            <div className="flex items-start justify-between mb-8">
              <h2 className="text-5xl font-serif font-bold tracking-tight text-black">ordliste</h2>
              <button
                onClick={() => setGlossaryOpen(false)}
                className="text-black/60 hover:text-black pt-3"
                aria-label="Lukk ordliste"
              >
                <X size={20} />
              </button>
            </div>
            <dl className="flex flex-col gap-5">
              {Object.entries(ordliste).map(([key, entry]) => (
                <div key={key} className="flex flex-col gap-1">
                  <dt className="font-serif text-xl font-bold text-black">
                    {entry.term}
                    <span className="ml-2 text-xs font-mono font-normal text-gray-400">[{entry.ref}]</span>
                  </dt>
                  <dd className="font-serif text-base text-gray-800 leading-snug">{entry.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

    </main>
  );
}
