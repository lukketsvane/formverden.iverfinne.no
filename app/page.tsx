'use client';

import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });

export default function Home() {
  return (
    <div className="h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--selection-bg)] overflow-y-auto reader-scroll">
      {/* Top Header */}
      <header className="max-w-5xl mx-auto px-6 py-6 flex justify-between items-baseline border-b border-[var(--border-color)]">
        <div className="flex gap-4 items-baseline">
          <span className="font-serif italic text-lg">formverden</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Hero Section */}
        <section className="mb-24 md:mb-32">
          <h1 className="text-7xl md:text-9xl font-serif leading-[0.85] mb-8 tracking-tight">
            Form følgjer <br />
            <span className="italic">tilpassing.</span>
          </h1>
          <p className="text-xl md:text-3xl font-serif leading-tight max-w-2xl text-[var(--text-muted)]">
            Ikkje funksjon. Funksjon er éi av fem krefter som verkar på forma. 
            Her samlar me teorien, empirien og verktøya for å tenkje om form på nytt.
          </p>
        </section>

        {/* Navigation Sections */}
        <section className="border-t border-[var(--border-color)] pt-12">
          <div className="mb-12">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Sju inngangar</span>
            <h2 className="text-4xl md:text-5xl font-serif mt-2">Korleis du kan gå inn.</h2>
          </div>

          <div className="space-y-0">
            <EntryPoint 
              number="I" 
              title="Læra" 
              description="Traktaten sjølv. Proposisjonar, aksiom, teorem. For den som vil sjå arkitekturen."
              href="/traktat"
            />
            <EntryPoint 
              number="II" 
              title="Opne spørsmål" 
              description="Åtte hypotesar teorien kan generere og som enno ikkje er prøvde."
              href="/opne-sporsmal"
            />
            <EntryPoint 
              number="III" 
              title="Arkivet" 
              description="Kjelder, ordliste, lineage. Kubler, Petroski, Pye, Michl, Levin, Hatchuel."
              href="/arkiv"
            />
            <EntryPoint 
              number="IV" 
              title="Bli med" 
              description="Skrive til oss. Sende ein stol til databasen. Prøve ein hypotese."
              href="/bli-med"
            />
            <EntryPoint 
              number="V" 
              title="Ordliste" 
              description="Definisjonar av dei sentrale omgrepa i rammeverket."
              href="/ordliste"
            />
          </div>
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-[var(--border-color)] flex justify-between items-center text-sm text-[var(--text-dim)] font-serif">
        <div className="max-w-xs">
          Formverden er eit arbeid av Iver Raknes Finne som del av...
        </div>
        <a href="mailto:iver@iverfinne.no" className="hover:text-[var(--foreground)] transition-colors">iver@iverfinne.no</a>
      </footer>
    </div>
  );
}

function EntryPoint({ number, title, description, href }: { number: string, title: string, description: string, href: string }) {
  const content = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-12 border-b border-[var(--border-color)] group cursor-pointer">
      <div className="md:col-span-1 font-serif text-sm text-[var(--text-dim)] pt-2">{number}</div>
      <div className="md:col-span-11">
        <h3 className="text-3xl md:text-4xl font-serif group-hover:italic transition-all duration-300">{title}</h3>
        <p className="text-lg md:text-xl font-serif text-[var(--text-muted)] mt-2 max-w-xl leading-snug">
          {description}
        </p>
      </div>
    </div>
  );

  if (href === '#') return content;
  
  return (
    <Link href={href}>
      {content}
    </Link>
  );
}
