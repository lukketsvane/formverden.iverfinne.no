'use client';

import Link from 'next/link';

export default function PlaceholderPage({ title, description, slug }: { title: string, description: string, slug: string }) {
  return (
    <div className="h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--selection-bg)] overflow-y-auto reader-scroll">
      <header className="max-w-5xl mx-auto px-6 py-6 border-b border-[var(--border-color)]">
        <Link href="/" className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--foreground)] mb-2 flex items-center gap-1">
          ← tilbake til start
        </Link>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight lowercase">{title}</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        <div className="flex flex-col gap-8 max-w-3xl">
          <p className="text-2xl md:text-4xl font-serif leading-snug">
            {description}
          </p>
          <div className="h-px w-24 bg-[var(--foreground)] mt-8" />
          <p className="text-xl md:text-2xl font-serif italic text-[var(--text-muted)] leading-relaxed">
            Denne seksjonen er under arbeid. Innhald vert lagt til fortløpande som del av formverden-prosjektet.
          </p>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-[var(--border-color)] text-sm text-[var(--text-dim)] font-serif">
        <Link href="/" className="hover:text-[var(--foreground)]">formverden</Link>
      </footer>
    </div>
  );
}
