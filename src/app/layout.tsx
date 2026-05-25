import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default:  'TIF — Intelligence Territoriale · Grand Genève',
    template: '%s · TIF',
  },
  description:
    'Perception temps réel du territoire genevois. ' +
    'Mobilité, trafic, transport public, événements — ' +
    'avant les sources officielles.',
  metadataBase: new URL('https://tif.borja-swiss-solutions.ch'),
  openGraph: {
    title:       'TIF — Intelligence Territoriale Grand Genève',
    description: 'Digital Twin Cognitif du Grand Genève',
    url:         'https://tif.borja-swiss-solutions.ch',
    siteName:    'TIF',
    locale:      'fr_CH',
    type:        'website',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
