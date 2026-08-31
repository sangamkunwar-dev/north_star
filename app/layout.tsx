import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
})

export const metadata: Metadata = {
  title: {
    default: 'Sajilo',
    template: '%s | Sajilo',
  },

  description:
    'Create, refine, and publish social posts from one calm workspace.',

  applicationName: 'Sajilo',

  generator: 'Next.js',

  icons: {
    icon: [
      {
        url: '/sajilo-logo.png',
        type: 'image/png',
      },
    ],

    shortcut: ['/sajilo-logo.png'],

    apple: [
      {
        url: '/sajilo-logo.png',
      },
    ],
  },

  openGraph: {
    title: 'Sajilo',
    description:
      'Create, refine, and publish social posts from one calm workspace.',
    siteName: 'Sajilo',
    type: 'website',
    images: [
      {
        url: '/sajilo-logo.png',
        alt: 'Sajilo',
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: 'Sajilo',
    description:
      'Create, refine, and publish social posts from one calm workspace.',
    images: ['/sajilo-logo.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',

  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: 'white',
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: 'black',
    },
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
