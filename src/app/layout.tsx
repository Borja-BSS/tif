import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider }  from '@/lib/theme/ThemeProvider'
import { Providers }      from './Providers'
import { CookieConsent }  from '@/components/CookieConsent'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

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
    images: [
      {
        url:    '/borja-og.png',
        width:  900,
        height: 639,
        alt:    'Börja Swiss Solutions — TIF',
      },
    ],
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
            __html: `(function(){localStorage.removeItem('tif-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(m?'dark':'light');})();`,
          }}
        />
        {/* hreflang — même URL pour toutes les langues (sélecteur intégré) */}
        <link rel="alternate" hrefLang="fr" href="https://tif.borja-swiss-solutions.ch/" />
        <link rel="alternate" hrefLang="en" href="https://tif.borja-swiss-solutions.ch/" />
        <link rel="alternate" hrefLang="de" href="https://tif.borja-swiss-solutions.ch/" />
        <link rel="alternate" hrefLang="pt" href="https://tif.borja-swiss-solutions.ch/" />
        <link rel="alternate" hrefLang="es" href="https://tif.borja-swiss-solutions.ch/" />
        <link rel="alternate" hrefLang="ar" href="https://tif.borja-swiss-solutions.ch/" />
        <link rel="alternate" hrefLang="x-default" href="https://tif.borja-swiss-solutions.ch/" />
        {/* JSON-LD — SoftwareApplication + Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "SoftwareApplication",
                  "name": "TIF — Intelligence Territoriale Grand Genève",
                  "alternateName": "TIF",
                  "applicationCategory": "TravelApplication",
                  "operatingSystem": "Web",
                  "url": "https://tif.borja-swiss-solutions.ch",
                  "description": "Application temps réel pour la mobilité frontalière dans le Grand Genève. Douanes, trafic, transports publics et alertes en temps réel, sources officielles agrégées.",
                  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CHF" },
                  "inLanguage": ["fr","en","de","pt","es","ar","it","ru","uk"],
                  "featureList": [
                    "Temps d'attente douanes en temps réel",
                    "Carte trafic Grand Genève",
                    "Alertes mobilité en temps réel",
                    "Transports publics TPG/CFF/Léman Express",
                    "Assistant IA multilingue",
                    "9 langues supportées",
                    "Gratuit, sans inscription"
                  ],
                  "publisher": {
                    "@type": "Organization",
                    "name": "Börja Swiss Solutions",
                    "url": "https://borja-swiss-solutions.ch",
                    "founder": { "@type": "Person", "name": "Arun Calstas" },
                    "address": { "@type": "PostalAddress", "addressLocality": "Genève", "addressCountry": "CH" }
                  }
                },
                {
                  "@type": "WebSite",
                  "url": "https://tif.borja-swiss-solutions.ch",
                  "name": "TIF — Intelligence Territoriale Grand Genève",
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": "https://tif.borja-swiss-solutions.ch/map",
                    "query-input": "required name=search_term_string"
                  }
                }
              ]
            })
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Providers>
            {children}
          </Providers>
          <CookieConsent />
        </ThemeProvider>
        {/* Live presence beacon — ping toutes les 60s pour compteur en direct admin */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){
          var sid=sessionStorage.getItem('tif_sid');
          if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem('tif_sid',sid);}
          function ping(){fetch('/api/v1/live-count',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid}),keepalive:true}).catch(function(){});}
          ping();
          setInterval(ping,60000);
        })();` }} />
      </body>
    </html>
  )
}
