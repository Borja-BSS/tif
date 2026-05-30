import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'

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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* FOUC prevention — applique le thème avant le premier render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('tif-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(t||(m?'dark':'light'));})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
