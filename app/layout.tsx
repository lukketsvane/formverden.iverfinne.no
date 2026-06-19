import { Inter, Playfair_Display } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' });

const siteUrl = process.env.APP_URL ?? 'https://formverden.iverfinne.no';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'formlære',
  description: 'Formlære',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/gemini-svg.svg', type: 'image/svg+xml' }],
    apple: '/gemini-svg.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'formlære',
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'formlære',
    title: 'formlære',
    description: 'Formlære',
    locale: 'nn_NO',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'formlære',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'formlære',
    description: 'Formlære',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'formlære',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-serif antialiased bg-white text-black">
        {children}
      </body>
    </html>
  );
}
