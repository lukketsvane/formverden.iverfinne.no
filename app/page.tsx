'use client';

import { useEffect, useState } from 'react';

const TRAKTAT_READER = 'https://grutnegitless-iverfinnes-projects.vercel.app/';

export default function Home() {
  const [reader, setReader] = useState<string | null>(null);

  useEffect(() => {
    const { hostname, pathname, hash } = window.location;

    if (hostname === 'traktat.iverfinne.no') {
      setReader(`${TRAKTAT_READER}${hash}`);
      return;
    }

    const match = pathname.match(/^\/(\d+(?:\.\d+)*)$/);
    const target = match ? `/traktat.html#${match[1]}` : `/traktat.html${hash}`;
    window.location.replace(target);
  }, []);

  if (reader) {
    return (
      <iframe
        src={reader}
        title="FORMLÆRE"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100dvh',
          border: 0,
          margin: 0,
          padding: 0,
          background: 'transparent',
        }}
      />
    );
  }

  return <div style={{ position: 'fixed', inset: 0, background: '#fff' }} />;
}
