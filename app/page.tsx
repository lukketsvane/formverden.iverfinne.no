'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import traktatData from '@/data/traktat.json';
import referencesData from '@/data/references.json';
import notesData from '@/data/notes.json';

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

export default function Home() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string>((traktatData as Proposition[])[0].id);
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

  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStart.current.x;
    const dy = touchEnd.y - touchStart.current.y;
    
    if (Math.abs(dx) > 40 || Math.abs(dy) > 40) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      } else {
        if (dy > 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      }
    }
    touchStart.current = null;
  };

  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  }, [selectedId]);

  const selectedNode = visibleNodes[safeSelectedIndex]?.node;
  const currentRefIds = useMemo(
    () => (selectedNode ? extractRefIds(selectedNode.text) : []),
    [selectedNode]
  );
  const currentNotes = selectedNode ? notes[selectedNode.id] ?? [] : [];

  const [panel, setPanel] = useState<{ id: string; notes: Note[]; refIds: string[] } | null>(null);
  useEffect(() => {
    if (selectedNode && (currentNotes.length > 0 || currentRefIds.length > 0)) {
      setPanel({ id: selectedNode.id, notes: currentNotes, refIds: currentRefIds });
    }
  }, [selectedNode, currentNotes, currentRefIds]);

  return (
    <main 
      className={`h-[100dvh] w-screen overflow-hidden bg-white text-black select-none touch-none ${showFootnotes ? 'show-footnotes' : 'hide-footnotes'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full w-full overflow-y-auto hide-scrollbar p-6 md:p-16 max-w-4xl mx-auto pb-[50vh]">
        <header className="mb-8 shrink-0 flex items-start justify-between gap-4">
          <h1 className="text-5xl font-serif font-bold tracking-tight text-black">formlære</h1>
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
            )}
          </div>
        </header>
        
        <div className="flex flex-col gap-1">
          {visibleNodes.map((item, index) => {
            const isSelected = index === safeSelectedIndex;
            const isAbove = index < safeSelectedIndex;
            const isBelow = index > safeSelectedIndex;

            const rowOpacity = isBelow ? 'opacity-40' : 'opacity-100';
            const numberOpacity = isAbove ? 'opacity-40' : 'opacity-100';

            // Remove double superscript from text if it's already there
            const cleanText = item.node.text.replace(/^(<sup>[a-z]<\/sup>\s*)+/i, '');

            return (
              <div
                key={item.node.id}
                ref={isSelected ? selectedRef : null}
                className={`flex items-start py-1 transition-opacity duration-75 cursor-pointer ${rowOpacity}`}
                style={{ paddingLeft: `${item.depth * 24}px` }}
                onClick={() => {
                  if (isSelected) toggleExpand(item.node.id);
                  else setSelectedId(item.node.id);
                }}
              >
                <div className={`flex flex-col items-end mr-6 min-w-[3.5rem] pt-0.5 ${numberOpacity}`}>
                  <span className="text-2xl font-bold text-black tabular-nums leading-none">
                    {item.node.id}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-serif text-black leading-snug traktat-content">
                    {item.node.status && (
                      <sup className="text-[10px] text-gray-400 font-mono font-bold mr-1 uppercase">
                        {item.node.status}
                      </sup>
                    )}
                    <span dangerouslySetInnerHTML={{ __html: cleanText }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-[45vh] bg-white/95 backdrop-blur border-t border-black/10 pointer-events-auto">
        <div className="h-full max-w-4xl mx-auto px-6 md:px-16 py-6 overflow-y-auto hide-scrollbar">
          {panel ? (
            <>
              {panel.notes.length > 0 && (
                <section>
                  <h2 className="text-5xl font-serif font-bold tracking-tight text-black mb-4">notat</h2>
                  <ul className="flex flex-col gap-3 mb-6">
                    {panel.notes.map((n, i) => (
                      <li key={i} className="flex items-baseline gap-3 text-base font-serif text-gray-800 leading-snug">
                        <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider min-w-[5.5rem] shrink-0">
                          {n.label ?? (n.kind === 'falsifisering' ? 'falsifisering' : 'notat')}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: n.text }} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {panel.notes.length > 0 && panel.refIds.length > 0 && (
                <hr className="border-t border-black/20 my-4" />
              )}

              {panel.refIds.length > 0 && (
                <section>
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
                        <li key={n} className="flex items-baseline gap-2 text-sm font-serif text-gray-700 leading-snug">
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
            <h2 className="text-5xl font-serif font-bold tracking-tight text-black/20">notat</h2>
          )}
        </div>
      </div>
    </main>
  );
}
