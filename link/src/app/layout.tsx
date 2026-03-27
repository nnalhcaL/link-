import type {Metadata} from 'next';
import {Inter, Plus_Jakarta_Sans} from 'next/font/google';

import '@/styles/globals.css';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const headlineFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Link! | AI Scheduling',
    template: '%s | Link!',
  },
  description: 'Find a time that works for everyone with AI-powered scheduling.',
  applicationName: 'Link!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headlineFont.variable} bg-background font-sans text-ink`}>
        {children}
      </body>
    </html>
  );
}

