'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import traktatData from '@/data/traktat.json';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [visibleNodes, safeSelectedIndex, expandedIds, toggleExpand, selectedId, allNodesFlattened, expandAncestors]);

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

  return (
    <main 
      className={`h-[100dvh] w-screen overflow-hidden bg-white text-black select-none touch-none ${showFootnotes ? 'show-footnotes' : 'hide-footnotes'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full w-full overflow-y-auto hide-scrollbar p-6 md:p-16 max-w-4xl mx-auto pb-[60vh]">
        <header className="mb-8 shrink-0">
          <h1 className="text-5xl font-serif font-bold tracking-tight text-black">formlære</h1>
        </header>
        
        <div className="flex flex-col gap-1">
          {visibleNodes.map((item, index) => {
            const isSelected = index === safeSelectedIndex;
            const isPreceding = index < safeSelectedIndex;
            const currentDepth = visibleNodes[safeSelectedIndex]?.depth ?? 0;
            const isSameOrShallower = item.depth <= currentDepth;
            const isFullyVisible = isPreceding || isSelected || isSameOrShallower;
            const opacityClass = isFullyVisible ? 'opacity-100' : 'opacity-40';

            // Remove double superscript from text if it's already there
            const cleanText = item.node.text.replace(/^(<sup>[a-z]<\/sup>\s*)+/i, '');
            
            return (
              <div 
                key={item.node.id}
                ref={isSelected ? selectedRef : null}
                className={`flex items-start py-1 transition-opacity duration-75 cursor-pointer ${opacityClass}`}
                style={{ paddingLeft: `${item.depth * 24}px` }}
                onClick={() => {
                  if (isSelected) toggleExpand(item.node.id);
                  else setSelectedId(item.node.id);
                }}
              >
                <div className="flex flex-col items-end mr-6 min-w-[3.5rem] pt-0.5">
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
    </main>
  );
}
