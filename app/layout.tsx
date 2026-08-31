import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'
import { Noto_Sans_Devanagari } from 'next/font/google'

const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' })

export const metadata: Metadata = {
  title: 'Sajilo',
  description: 'Create, refine, and publish social posts from one calm workspace.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/sajilo-logo.png', type: 'image/png' },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ne" className="light bg-background">
      <body className={`${notoDevanagari.variable} antialiased`}>
        {children}
        <CookieBanner />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
