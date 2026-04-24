'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const { pathname, hash } = window.location;
    const match = pathname.match(/^\/(\d+(?:\.\d+)*)$/);
    const target = match ? `/traktat.html#${match[1]}` : `/traktat.html${hash}`;
    window.location.replace(target);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1e8' }} />
  );
}
