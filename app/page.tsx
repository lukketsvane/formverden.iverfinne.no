'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const { hostname, pathname, hash } = window.location;

    // The dedicated tractatus subdomain opens the intuitive explorer.
    // formverden.iverfinne.no keeps its existing reading experience unchanged.
    if (hostname === 'traktat.iverfinne.no') {
      window.location.replace(`/utforsk.html${hash}`);
      return;
    }

    const match = pathname.match(/^\/(\d+(?:\.\d+)*)$/);
    const target = match ? `/traktat.html#${match[1]}` : `/traktat.html${hash}`;
    window.location.replace(target);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1e8' }} />
  );
}
