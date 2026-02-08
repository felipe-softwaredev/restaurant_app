import type React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { ToastProvider } from '@/components/toast-provider';
import CustomerShell from '@/components/customer-shell';

const _geist = Geist({ subsets: ['latin'] });
const _geistMono = Geist_Mono({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Bella Tavola - Order Food Online',
  description: 'Fresh ingredients, made to order. Order online and pick up when it\'s ready.',
  generator: '',
  icons: {
    icon: [
      {
        url: '/food-dinner.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/food-dinner.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <ToastProvider>
          <CustomerShell>{children}</CustomerShell>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
