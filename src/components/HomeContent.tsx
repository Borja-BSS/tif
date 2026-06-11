'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { T, LANGUAGES } from '@/i18n/home'
import type { Lang } from '@/i18n/home'
import { LangSelector } from '@/components/LangSelector'

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

const STATIC_BORDERS: BorderRow[] = [
  { name: 'Bardonnex', waitMinutes: 22, status: 'MODERATE' },
  { name: 'Moillesulaz', waitMinutes: 8, status: 'LIGHT' },
  { name: 'Ferney', waitMinutes: 5, status: 'CLEAR' },
  { name: 'Thônex', waitMinutes: 3, status: 'CLEAR' },
  { name: 'Vallard', waitMinutes: 41, status: 'HEAVY' },
]

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
  const [borders, setBorders] = useState<BorderRow[]>(STATIC_BORDERS)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)
  const [proForm, setProForm] = useState({ name: '', organisation: '', email: '', fonction: '', message: '', loading: false, success: false, error: '' })
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '', loading: false, success: false, error: '' })
  const [auditForm, setAuditForm] = useState({ name: '', email: '', expertise: '', loading: false, success: false, error: '' })
  const [partnerForm, setPartnerForm] = useState({ institution: '', email: '', expertise: '', loading: false, success: false, error: '' })
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
  const shareText = 'TIF centralise toutes les perturbations du G7 Grand Genève en temps réel. Routes, frontières, TPG, météo : gratuit et sans inscription.'
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
          <a className="n-link" href="#live">{t.nav.live}</a>
          <a className="n-link" href="#sources">{t.nav.sources}</a>
          <a className="n-link" href="#soutien">{t.nav.support}</a>
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
        <h1 className="hero-h1">{t.hero.h1a}<br />{t.hero.h1b} <span className="accent">{t.hero.accent}</span></h1>
        <p className="hero-p">
          {t.hero.p1}<br />
          <strong>{t.hero.p2}</strong><br />
          {t.hero.p3}
        </p>
        <div className="hero-btns">
          <a className="btn-p" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="white" /><circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" /></svg>
            {t.hero.btn}
          </a>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span>{t.hero.scrollCue}</span>
          <div className="scroll-arrow"><svg viewBox="0 0 14 14"><polyline points="2,5 7,10 12,5" /></svg></div>
        </div>
      </section>

      {/* DASHBOARD LIVE */}
      <section className="s s-alt" id="live">
        <div className="s-label">{t.dash.sectionLabel}</div>
        <h2 className="s-h">{t.dash.h2a}<br />{t.dash.h2b}</h2>
        <p className="s-sub" style={{ marginBottom: lastRefresh ? '8px' : undefined }}>{t.dash.sub}</p>
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

      {/* SOCIAL SHARING */}
      <section className="s reveal">
        <div className="s-label">{t.share.sectionLabel}</div>
        <h2 className="s-h">{t.share.h2a}<br />{t.share.h2b}</h2>
        <p className="s-sub">{t.share.sub}</p>
        <div className="share-btns">
          <a className="share-btn share-tw" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            {t.share.xBtn}
          </a>
          <a className="share-btn share-li" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            {t.share.liBtn}
          </a>
          <a className="share-btn share-wa" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
            {t.share.waBtn}
          </a>
          <button className="share-btn share-copy" onClick={copyLink}>
            {copied ? t.share.copiedBtn : t.share.copyBtn}
          </button>
        </div>
      </section>

      {/* POURQUOI G7 */}
      <section className="s reveal">
        <div className="s-label">{t.why.sectionLabel}</div>
        <h2 className="s-h">{t.why.h2a}<br />{t.why.h2b}</h2>
        <p className="s-sub">{t.why.sub}</p>
        <div className="car-outer" style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="car-head">
            <span className="car-head-t">{t.why.carHead}</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('why', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('why', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-why" ref={el => { carRefs.current['why'] = el }} onScroll={() => csync('why')}>
            {[...t.why.slides, ...t.why.slides, ...t.why.slides].map((s, i) => (
              <div key={i} className="cslide" style={{ cursor: 'pointer' }} onClick={() => setDetail(WHY_DETAILS[i % t.why.slides.length])}>
                <div className="why-card">
                  <div className="why-num">{String(i % t.why.slides.length + 1).padStart(2, '0')}{'  '}{s.numLabel}</div>
                  <div className="why-title">{s.title}</div>
                  <div className="why-body">
                    <span className="before">{t.why.withoutTIF}</span>{' '}{s.withoutText}{' '}<span className="after">{t.why.withTIF}</span>{' '}{s.withText}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '10px' }}>{t.why.analyzeLink}</div>
                </div>
              </div>
            ))}
          </div>
          <Dots id="why" logical={t.why.slides.length} />
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
        </div>
      </section>

      {/* PARKINGS */}
      <section className="s reveal" id="parkings">
        <div className="s-label">{t.prk.sectionLabel}</div>
        <h2 className="s-h">{t.prk.h2a}<br />{t.prk.h2b}</h2>
        <p className="s-sub">{t.prk.sub}</p>
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

      {/* LIGNE VERTE G7 */}
      <section className="s reveal" id="ligne-verte">
        <div className="s-label reveal">{t.lgv.sectionLabel}</div>
        <h2 className="s-h reveal">{t.lgv.h2}</h2>
        <p className="s-sub reveal">{t.lgv.sub}</p>
        <div className="reveal" style={{ maxWidth: '560px', margin: '0 auto' }}>
          {/* Card principale — numéro vert */}
          <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border)',
            borderRadius: '20px',
            padding:      '32px 28px',
            boxShadow:    'var(--shadow-lg)',
            textAlign:    'center',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '12px' }}>
              {t.lgv.freeNumberLabel}
            </div>
            <a
              href="tel:0800902456"
              style={{
                display:       'block',
                fontSize:      'clamp(32px, 8vw, 48px)',
                fontWeight:    800,
                letterSpacing: '-0.03em',
                color:         'var(--green)',
                textDecoration:'none',
                lineHeight:    1,
                marginBottom:  '8px',
              }}
            >
              0800 902 456
            </a>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {t.lgv.freeCallLabel}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>🕐</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '3px' }}>{t.lgv.hoursLabel}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    Lun 1er – ven 5 juin 2026<br />
                    Lun 8 – jeu 18 juin 2026<br />
                    <span style={{ color: 'var(--text-secondary)' }}>11h – 19h</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>🚨</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '3px' }}>{t.lgv.emergencyLabel}</div>
                  <a href="tel:117" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--red)', textDecoration: 'none', letterSpacing: '-0.01em' }}>117</a>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>📧</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '3px' }}>{t.lgv.pressLabel}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <a href="tel:+41224275600" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>+41 (0)22 427 56 00</a><br />
                    <a href="mailto:communication@police.ge.ch" style={{ color: 'var(--blue-d)', textDecoration: 'none' }}>communication@police.ge.ch</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
            {t.lgv.sourceText}
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
        <div className="cta-stats">
          <div className="cta-stat"><div className="cta-stat-v">7</div><div className="cta-stat-l">{t.ctaDark.stat1l}</div></div>
          <div className="cta-stat"><div className="cta-stat-v">30s</div><div className="cta-stat-l">{t.ctaDark.stat2l}</div></div>
          <div className="cta-stat"><div className="cta-stat-v">1M+</div><div className="cta-stat-l">{t.ctaDark.stat3l}</div></div>
        </div>
      </div>

      {/* CONTRIBUTION */}
      <section className="s s-alt" id="soutien">
        <div className="s-label reveal">{t.contrib.sectionLabel}</div>
        <h2 className="s-h reveal">{t.contrib.h2a}<br />{t.contrib.h2b}</h2>
        <p className="s-sub reveal">{t.contrib.sub}</p>
        <div className="contrib-wrap reveal">
          <div className="cc">
            <span className="cc-tag pub">{t.contrib.citizenTag}</span>
            <div className="cc-h">{t.contrib.citizenH1}<br />{t.contrib.citizenH2}</div>
            <div className="cc-p">{t.contrib.citizenP}</div>
            <div className="amts">
              {[5, 10, 20, 50].map(v => (<button key={v} className={`amt${selectedAmt === v && !customAmt ? ' sel' : ''}`} onClick={() => { setSelectedAmt(v); setCustomAmt('') }}>CHF {v}</button>))}
            </div>
            <input className="m-input" type="number" min="1" placeholder="Autre montant (CHF)" value={customAmt} onChange={e => { setCustomAmt(e.target.value); setSelectedAmt(null) }} style={{ marginBottom: '12px' }} />
            <button className="btn-full green" onClick={() => openM('m-don')}>{t.contrib.citizenBtn}</button>
            <p className="cc-note">{t.contrib.citizenNote}</p>
          </div>
          <div className="cc">
            <span className="cc-tag pro">{t.contrib.proTag}</span>
            <div className="cc-h">{t.contrib.proH1}<br />{t.contrib.proH2}</div>
            <div className="cc-p">{t.contrib.proP}</div>
            <ul className="pro-list">
              {t.contrib.proFeatures.map((item, idx) => (
                <li key={idx}><span className="check-icon"><svg viewBox="0 0 9 9"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" /></svg></span>{item}</li>
              ))}
            </ul>
            <button className="btn-full dark" onClick={() => openM('m-pro')}>{t.contrib.proBtn}</button>
            <p className="cc-note">{t.contrib.proNote}</p>
          </div>
        </div>
      </section>

      {/* CONTACT BAND */}
      <div className="contact-band reveal">
        <p>{t.contactBand.text} <strong>{t.contactBand.strong}</strong></p>
        <button className="btn-p" style={{ fontSize: '14px', padding: '11px 22px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }} onClick={() => openM('m-contact')}>{t.contactBand.btn}</button>
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
          <a className="btn-s" href="#soutien">{t.final.supportBtn}</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="ft">
          <div className="ft-top">
            <div className="ft-brand"><p>TIF</p><span>{t.footer.tagline}</span></div>
            <div className="ft-links">
              <a href="#live">{t.footer.live}</a><a href="#sources">{t.footer.sources}</a>
              <a href="#soutien">{t.footer.support}</a><a href="#confiance">{t.footer.transparency}</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-contact') }}>{t.footer.contact}</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-privacy') }}>{t.footer.privacy}</a>
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
                <a className="m-src-btn m-src-map" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">
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
                <a className="m-src-btn m-src-map" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">
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
