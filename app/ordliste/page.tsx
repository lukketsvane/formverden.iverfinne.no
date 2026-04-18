'use client';

import Link from 'next/link';
import ordlisteData from '@/data/ordliste.json';

interface GlossaryEntry {
  term: string;
  body: string;
  ref: string;
}
const ordliste = ordlisteData as Record<string, GlossaryEntry>;

export default function OrdlistePage() {
  return (
    <div className="h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--selection-bg)] overflow-y-auto reader-scroll">
      <header className="max-w-5xl mx-auto px-6 py-6 border-b border-[var(--border-color)]">
        <Link href="/" className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--foreground)] mb-2 flex items-center gap-1">
          ← tilbake til start
        </Link>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">ordliste</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        <dl className="flex flex-col gap-8 md:gap-12">
          {Object.entries(ordliste).sort((a, b) => a[1].term.localeCompare(b[1].term)).map(([key, entry]) => (
            <div key={key} className="flex flex-col gap-2 border-b border-[var(--border-color)] pb-8 last:border-0">
              <dt className="font-serif text-2xl md:text-3xl font-bold italic">
                {entry.term}
                <Link 
                  href={`/traktat/${entry.ref}`}
                  className="ml-3 text-xs font-mono font-normal text-[var(--text-dim)] hover:text-[var(--foreground)] underline decoration-dotted"
                >
                  [{entry.ref}]
                </Link>
              </dt>
              <dd className="font-serif text-lg md:text-xl text-[var(--text-muted)] leading-relaxed max-w-2xl">
                {entry.body}
              </dd>
            </div>
          ))}
        </dl>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-[var(--border-color)] text-sm text-[var(--text-dim)] font-serif">
        <Link href="/" className="hover:text-[var(--foreground)]">formverden</Link>
      </footer>
    </div>
  );
}
