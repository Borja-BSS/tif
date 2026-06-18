'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { T, LANGUAGES } from '@/i18n/home'
import type { Lang } from '@/i18n/home'
import { LangSelector } from '@/components/LangSelector'
import { computeInstantStatus, ALL_CROSSINGS } from '@/lib/territory/border-crossings-client'
import { events as allEvents } from '@/data/events'

interface DashData {
  alerts: Array<{ id: string; icon: string; title: string; severity: string; timeAgo: string }>
  network: { tpg: string; cff: string; ceva: string }
  activeZones: number
  lastUpdated: string
}
interface TransportData {
  disruptions: {
    tpg: Array<{ lineNumber: string; description: string }>
    cff: Array<{ line: string; from: string; to: string; delayMinutes?: number; isCEVA: boolean }>
  }
  g7: { isActive: boolean; affectedLines: string[]; suspendedLines: string[] }
}
interface BorderRow { name: string; waitMinutes: number; status: string }
type IncSlide = { id: string; icon: string; title: string; severity: string; timeAgo: string; source?: string }
type DetailInfo = {
  icon: string; title: string; badge?: string
  rows?: Array<{ label: string; value: string; color?: string }>
  note?: string; body?: string
}

const SOURCE_URLS: Record<string, string> = {
  'OFROU': 'https://www.astra.admin.ch/astra/fr/home.html',
  'OFROU (Réseau autoroutier national)': 'https://www.astra.admin.ch/astra/fr/home.html',
  'TPG': 'https://www.tpg.ch/fr/voyagez-avec-nous/infos-trafic',
  'TPG (Transports Publics Genevois)': 'https://www.tpg.ch/fr/voyagez-avec-nous/infos-trafic',
  'TPG en lien avec dispositif G7': 'https://www.tpg.ch/fr/voyagez-avec-nous/infos-trafic',
  'OpenTransportData.swiss': 'https://opentransportdata.swiss/fr/',
  'CFF / SBB via OpenTransportData.swiss': 'https://opentransportdata.swiss/fr/',
  'CFF / SBB': 'https://www.sbb.ch/fr',
  'MétéoSuisse': 'https://www.meteoswiss.admin.ch/',
  'MétéoSuisse, Office fédéral de météorologie': 'https://www.meteoswiss.admin.ch/',
  'BAZG': 'https://www.bazg.admin.ch/bazg/fr/home.html',
  'BAZG, Bureau fédéral des douanes suisses': 'https://www.bazg.admin.ch/bazg/fr/home.html',
  'BAZG (frontières), Police Cantonale GE': 'https://www.bazg.admin.ch/bazg/fr/home.html',
  'Police Cantonale GE': 'https://www.police.ge.ch/',
  'Police Cantonale GE, Dispositif G7': 'https://www.police.ge.ch/',
  'Police Cantonale GE, SITG, OFROU': 'https://www.police.ge.ch/',
  'OFROU, SITG, Veille G7 TIF': 'https://www.astra.admin.ch/astra/fr/home.html',
  'OFROU, SITG': 'https://ge.ch/sitg/',
  'OFROU, Police Cantonale GE, TPG, CFF, MétéoSuisse, BAZG': 'https://tif.borja-swiss-solutions.ch',
  'Canton GE, SITG': 'https://ge.ch/sitg/',
  'CFF côté suisse et SNCF côté français': 'https://opentransportdata.swiss/fr/',
  'BAZG, Bureau fédéral des douanes': 'https://www.bazg.admin.ch/bazg/fr/home.html',
  'TIF Monitoring': 'https://tif.borja-swiss-solutions.ch',
}

const SLIDE_COUNTS: Record<string, number> = { why: 4, src: 8, tc1: 4, tc2: 4, prk: 8 }

const PRK_SLIDES = [
  { id: 'balexert',    name: 'Balexert',      capacity: 1879, tpg: 'Tram 14',         hasRT: false },
  { id: 'sous-moulin', name: 'Sous-Moulin',    capacity:  876, tpg: 'Tram 12',         hasRT: true  },
  { id: 'ge-plage',    name: 'Genève-Plage',   capacity:  865, tpg: 'Bus 2 · 27',      hasRT: true  },
  { id: 'etoile',      name: 'Étoile',         capacity:  541, tpg: 'Tram 15 · 17',    hasRT: true  },
  { id: 'p26',         name: 'P26 Aéroport',   capacity:  527, tpg: 'Train · Tram 14', hasRT: true  },
  { id: 'secheron',    name: 'Sécheron',       capacity:  395, tpg: 'Tram 14 · 15',    hasRT: false },
  { id: 'moillesulaz', name: 'Moillesulaz',    capacity:  379, tpg: 'Tram 12',         hasRT: true  },
  { id: 'bernex',      name: 'Bernex',         capacity:  254, tpg: 'Tram 15',         hasRT: false },
]

const STATIC_INC: IncSlide[] = [
  { id: '1', icon: '🚦', title: 'A1, km 4.2 direction Lausanne, 2 voies bloquées sur 3', severity: 'CRITICAL', timeAgo: '07:43', source: 'OFROU' },
  { id: '2', icon: '⬡', title: 'G7 Zones rouges actives : Palais des Nations, Quai Wilson, Rue de Lausanne', severity: 'HIGH', timeAgo: '06:00', source: 'Police Cantonale GE' },
  { id: '3', icon: '📢', title: 'Manifestation Quai du Mont-Blanc, blocage, durée estimée 45 min', severity: 'HIGH', timeAgo: '08:12', source: 'Police Cantonale GE' },
  { id: '4', icon: '🚌', title: 'TPG Ligne 12, Déviation Cornavin vers Rive, retard cumulé 8 min', severity: 'MEDIUM', timeAgo: '07:58', source: 'TPG' },
  { id: '5', icon: '⛈️', title: 'Alerte météo orange, orages dès 17h, rafales 80 km/h, grêle possible', severity: 'MEDIUM', timeAgo: '05:30', source: 'MétéoSuisse' },
  { id: '6', icon: '🚆', title: 'CFF IR90 Genève vers Berne, retard 14 min suite incident Lausanne', severity: 'MEDIUM', timeAgo: '08:02', source: 'CFF' },
  { id: '7', icon: '⬡', title: 'G7 Consigne, éviter secteur aéroport 11h à 14h, convois officiels', severity: 'HIGH', timeAgo: '09:00', source: 'Police Cantonale GE' },
  { id: '8', icon: '🚧', title: 'Travaux Rue de Rive, fermeture totale, déviation par Cours de Rive', severity: 'LOW', timeAgo: '00:00', source: 'Canton GE, SITG' },
]

// WHY_SLIDES content moved to i18n/home.ts → t.why.slides

const WHY_DETAILS: DetailInfo[] = [
  { icon: '🏥', title: 'Scénario 01 : Mobilité professionnelle', rows: [
    { label: 'Profil', value: 'Infirmière, départ 7h45' },
    { label: 'Problème', value: 'Bardonnex fermée, non signalée' },
    { label: 'Sans TIF', value: '+20 min de queue découverte sur place', color: 'var(--red)' },
    { label: 'Avec TIF', value: 'Alerte 6h30, itinéraire Thônex planifié', color: 'var(--green)' },
    { label: 'Gain estimé', value: '35 à 45 min' },
    { label: 'Source données', value: 'BAZG (frontières), Police Cantonale GE' },
  ], note: 'Ce scénario se produit chaque matin de sommet international pour des milliers de professionnels de santé dans le Grand Genève.' },
  { icon: '👨‍👩‍👧', title: 'Scénario 02 : Sécurité familiale', rows: [
    { label: 'Profil', value: 'Famille, sortie Quai Wilson' },
    { label: 'Problème', value: 'Zone rouge G7 non connue' },
    { label: 'Sans TIF', value: 'Blocage surprise, demi-tour forcé', color: 'var(--red)' },
    { label: 'Avec TIF', value: 'Zone visible à 6h00 avec itinéraire alternatif', color: 'var(--green)' },
    { label: 'Source données', value: 'Police Cantonale GE, Veille G7 TIF' },
  ], note: 'Les zones G7 changent quotidiennement. TIF les met à jour dès leur publication officielle.' },
  { icon: '🚚', title: 'Scénario 03 : Logistique entreprise', rows: [
    { label: 'Profil', value: 'Livreur, 14 arrêts dans Genève' },
    { label: 'Problème', value: '4 zones G7 fermées sur le trajet' },
    { label: 'Sans TIF', value: '3 heures perdues, 6 livraisons ratées', color: 'var(--red)' },
    { label: 'Avec TIF', value: 'Tournée planifiée avant 7h30, 14 livraisons OK', color: 'var(--green)' },
    { label: 'Gain estimé', value: '3h et 6 livraisons supplémentaires' },
    { label: 'Source données', value: 'OFROU, SITG, Veille G7 TIF' },
  ], note: 'Pour les entreprises logistiques, TIF Pro offre une API directe pour automatiser la planification.' },
  { icon: '⚡', title: 'Scénario 04 : Réaction en temps réel', rows: [
    { label: 'Situation', value: 'Incident soudain, information dispersée' },
    { label: 'Twitter / Waze', value: 'Délai 5 à 15 min, rumeurs non vérifiées', color: 'var(--red)' },
    { label: 'Google Maps', value: 'Délai 5 à 15 min, pas de contexte G7', color: 'var(--orange)' },
    { label: 'TIF', value: 'Sources officielles agrégées en moins de 30s', color: 'var(--green)' },
    { label: 'Sources', value: 'OFROU, Police, TPG, CFF, MétéoSuisse' },
  ], note: 'TIF ne produit pas de données. Il les agrège et les attribue. Chaque information est traçable à sa source primaire.' },
]

// desc + live moved to i18n/home.ts → t.src.slides
const SRC_SLIDES_STATIC = [
  { icon: '📡', name: 'Réseau Börja',    url: 'https://borja-swiss-solutions.ch', blue: true  },
  { icon: '🛣️', name: 'OFROU / ASTRA',  url: 'https://www.astra.admin.ch',       blue: false },
  { icon: '🗺️', name: 'SITG Geneva',     url: 'https://ge.ch/sitg/',              blue: false },
  { icon: '🚌', name: 'TPG',             url: 'https://www.tpg.ch',               blue: false },
  { icon: '🚆', name: 'CFF / SBB + CEVA',url: 'https://www.sbb.ch/fr',            blue: false },
  { icon: '🌩️', name: 'MétéoSuisse',    url: 'https://www.meteoswiss.admin.ch',  blue: false },
  { icon: '🛂', name: 'Frontières CH-FR',url: 'https://www.bazg.admin.ch',        blue: false },
  { icon: '🚗', name: 'HERE Maps / Waze',url: 'https://www.here.com',             blue: false },
]

// name + desc moved to i18n/home.ts → t.trans.tc1Slides / tc2Slides
const TC1_MODALS = ['m-hosting', 'm-rgpd', 'm-privacy', 'm-secu']
const TC2_MODALS = ['m-faq', 'm-doc', 'm-usecases', 'm-archi']
const TC1_ICONS  = ['🏢', '🔒', '📄', '🛡️']
const TC2_ICONS  = ['❓', '📚', '🎯', '🏗️']

// FAQ_ITEMS content moved to i18n/home.ts → t.faq.items

const BORDER_HOME_IDS = ['bardonnex', 'thonex-vallard', 'moillesulaz', 'meyrin', 'ferney-voltaire']

const CATEGORY_MAP: Record<string, string> = {
  football: 'Football',
  festival: 'Musique',
  concert: 'Musique',
  classique: 'Musique',
  cinema: 'Cinéma',
  art: 'Culture',
  sport: 'Sport',
  theatre: 'Culture',
  danse: 'Culture',
}

// Seuls les événements publics à grande échelle (pas les spectacles de petite salle)
const HOMEPAGE_IDS = new Set([
  'worldcup-2026','nati-qatar-suisse','nati-suisse-bosnie','nati-suisse-canada',
  'fanzone-gradi24','fanzone-nyon','fanzone-saint-genis','fanzone-crowne-plaza',
  'etoile-carouge-aarau-j1',
  'servette-bale-j1','servette-grasshoppers-2026','servette-lucerne-2026',
  'caribana-17','caribana-18','caribana-19','caribana-20',
  'fete-musique',
  'scene-ella',
  'beach-pro-tour-femmes','beach-pro-tour-hommes',
  'tous-a-la-plage-2026',
  'amr-cropettes',
  'plein-les-watts',
  'triathlon-tour-geneve',
  'guitare-en-scene',
  'swiss-open-geneva-2026',
  'montreux-jazz-2026',
  'grand-juillet-2026',
  'paleo-2026',
  'nocturne-saint-pierre-2026',
  'allianz-cinema',
  'cinetransat-2026',
  'pathe-balexert','arena-la-praille','grutli','spoutnik','cinema-bio',
  'les-scala','le-city','nord-sud','cinema-voltaire-ferney','pathe-archamps',
  'jazz-sur-la-plage-2026',
  'tdf-femmes-etape2',
  'osr-geneve-plage-2026',
  'piz-palu-festival-2026',
  'festiverbant-2026',
  'la-batie-2026',
  'scene-vagabonde-2026',
  'musee-ariana-ducate','musee-ariana-verre-cirva','musee-rath-sylvia-sleigh',
])

const EVENTS_DATA = allEvents
  .filter(ev => ev.occurrences.length > 0 && HOMEPAGE_IDS.has(ev.id))
  .map(ev => {
    const dates = [...new Set(ev.occurrences.map(o => o.date))].sort()
    const cat = CATEGORY_MAP[ev.category] ?? 'Culture'
    const isFree = !!ev.priceInfo && (
      ev.priceInfo.toLowerCase().includes('gratuit') ||
      ev.priceInfo.toLowerCase().includes('libre')
    )
    const ticketLink = ev.links?.find(l => l.kind === 'tickets')
    const infoLink   = ev.links?.find(l => l.kind === 'info')
    const venueLink  = ev.links?.find(l => l.kind === 'venue')
    const url = (cat === 'Cinéma' ? (venueLink?.url ?? infoLink?.url) : ticketLink?.url)
      ?? infoLink?.url ?? venueLink?.url ?? ev.links?.[0]?.url ?? '/map'
    const desc = ev.description.length > 90 ? ev.description.slice(0, 88) + '…' : ev.description
    const lastDate = dates[dates.length - 1]
    return {
      date: dates[0],
      endDate: lastDate !== dates[0] ? lastDate : undefined,
      title: ev.title,
      cat,
      desc,
      loc: ev.venue.name,
      free: isFree,
      url,
    }
  })

const CAT_COLORS: Record<string, string> = {
  Football: '#FF9F0A',
  Musique: '#0A84FF',
  Sport: '#30D158',
  Culture: '#BF5AF2',
  Cinéma: '#FF375F',
}

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']

function fmtEventDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

function getInitialBorders(): BorderRow[] {
  const now = new Date()
  return BORDER_HOME_IDS.map(id => {
    const c = ALL_CROSSINGS.find(x => x.id === id)
    if (!c) return { name: id, waitMinutes: 0, status: 'CLEAR' }
    const { status, waitMinutes } = computeInstantStatus(c, now)
    return { name: c.name, waitMinutes, status }
  })
}

const CEVA_LINES = ['L1 Coppet Annemasse', 'L2 Bellegarde Évian', 'L3 Genève Annecy', 'L4 Cornavin Meyrin']

export function HomeContent() {
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    const saved = localStorage.getItem('tif-lang') as Lang | null
    if (saved && LANGUAGES.some(l => l.code === saved)) setLang(saved)
  }, [])

  function changeLang(l: Lang) {
    setLang(l)
    localStorage.setItem('tif-lang', l)
  }

  const t = T[lang]

  const [clock, setClock] = useState('--:--')
  const [openModal, setOpenModal] = useState<string | null>(null)
  const [incModal, setIncModal] = useState<IncSlide | null>(null)
  const [detail, setDetail] = useState<DetailInfo | null>(null)
  const [selectedAmt,   setSelectedAmt]   = useState<number | null>(null)
  const [customAmt,     setCustomAmt]     = useState('')
  const [donateEmail,   setDonateEmail]   = useState('')
  const [donateLoading, setDonateLoading] = useState(false)
  const [donateError,   setDonateError]   = useState<string | null>(null)

  const PAYMENT_LINK = 'https://buy.stripe.com/fZu5kCar71V38erfdR97G00'

  function handleDonate() {
    const amount = customAmt ? parseFloat(customAmt) : selectedAmt
    if (!amount || amount < 1) { setDonateError('Choisissez un montant.'); return }
    setDonateError(null)
    const centimes = Math.round(amount * 100)
    const url = `${PAYMENT_LINK}?prefilled_amount=${centimes}${donateEmail ? `&prefilled_email=${encodeURIComponent(donateEmail)}` : ''}`
    window.open(url, '_blank')
  }
  const [activeDots, setActiveDots] = useState<Record<string, number>>({})
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [dashData, setDashData] = useState<DashData | null>(null)
  const [transport, setTransport] = useState<TransportData | null>(null)
  const [borders, setBorders] = useState<BorderRow[]>(getInitialBorders)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)
  const [proForm, setProForm] = useState({ name: '', organisation: '', email: '', fonction: '', message: '', loading: false, success: false, error: '' })
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '', loading: false, success: false, error: '' })
  const [auditForm, setAuditForm] = useState({ name: '', email: '', expertise: '', loading: false, success: false, error: '' })
  const [partnerForm, setPartnerForm] = useState({ institution: '', email: '', expertise: '', loading: false, success: false, error: '' })
  const [agendaFilter, setAgendaFilter] = useState<string>('Tout')
  const [agendaShowAll, setAgendaShowAll] = useState(false)
  const [statsEmail, setStatsEmail] = useState('')
  const lastFocus = useRef<HTMLElement | null>(null)
  const { user } = useAuth()
  const router = useRouter()
  const carRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  // Nav shadow
  useEffect(() => {
    const nav = document.getElementById('nav')
    const fn = () => nav?.classList.toggle('scrolled', window.scrollY > 10)
    window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn)
  }, [])

  // Reveal
  useEffect(() => {
    const ro = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); ro.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => ro.observe(el))
    return () => ro.disconnect()
  }, [])

  // Bar animation
  useEffect(() => {
    const bo = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.dc-fill').forEach(b => {
            const el = b as HTMLElement; const w = el.style.width; el.style.width = '0'
            requestAnimationFrame(() => setTimeout(() => { el.style.width = w }, 80))
          }); bo.unobserve(e.target)
        }
      })
    }, { threshold: 0.3 })
    document.querySelectorAll('.dash-row').forEach(el => bo.observe(el))
    return () => bo.disconnect()
  }, [])

  // Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detail) setDetail(null)
        else if (incModal) setIncModal(null)
        else if (openModal) closeM()
      }
    }
    document.addEventListener('keydown', fn); return () => document.removeEventListener('keydown', fn)
  }, [openModal, incModal, detail])

  // Carousel init
  useEffect(() => {
    requestAnimationFrame(() => {
      Object.entries(SLIDE_COUNTS).forEach(([key, logical]) => {
        const el = carRefs.current[key]; if (!el) return
        const slides = el.querySelectorAll('.cslide'); if (!slides.length) return
        el.scrollLeft = logical * ((slides[0] as HTMLElement).offsetWidth + 3)
      })
    })
  }, [])

  // Live data
  const fetchLive = useCallback(async () => {
    try {
      const [dashRes, transRes, terrRes] = await Promise.allSettled([
        fetch('/api/v1/dashboard').then(r => r.ok ? r.json() : null),
        fetch('/api/v1/layers/transport').then(r => r.ok ? r.json() : null),
        fetch('/api/v1/layers/territory').then(r => r.ok ? r.json() : null),
      ])
      if (dashRes.status === 'fulfilled' && dashRes.value) setDashData(dashRes.value)
      if (transRes.status === 'fulfilled' && transRes.value) setTransport(transRes.value)
      if (terrRes.status === 'fulfilled' && terrRes.value) {
        const parsed: BorderRow[] = (terrRes.value.features ?? [])
          .filter((f: { properties?: Record<string, unknown> }) => {
            const p = f.properties ?? {}
            return p.type === 'border' && (typeof p.waitMinutes === 'number' || typeof p.waitTimeMinutes === 'number')
          })
          .slice(0, 5)
          .map((f: { properties: Record<string, unknown> }) => ({
            name: String(f.properties.name ?? ''),
            waitMinutes: Number(f.properties.waitMinutes ?? f.properties.waitTimeMinutes ?? 0),
            status: String(f.properties.status ?? 'CLEAR'),
          }))
        if (parsed.length) setBorders(parsed)
      }
      setLastRefresh(new Date())
    } catch { /* keep previous data */ }
  }, [])

  useEffect(() => { fetchLive(); const id = setInterval(fetchLive, 30000); return () => clearInterval(id) }, [fetchLive])

  // Derived
  const tpgDisrupted = transport?.disruptions.tpg ?? []
  const uniqueTpgLines = [...new Set(tpgDisrupted.map(d => d.lineNumber))]
  const cffDelays = (transport?.disruptions.cff ?? []).filter(d => !d.isCEVA && (d.delayMinutes ?? 0) > 0)
  const maxCffDelay = cffDelays.length ? Math.max(...cffDelays.map(d => d.delayMinutes ?? 0)) : 0
  const cevaOk = !(transport?.disruptions.cff ?? []).some(d => d.isCEVA && (d.delayMinutes ?? 0) > 0)
  const trafficAlert = dashData?.alerts.find(a => ['🚦', '🚫', '🚨'].includes(a.icon))
  const meteoAlert = dashData?.alerts.find(a => a.icon === '⛈️')
  const g7Zones = dashData?.activeZones ?? 4
  const g7Lines = transport?.g7.affectedLines ?? []
  const traficBar = trafficAlert ? (trafficAlert.severity === 'CRITICAL' ? 90 : 65) : 20
  const tpgBar = Math.min(95, uniqueTpgLines.length * 14)
  const cffBar = Math.min(90, maxCffDelay * 2)
  const meteoBar = meteoAlert ? 72 : 25

  // Ticker items from real API data or accurate generic fallback
  const tickerItems = useMemo(() => {
    const apiItems = (dashData?.alerts ?? []).map(a => {
      const cls = a.severity === 'CRITICAL' ? 'tb-r' : a.severity === 'HIGH' ? 'tb-gold' : 'tb-o'
      const lbl = a.icon === '🚆' ? 'CFF' : a.icon === '🚌' ? 'TPG' : a.icon === '⛈️' ? 'Météo' : a.icon === '⬡' ? 'G7' : 'Alerte'
      return { cls, label: lbl, text: a.title }
    })
    const TICKER_CLS = ['tb-b', 'tb-gold', 'tb-g', 'tb-b', 'tb-g', 'tb-b']
    const info = t.ticker.map((item, i) => ({ cls: TICKER_CLS[i] ?? 'tb-b', label: item.label, text: item.text }))
    const combined = apiItems.length ? [...apiItems, ...info] : info
    return [...combined, ...combined]
  }, [dashData, t])

  function borderLabel(status: string) {
    return status === 'CLEAR' ? t.common.borderClear : status === 'LIGHT' ? t.common.borderLight : status === 'MODERATE' ? t.common.borderModerate : status === 'HEAVY' ? t.common.borderHeavy : t.common.borderBlocked
  }
  function borderClass(status: string) {
    return status === 'CLEAR' || status === 'LIGHT' ? 'mt-ok' : status === 'HEAVY' || status === 'BLOCKED' ? 'mt-bad' : 'mt-warn'
  }

  // Modals
  function openM(id: string) { lastFocus.current = document.activeElement as HTMLElement; setOpenModal(id); document.body.style.overflow = 'hidden' }
  function closeM() { setOpenModal(null); document.body.style.overflow = ''; lastFocus.current?.focus() }

  // Carousel infinite triple-clone
  const carMove = useCallback((key: string, dir: number, logical?: number) => {
    const el = carRefs.current[key]; if (!el) return
    const all = el.querySelectorAll('.cslide'); if (!all.length) return
    const log = logical ?? SLIDE_COUNTS[key] ?? Math.round(all.length / 3)
    const sw = (all[0] as HTMLElement).offsetWidth + 3
    const cur = Math.round(el.scrollLeft / sw)
    el.scrollTo({ left: (cur + dir) * sw, behavior: 'smooth' })
    setActiveDots(prev => ({ ...prev, [key]: (((cur + dir) % log) + log) % log }))
  }, [])

  const csync = useCallback((key: string, logical?: number) => {
    const el = carRefs.current[key]; if (!el) return
    const all = el.querySelectorAll('.cslide'); if (!all.length) return
    const log = logical ?? SLIDE_COUNTS[key] ?? Math.round(all.length / 3)
    const sw = (all[0] as HTMLElement).offsetWidth + 3
    const cur = Math.round(el.scrollLeft / sw)
    const dot = ((cur % log) + log) % log
    setActiveDots(prev => ({ ...prev, [key]: dot }))
    if (cur < log || cur >= log * 2) el.scrollLeft = (log + dot) * sw
  }, [])

  function Dots({ id, logical }: { id: string; logical: number }) {
    return (
      <div className="cdots">
        {Array.from({ length: logical }).map((_, i) => (
          <button key={i} className={`cdot${(activeDots[id] ?? 0) === i ? ' on' : ''}`}
            onClick={() => {
              const el = carRefs.current[id]; if (!el) return
              const sl = el.querySelector('.cslide') as HTMLElement | null; if (!sl) return
              el.scrollTo({ left: (logical + i) * (sl.offsetWidth + 3), behavior: 'smooth' })
              setActiveDots(prev => ({ ...prev, [id]: i }))
            }} />
        ))}
      </div>
    )
  }

  const shareUrl = 'https://tif.borja-swiss-solutions.ch'
  const shareText = t.shareText
  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function handleOpenMap(e: React.MouseEvent) {
    e.preventDefault()
    router.push(user ? '/map' : '/login')
  }

  // Form submits
  const submitPro = async () => {
    setProForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pro', name: proForm.name, organisation: proForm.organisation, email: proForm.email, fonction: proForm.fonction, message: proForm.message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Erreur lors de l\'envoi')
      setProForm(f => ({ ...f, loading: false, success: true }))
    } catch (e) {
      setProForm(f => ({ ...f, loading: false, error: e instanceof Error ? e.message : 'Erreur inconnue' }))
    }
  }

  const submitContact = async () => {
    setContactForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contact', name: contactForm.name, email: contactForm.email, subject: contactForm.subject, message: contactForm.message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Erreur lors de l\'envoi')
      setContactForm(f => ({ ...f, loading: false, success: true }))
    } catch (e) {
      setContactForm(f => ({ ...f, loading: false, error: e instanceof Error ? e.message : 'Erreur inconnue' }))
    }
  }

  const submitAudit = async () => {
    setAuditForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'audit', name: auditForm.name, email: auditForm.email, expertise: auditForm.expertise }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Erreur lors de l\'envoi')
      setAuditForm(f => ({ ...f, loading: false, success: true }))
    } catch (e) {
      setAuditForm(f => ({ ...f, loading: false, error: e instanceof Error ? e.message : 'Erreur inconnue' }))
    }
  }

  const submitPartner = async () => {
    setPartnerForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'partner', name: partnerForm.institution, institution: partnerForm.institution, email: partnerForm.email, expertise: partnerForm.expertise }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Erreur lors de l\'envoi')
      setPartnerForm(f => ({ ...f, loading: false, success: true }))
    } catch (e) {
      setPartnerForm(f => ({ ...f, loading: false, error: e instanceof Error ? e.message : 'Erreur inconnue' }))
    }
  }

  return (
    <div className="home-page">

      {/* NAV */}
      <nav id="nav">
        <a className="n-logo" href="#">TIF</a>
        <div className="n-links">
          <a className="n-link" href="#evenements">Événements</a>
          <a className="n-link" href="#live">Live</a>
          <a className="n-link" href="#pro">Professionnels</a>
          <a className="n-link" href="#confiance">{t.nav.transparency}</a>
        </div>
        <div className="n-right">
          <div className="n-live"><div className="n-live-dot" /><span>{clock}</span></div>
          <a
            href={user ? '/map' : '/login'}
            onClick={e => { e.preventDefault(); router.push(user ? '/map' : '/login') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '980px', padding: '5px 11px', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-.01em', whiteSpace: 'nowrap' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            <span>{user ? (user.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? t.nav.account) : t.nav.login}</span>
          </a>
          <a className="n-cta" href={user ? '/map' : '/login'} onClick={handleOpenMap}>{t.nav.openMap}</a>
          <a href="https://borja-swiss-solutions.ch" target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-.01em' }}>Börja</a>
          <LangSelector lang={lang} onChange={changeLang} />
        </div>
      </nav>

      {/* TICKER — dynamique depuis API ou info vérifiée */}
      <div className="ticker" aria-label="Flux d'informations en direct">
        <div className="ticker-inner">
          {tickerItems.map((item, i) => (
            <div key={i} className="ti"><span className={`tb ${item.cls}`}>{item.label}</span>{item.text}</div>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <h1 className="hero-h1">Intelligence Territoriale<br /><span className="accent">Grand Genève</span></h1>
        <p className="hero-p">
          Mobilité en temps réel, agenda événementiel complet, gestion de foule.<br />
          <strong>Comprendre et anticiper votre territoire.</strong><br />
          6 sources live · mise à jour toutes les 30s · Développement interne
        </p>
        <div className="hero-btns">
          <a className="btn-p" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="white" /><circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" /></svg>
            Ouvrir la carte
          </a>
          <a className="btn-s" href="#evenements">Voir les événements</a>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span>Découvrir</span>
          <div className="scroll-arrow"><svg viewBox="0 0 14 14"><polyline points="2,5 7,10 12,5" /></svg></div>
        </div>
      </section>

      {/* ÉVÉNEMENTS TICKER */}
      <section className="s s-alt" id="evenements">
        <div className="s-label reveal">{t.agenda.sectionLabel}</div>
        <h2 className="s-h reveal">{t.agenda.h2a}<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{t.agenda.h2b}</span></h2>
        <p className="s-sub reveal" style={{ marginBottom: '32px' }}>{t.agenda.sub}</p>
        <div className="reveal" style={{ overflowX: 'auto', display: 'flex', gap: '12px', padding: '4px 0 20px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {EVENTS_DATA
            .filter(ev => (ev.endDate ?? ev.date) >= new Date().toISOString().split('T')[0])
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((ev, i) => {
            const color = CAT_COLORS[ev.cat] ?? '#636366'
            return (
              <a key={i} href={ev.url} target={ev.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                style={{ textDecoration: 'none', flexShrink: 0, width: '200px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'border-color 0.2s', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color, background: `${color}18`, padding: '3px 8px', borderRadius: '100px' }}>{ev.cat}</span>
                  {ev.free && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--green)', letterSpacing: '0.06em' }}>{t.agenda.free.toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>{ev.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{ev.desc}</div>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>📍 {ev.loc}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color, marginTop: '2px' }}>{fmtEventDate(ev.date)}{ev.endDate ? ` au ${fmtEventDate(ev.endDate)}` : ''}</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 600, marginTop: '4px' }}>
                  {ev.url.startsWith('/') ? t.agenda.seeMap : t.agenda.ticket}
                </div>
              </a>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <a href="#agenda" style={{ fontSize: '13px', color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{t.agenda.fullLabel} →</a>
        </div>
      </section>

      {/* AGENDA COMPLET */}
      <section className="s reveal" id="agenda">
        <div className="s-label">{t.agenda.fullLabel}</div>
        <h2 className="s-h" style={{ marginBottom: '24px' }}>{t.agenda.fullH2a}<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{t.agenda.fullH2b}</span></h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px', justifyContent: 'center' }}>
          {[
            { key: 'Tout', label: t.agenda.filterAll },
            { key: 'Musique', label: t.agenda.filterMusic },
            { key: 'Sport', label: t.agenda.filterSport },
            { key: 'Culture', label: t.agenda.filterCulture },
            { key: 'Football', label: t.agenda.filterFootball },
            { key: 'Cinéma', label: t.agenda.filterCinema },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => { setAgendaFilter(key); setAgendaShowAll(false) }} style={{ padding: '8px 18px', borderRadius: '100px', border: `1px solid ${agendaFilter === key ? (CAT_COLORS[key] ?? 'var(--border)') : 'var(--border)'}`, background: agendaFilter === key ? `${CAT_COLORS[key] ?? 'var(--blue)'}18` : 'transparent', color: agendaFilter === key ? (CAT_COLORS[key] ?? 'var(--blue)') : 'var(--text-secondary)', fontWeight: agendaFilter === key ? 700 : 500, fontSize: '13px', cursor: 'pointer', transition: 'all 0.18s', letterSpacing: '-0.01em' }}>
              {label}
            </button>
          ))}
        </div>
        {(() => {
          const today = new Date().toISOString().split('T')[0]
          const filtered = EVENTS_DATA
            .filter(ev => (agendaFilter === 'Tout' || ev.cat === agendaFilter) && (ev.endDate ?? ev.date) >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
          const visible = agendaShowAll ? filtered : filtered.slice(0, 4)
          return (
            <>
              <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {visible.map((ev, i) => {
                  const color = CAT_COLORS[ev.cat] ?? '#636366'
                  return (
                    <a key={i} href={ev.url} target={ev.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', borderRadius: '12px', border: '1px solid transparent', transition: 'background 0.15s, border-color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}>
                      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '44px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{new Date(ev.date).getDate()}</div>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{MONTHS_FR[new Date(ev.date).getMonth()]}</div>
                      </div>
                      <div style={{ width: '3px', height: '36px', borderRadius: '4px', background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{ev.desc} · {ev.loc}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color, background: `${color}18`, padding: '3px 8px', borderRadius: '100px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{ev.cat}</span>
                        {ev.free && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--green)' }}>{t.agenda.freeLower}</span>}
                      </div>
                      <div style={{ flexShrink: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>→</div>
                    </a>
                  )
                })}
              </div>
              {!agendaShowAll && filtered.length > 4 && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button onClick={() => setAgendaShowAll(true)} style={{ padding: '12px 28px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.18s', letterSpacing: '-0.01em' }}>
                    {t.agenda.showMore} · {filtered.length - 4} {t.agenda.eventsLabel} →
                  </button>
                </div>
              )}
            </>
          )
        })()}
        <div className="live-cta reveal" style={{ marginTop: '32px' }}>
          <div className="lct"><strong>Accéder aux événements en temps réel</strong><br />Conditions de mobilité, foule estimée et accès recommandés directement sur la carte.</div>
          <div className="lcb">
            <a className="lc-a" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
              Ouvrir la carte
            </a>
          </div>
        </div>
      </section>

      {/* MÉTRIQUES */}
      <section className="s reveal">
        <div className="dash reveal">
          <div className="dash-row dash-row-4">
            <div className="dc" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(36px,6vw,52px)', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>10K</div>
              <div className="dc-label" style={{ marginBottom: '4px' }}>Utilisateurs uniques / jour</div>
              <div className="dc-desc">Mesurés sur les 7 derniers jours</div>
            </div>
            <div className="dc" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(36px,6vw,52px)', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>150K+</div>
              <div className="dc-label" style={{ marginBottom: '4px' }}>Connexions sur 7 jours</div>
              <div className="dc-desc">+15 sessions par utilisateur en moyenne</div>
            </div>
            <div className="dc" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(36px,6vw,52px)', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>6+</div>
              <div className="dc-label" style={{ marginBottom: '4px' }}>Sources & algo internes</div>
              <div className="dc-desc">HERE · CFF · TPG · Météo · OFDF · OSM + algorithmes propriétaires</div>
            </div>
            <div className="dc" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(36px,6vw,52px)', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>30s</div>
              <div className="dc-label" style={{ marginBottom: '4px' }}>Fréquence de mise à jour</div>
              <div className="dc-desc">Trafic, transports, alertes</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Données d'engagement détaillées disponibles sur demande pour les partenaires institutionnels.
            </span>
            <a href="#stats-request" style={{ fontSize: '12px', color: 'var(--blue)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Recevoir le rapport complet →
            </a>
          </div>
        </div>
      </section>

      {/* DASHBOARD LIVE */}
      <section className="s s-alt" id="live">
        <div className="s-label">Mobilité temps réel</div>
        <h2 className="s-h">Conditions en direct<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>sur le territoire.</span></h2>
        <p className="s-sub" style={{ marginBottom: lastRefresh ? '8px' : undefined }}>Trafic, transports publics, frontières, agrégés depuis 6 sources officielles et nos algorithmes internes, mis à jour toutes les 30 secondes.</p>
        {lastRefresh && (
          <div className="live-refresh-block" style={{ marginBottom: '40px' }}>
            {t.dash.updatedAt} {lastRefresh.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
        <div className="dash reveal">
          <div className="dash-row dash-row-4">
            {/* Trafic */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🚦', title: t.dash.traffic.label, rows: [{ label: 'Statut', value: trafficAlert ? trafficAlert.title : t.common.normal }, { label: 'Source', value: 'OFROU' }, { label: 'Mise à jour', value: 'Toutes les 60s' }], note: 'Données issues du système de surveillance du réseau autoroutier suisse (OFROU).' })}>
              <div className="dc-top"><div className="dc-label">{t.dash.traffic.label}</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${trafficAlert ? 'r' : 'b'}`}>{trafficAlert ? (trafficAlert.severity === 'CRITICAL' ? t.dash.traffic.critical : t.dash.traffic.alert) : t.dash.traffic.normal}</div>
              <div className="dc-desc">{trafficAlert ? trafficAlert.title : t.dash.traffic.descNormal}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${traficBar}%`, background: trafficAlert ? 'var(--red)' : 'var(--blue)' }} /></div>
            </div>
            {/* TPG */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🚌', title: t.dash.tpg.label, rows: [{ label: 'Lignes', value: uniqueTpgLines.length > 0 ? `${uniqueTpgLines.length} ${uniqueTpgLines.length > 1 ? t.dash.tpg.lines : t.dash.tpg.line}` : t.common.normal, color: uniqueTpgLines.length > 0 ? 'var(--orange)' : 'var(--green)' }, { label: 'Source', value: 'TPG' }, { label: 'Mise à jour', value: 'Toutes les 30s' }], note: 'Les données TPG couvrent trams, bus et trolleybus dans le Grand Genève.' })}>
              <div className="dc-top"><div className="dc-label">{t.dash.tpg.label}</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${uniqueTpgLines.length > 3 ? 'r' : uniqueTpgLines.length > 0 ? 'o' : 'b'}`}>{uniqueTpgLines.length > 0 ? `${uniqueTpgLines.length} ${uniqueTpgLines.length > 1 ? t.dash.tpg.lines : t.dash.tpg.line}` : t.dash.tpg.normal}</div>
              <div className="dc-desc">{uniqueTpgLines.length > 0 ? `Lignes ${uniqueTpgLines.slice(0, 4).join(', ')}${uniqueTpgLines.length > 4 ? ` ${t.dash.tpg.other}` : ''}` : t.dash.tpg.descNormal}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${Math.max(tpgBar, 5)}%`, background: uniqueTpgLines.length > 0 ? 'var(--orange)' : 'var(--blue)' }} /></div>
            </div>
            {/* CFF */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🚆', title: t.dash.cff.label, rows: [{ label: 'Retard max', value: maxCffDelay > 0 ? `+${maxCffDelay} min` : t.common.normal, color: maxCffDelay > 0 ? 'var(--orange)' : 'var(--green)' }, { label: t.dash.cff.leman, value: cevaOk ? t.dash.cff.lemanNormal : t.dash.cff.lemanDisrupted, color: cevaOk ? 'var(--green)' : 'var(--orange)' }, { label: 'Source', value: 'OpenTransportData.swiss' }], note: 'Couvre tous les trains CFF et les 4 lignes du Léman Express (CEVA).' })}>
              <div className="dc-top"><div className="dc-label">{t.dash.cff.label}</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${maxCffDelay > 10 ? 'r' : maxCffDelay > 0 ? 'o' : 'b'}`}>{maxCffDelay > 0 ? `+${maxCffDelay} min` : t.dash.cff.normal}</div>
              <div className="dc-desc">{maxCffDelay > 0 ? (cffDelays[0] ? `${cffDelays[0].from} → ${cffDelays[0].to}` : t.dash.cff.delayOngoing) : `${t.dash.cff.leman} : ${cevaOk ? t.dash.cff.lemanNormal : t.dash.cff.lemanDisrupted}`}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${Math.max(cffBar, 5)}%`, background: maxCffDelay > 0 ? 'var(--orange)' : 'var(--blue)' }} /></div>
            </div>
            {/* Météo */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🌩️', title: t.dash.meteo.label, rows: [{ label: 'Statut', value: meteoAlert ? `⚠ ${meteoAlert.severity === 'CRITICAL' ? t.dash.meteo.red : t.dash.meteo.orange}` : t.common.normal, color: meteoAlert ? (meteoAlert.severity === 'CRITICAL' ? 'var(--red)' : 'var(--yellow-text)') : 'var(--green)' }, { label: 'Source', value: 'MétéoSuisse' }, { label: 'Mise à jour', value: 'En continu' }], note: 'Alertes officielles pour le Canton de Genève.' })}>
              <div className="dc-top"><div className="dc-label">{t.dash.meteo.label}</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${meteoAlert ? (meteoAlert.severity === 'CRITICAL' ? 'r' : 'y') : 'b'}`}>{meteoAlert ? `⚠ ${meteoAlert.severity === 'CRITICAL' ? t.dash.meteo.red : t.dash.meteo.orange}` : t.dash.meteo.normal}</div>
              <div className="dc-desc">{meteoAlert ? meteoAlert.title : t.dash.meteo.descNormal}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${Math.max(meteoBar, 5)}%`, background: meteoAlert ? 'var(--yellow-text)' : 'var(--blue)' }} /></div>
            </div>
          </div>
          <div className="dash-row dash-row-3">
            {/* G7 */}
            <div className="dc">
              <div className="g7-head"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polygon points="5,1 9,3 9,7 5,9 1,7 1,3" stroke="currentColor" strokeWidth="1.2" /></svg>{t.dash.g7.label}</div>
              <div className="g7-grid">
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '🔴', title: `${g7Zones} ${t.dash.g7.zonesLabel}`, rows: [{ label: 'Nombre', value: `${g7Zones}`, color: 'var(--red)' }, { label: 'Source', value: 'Police Cantonale GE' }], note: t.dash.g7.zonesDesc })}>
                  <div className="g7m-l">{t.dash.g7.zonesLabel}</div><div className="g7m-v" style={{ color: 'var(--red)' }}>{g7Zones}</div><div className="g7m-d">{t.dash.g7.zonesDesc}</div>
                </div>
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '🚫', title: `11 ${t.dash.g7.roadsLabel}`, rows: [{ label: 'Nombre', value: '11', color: 'var(--orange)' }, { label: 'Source', value: 'Police Cantonale GE, SITG, OFROU' }], note: t.dash.g7.roadsDesc })}>
                  <div className="g7m-l">{t.dash.g7.roadsLabel}</div><div className="g7m-v" style={{ color: 'var(--orange)' }}>11</div><div className="g7m-d">{t.dash.g7.roadsDesc}</div>
                </div>
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '🚌', title: t.dash.g7.tpgLabel, rows: [{ label: 'Nombre', value: `${g7Lines.length > 0 ? g7Lines.length : 3}`, color: 'var(--gold)' }, { label: 'Source', value: 'TPG' }], note: t.dash.g7.tpgDesc })}>
                  <div className="g7m-l">{t.dash.g7.tpgLabel}</div>
                  <div className="g7m-v" style={{ color: 'var(--gold)' }}>{g7Lines.length > 0 ? g7Lines.length : transport?.g7.isActive ? '—' : 3}</div>
                  <div className="g7m-d">{g7Lines.length > 0 ? `Lignes ${g7Lines.slice(0, 4).map(l => l.startsWith('L') || l.startsWith('l') ? l : `L${l}`).join(', ')}` : t.dash.g7.tpgDesc}</div>
                </div>
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '📢', title: `${dashData?.alerts.length ?? 28} ${t.dash.g7.alertsLabel}`, rows: [{ label: 'Total', value: `${dashData?.alerts.length ?? 28}` }, { label: 'Sources', value: 'OFROU, Police GE, TPG, CFF, MétéoSuisse, BAZG' }], note: t.dash.g7.alertsFrom })}>
                  <div className="g7m-l">{t.dash.g7.alertsLabel}</div><div className="g7m-v" style={{ color: 'var(--blue-d)' }}>{dashData?.alerts.length ?? 28}</div><div className="g7m-d">{t.dash.g7.alertsFrom}</div>
                </div>
              </div>
            </div>
            {/* Frontières */}
            <div className="dc">
              <div className="dc-top"><div className="dc-label">{t.dash.borders.label}</div><div className="dc-live-dot" /></div>
              <div className="mini-table" style={{ marginTop: '4px' }}>
                {borders.map(b => (
                  <div key={b.name} className="mt-row mt-row-btn" onClick={() => setDetail({ icon: '🛂', title: b.name, rows: [{ label: 'Attente actuelle', value: b.waitMinutes < 2 ? '< 2 min' : `${b.waitMinutes} min`, color: borderClass(b.status) === 'mt-ok' ? 'var(--green)' : borderClass(b.status) === 'mt-bad' ? 'var(--red)' : 'var(--orange)' }, { label: 'Niveau', value: borderLabel(b.status) }, { label: 'Source', value: 'BAZG, Bureau fédéral des douanes suisses' }, { label: 'Fréquence', value: 'Mise à jour toutes les 5 min' }], note: "Temps indicatif. Peut varier selon les dispositifs G7 en vigueur et les contrôles douaniers renforcés pendant le Sommet." })}>
                    <span className="mt-name">{b.name}</span>
                    <span className={`mt-val ${borderClass(b.status)}`}>{b.waitMinutes < 2 ? '< 2 min' : `${b.waitMinutes} min`}{(b.status === 'HEAVY' || b.status === 'BLOCKED') ? ' ⚠' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* CEVA */}
            <div className="dc">
              <div className="dc-top"><div className="dc-label">{t.dash.ceva.label}</div><div className="dc-live-dot" /></div>
              <div className="mini-table" style={{ marginTop: '4px' }}>
                {CEVA_LINES.map((line, i) => {
                  const disrupted = transport?.disruptions.cff.find(d => d.isCEVA && d.line.includes(`L${i + 1}`))
                  return (
                    <div key={line} className="mt-row mt-row-btn" onClick={() => setDetail({ icon: '🚆', title: `Léman Express ${line}`, rows: [{ label: 'Statut', value: disrupted?.delayMinutes ? `Retard +${disrupted.delayMinutes} min` : 'Service normal', color: disrupted ? 'var(--orange)' : 'var(--green)' }, { label: 'Tronçon', value: disrupted ? `${disrupted.from} vers ${disrupted.to}` : 'Toutes gares' }, { label: 'Source', value: 'CFF / SBB via OpenTransportData.swiss' }, { label: 'Mise à jour', value: 'Toutes les 30 secondes' }], note: 'Le Léman Express est le réseau ferroviaire transfrontalier franco-suisse desservant le Grand Genève. Géré par CFF côté suisse et SNCF côté français.' })}>
                      <span className="mt-name">{line}</span>
                      <span className={`mt-val ${disrupted ? 'mt-warn' : 'mt-ok'}`}>{disrupted?.delayMinutes ? `+${disrupted.delayMinutes} min` : t.common.normal}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="live-cta reveal">
          <div className="lct"><strong>{t.dash.ctaStrong}</strong><br />{t.dash.ctaDesc}</div>
          <div className="lcb">
            <a className="lc-a" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
              {t.dash.ctaBtn}
            </a>
          </div>
        </div>
      </section>


      {/* TRACK RECORD G7 */}
      <section className="s reveal" id="track">
        <div className="contrib-wrap reveal">
          <div className="cc" style={{ flex: '1 1 420px' }}>
            <div className="s-label" style={{ marginBottom: '12px' }}>G7 Évian · 8–17 juin 2026</div>
            <div className="cc-h">Notre savoir-faire,<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontWeight: 400 }}>éprouvé sous pression.</span></div>
            <div className="cc-p" style={{ marginTop: '16px' }}>
              Le Sommet du G7 à Évian a constitué pour TIF un test opérationnel d'envergure internationale. Durant dix jours, la plateforme a assuré une couverture temps réel du territoire genevois sous dispositif sécuritaire maximal, passages frontière renforcés, restrictions de circulation, perturbations TPG majeures, manifestations en centre-ville.
            </div>
            <div className="cc-p">
              Résultat : zéro incident technique, adoption immédiate par la population, couverture presse nationale. Le G7 a démontré qu'une intelligence territoriale réellement distribuée, enrichie de nos algorithmes internes sur mesure, peut absorber les crises sans délai de latence.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Couverts par</span>
              {[
                { name: 'Blick', url: 'https://www.blick.ch/fr/suisse/romande/g7-un-site-gratuit-pour-aider-les-genevois-a-circuler-id22023083.html' },
                { name: 'Léman Bleu', url: 'https://www.lemanbleu.ch/fr/Accueil/G7/Un-Genevois-centralise-les-perturbations-sur-une-seule-plateforme.html' },
                { name: 'Entreprise Romande', url: 'https://www.entrepriseromande.ch/web/er/w/g7-un-site-signalera-les-perturbations-en-temps-réel' },
                { name: 'Radio Lac', url: 'https://www.radiolac.ch/podcasts/le-meilleur-des-reveils-12-06-2026-0836/' },
              ].map(m => (
                <a key={m.name} href={m.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', padding: '5px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '100px', textDecoration: 'none', transition: 'border-color 0.2s' }}>
                  {m.name}
                </a>
              ))}
            </div>
          </div>
          <div className="cc" style={{ flex: '0 0 300px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rapport opérationnel G7</span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>8–17 juin 2026</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {[
                  { val: '0', key: 'Incident technique', sub: 'Sur 10 jours de déploiement' },
                  { val: '10K', key: 'Utilisateurs / jour', sub: 'Pic atteint dès J+2' },
                  { val: '150K+', key: 'Sessions · 7 jours', sub: 'Engagement quotidien soutenu' },
                  { val: '6+', key: 'Sources & algo internes', sub: 'Algorithmes propriétaires développés en interne' },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '12px', background: 'var(--off)', borderRadius: '12px' }}>
                    <div style={{ fontSize: 'clamp(22px,4vw,28px)', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '4px' }}>{s.val}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{s.key}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)' }}>Disponibilité plateforme : 100% · aucune interruption de service</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="s s-alt reveal">
        <div className="s-label">{t.faq.sectionLabel}</div>
        <h2 className="s-h">{t.faq.h2a}<br />{t.faq.h2b}</h2>
        <p className="s-sub">{t.faq.sub}</p>
        <div className="faq-wrap">
          {t.faq.items.map((item, i) => (
            <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{item.q}<span className="faq-icon">+</span></button>
              <div className="faq-body"><p>{item.a}</p></div>
            </div>
          ))}
          {t.faq2.map((item, i) => (
            <div key={100 + i} className={`faq-item${openFaq === 100 + i ? ' open' : ''}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === 100 + i ? null : 100 + i)}>{item.q}<span className="faq-icon">+</span></button>
              <div className="faq-body"><p>{item.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* PARKINGS */}
      <section className="s reveal" id="parkings">
        <div className="s-label">Se déplacer malin</div>
        <h2 className="s-h">Parkings P+Rail<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>pour rejoindre vos événements.</span></h2>
        <p className="s-sub">Garez-vous en périphérie et rejoignez le cœur de Genève en transports publics, rapide, sans stress, sans chercher une place.</p>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="car-outer">
            <div className="car-head">
              <span className="car-head-t">{t.prk.carHead}</span>
              <div className="car-arrows">
                <button className="c-arr" onClick={() => carMove('prk', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
                <button className="c-arr" onClick={() => carMove('prk', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
              </div>
            </div>
            <div className="ctrack" id="ctr-prk" ref={el => { carRefs.current['prk'] = el }} onScroll={() => csync('prk')}>
              {[...PRK_SLIDES, ...PRK_SLIDES, ...PRK_SLIDES].map((p, i) => (
                <div key={i} className="cslide">
                  <div className="why-card" style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '26px', marginBottom: '8px' }}>🅿️</div>
                    <div className="why-title">{p.name}</div>
                    <div className="why-body" style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                        {p.capacity.toLocaleString('fr-CH')}
                        <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '4px' }}>{t.prk.places}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--brand)', fontWeight: 600, marginBottom: '4px' }}>🚌 {p.tpg}</div>
                      {p.hasRT && <div style={{ fontSize: '11px', color: 'var(--green)' }}>⚡ {t.prk.rt}</div>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '10px' }}>{t.prk.viewMap}</div>
                  </div>
                </div>
              ))}
            </div>
            <Dots id="prk" logical={PRK_SLIDES.length} />
          </div>
        </div>
        <div className="live-cta reveal" style={{ marginTop: '20px' }}>
          <div className="lct"><strong>{t.prk.ctaStrong}</strong><br />{t.prk.ctaDesc}</div>
          <div className="lcb">
            <a className="lc-a" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
              {t.prk.ctaBtn}
            </a>
          </div>
        </div>
      </section>


      {/* SOURCES */}
      <section className="s s-alt" id="sources">
        <div className="s-label reveal">{t.src.sectionLabel}</div>
        <h2 className="s-h reveal">{t.src.h2a}<br />{t.src.h2b}</h2>
        <p className="s-sub reveal">{t.src.sub}</p>
        <div className="car-outer reveal" style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <div className="car-head">
            <span className="car-head-t">{t.src.carHead}</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('src', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('src', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-src" ref={el => { carRefs.current['src'] = el }} onScroll={() => csync('src')}>
            {[...SRC_SLIDES_STATIC, ...SRC_SLIDES_STATIC, ...SRC_SLIDES_STATIC].map((s, i) => {
              const ts = t.src.slides[i % SRC_SLIDES_STATIC.length]
              return (
                <div key={i} className="cslide">
                  <a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                    <div className="src" style={{ cursor: 'pointer' }}>
                      <div className="src-icon">{s.icon}</div>
                      <div className="src-name">{s.name}</div>
                      <div className="src-desc">{ts.desc}</div>
                      <div className="src-live" style={s.blue ? { color: 'var(--blue-d)' } : {}}>{ts.live}</div>
                    </div>
                  </a>
                </div>
              )
            })}
          </div>
          <Dots id="src" logical={SRC_SLIDES_STATIC.length} />
        </div>
      </section>

      {/* PRESSE */}
      <section className="s" id="presse" style={{ paddingTop: '72px', paddingBottom: '72px' }}>
        <div className="s-label reveal">Médias</div>
        <h2 className="s-h reveal" style={{ marginBottom: '8px' }}>Ils parlent de TIF</h2>
        <p className="s-sub reveal" style={{ marginBottom: '48px' }}>Couverture presse & médias</p>
        <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', maxWidth: '900px', margin: '0 auto' }}>
          {[
            { name: 'Léman Bleu', type: '📺 Télévision', url: 'https://www.lemanbleu.ch/fr/Accueil/G7/Un-Genevois-centralise-les-perturbations-sur-une-seule-plateforme.html' },
            { name: 'Radio Lac', type: '📻 Radio', url: 'https://www.radiolac.ch/podcasts/le-meilleur-des-reveils-12-06-2026-0836/' },
            { name: 'Entreprise Romande', type: '📰 Presse', url: 'https://www.entrepriseromande.ch/web/er/w/g7-un-site-signalera-les-perturbations-en-temps-réel' },
            { name: 'Blick', type: '📰 Presse', url: 'https://www.blick.ch/fr/suisse/romande/g7-un-site-gratuit-pour-aider-les-genevois-a-circuler-id22023083.html' },
          ].map(m => (
            <a key={m.name} href={m.url} target="_blank" rel="noreferrer"
              style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
                padding: '20px 28px', minWidth: '180px', flex: '1 1 180px', maxWidth: '220px',
                transition: 'border-color 0.2s, box-shadow 0.2s' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{m.type}</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{m.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--brand)', fontWeight: 600, marginTop: '4px' }}>Lire l'article →</span>
            </a>
          ))}
        </div>
      </section>

      {/* APP TEASER */}
      <section className="s reveal" id="app">
        <div className="s-label reveal">Application mobile</div>
        <h2 className="s-h reveal">TIF dans votre poche.<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Disponible la semaine prochaine.</span></h2>
        <p className="s-sub reveal">{t.app.sub}</p>
        <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: '16px', padding: '16px 28px', minWidth: '200px', cursor: 'not-allowed', opacity: 0.85 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 500, opacity: 0.6, letterSpacing: '0.04em' }}>Bientôt disponible sur</div>
              <div style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>App Store</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', background: 'var(--text-primary)', color: 'var(--bg)', borderRadius: '16px', padding: '16px 28px', minWidth: '200px', cursor: 'not-allowed', opacity: 0.85 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.18 23.76c.31.17.67.22 1.04.13l11.35-6.55-2.43-2.43-9.96 8.85zm15.29-10.7L5.02 5.89l9.82 8.74 3.63-1.57zM1.21 5.27C1.08 5.53 1 5.83 1 6.17v11.65c0 .34.08.64.21.9l.1.1 6.53-6.53v-.14L1.31 5.17l-.1.1zm15.75 8.18l-2.06 1.19-2.58-2.58 2.58-2.58 2.07 1.2c.59.34.59 1.43-.01 1.77z"/></svg>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 500, opacity: 0.6, letterSpacing: '0.04em' }}>Bientôt disponible sur</div>
              <div style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Google Play</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '100px', padding: '7px 16px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', display: 'inline-block', flexShrink: 0 }} />
            {t.app.launch}
          </span>
        </div>
      </section>

      {/* CTA DARK */}
      <div className="cta-dark reveal">
        <h2>{t.ctaDark.h2a}<br />{t.ctaDark.h2b}</h2>
        <p>{t.ctaDark.p}</p>
        <div className="btns">
          <a className="btn-w" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="currentColor" /><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" /></svg>
            {t.ctaDark.btn}
          </a>
        </div>
      </div>

      {/* PRO — ORGANISATEURS */}
      <section className="s s-alt" id="pro">
        <div className="s-label reveal">Pour les organisateurs</div>
        <div className="contrib-wrap reveal">
          <div className="cc" style={{ flex: '1 1 420px' }}>
            <div className="cc-h">Votre événement mérite<br /><span style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontWeight: 400 }}>une infrastructure à sa hauteur.</span></div>
            <div className="cc-p" style={{ marginTop: '16px' }}>
              TIF accompagne les organisateurs qui visent l'excellence opérationnelle. Nous intégrons l'intelligence territoriale au cœur de vos dispositifs, de la phase de planification jusqu'à l'heure de fermeture.
            </div>
            <ul className="pro-list" style={{ marginTop: '24px' }}>
              {[
                { icon: '📊', title: 'Analyse prédictive des flux', desc: "Modélisation des comportements de foule et des impacts trafic avant l'événement, sur la base des données historiques du territoire." },
                { icon: '🛡️', title: 'Sécurité et anticipation', desc: "Détection d'anomalies en temps réel, alertes configurables, coordination avec les services compétents." },
                { icon: '🚦', title: 'Gestion de la mobilité', desc: 'Optimisation des accès, signalement dynamique, coordination avec les réseaux TPG et CFF.' },
                { icon: '📡', title: 'Tableau de bord opérationnel', desc: "Vue temps réel dédiée à votre équipe, reporting post-événement, métriques de performance." },
                { icon: '🌐', title: 'Visibilité territoriale', desc: "Intégration de votre événement dans la plateforme TIF, visibilité maximale auprès des habitants du Grand Genève." },
              ].map((c, i) => (
                <li key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{c.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="cc" style={{ flex: '0 0 320px' }}>
            <div style={{ position: 'sticky', top: '80px' }}>
              <div className="cc-h" style={{ marginBottom: '16px' }}>
                <span className="cc-tag pro" style={{ display: 'inline-block', marginBottom: '12px' }}>Partenariat · Accès prioritaire</span><br />
                Rejoignez le top 1% des organisateurs.
              </div>
              <div className="cc-p">
                Présentez-nous votre événement. Nous évaluerons ensemble comment TIF peut en faire une référence d'organisation, de sécurité et d'expérience utilisateur dans le Grand Genève.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '16px 0' }}>
                {['Paléo Festival', 'Fêtes de Genève', 'Événements sportifs', 'Sommets institutionnels', 'Concerts & festivals', 'Manifestations publiques'].map(tag => (
                  <span key={tag} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--off)', border: '1px solid var(--border)', borderRadius: '100px', padding: '4px 10px' }}>{tag}</span>
                ))}
              </div>
              <a href="mailto:contact@borja-swiss-solutions.ch?subject=TIF%20—%20Partenariat%20Événementiel&body=Bonjour%2C%0A%0AJe%20suis%20organisateur%20de%20[nom%20événement]%20et%20souhaite%20en%20savoir%20plus%20sur%20un%20partenariat%20avec%20TIF.%0A%0ACordialement"
                className="btn-full dark" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: '8px' }}>
                Nous contacter →
              </a>
              <p className="cc-note">Réponse sous 24 heures · Genève, Suisse</p>
              <div id="stats-request" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Accès aux statistiques détaillées</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  Données d'engagement, démographie utilisateurs, zones de couverture, sur demande et sous NDA.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="votre@email.ch"
                    value={statsEmail}
                    onChange={e => setStatsEmail(e.target.value)}
                    className="m-input"
                    style={{ margin: 0, flex: 1, fontSize: '13px' }}
                  />
                  <button
                    onClick={() => {
                      if (!statsEmail) return
                      window.location.href = `mailto:contact@borja-swiss-solutions.ch?subject=TIF%20—%20Demande%20statistiques%20détaillées&body=Bonjour%2C%0A%0AJe%20souhaite%20recevoir%20le%20rapport%20statistiques%20TIF%20complet.%0A%0AEmail%20de%20contact%20%3A%20${encodeURIComponent(statsEmail)}%0A%0ACordialement`
                    }}
                    style={{ flexShrink: 0, padding: '0 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', height: '42px' }}>
                    Recevoir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BANDEAU STATISTIQUES */}
      <div className="cta-stats reveal" style={{ display: 'flex', justifyContent: 'center', gap: '48px', padding: '40px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="cta-stat"><div className="cta-stat-v">10K</div><div className="cta-stat-l">Utilisateurs / jour</div></div>
        <div className="cta-stat"><div className="cta-stat-v">30s</div><div className="cta-stat-l">Mise à jour</div></div>
        <div className="cta-stat"><div className="cta-stat-v">150K+</div><div className="cta-stat-l">Sessions · 7 jours</div></div>
      </div>

      {/* CONTACT BAND */}
      <div className="contact-band reveal">
        <p>Une question, un partenariat ? <strong>Contactez l'équipe TIF.</strong></p>
        <button className="btn-p" style={{ fontSize: '14px', padding: '11px 22px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }} onClick={() => openM('m-contact')}>Nous écrire</button>
      </div>

      {/* TRANSPARENCE */}
      <section className="s" id="confiance">
        <div className="s-label reveal">{t.trans.sectionLabel}</div>
        <h2 className="s-h reveal">{t.trans.h2a}<br />{t.trans.h2b}</h2>
        <p className="s-sub reveal">{t.trans.sub}</p>
        <div className="car-outer reveal" style={{ maxWidth: '960px', margin: '0 auto 3px' }}>
          <div className="car-head"><span className="car-head-t">{t.trans.legalHead}</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('tc1', -1)}><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('tc1', 1)}><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-tc1" ref={el => { carRefs.current['tc1'] = el }} onScroll={() => csync('tc1')}>
            {[...TC1_ICONS, ...TC1_ICONS, ...TC1_ICONS].map((icon, i) => {
              const ts = t.trans.tc1Slides[i % TC1_ICONS.length]
              return (
                <div key={i} className="cslide"><div className="src" style={{ cursor: 'pointer' }} onClick={() => openM(TC1_MODALS[i % TC1_MODALS.length])}><div className="src-icon">{icon}</div><div className="src-name">{ts.name}</div><div className="src-desc">{ts.desc}</div><div className="src-live" style={{ color: 'var(--blue)' }}>{t.trans.learnMore}</div></div></div>
              )
            })}
          </div>
          <Dots id="tc1" logical={TC1_ICONS.length} />
        </div>
        <div className="car-outer reveal" style={{ maxWidth: '960px', margin: '0 auto 24px' }}>
          <div className="car-head"><span className="car-head-t">{t.trans.docHead}</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('tc2', -1)}><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('tc2', 1)}><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-tc2" ref={el => { carRefs.current['tc2'] = el }} onScroll={() => csync('tc2')}>
            {[...TC2_ICONS, ...TC2_ICONS, ...TC2_ICONS].map((icon, i) => {
              const ts = t.trans.tc2Slides[i % TC2_ICONS.length]
              return (
                <div key={i} className="cslide"><div className="src" style={{ cursor: 'pointer' }} onClick={() => openM(TC2_MODALS[i % TC2_MODALS.length])}><div className="src-icon">{icon}</div><div className="src-name">{ts.name}</div><div className="src-desc">{ts.desc}</div><div className="src-live" style={{ color: 'var(--blue)' }}>{t.trans.seeMore}</div></div></div>
              )
            })}
          </div>
          <Dots id="tc2" logical={TC2_ICONS.length} />
        </div>
        <div className="audit-card reveal">
          <h3>{t.trans.auditH3}</h3>
          <p>{t.trans.auditP}</p>
          <div className="audit-actions">
            <div className="aa" onClick={() => openM('m-vuln')}><div><div className="aa-title">{t.trans.vulnTitle}</div><div className="aa-sub">{t.trans.vulnSub}</div></div><div className="aa-arr">→</div></div>
            <div className="aa" onClick={() => openM('m-audit')}><div><div className="aa-title">{t.trans.auditTitle}</div><div className="aa-sub">{t.trans.auditSub}</div></div><div className="aa-arr">→</div></div>
            <div className="aa" onClick={() => openM('m-partner')}><div><div className="aa-title">{t.trans.partnerTitle}</div><div className="aa-sub">{t.trans.partnerSub}</div></div><div className="aa-arr">→</div></div>
          </div>
          <div style={{ padding: '12px 0 0', borderTop: '1px solid var(--border-l)', marginTop: '12px' }}>
            <p style={{ fontSize: '11px', color: 'var(--ink3)', margin: 0 }}>⚠ {t.trans.disclaimer}</p>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section className="final reveal">
        <h2>{t.final.h2} <span className="accent">{t.final.accent}</span></h2>
        <p>{t.final.p}</p>
        <div className="btns">
          <a className="btn-p" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="white" /><circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" /></svg>
            {t.final.mapBtn}
          </a>
          <a className="btn-s" href="#pro">Collaborer →</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="ft">
          <div className="ft-top">
            <div className="ft-brand"><p>TIF</p><span>Intelligence Territoriale · Grand Genève</span></div>
            <div className="ft-links">
              <a href="#evenements">Événements</a>
              <a href="#live">Live</a>
              <a href="#pro">Professionnels</a>
              <a href="#confiance">{t.footer.transparency}</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-contact') }}>Contact</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-privacy') }}>Confidentialité</a>
            </div>
          </div>
          <div className="ft-bottom">
            <p>{t.footer.copyright}</p>
            <p>{t.footer.legal}</p>
          </div>
        </div>
      </footer>

      {/* ─── DETAIL MODAL (dashboard + scenarios) ─── */}
      {detail && (() => {
        const srcRow = detail.rows?.find(r => ['Source', 'Sources', 'Source primaire', 'Source données'].includes(r.label))
        const srcUrl = srcRow ? (SOURCE_URLS[srcRow.value] ?? SOURCE_URLS[srcRow.value.split(',')[0].trim()] ?? 'https://tif.borja-swiss-solutions.ch') : 'https://tif.borja-swiss-solutions.ch'
        return (
        <div className="overlay on" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="modal">
            <div className="m-head">
              <div><span className="m-tag" style={{ background: 'var(--off2)', color: 'var(--ink3)' }}>Détail</span><h3>{detail.icon} {detail.title}</h3></div>
              <button className="m-x" onClick={() => setDetail(null)} aria-label="Fermer">✕</button>
            </div>
            <div className="m-body">
              {detail.rows?.map((r, i) => (
                <div key={i} className="m-row">
                  <label>{r.label}</label>
                  <span style={r.color ? { color: r.color } : {}}>{r.value}</span>
                </div>
              ))}
              {detail.note && <p style={{ marginTop: '14px' }}>{detail.note}</p>}
              {detail.body && <p>{detail.body}</p>}
              <div className="m-src-btns">
                <a className="m-src-btn m-src-primary" href={srcUrl} target="_blank" rel="noreferrer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Source officielle
                </a>
                <a className="m-src-btn m-src-borja" href="https://borja-swiss-solutions.ch" target="_blank" rel="noreferrer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Réseau Börja
                </a>
                <a className="m-src-btn m-src-map" href="/map" target="_blank" rel="noreferrer">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.2" fill="currentColor" /><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
                  Carte live
                </a>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ─── INCIDENT MODAL ─── */}
      {incModal && (() => {
        const incSrcUrl = incModal.source ? (SOURCE_URLS[incModal.source] ?? 'https://tif.borja-swiss-solutions.ch') : 'https://tif.borja-swiss-solutions.ch'
        return (
        <div className="overlay on" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setIncModal(null) }}>
          <div className="modal">
            <div className="m-head">
              <div>
                <span className="m-tag" style={{ background: incModal.severity === 'CRITICAL' ? 'var(--red-bg)' : incModal.severity === 'HIGH' ? 'var(--orange-bg)' : 'var(--yellow-bg)', color: incModal.severity === 'CRITICAL' ? 'var(--red)' : incModal.severity === 'HIGH' ? 'var(--orange)' : 'var(--yellow-text)' }}>{incModal.severity}</span>
                <h3>{incModal.title}</h3>
              </div>
              <button className="m-x" onClick={() => setIncModal(null)}>✕</button>
            </div>
            <div className="m-body">
              <div className="m-row"><label>Détecté à</label><span>{incModal.timeAgo}</span></div>
              <div className="m-row"><label>Source primaire</label><span>{incModal.source ?? 'TIF Monitoring'}</span></div>
              <div className="m-row"><label>Sévérité</label><span>{incModal.severity}</span></div>
              <p style={{ marginTop: '14px' }}>Cette information est agrégée par TIF depuis les flux officiels. Chaque alerte est horodatée et attribuée à sa source primaire.</p>
              <div className="m-src-btns">
                <a className="m-src-btn m-src-primary" href={incSrcUrl} target="_blank" rel="noreferrer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  {incModal.source ?? 'Source officielle'}
                </a>
                <a className="m-src-btn m-src-borja" href="https://borja-swiss-solutions.ch" target="_blank" rel="noreferrer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Réseau Börja
                </a>
                <a className="m-src-btn m-src-map" href="/map" target="_blank" rel="noreferrer">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.2" fill="currentColor" /><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
                  Carte live
                </a>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ─── MODALS ─── */}
      {[
        { id: 'm-don', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'Soutenir TIF', content: (
          <><div className="m-note">💚 100% des dons vont au projet TIF — paiement sécurisé Stripe</div>
          <p>TIF est gratuit et le restera. Votre soutien finance les infrastructures serveur, l&apos;intégration de nouvelles sources et l&apos;amélioration de la sécurité au bénéfice de tous.</p>
          <h4>Montant</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '7px', marginBottom: '8px' }}>
            {[5, 10, 20, 50].map(v => <button key={v} className={`amt${selectedAmt === v && !customAmt ? ' sel' : ''}`} onClick={() => { setSelectedAmt(v); setCustomAmt(''); setDonateError(null) }}>CHF {v}</button>)}
          </div>
          <input className="m-input" type="number" min="1" placeholder="Autre montant (CHF)" value={customAmt} onChange={e => { setCustomAmt(e.target.value); setSelectedAmt(null); setDonateError(null) }} />
          <input className="m-input" type="email" placeholder="Email (optionnel — pour reçu)" value={donateEmail} onChange={e => setDonateEmail(e.target.value)} />
          {donateError && <p style={{ fontSize: '12px', color: 'var(--red)', margin: '4px 0 8px' }}>{donateError}</p>}
          <button className="m-submit g" onClick={handleDonate}>
            💚 Soutenir TIF par carte
          </button>
          <p style={{ fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Paiement sécurisé · Stripe · Visa, Mastercard, TWINT</p></>
        )},
        { id: 'm-pro', tag: { bg: 'var(--blue-bg)', c: 'var(--blue-d)', label: 'Professionnel' }, title: 'Accès TIF Pro', content: (
          <><p>Réservé aux collectivités, services publics, entreprises et professionnels de sécurité. Chaque demande est évaluée manuellement.</p>
          <h4>Ce qui est inclus</h4>
          <ul><li>API REST temps réel, flux bruts (trafic, TPG, CFF, météo, frontières)</li><li>Dashboard dédié avec alertes personnalisées par zone</li><li>Export JSON/CSV et intégration webhooks</li><li>Support prioritaire, réponse sous 4h ouvrées</li><li>SLA contractuel, confidentialité des données</li></ul>
          <h4>Votre demande</h4>
          <input className="m-input" type="text" placeholder="Nom Prénom" value={proForm.name} onChange={e => setProForm(f => ({ ...f, name: e.target.value }))} /><input className="m-input" type="text" placeholder="Organisation" value={proForm.organisation} onChange={e => setProForm(f => ({ ...f, organisation: e.target.value }))} /><input className="m-input" type="email" placeholder="Email professionnel" value={proForm.email} onChange={e => setProForm(f => ({ ...f, email: e.target.value }))} /><input className="m-input" type="text" placeholder="Fonction" value={proForm.fonction} onChange={e => setProForm(f => ({ ...f, fonction: e.target.value }))} />
          <textarea className="m-input m-ta" placeholder="Décrivez votre cas d'usage..." value={proForm.message} onChange={e => setProForm(f => ({ ...f, message: e.target.value }))} />
          <button className="m-submit" onClick={submitPro} disabled={proForm.loading} style={{ opacity: proForm.loading ? 0.7 : 1 }}>{proForm.loading ? 'Envoi...' : 'Envoyer la demande →'}</button>
          {proForm.error && <p style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px' }}>{proForm.error}</p>}
          {proForm.success && <p style={{ color: 'var(--green)', fontSize: '13px', marginTop: '8px' }}>✓ Message envoyé. Nous vous répondrons sous 48h ouvrées.</p>}</>
        )},
        { id: 'm-contact', tag: { bg: 'var(--off2)', c: 'var(--ink3)', label: 'Public' }, title: 'Nous contacter', content: (
          <><div className="m-row"><label>Email</label><span>contact@borja-swiss-solutions.ch</span></div>
          <div className="m-row"><label>Délai</label><span>48h ouvrées</span></div>
          <h4>Envoyer un message</h4>
          <input className="m-input" type="text" placeholder="Nom" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} /><input className="m-input" type="email" placeholder="Email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} />
          <select className="m-input m-select" value={contactForm.subject} onChange={e => setContactForm(f => ({ ...f, subject: e.target.value }))}><option>Sujet...</option><option>Question générale</option><option>Signalement</option><option>Accès professionnel</option><option>Partenariat</option><option>Presse / Média</option></select>
          <textarea className="m-input m-ta" placeholder="Votre message..." value={contactForm.message} onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))} />
          <button className="m-submit" onClick={submitContact} disabled={contactForm.loading} style={{ opacity: contactForm.loading ? 0.7 : 1 }}>{contactForm.loading ? 'Envoi...' : '✉ Envoyer'}</button>
          {contactForm.error && <p style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px' }}>{contactForm.error}</p>}
          {contactForm.success && <p style={{ color: 'var(--green)', fontSize: '13px', marginTop: '8px' }}>✓ Message envoyé. Nous vous répondrons sous 48h ouvrées.</p>}</>
        )},
        { id: 'm-hosting', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'Hébergement', content: (
          <><div className="m-note">🇪🇺 Toutes les données sont hébergées et traitées exclusivement en Europe (nLPD art. 16–17).</div>
          <div className="m-row"><label>Base de données</label><span>Neon PostgreSQL — eu-central-1 (Francfort, Allemagne)</span></div>
          <div className="m-row"><label>Cache &amp; sessions</label><span>Upstash Redis — eu-west-1 (Irlande)</span></div>
          <div className="m-row"><label>Fichiers statiques</label><span>Cloudflare R2 — Union Européenne exclusivement</span></div>
          <div className="m-row"><label>Application</label><span>Vercel — edge nodes UE, TLS 1.3 en transit</span></div>
          <div className="m-row"><label>Juridiction</label><span>Droit suisse (nLPD) + RGPD européen</span></div>
          <div className="m-row"><label>Chiffrement</label><span>AES-256 au repos sur tous les supports</span></div>
          <div className="m-row"><label>Données hors UE</label><span>Jamais</span></div></>
        )},
        { id: 'm-rgpd', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'Protection des données', content: (
          <><p>TIF applique le principe Privacy by Design (nLPD art. 7) : seules les données strictement nécessaires sont collectées. Anonymisation irréversible avant toute transmission ou stockage.</p>
          <h4>Ce que nous collectons</h4><ul><li>Adresse e-mail (authentification) — chiffrée AES-256</li><li>Identifiant unique interne — non communicable à des tiers</li><li>Fournisseur OAuth (Google/Apple) — pas les jetons</li><li>Données de mobilité anonymisées — uniquement avec consentement explicite</li><li>Logs de sécurité — IP hashée (jamais l&apos;IP brute)</li></ul>
          <h4>Ce que nous ne collectons jamais</h4><ul><li>Coordonnées GPS exactes — transformation irréversible en zone ±600m</li><li>Nom et prénom — non requis</li><li>Numéro de téléphone</li><li>Données de santé ou biométriques (nLPD art. 5 lit. c)</li><li>Contenu des communications</li><li>Historique de navigation web</li><li>Profilage publicitaire</li><li>Données vendues ou cédées à des tiers</li></ul>
          <div className="m-row"><label>Conservation compte</label><span>Durée de vie du compte + 30 jours</span></div>
          <div className="m-row"><label>Conservation mobilité</label><span>90 jours maximum — purge automatique</span></div>
          <div className="m-row"><label>Conservation logs</label><span>30 jours glissants</span></div>
          <div className="m-row"><label>Contact</label><span>contact@borja-swiss-solutions.ch</span></div></>
        )},
        { id: 'm-privacy', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'Politique de confidentialité', content: (
          <><p>Établie conformément à la nLPD suisse (RS 235.1, en vigueur depuis le 1er septembre 2023) et au RGPD (UE 2016/679).</p>
          <h4>Responsable du traitement</h4><p>Borja Swiss Solutions, Genève — contact@borja-swiss-solutions.ch</p>
          <h4>Cookies</h4><ul><li>Cookies techniques strictement nécessaires</li><li>Aucun cookie publicitaire ou tracking tiers</li></ul>
          <h4>Vos droits (nLPD art. 25–32)</h4><ul><li>Droit d&apos;accès (art. 25) — liste complète des données traitées, finalité et destinataires</li><li>Droit de rectification (art. 32) — correction de toute donnée inexacte</li><li>Droit à l&apos;effacement (art. 32) — suppression complète en base, y compris mobilité</li><li>Droit à la portabilité (art. 28) — export format structuré, lisible par machine</li><li>Droit d&apos;opposition (art. 30) — applicable en particulier à la collecte de mobilité</li><li>Droit de retrait du consentement — révocable à tout moment, collecte cesse immédiatement</li></ul>
          <div className="m-row"><label>Délai de réponse</label><span>30 jours calendaires (nLPD art. 25 al. 6)</span></div></>
        )},
        { id: 'm-secu', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Sécurité' }, title: 'Contact sécurité', content: (
          <><div className="m-note">🛡️ Pour tout signalement de vulnérabilité, contactez-nous directement et en toute confidentialité.</div>
          <div className="m-row"><label>Email</label><span>contact@borja-swiss-solutions.ch</span></div>
          <div className="m-row"><label>Délai</label><span>24h ouvrées maximum</span></div>
          <p style={{ marginTop: '14px' }}>Aucune action légale contre un chercheur agissant de bonne foi.</p></>
        )},
        { id: 'm-faq', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'FAQ', content: (<>{t.faq.items.map((item, i) => <div key={i}><h4>{item.q}</h4><p>{item.a}</p></div>)}</>) },
        { id: 'm-doc', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'Documentation', content: (
          <><p>Documentation complète bientôt disponible.</p>
          <ul><li>Prise en main, naviguer sur la carte</li><li>Alertes, configurer des notifications par zone</li><li>Carte live, couches de données et filtres</li><li>Veille G7, tableau de bord pendant le Sommet</li></ul>
          <div className="m-note">📩 contact@borja-swiss-solutions.ch</div></>
        )},
        { id: 'm-usecases', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: "Cas d'usage", content: (
          <><h4>🏠 Habitant</h4><p>Vérifier les conditions avant de partir. Alerte météo. Lignes perturbées.</p>
          <h4>🚗 Frontalier</h4><p>Temps d&apos;attente aux postes frontière. Restrictions G7. Passage optimal.</p>
          <h4>🏥 Professionnel de santé</h4><p>Arriver à l&apos;heure malgré les perturbations. Déviations validées.</p>
          <h4>🚚 Entreprise logistique</h4><p>Tournées planifiées avec restrictions G7. Coûts réduits.</p></>
        )},
        { id: 'm-archi', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Simplifié' }, title: 'Architecture générale', content: (
          <><div className="m-note">Présentation simplifiée. Documentation technique sur demande.</div>
          <ul><li>Sources officielles → connecteurs (pull toutes les 30s)</li><li>Validation et normalisation des données</li><li>Corrélation croisée multi-sources</li><li>API interne → Frontend via WebSocket</li><li>Hébergement UE — Vercel, Neon (Francfort), Upstash (Dublin) · migration Suisse prévue</li></ul></>
        )},
        { id: 'm-vuln', tag: { bg: 'var(--blue-bg)', c: 'var(--blue-d)', label: 'Professionnels' }, title: 'Signalement des vulnérabilités', content: (
          <><div className="m-note">⚠ Agir de bonne foi et dans le respect de la loi suisse.</div>
          <ul><li>Identifiez et documentez (sans exploiter)</li><li>Envoyez à contact@borja-swiss-solutions.ch</li><li>Accusé de réception sous 24h ouvrées</li><li>Traitement : 30 à 90 jours selon criticité</li></ul>
          <div className="m-row"><label>Email</label><span>contact@borja-swiss-solutions.ch</span></div></>
        )},
        { id: 'm-audit', tag: { bg: 'var(--blue-bg)', c: 'var(--blue-d)', label: 'Sur demande' }, title: 'Accès audit complet', content: (
          <><p>Documentation technique approfondie et environnement sandbox inclus.</p>
          <ul><li>Documentation technique complète</li><li>Schémas de flux de données</li><li>Environnement sandbox</li><li>Session avec l&apos;équipe technique Börja</li></ul>
          <input className="m-input" type="text" placeholder="Nom Prénom" value={auditForm.name} onChange={e => setAuditForm(f => ({ ...f, name: e.target.value }))} /><input className="m-input" type="email" placeholder="Email professionnel" value={auditForm.email} onChange={e => setAuditForm(f => ({ ...f, email: e.target.value }))} />
          <textarea className="m-input m-ta" placeholder="Expertise et objectif de l'audit..." value={auditForm.expertise} onChange={e => setAuditForm(f => ({ ...f, expertise: e.target.value }))} />
          <button className="m-submit" onClick={submitAudit} disabled={auditForm.loading} style={{ opacity: auditForm.loading ? 0.7 : 1 }}>{auditForm.loading ? 'Envoi...' : 'Soumettre →'}</button>
          {auditForm.error && <p style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px' }}>{auditForm.error}</p>}
          {auditForm.success && <p style={{ color: 'var(--green)', fontSize: '13px', marginTop: '8px' }}>✓ Message envoyé. Nous vous répondrons sous 48h ouvrées.</p>}</>
        )},
        { id: 'm-partner', tag: { bg: 'var(--blue-bg)', c: 'var(--blue-d)', label: 'Institutionnel' }, title: 'Partenariat institutionnel', content: (
          <><ul><li>Ville de Genève, Canton : intégration de données officielles</li><li>Services d&apos;urgence : diffusion prioritaire d&apos;alertes</li><li>TPG, CFF : flux de données directs</li><li>Collectivités françaises : extension Grand Genève</li></ul>
          <input className="m-input" type="text" placeholder="Institution" value={partnerForm.institution} onChange={e => setPartnerForm(f => ({ ...f, institution: e.target.value }))} /><input className="m-input" type="email" placeholder="Email institutionnel" value={partnerForm.email} onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))} />
          <textarea className="m-input m-ta" placeholder="Nature du partenariat..." value={partnerForm.expertise} onChange={e => setPartnerForm(f => ({ ...f, expertise: e.target.value }))} />
          <button className="m-submit" onClick={submitPartner} disabled={partnerForm.loading} style={{ opacity: partnerForm.loading ? 0.7 : 1 }}>{partnerForm.loading ? 'Envoi...' : 'Initier →'}</button>
          {partnerForm.error && <p style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px' }}>{partnerForm.error}</p>}
          {partnerForm.success && <p style={{ color: 'var(--green)', fontSize: '13px', marginTop: '8px' }}>✓ Message envoyé. Nous vous répondrons sous 48h ouvrées.</p>}</>
        )},
      ].map(m => (
        <div key={m.id} className={`overlay${openModal === m.id ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
          <div className="modal">
            <div className="m-head">
              <div><span className="m-tag" style={{ background: m.tag.bg, color: m.tag.c }}>{m.tag.label}</span><h3>{m.title}</h3></div>
              <button className="m-x" onClick={closeM}>✕</button>
            </div>
            <div className="m-body">{m.content}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
