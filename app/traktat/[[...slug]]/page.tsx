'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, BookOpen, ChevronDown, Play, Pause, RotateCcwSquare, RotateCwSquare, ExternalLink, Sun, Moon } from 'lucide-react';
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

function Section({ 
  data, 
  onBlockClick, 
  hideTitle, 
  sectionRef,
  pid
}: { 
  data: SectionData; 
  onBlockClick: (id: string, text: string, rawId: string) => void; 
  hideTitle?: boolean; 
  sectionRef?: React.Ref<HTMLElement>;
  pid?: string;
}) {
  return (
    <section ref={sectionRef} data-pid={pid} className="my-16 md:my-24">
      {!hideTitle && (
        <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-black mb-6 md:mb-8">{data.title}</h2>
      )}
      <div className="flex flex-col gap-4 max-w-3xl">
        {data.blocks.map((block, i) => {
          const blockId = pid ? `${pid} · §${i + 1}` : `${data.title} · §${i + 1}`;
          const rawId = pid ? `${pid}-${i}` : '';
          if (block.type === 'paragraph') {
            return (
              <p
                key={i}
                id={rawId || undefined}
                className="text-base md:text-xl font-serif text-black leading-snug traktat-content cursor-pointer -mx-2 px-2 py-1 rounded hover:bg-[var(--border-color)] transition-colors"
                onClick={() => onBlockClick(blockId, block.text, rawId)}
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

async function sharePropLink(nodeId: string) {
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
}

function AudioControls({ 
  isPlaying, 
  togglePlay, 
  skip, 
  available, 
  compact = false 
}: { 
  isPlaying: boolean; 
  togglePlay: () => void; 
  skip: (s: number) => void; 
  available: boolean;
  compact?: boolean;
}) {
  const iconSize = compact ? 20 : 22;
  const playSize = compact ? 24 : 34;
  
  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); skip(-10); }}
        aria-label="Hopp 10s tilbake"
        className="hover:text-[var(--foreground)] p-1 md:p-2 disabled:opacity-30 transition-colors"
        disabled={!available}
      >
        <RotateCcwSquare size={iconSize} strokeWidth={1.75} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); skip(10); }}
        aria-label="Hopp 10s fram"
        className="hover:text-[var(--foreground)] p-1 md:p-2 disabled:opacity-30 transition-colors"
        disabled={!available}
      >
        <RotateCwSquare size={iconSize} strokeWidth={1.75} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        aria-label={isPlaying ? 'Pause' : 'Spel'}
        className="text-[var(--foreground)] p-1 md:p-2 ml-0.5 md:ml-3 disabled:opacity-30 transition-colors"
        disabled={!available}
      >
        {isPlaying ? <Pause size={playSize} strokeWidth={1.75} fill="currentColor" /> : <Play size={playSize} strokeWidth={1.75} fill="currentColor" />}
      </button>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (systemDark ? 'dark' : 'light');
    setTheme(initial);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['1', '1.3', '1.31']));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Audio State
  const [currentAudioNodeId, setAudioNodeId] = useState<string>('forord-0');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rateIdx, setRateIdx] = useState(0);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const wasPlayingRef = useRef(false);

  const [showFootnotes, setShowFootnotes] = useState(false);

  const allNodesFlattened = useMemo(() => flattenAll(traktatData as Proposition[]), []);

  const fullLinearSequence = useMemo(() => {
    const seq: { id: string, type: 'forord' | 'etterord' | 'prop', text: string }[] = [];
    let fp = 0;
    foreord.blocks.forEach(b => {
      if (b.type === 'paragraph') seq.push({ id: `forord-${fp++}`, type: 'forord', text: b.text });
    });
    allNodesFlattened.forEach(n => {
      seq.push({ id: n.node.id, type: 'prop', text: n.node.text });
    });
    let ep = 0;
    etterord.blocks.forEach(b => {
      if (b.type === 'paragraph') seq.push({ id: `etterord-${ep++}`, type: 'etterord', text: b.text });
    });
    return seq;
  }, [allNodesFlattened]);

  const visibleLinearSequence = useMemo(() => {
    const seq: { id: string, displayId: string, sectionId: string, isProp: boolean, depth: number }[] = [];
    let fp = 0;
    foreord.blocks.forEach(b => {
      if (b.type === 'paragraph') {
        seq.push({ id: `forord-${fp}`, displayId: `forord · §${fp + 1}`, sectionId: 'forord', isProp: false, depth: 0 });
        fp++;
      }
    });
    getVisibleNodes(traktatData as Proposition[], expandedIds).forEach(n => {
      seq.push({ id: n.node.id, displayId: n.node.id, sectionId: n.node.id, isProp: true, depth: n.depth });
    });
    let ep = 0;
    etterord.blocks.forEach(b => {
      if (b.type === 'paragraph') {
        seq.push({ id: `etterord-${ep}`, displayId: `etterord · §${ep + 1}`, sectionId: 'etterord', isProp: false, depth: 0 });
        ep++;
      }
    });
    return seq;
  }, [expandedIds]);

  const currentAudioNode = useMemo(
    () => {
      if (!mounted) return null;
      const f = fullLinearSequence.find(n => n.id === currentAudioNodeId);
      if (!f) return null;
      if (f.type === 'prop') {
        return allNodesFlattened.find(n => n.node.id === currentAudioNodeId)?.node ?? null;
      }
      return { id: f.id, text: f.text }; // mock node for audio URL
    },
    [allNodesFlattened, fullLinearSequence, currentAudioNodeId, mounted]
  );

  useEffect(() => {
    if (!mounted) return;
    setAudioAvailable(true);
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = PLAYBACK_RATES[rateIdx];
    if (wasPlayingRef.current) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
  }, [currentAudioNodeId, rateIdx, mounted]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const audioSkip = useCallback((s: number) => {
    const el = audioRef.current;
    if (!el) return;
    if (!isFinite(el.duration)) {
      el.currentTime = Math.max(0, el.currentTime + s);
      return;
    }
    el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + s));
  }, []);

  const onAudioEnded = useCallback(() => {
    wasPlayingRef.current = true;
    setIsPlaying(false);
    const idx = fullLinearSequence.findIndex(n => n.id === currentAudioNodeId);
    if (idx !== -1 && idx < fullLinearSequence.length - 1) {
      setAudioNodeId(fullLinearSequence[idx + 1].id);
    }
  }, [fullLinearSequence, currentAudioNodeId]);

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
    const idx = visibleLinearSequence.findIndex(n => n.id === currentAudioNodeId);
    return idx !== -1 ? idx : 0;
  }, [visibleLinearSequence, currentAudioNodeId]);

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

    slug = slug.replace(/^traktat\//i, '');
    if (!slug || slug === 'traktat') slug = 'forord';

    const lower = slug.toLowerCase();
    if (lower === 'forord' || lower === 'føreord' || lower === 'foreord') {
      setSelectedId('forord');
      setAudioNodeId('forord-0');
      requestAnimationFrame(() => foreordRef.current?.scrollIntoView({ block: 'start' }));
      return;
    }
    if (lower === 'etterord') {
      setSelectedId('etterord');
      setAudioNodeId('etterord-0');
      requestAnimationFrame(() => etterordRef.current?.scrollIntoView({ block: 'start' }));
      return;
    }
    const found = allNodesFlattened.find(n => n.node.id === slug);
    if (found) {
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
    if (!didInitialRouteRef.current || !selectedId) return;
    const target = `/traktat/${selectedId}`;
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [selectedId]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [] as { node: { id: string } }[];
    return allNodesFlattened.filter(n =>
      n.node.id.toLowerCase().includes(q) ||
      stripHtml(n.node.text).toLowerCase().includes(q)
    );
  }, [searchQuery, allNodesFlattened]);

  const jumpToMatch = useCallback((nodeId: string) => {
    expandAncestors(nodeId);
    setSelectedId(nodeId);
    setAudioNodeId(nodeId);
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

      if (e.key.toLowerCase() === 'a') {
        setExpandedIds(new Set(allNodesFlattened.filter(n => n.node.children && n.node.children.length > 0).map(n => n.node.id)));
        return;
      }

      const currentVisible = visibleLinearSequence[safeSelectedIndex];
      if (!currentVisible) return;

      switch (e.key) {
        case 'ArrowDown': {
          const next = visibleLinearSequence[safeSelectedIndex + 1];
          if (next) {
            setSelectedId(next.sectionId);
            setAudioNodeId(next.id);
          }
          break;
        }
        case 'ArrowUp': {
          const prev = visibleLinearSequence[safeSelectedIndex - 1];
          if (prev) {
            setSelectedId(prev.sectionId);
            setAudioNodeId(prev.id);
          }
          break;
        }
        case 'ArrowRight': {
          if (currentVisible.isProp) {
            const propNode = allNodesFlattened.find(n => n.node.id === currentVisible.id);
            if (propNode && propNode.node.children && propNode.node.children.length > 0) {
              if (!expandedIds.has(propNode.node.id)) {
                toggleExpand(propNode.node.id);
              } else {
                const next = visibleLinearSequence[safeSelectedIndex + 1];
                if (next) {
                  setSelectedId(next.sectionId);
                  setAudioNodeId(next.id);
                }
              }
            }
          }
          break;
        }
        case 'ArrowLeft': {
          if (currentVisible.isProp) {
            const propNode = allNodesFlattened.find(n => n.node.id === currentVisible.id);
            if (propNode) {
              if (expandedIds.has(propNode.node.id)) {
                toggleExpand(propNode.node.id);
              } else if (propNode.parentId) {
                setSelectedId(propNode.parentId);
                setAudioNodeId(propNode.parentId);
              }
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          if (currentVisible.isProp) {
            const propNode = allNodesFlattened.find(n => n.node.id === currentVisible.id);
            if (propNode && propNode.node.children && propNode.node.children.length > 0) {
              toggleExpand(propNode.node.id);
            }
          }
          break;
        }
        case 'n':
        case 'N': {
          const globalIdx = fullLinearSequence.findIndex(n => n.id === currentAudioNodeId);
          if (globalIdx !== -1 && globalIdx < fullLinearSequence.length - 1) {
            const nextNode = fullLinearSequence[globalIdx + 1];
            expandAncestors(nextNode.id);
            setSelectedId(nextNode.type === 'prop' ? nextNode.id : nextNode.type);
            setAudioNodeId(nextNode.id);
          }
          break;
        }
        case 'b':
        case 'B': {
          const globalIdx = fullLinearSequence.findIndex(n => n.id === currentAudioNodeId);
          if (globalIdx > 0) {
            const prevNode = fullLinearSequence[globalIdx - 1];
            expandAncestors(prevNode.id);
            setSelectedId(prevNode.type === 'prop' ? prevNode.id : prevNode.type);
            setAudioNodeId(prevNode.id);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleLinearSequence, safeSelectedIndex, expandedIds, toggleExpand, currentAudioNodeId, allNodesFlattened, expandAncestors, searchOpen, fullLinearSequence]);

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
  const suppressScrollRef = useRef(false);
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
  }, [currentAudioNodeId]);

  const [panel, setPanel] = useState<{ id: string; notes: Note[]; refIds: string[] } | null>(null);
  useEffect(() => {
    const pNode = allNodesFlattened.find(n => n.node.id === currentAudioNodeId)?.node;
    if (pNode) {
      const pNotes = notes[pNode.id] ?? [];
      const pRefIds = extractRefIds(pNode.text);
      if (pNotes.length > 0 || pRefIds.length > 0) {
        setPanel({ id: pNode.id, notes: pNotes, refIds: pRefIds });
        return;
      }
    } else {
      const fNode = fullLinearSequence.find(n => n.id === currentAudioNodeId);
      if (fNode) {
        const pRefIds = extractRefIds(fNode.text);
        if (pRefIds.length > 0) {
          const displayId = fNode.type === 'forord' ? `forord · §${parseInt(fNode.id.split('-')[1]) + 1}` : `etterord · §${parseInt(fNode.id.split('-')[1]) + 1}`;
          setPanel({ id: displayId, notes: [], refIds: pRefIds });
          return;
        }
      }
    }
    setPanel(null);
  }, [currentAudioNodeId, allNodesFlattened, fullLinearSequence]);

  const showBlockRefs = useCallback((displayId: string, text: string, rawId: string) => {
    const sectionId = displayId.split(' · ')[0];
    setSelectedId(sectionId);
    setAudioNodeId(rawId);
    setPanelCollapsed(false);
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

  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleContentMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const termEl = target.closest('[data-term]');
    const statusEl = target.closest('[data-status]');
    const refEl = target.closest('.footnote-ref');

    let content = '';
    if (termEl) {
      const key = termEl.getAttribute('data-term');
      if (key && ordliste[key]) {
        content = `${ordliste[key].term}. ${ordliste[key].body} [${ordliste[key].ref}]`;
      }
    } else if (statusEl) {
      const key = statusEl.getAttribute('data-status');
      if (key && statusDefs[key.toLowerCase()]) {
        content = `${statusDefs[key.toLowerCase()].name.toUpperCase()}: ${statusDefs[key.toLowerCase()].body}`;
      }
    } else if (refEl) {
      const raw = refEl.textContent ?? '';
      const first = raw.split(/[,\s]+/).filter(Boolean)[0];
      if (first && references[first]) {
        content = stripHtml(references[first].text);
      }
    }

    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    if (content) {
      const x = e.clientX;
      const y = e.clientY;
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltip({ content, x, y });
      }, 300);
    } else {
      setTooltip(null);
    }
  }, []);

  const handleContentMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setTooltip(null);
  }, []);

  useEffect(() => {
    setActiveTerm(null);
    setActiveStatus(null);
  }, [selectedId]);

  const selectedNode = useMemo(
    () => allNodesFlattened.find(n => n.node.id === selectedId)?.node ?? null,
    [allNodesFlattened, selectedId]
  );

  return (
    <>
    <main
      className={`h-[100dvh] w-screen overflow-hidden bg-white text-black ${showFootnotes ? 'show-footnotes' : 'hide-footnotes'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="reader-scroll h-full w-full overflow-y-auto hide-scrollbar p-4 md:p-16 max-w-4xl mx-auto pb-[30vh] md:pb-[34vh]"
        onClick={handleContentClick}
        onMouseMove={handleContentMouseMove}
        onMouseLeave={handleContentMouseLeave}
      >
        <header 
          className="mb-6 md:mb-8 shrink-0 flex items-start justify-between gap-4"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex flex-col gap-1">
            <Link href="/" className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--foreground)] mb-2 flex items-center gap-1">
              ← tilbake til start
            </Link>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-black">formlære</h1>
          </div>
          <div className="flex items-center gap-2 pt-6">
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

        <Section data={foreord} onBlockClick={showBlockRefs} hideTitle sectionRef={foreordRef} pid="forord" />

        <figure className="my-12 md:my-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fencing.png" alt="Fencing – illustrasjon" className="w-full max-w-3xl mx-auto" />
        </figure>

        <div className="flex flex-col gap-1">
          {visibleNodes.map((item, index) => {
            const isSelected = index === safeSelectedIndex;
            const isAbove = safeSelectedIndex !== -1 && index < safeSelectedIndex;
            const isBelow = safeSelectedIndex !== -1 && index > safeSelectedIndex;

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
                  // Suppress scroll-into-view since the user already chose where they're looking,
                  // AND block the IntersectionObserver briefly so it doesn't overwrite the
                  // explicit pick with whatever node happens to sit topmost in the viewport.
                  suppressScrollRef.current = true;
                  programmaticScrollUntilRef.current = Date.now() + 800;
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

        <Section data={etterord} onBlockClick={showBlockRefs} sectionRef={etterordRef} pid="etterord" />

        <figure className="mt-16 md:mt-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/footer.png" alt="" className="w-full block" />
        </figure>
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 bg-[var(--panel-bg)] backdrop-blur-md border-t border-[var(--border-color)] pointer-events-auto flex flex-col transition-all duration-300 ${
          panelCollapsed ? 'h-10' : 'h-[32vh] md:h-auto md:max-h-[38vh]'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          onClick={() => setPanelCollapsed(v => !v)}
          aria-label={panelCollapsed ? 'Opne panel' : 'Lukk panel'}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-[var(--panel-bg)] border border-[var(--border-color)] border-b-0 rounded-t px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)] hover:text-[var(--foreground)] transition-colors"
        >
          {panelCollapsed ? '▲' : '▼'}
        </button>
        
        <div className="max-w-4xl mx-auto w-full px-6 md:px-16 pt-3 md:pt-5 pb-2 flex items-baseline justify-between gap-4">
          <button
            onClick={() => setPanelCollapsed(v => !v)}
            aria-label={panelCollapsed ? 'Opne panel' : 'Lukk panel'}
            className="text-left flex items-baseline gap-2 group"
          >
            {selectedId === 'forord' || selectedId === 'etterord' ? (
              <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tighter text-[var(--foreground)] leading-none lowercase group-hover:opacity-80 transition-opacity">
                {selectedId}
              </h2>
            ) : (
              <>
                <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tighter text-[var(--foreground)] leading-none">proposisjon</h2>
                {selectedNode && (
                  <span className="font-mono text-3xl md:text-5xl font-bold tabular-nums text-[var(--foreground)] leading-none ml-1">
                    {selectedNode.id}
                  </span>
                )}
              </>
            )}
          </button>
          
          <div className="flex items-center gap-3">
            {selectedNode && (
              <button
                onClick={() => sharePropLink(selectedNode.id)}
                aria-label="Del lenkje"
                title="Del lenkje"
                className="text-[var(--text-dim)] hover:text-[var(--foreground)] transition-colors"
              >
                <ExternalLink size={20} strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={() => setPanelCollapsed(v => !v)}
              aria-label={panelCollapsed ? 'Opne panel' : 'Lukk panel'}
              className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--foreground)] transition-colors ml-2"
            >
              {panelCollapsed ? '▲' : '▼'}
            </button>
          </div>
        </div>

        <div
          ref={panelRef}
          className={`flex-1 min-h-0 max-w-4xl mx-auto w-full px-6 md:px-16 pb-2 overflow-y-auto hide-scrollbar flex flex-col text-[13px] md:text-base ${panelCollapsed ? 'hidden' : ''}`}
        >
          {activeTerm && ordliste[activeTerm] ? (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">Definisjon</span>
                <button onClick={() => setActiveTerm(null)} className="text-[var(--text-dim)] hover:text-[var(--foreground)]"><X size={14} /></button>
              </div>
              <ul className="flex flex-col gap-2">
                <li className="font-serif text-[var(--foreground)] leading-relaxed">
                  <b>{ordliste[activeTerm].term}.</b> {ordliste[activeTerm].body}{' '}
                  <button onClick={() => jumpToMatch(ordliste[activeTerm].ref)} className="text-[var(--text-dim)] font-mono text-xs underline decoration-dotted hover:decoration-solid hover:text-[var(--foreground)] ml-1">[{ordliste[activeTerm].ref}]</button>
                </li>
              </ul>
            </section>
          ) : activeStatus && statusDefs[activeStatus] ? (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">Status</span>
                <button onClick={() => setActiveStatus(null)} className="text-[var(--text-dim)] hover:text-[var(--foreground)]"><X size={14} /></button>
              </div>
              <ul className="flex flex-col gap-2">
                <li className="font-serif text-[var(--foreground)] leading-relaxed">
                  <b>{activeStatus.toUpperCase()} · {statusDefs[activeStatus].name}.</b> {statusDefs[activeStatus].body}
                </li>
              </ul>
            </section>
          ) : panel ? (
            <>
              {panel.notes.length > 0 && (
                <section>
                  <ul className="flex flex-col gap-3">
                    {panel.notes.map((n, i) => (
                      <li key={i} className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                          {n.label ?? (n.kind === 'falsifisering' ? 'falsifisering' : 'notat')}
                        </span>
                        <span className="font-serif text-[var(--foreground)] leading-relaxed" dangerouslySetInnerHTML={{ __html: n.text }} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {panel.refIds.length > 0 && (
                <section className="pt-4">
                  {panel.notes.length > 0 && (
                    <hr className="border-t border-[var(--border-color)] mb-4" />
                  )}
                  <div className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-dim)] mb-3">
                    Referansar · {panel.id}
                  </div>
                  <ol className="flex flex-col gap-2">
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
                          className={`flex items-start gap-3 font-serif text-[var(--text-muted)] leading-relaxed transition-colors duration-300 rounded -mx-2 px-2 py-1 ${highlightRef === n ? 'bg-[var(--selection-bg)] text-[var(--foreground)]' : ''}`}
                        >
                          <span className="tabular-nums text-[var(--text-dim)] font-mono font-bold text-xs mt-1 w-5 shrink-0 text-right">
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
              <ul className="flex flex-col gap-4">
                <li className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">nummer</span>
                  <span className="font-serif text-[var(--text-muted)] leading-relaxed">Desimaltala angjev logisk vekt. n.1, n.2 osb. er utdjupingar av n; n.m1, n.m2 av n.m, og so vidare.</span>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">status</span>
                  <span className="font-serif text-[var(--text-muted)] leading-relaxed">
                    Kvar proposisjon har ein status:{' '}
                    <span data-status="d" className="cursor-pointer underline decoration-dotted hover:decoration-solid">d definisjon</span>,{' '}
                    <span data-status="a" className="cursor-pointer underline decoration-dotted hover:decoration-solid">a postulat</span>,{' '}
                    <span data-status="t" className="cursor-pointer underline decoration-dotted hover:decoration-solid">t teorem</span>,{' '}
                    <span data-status="o" className="cursor-pointer underline decoration-dotted hover:decoration-solid">o observasjon</span>,{' '}
                    <span data-status="i" className="cursor-pointer underline decoration-dotted hover:decoration-solid">i illustrasjon</span>.
                  </span>
                </li>
              </ul>
            </section>
          )}
        </div>
        
        {mounted && currentAudioNode && !panelCollapsed && (
          <div className="border-t border-[var(--border-color)] w-full">
            <div className="max-w-4xl mx-auto px-6 md:px-16 py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-serif italic text-xs">
                  N
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRateIdx((rateIdx + 1) % PLAYBACK_RATES.length)}
                    className="font-mono text-xs tracking-wider uppercase px-2 py-1 rounded hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                    aria-label={`Hastigheit ${PLAYBACK_RATES[rateIdx]}×`}
                    disabled={!audioAvailable}
                  >
                    {PLAYBACK_RATES[rateIdx].toFixed(PLAYBACK_RATES[rateIdx] % 1 === 0 ? 1 : 2)}x
                  </button>
                  <button
                    onClick={toggleTheme}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors rounded-full hover:bg-[var(--border-color)]"
                    aria-label={theme === 'dark' ? 'Byt til lyst tema' : 'Byt til mørkt tema'}
                  >
                    {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
                  </button>
                </div>
              </div>
              
              <AudioControls 
                isPlaying={isPlaying} 
                togglePlay={togglePlay} 
                skip={audioSkip} 
                available={audioAvailable} 
              />
            </div>
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

    {tooltip && (
      <div
        className="fixed pointer-events-none z-[100] bg-black text-white text-xs font-serif px-3 py-2 rounded shadow-2xl -translate-x-1/2 -translate-y-[calc(100%+12px)] max-w-xs md:max-w-sm whitespace-normal leading-tight"
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.content}
      </div>
    )}

      {mounted && currentAudioNode && (
        <audio
          ref={audioRef}
          src={audioUrlForNode(currentAudioNode)}
          onEnded={onAudioEnded}
          onError={() => setAudioAvailable(false)}
          onLoadedData={() => setAudioAvailable(true)}
          onPlay={() => { wasPlayingRef.current = true; setIsPlaying(true); }}
          onPause={() => { wasPlayingRef.current = false; setIsPlaying(false); }}
          preload="metadata"
        />
      )}
    </>
  );
}
