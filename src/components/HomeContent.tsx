'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

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

const WHY_SLIDES = [
  { num: '01  Mobilité', title: 'Une infirmière. 7h45. Bardonnex fermée.', body: <><span className="before">Sans TIF</span> elle l&apos;apprend sur place après 20 min de queue. <span className="after">Avec TIF</span> alerte à 6h30, itinéraire choisi à la maison. Elle arrive à l&apos;heure.</> },
  { num: '02  Sécurité', title: 'Une famille. Quai Wilson. Zone rouge.', body: <><span className="before">Sans TIF</span> bloquée face à un périmètre non signalé. <span className="after">Avec TIF</span> restriction visible dès 6h00 avec l&apos;alternative et la durée estimée.</> },
  { num: '03  Entreprise', title: 'Un livreur. 14 arrêts. 4 zones fermées.', body: <><span className="before">Sans TIF</span> découvre les blocages un par un, perd 3 heures. <span className="after">Avec TIF</span> tournée planifiée sur la carte G7. 14 livraisons avant 16h.</> },
  { num: '04  Réaction rapide', title: 'Un incident. Qui informe en premier ?', body: <><span className="before">Sans TIF</span> Twitter, rumeurs, Google Maps en retard. <span className="after">Avec TIF</span> sources officielles agrégées en 30 secondes, information vérifiée avant la confusion.</> },
]

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

const SRC_SLIDES = [
  { icon: '📡', name: 'Réseau Börja', desc: 'Signalements anonymes de la communauté TIF. Corrélation terrain pour affinage des données officielles.', live: 'Complémentaire', url: 'https://borja-swiss-solutions.ch', blue: true },
  { icon: '🛣️', name: 'OFROU / ASTRA', desc: 'Trafic autoroutier A1, A40 et réseau national. Incidents, fermetures, travaux en temps réel.', live: 'Live  60s', url: 'https://www.astra.admin.ch', blue: false },
  { icon: '🗺️', name: 'SITG Geneva', desc: "Système d'Information du Territoire Genevois. Voirie, événements et restrictions officielles.", live: 'Officiel Canton GE', url: 'https://ge.ch/sitg/', blue: false },
  { icon: '🚌', name: 'TPG', desc: 'Perturbations, retards et déviations sur le réseau trams, bus et trolleybus du Grand Genève.', live: 'Live  30s', url: 'https://www.tpg.ch', blue: false },
  { icon: '🚆', name: 'CFF / SBB + CEVA', desc: 'Léman Express, InterRegio, retards via OpenTransportData.swiss. Toutes lignes couvertes.', live: 'Live  30s', url: 'https://www.sbb.ch/fr', blue: false },
  { icon: '🌩️', name: 'MétéoSuisse', desc: 'Alertes météo officielles, précipitations, orages et vigilance pour le Canton de Genève.', live: 'Officiel Confédération', url: 'https://www.meteoswiss.admin.ch', blue: false },
  { icon: '🛂', name: 'Frontières CH-FR', desc: "Temps d'attente aux 8 postes frontaliers franco-suisses. Bardonnex, Moillesulaz, Ferney...", live: 'Live  5 min', url: 'https://www.bazg.admin.ch', blue: false },
  { icon: '🚗', name: 'HERE Maps / Waze', desc: 'Données trafic communautaires. Incidents terrain, congestion, signalements citoyens.', live: 'Live  corrélation', url: 'https://www.here.com', blue: false },
]

const TC1_SLIDES = [
  { icon: '🏢', name: 'Hébergement', desc: 'Infomaniak  Suisse  Données jamais hors UE', modal: 'm-hosting' },
  { icon: '🔒', name: 'Protection des données', desc: 'RGPD  nLPD  Aucune donnée vendue', modal: 'm-rgpd' },
  { icon: '📄', name: 'Confidentialité', desc: 'Données collectées  Durée  Droits', modal: 'm-privacy' },
  { icon: '🛡️', name: 'Contact sécurité', desc: 'contact@borja-swiss-solutions.ch', modal: 'm-secu' },
]
const TC2_SLIDES = [
  { icon: '❓', name: 'FAQ', desc: 'Questions fréquentes  Sources  Fiabilité', modal: 'm-faq' },
  { icon: '📚', name: 'Documentation', desc: 'Guide utilisateur  Fonctionnalités', modal: 'm-doc' },
  { icon: '🎯', name: "Cas d'usage", desc: 'Habitants  Frontaliers  Entreprises  G7', modal: 'm-usecases' },
  { icon: '🏗️', name: 'Architecture', desc: 'Schéma simplifié  Sources  Flux', modal: 'm-archi' },
]

const FAQ_ITEMS = [
  { q: "TIF pendant le G7, c'est quoi exactement ?", a: "TIF centralise en temps réel toutes les perturbations liées au Sommet : zones rouges, routes fermées, restrictions TPG, délais aux frontières et alertes météo. Une seule source fiable, mise à jour toutes les 30 secondes depuis les sources officielles." },
  { q: "Pourquoi ne pas juste utiliser Google Maps ou Twitter ?", a: "Google Maps a un délai de 5 à 15 minutes sur les restrictions G7 spécifiques. Twitter diffuse des rumeurs non vérifiées. TIF s'alimente directement aux sources officielles (Police Cantonale GE, OFROU, TPG, CFF) avec attribution traçable pour chaque information." },
  { q: "Qui est réellement concerné ?", a: "Toute personne se déplaçant dans le Grand Genève du 11 au 18 juin 2026 : 47 000 frontaliers par jour, livreurs, professionnels de santé, habitants des communes sous restrictions, et touristes en visite pendant le Sommet." },
  { q: "TIF peut-il vraiment éviter un blocage ?", a: "Si une restriction est publiée à 6h00 et que vous partez à 7h30, TIF vous alerte avant même que vous preniez le volant. Les scénarios présentés sont des situations réelles qui se produisent à chaque grand événement international à Genève." },
  { q: "La plateforme est-elle vraiment gratuite, sans conditions ?", a: "Oui. Sans inscription, sans publicité, sans limite de fonctionnalités. TIF est financé par des contributions volontaires et Börja Swiss Solutions. L'accès public restera gratuit même après le G7." },
  { q: "TIF remplace-t-il les communications officielles des autorités ?", a: "Non. TIF est un tableau de bord citoyen indépendant. Il agrège et synthétise les sources officielles mais ne les remplace pas. En cas d'urgence, suivez toujours les instructions directes des autorités cantonales." },
]

const STATIC_BORDERS: BorderRow[] = [
  { name: 'Bardonnex', waitMinutes: 22, status: 'MODERATE' },
  { name: 'Moillesulaz', waitMinutes: 8, status: 'LIGHT' },
  { name: 'Ferney', waitMinutes: 5, status: 'CLEAR' },
  { name: 'Thônex', waitMinutes: 3, status: 'CLEAR' },
  { name: 'Vallard', waitMinutes: 41, status: 'HEAVY' },
]

const CEVA_LINES = ['L1 Coppet Annemasse', 'L2 Bellegarde Évian', 'L3 Genève Annecy', 'L4 Cornavin Meyrin']

export function HomeContent() {
  const [clock, setClock] = useState('--:--')
  const [openModal, setOpenModal] = useState<string | null>(null)
  const [incModal, setIncModal] = useState<IncSlide | null>(null)
  const [detail, setDetail] = useState<DetailInfo | null>(null)
  const [selectedAmt, setSelectedAmt] = useState<number | null>(null)
  const [customAmt, setCustomAmt] = useState('')
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
    const info = [
      { cls: 'tb-b', label: 'TIF', text: '9 sources officielles connectées, mise à jour toutes les 30 secondes' },
      { cls: 'tb-gold', label: 'G7', text: 'Sommet du Grand Genève du 11 au 18 juin 2026, restrictions en vigueur' },
      { cls: 'tb-g', label: 'Frontières', text: '46 postes frontaliers sur la carte · Bardonnex, Ferney-Voltaire, Thônex-Vallard, Moillesulaz, Perly, Meyrin et 40 autres' },
      { cls: 'tb-b', label: 'CEVA', text: 'Léman Express 4 lignes surveillées : L1, L2, L3, L4' },
      { cls: 'tb-g', label: 'Info', text: '47 000 frontaliers par jour dans le Grand Genève concernés par les restrictions G7' },
      { cls: 'tb-b', label: 'Sources', text: 'OFROU, Police Cantonale GE, TPG, CFF, MétéoSuisse, SITG, BAZG' },
    ]
    const combined = apiItems.length ? [...apiItems, ...info] : info
    return [...combined, ...combined]
  }, [dashData])

  function borderLabel(status: string) {
    return status === 'CLEAR' ? 'Fluide' : status === 'LIGHT' ? 'Léger' : status === 'MODERATE' ? 'Modéré' : status === 'HEAVY' ? 'Chargé' : 'Bloqué'
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
          <a className="n-link" href="#live">Situation live</a>
          <a className="n-link" href="#sources">Sources</a>
          <a className="n-link" href="#soutien">Soutenir</a>
          <a className="n-link" href="#confiance">Transparence</a>
        </div>
        <div className="n-right">
          <div className="n-live"><div className="n-live-dot" /><span>{clock}</span></div>
          <a
            href={user ? '/map' : '/login'}
            onClick={e => { e.preventDefault(); router.push(user ? '/map' : '/login') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '980px', padding: '5px 11px', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-.01em', whiteSpace: 'nowrap' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            <span>{user ? (user.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'Compte') : 'Se connecter'}</span>
          </a>
          <a className="n-cta" href={user ? '/map' : '/login'} onClick={handleOpenMap}>Carte live →</a>
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
        <h1 className="hero-h1">Le Grand Genève,<br />en <span className="accent">temps réel.</span></h1>
        <p className="hero-p">
          Un accident. Une route fermée. Une alerte G7.<br />
          <strong>Ces informations existent.</strong> Elles sont dispersées.<br />
          TIF les centralise. Avant qu&apos;il soit trop tard.
        </p>
        <div className="hero-btns">
          <a className="btn-p" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="white" /><circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" /></svg>
            Ouvrir la carte live
          </a>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span>Situation en direct</span>
          <div className="scroll-arrow"><svg viewBox="0 0 14 14"><polyline points="2,5 7,10 12,5" /></svg></div>
        </div>
      </section>

      {/* DASHBOARD LIVE */}
      <section className="s s-alt" id="live">
        <div className="s-label">Situation en direct</div>
        <h2 className="s-h">Ce qui se passe<br />en ce moment</h2>
        <p className="s-sub" style={{ marginBottom: lastRefresh ? '8px' : undefined }}>Mis à jour toutes les 30 secondes depuis les sources officielles.</p>
        {lastRefresh && (
          <div className="live-refresh-block" style={{ marginBottom: '40px' }}>
            Actualisé à {lastRefresh.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
        <div className="dash reveal">
          <div className="dash-row dash-row-4">
            {/* Trafic */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🚦', title: 'Trafic A1 et A40', rows: [{ label: 'Statut', value: trafficAlert ? trafficAlert.title : 'Normal, aucun incident' }, { label: 'Source', value: 'OFROU' }, { label: 'Mise à jour', value: 'Toutes les 60 secondes' }], note: 'Données issues du système de surveillance du réseau autoroutier suisse (OFROU). Couvre la A1 et la A40 dans le périmètre Grand Genève.' })}>
              <div className="dc-top"><div className="dc-label">Trafic A1 / A40</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${trafficAlert ? 'r' : 'b'}`}>{trafficAlert ? (trafficAlert.severity === 'CRITICAL' ? '⚠ Critique' : '⚠ Alerte') : 'Normal'}</div>
              <div className="dc-desc">{trafficAlert ? trafficAlert.title : 'Autoroutes fluides, aucun incident signalé'}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${traficBar}%`, background: trafficAlert ? 'var(--red)' : 'var(--blue)' }} /></div>
            </div>
            {/* TPG */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🚌', title: 'Perturbations TPG', rows: [{ label: 'Lignes touchées', value: uniqueTpgLines.length > 0 ? `${uniqueTpgLines.length} ligne${uniqueTpgLines.length > 1 ? 's' : ''}` : 'Aucune', color: uniqueTpgLines.length > 0 ? 'var(--orange)' : 'var(--green)' }, { label: 'Détail', value: uniqueTpgLines.length > 0 ? `Lignes ${uniqueTpgLines.join(', ')}` : 'Service normal sur tout le réseau' }, { label: 'Source', value: 'TPG (Transports Publics Genevois)' }, { label: 'Mise à jour', value: 'Toutes les 30 secondes' }], note: 'Les données TPG couvrent trams, bus et trolleybus dans le Grand Genève.' })}>
              <div className="dc-top"><div className="dc-label">TPG perturbations</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${uniqueTpgLines.length > 3 ? 'r' : uniqueTpgLines.length > 0 ? 'o' : 'b'}`}>{uniqueTpgLines.length > 0 ? `${uniqueTpgLines.length} ligne${uniqueTpgLines.length > 1 ? 's' : ''}` : 'Normal'}</div>
              <div className="dc-desc">{uniqueTpgLines.length > 0 ? `Lignes ${uniqueTpgLines.slice(0, 4).join(', ')}${uniqueTpgLines.length > 4 ? ' et autres' : ''}` : 'Service normal, aucune déviation'}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${Math.max(tpgBar, 5)}%`, background: uniqueTpgLines.length > 0 ? 'var(--orange)' : 'var(--blue)' }} /></div>
            </div>
            {/* CFF */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🚆', title: 'CFF / CEVA', rows: [{ label: 'Retard max', value: maxCffDelay > 0 ? `+${maxCffDelay} min` : 'Aucun', color: maxCffDelay > 0 ? 'var(--orange)' : 'var(--green)' }, { label: 'Ligne concernée', value: cffDelays[0] ? `${cffDelays[0].from} vers ${cffDelays[0].to}` : 'Aucune perturbation' }, { label: 'Léman Express', value: cevaOk ? 'Service normal' : 'Perturbé', color: cevaOk ? 'var(--green)' : 'var(--orange)' }, { label: 'Source', value: 'OpenTransportData.swiss' }], note: 'Couvre tous les trains CFF dans le périmètre Grand Genève et les 4 lignes du Léman Express (CEVA).' })}>
              <div className="dc-top"><div className="dc-label">CFF / CEVA</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${maxCffDelay > 10 ? 'r' : maxCffDelay > 0 ? 'o' : 'b'}`}>{maxCffDelay > 0 ? `+${maxCffDelay} min` : 'Normal'}</div>
              <div className="dc-desc">{maxCffDelay > 0 ? (cffDelays[0] ? `${cffDelays[0].from} vers ${cffDelays[0].to}` : 'Retard en cours') : `Léman Express : ${cevaOk ? 'service normal' : 'perturbé'}`}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${Math.max(cffBar, 5)}%`, background: maxCffDelay > 0 ? 'var(--orange)' : 'var(--blue)' }} /></div>
            </div>
            {/* Météo */}
            <div className="dc" style={{ cursor: 'pointer' }} onClick={() => setDetail({ icon: '🌩️', title: 'Météo MétéoSuisse', rows: [{ label: 'Statut', value: meteoAlert ? `Alerte ${meteoAlert.severity === 'CRITICAL' ? 'rouge' : 'orange'}` : 'Normal', color: meteoAlert ? (meteoAlert.severity === 'CRITICAL' ? 'var(--red)' : 'var(--yellow-text)') : 'var(--green)' }, { label: 'Détail', value: meteoAlert ? meteoAlert.title : "Pas d'alerte en cours pour le Canton de Genève" }, { label: 'Source', value: 'MétéoSuisse, Office fédéral de météorologie' }, { label: 'Mise à jour', value: 'En continu' }], note: 'Alertes officielles pour le Canton de Genève. MétéoSuisse est l\'autorité météorologique officielle de la Confédération suisse.' })}>
              <div className="dc-top"><div className="dc-label">Météo MétéoSuisse</div><div className="dc-live-dot" /></div>
              <div className={`dc-val ${meteoAlert ? (meteoAlert.severity === 'CRITICAL' ? 'r' : 'y') : 'b'}`}>{meteoAlert ? `⚠ ${meteoAlert.severity === 'CRITICAL' ? 'Rouge' : 'Orange'}` : 'Normal'}</div>
              <div className="dc-desc">{meteoAlert ? meteoAlert.title : "Conditions normales, pas d'alerte active"}</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: `${Math.max(meteoBar, 5)}%`, background: meteoAlert ? 'var(--yellow-text)' : 'var(--blue)' }} /></div>
            </div>
          </div>
          <div className="dash-row dash-row-3">
            {/* G7 */}
            <div className="dc">
              <div className="g7-head"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polygon points="5,1 9,3 9,7 5,9 1,7 1,3" stroke="currentColor" strokeWidth="1.2" /></svg>Veille G7, Restrictions actives</div>
              <div className="g7-grid">
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '🔴', title: `${g7Zones} Zones rouges actives`, rows: [{ label: 'Nombre', value: `${g7Zones} zones`, color: 'var(--red)' }, { label: 'Localisation', value: 'Palais des Nations, Quai Wilson, Rue de Lausanne, IATA' }, { label: 'Source', value: 'Police Cantonale GE, Dispositif G7' }, { label: 'Durée', value: '11 au 18 juin 2026' }], note: 'Les zones rouges sont strictement fermées à la circulation non autorisée. Des restrictions supplémentaires peuvent être activées sans préavis.' })}>
                  <div className="g7m-l">Zones rouge</div><div className="g7m-v" style={{ color: 'var(--red)' }}>{g7Zones}</div><div className="g7m-d">Palais Nations, Quai Wilson, Rue de Lausanne, IATA</div>
                </div>
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '🚫', title: '11 Routes fermées', rows: [{ label: 'Nombre', value: '11 routes', color: 'var(--orange)' }, { label: 'Secteurs', value: 'Rive gauche et accès aéroport réglementés' }, { label: 'Source', value: 'Police Cantonale GE, SITG, OFROU' }, { label: 'Durée', value: '11 au 18 juin 2026' }], note: 'Les fermetures varient selon le programme journalier du Sommet. Consultez la carte live pour les itinéraires alternatifs.' })}>
                  <div className="g7m-l">Routes fermées</div><div className="g7m-v" style={{ color: 'var(--orange)' }}>11</div><div className="g7m-d">Rive gauche et accès aéroport réglementés</div>
                </div>
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '🚌', title: 'Lignes TPG impactées G7', rows: [{ label: 'Nombre', value: `${g7Lines.length > 0 ? g7Lines.length : 3} lignes`, color: 'var(--gold)' }, { label: 'Lignes', value: g7Lines.length > 0 ? `Lignes ${g7Lines.map(l => l.startsWith('L') ? l : `L${l}`).join(', ')}` : 'Selon dispositif G7 journalier' }, { label: 'Source', value: 'TPG en lien avec dispositif G7' }, { label: 'Durée', value: '11 au 18 juin 2026' }], note: 'Les déviations TPG sont publiées par TPG et intégrées automatiquement dans TIF.' })}>
                  <div className="g7m-l">Lignes TPG impactées</div>
                  <div className="g7m-v" style={{ color: 'var(--gold)' }}>{g7Lines.length > 0 ? g7Lines.length : transport?.g7.isActive ? '—' : 3}</div>
                  <div className="g7m-d">{g7Lines.length > 0 ? `Lignes ${g7Lines.slice(0, 4).map(l => l.startsWith('L') || l.startsWith('l') ? l : `L${l}`).join(', ')}` : 'Selon dispositif G7 en vigueur'}</div>
                </div>
                <div className="g7m g7m-btn" onClick={() => setDetail({ icon: '📢', title: `${dashData?.alerts.length ?? 28} Alertes diffusées`, rows: [{ label: 'Total aujourd\'hui', value: `${dashData?.alerts.length ?? 28} alertes` }, { label: 'Sources', value: 'OFROU, Police GE, TPG, CFF, MétéoSuisse, BAZG' }, { label: 'Canaux', value: 'Tableau de bord TIF, carte live, veille G7' }, { label: 'Depuis', value: '06h00 ce matin' }], note: 'Chaque alerte est horodatée et attribuée à sa source primaire. Consultez la carte live pour le détail géolocalisé.' })}>
                  <div className="g7m-l">Alertes diffusées</div><div className="g7m-v" style={{ color: 'var(--blue-d)' }}>{dashData?.alerts.length ?? 28}</div><div className="g7m-d">Depuis 06h00 ce matin</div>
                </div>
              </div>
            </div>
            {/* Frontières */}
            <div className="dc">
              <div className="dc-top"><div className="dc-label">Frontières CH-FR</div><div className="dc-live-dot" /></div>
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
              <div className="dc-top"><div className="dc-label">Léman Express CEVA</div><div className="dc-live-dot" /></div>
              <div className="mini-table" style={{ marginTop: '4px' }}>
                {CEVA_LINES.map((line, i) => {
                  const disrupted = transport?.disruptions.cff.find(d => d.isCEVA && d.line.includes(`L${i + 1}`))
                  return (
                    <div key={line} className="mt-row mt-row-btn" onClick={() => setDetail({ icon: '🚆', title: `Léman Express ${line}`, rows: [{ label: 'Statut', value: disrupted?.delayMinutes ? `Retard +${disrupted.delayMinutes} min` : 'Service normal', color: disrupted ? 'var(--orange)' : 'var(--green)' }, { label: 'Tronçon', value: disrupted ? `${disrupted.from} vers ${disrupted.to}` : 'Toutes gares' }, { label: 'Source', value: 'CFF / SBB via OpenTransportData.swiss' }, { label: 'Mise à jour', value: 'Toutes les 30 secondes' }], note: 'Le Léman Express est le réseau ferroviaire transfrontalier franco-suisse desservant le Grand Genève. Géré par CFF côté suisse et SNCF côté français.' })}>
                      <span className="mt-name">{line}</span>
                      <span className={`mt-val ${disrupted ? 'mt-warn' : 'mt-ok'}`}>{disrupted?.delayMinutes ? `+${disrupted.delayMinutes} min` : 'Normal'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="live-cta reveal">
          <div className="lct"><strong>Vous venez de voir la situation en direct.</strong><br />La carte live regroupe tout ça en une seule vue : routes, TPG, G7, météo, frontières.</div>
          <div className="lcb">
            <a className="lc-a" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
              Ouvrir la carte live
            </a>
          </div>
        </div>
      </section>

      {/* SOCIAL SHARING */}
      <section className="s reveal">
        <div className="s-label">Partagez TIF</div>
        <h2 className="s-h">Informez votre<br />entourage</h2>
        <p className="s-sub">Plus les gens connaissent TIF avant le G7, moins il y a de blocages inutiles. Chaque partage peut éviter une heure perdue à quelqu&apos;un.</p>
        <div className="share-btns">
          <a className="share-btn share-tw" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            Partager sur X
          </a>
          <a className="share-btn share-li" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            Partager sur LinkedIn
          </a>
          <a className="share-btn share-wa" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
            WhatsApp
          </a>
          <button className="share-btn share-copy" onClick={copyLink}>
            {copied ? '✓ Lien copié' : '🔗 Copier le lien'}
          </button>
        </div>
      </section>

      {/* POURQUOI G7 */}
      <section className="s reveal">
        <div className="s-label">Sommet G7</div>
        <h2 className="s-h">Pourquoi chaque<br />minute compte</h2>
        <p className="s-sub">Lors d&apos;un sommet international, la ville change de nature. Sans information centralisée, chaque perturbation touche des milliers de personnes simultanément.</p>
        <div className="car-outer" style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="car-head">
            <span className="car-head-t">4 scénarios réels, cliquez pour le détail</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('why', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('why', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-why" ref={el => { carRefs.current['why'] = el }} onScroll={() => csync('why')}>
            {[...WHY_SLIDES, ...WHY_SLIDES, ...WHY_SLIDES].map((s, i) => (
              <div key={i} className="cslide" style={{ cursor: 'pointer' }} onClick={() => setDetail(WHY_DETAILS[i % WHY_SLIDES.length])}>
                <div className="why-card">
                  <div className="why-num">{s.num}</div>
                  <div className="why-title">{s.title}</div>
                  <div className="why-body">{s.body}</div>
                  <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '10px' }}>Voir l&apos;analyse complète →</div>
                </div>
              </div>
            ))}
          </div>
          <Dots id="why" logical={WHY_SLIDES.length} />
        </div>
      </section>

      {/* FAQ */}
      <section className="s s-alt reveal">
        <div className="s-label">Questions fréquentes</div>
        <h2 className="s-h">Tout comprendre<br />en 30 secondes</h2>
        <p className="s-sub">Ce que TIF apporte concrètement pendant le G7 et au quotidien.</p>
        <div className="faq-wrap">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{item.q}<span className="faq-icon">+</span></button>
              <div className="faq-body"><p>{item.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* PARKINGS */}
      <section className="s reveal" id="parkings">
        <div className="s-label">Stationnement · P+R</div>
        <h2 className="s-h">Parkings et<br />solutions actives</h2>
        <p className="s-sub">Pendant le G7, garez votre voiture dans un P+R et prenez les transports publics directement au centre-ville. Moins d&apos;embouteillages, zéro stress.</p>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="car-outer">
            <div className="car-head">
              <span className="car-head-t">8 P+R principaux · accès TPG direct</span>
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
                        <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '4px' }}>places</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--brand)', fontWeight: 600, marginBottom: '4px' }}>🚌 {p.tpg}</div>
                      {p.hasRT && <div style={{ fontSize: '11px', color: 'var(--green)' }}>⚡ Disponibilité temps réel</div>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '10px' }}>Voir sur la carte →</div>
                  </div>
                </div>
              ))}
            </div>
            <Dots id="prk" logical={PRK_SLIDES.length} />
          </div>
        </div>
        <div className="live-cta reveal" style={{ marginTop: '20px' }}>
          <div className="lct"><strong>Stratégie P+R pendant le G7.</strong><br />Posez votre voiture en périphérie et rejoignez le centre en TPG. La plupart des P+R sont gratuits ou à très faible coût.</div>
          <div className="lcb">
            <a className="lc-a" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
              Voir les parkings sur la carte
            </a>
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="s s-alt" id="sources">
        <div className="s-label reveal">Sources officielles</div>
        <h2 className="s-h reveal">Données vérifiées.<br />Tracées à la source.</h2>
        <p className="s-sub reveal">Chaque information publiée sur TIF est attribuée à sa source officielle. Aucune donnée invérifiable. Cliquez pour accéder à chaque source.</p>
        <div className="car-outer reveal" style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <div className="car-head">
            <span className="car-head-t">9 sources officielles connectées</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('src', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('src', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-src" ref={el => { carRefs.current['src'] = el }} onScroll={() => csync('src')}>
            {[...SRC_SLIDES, ...SRC_SLIDES, ...SRC_SLIDES].map((s, i) => (
              <div key={i} className="cslide">
                <a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="src" style={{ cursor: 'pointer' }}>
                    <div className="src-icon">{s.icon}</div>
                    <div className="src-name">{s.name}</div>
                    <div className="src-desc">{s.desc}</div>
                    <div className="src-live" style={s.blue ? { color: 'var(--blue-d)' } : {}}>{s.live}</div>
                  </div>
                </a>
              </div>
            ))}
          </div>
          <Dots id="src" logical={SRC_SLIDES.length} />
        </div>
      </section>

      {/* CTA DARK */}
      <div className="cta-dark reveal">
        <h2>Voir avant<br />tout le monde.</h2>
        <p>La carte live est gratuite, sans inscription, sans publicité. Ouvrez-la maintenant, avant de prendre la route.</p>
        <div className="btns">
          <a className="btn-w" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="currentColor" /><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" /></svg>
            Ouvrir la carte live
          </a>
        </div>
        <div className="cta-stats">
          <div className="cta-stat"><div className="cta-stat-v">9</div><div className="cta-stat-l">sources officielles</div></div>
          <div className="cta-stat"><div className="cta-stat-v">30s</div><div className="cta-stat-l">refresh automatique</div></div>
          <div className="cta-stat"><div className="cta-stat-v">1M+</div><div className="cta-stat-l">personnes concernées</div></div>
        </div>
      </div>

      {/* CONTRIBUTION */}
      <section className="s s-alt" id="soutien">
        <div className="s-label reveal">Soutenir le projet</div>
        <h2 className="s-h reveal">TIF est gratuit.<br />Aidez-le à le rester.</h2>
        <p className="s-sub reveal">Votre soutien finance l&apos;infrastructure, les nouvelles sources de données et la sécurité de la plateforme.</p>
        <div className="contrib-wrap reveal">
          <div className="cc">
            <span className="cc-tag pub">Citoyen  Public</span>
            <div className="cc-h">Faire un don<br />au projet</div>
            <div className="cc-p">TIF est financé par des contributions volontaires. Chaque don améliore directement la résilience et la sécurité de l&apos;information pour tous les habitants du Grand Genève.</div>
            <div className="amts">
              {[5, 10, 20, 50].map(v => (<button key={v} className={`amt${selectedAmt === v && !customAmt ? ' sel' : ''}`} onClick={() => { setSelectedAmt(v); setCustomAmt('') }}>CHF {v}</button>))}
            </div>
            <input className="m-input" type="number" min="1" placeholder="Autre montant (CHF)" value={customAmt} onChange={e => { setCustomAmt(e.target.value); setSelectedAmt(null) }} style={{ marginBottom: '12px' }} />
            <button className="btn-full green" onClick={() => openM('m-don')}>💚 Soutenir TIF</button>
            <p className="cc-note">100% des dons vont au projet, aucune commission</p>
          </div>
          <div className="cc">
            <span className="cc-tag pro">Professionnel  Sur demande</span>
            <div className="cc-h">Accès TIF Pro<br />pour votre organisation</div>
            <div className="cc-p">Réservé aux collectivités, services publics, entreprises et professionnels de sécurité. Chaque demande est évaluée manuellement.</div>
            <ul className="pro-list">
              {['API REST temps réel, flux de données brutes', 'Dashboard dédié avec alertes personnalisées', 'Export JSON/CSV et intégration webhooks', 'Support prioritaire, réponse sous 4h ouvrées', 'SLA contractuel, confidentialité des données'].map(item => (
                <li key={item}><span className="check-icon"><svg viewBox="0 0 9 9"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" /></svg></span>{item}</li>
              ))}
            </ul>
            <button className="btn-full dark" onClick={() => openM('m-pro')}>Demander un accès Pro →</button>
            <p className="cc-note">Délai de réponse : 2 à 5 jours ouvrés</p>
          </div>
        </div>
      </section>

      {/* CONTACT BAND */}
      <div className="contact-band reveal">
        <p>Une question ? Un partenariat ? Une idée ? <strong>Notre équipe est à Genève, 48h ouvrées.</strong></p>
        <button className="btn-p" style={{ fontSize: '14px', padding: '11px 22px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }} onClick={() => openM('m-contact')}>✉ Nous contacter</button>
      </div>

      {/* TRANSPARENCE */}
      <section className="s" id="confiance">
        <div className="s-label reveal">Confiance et Transparence</div>
        <h2 className="s-h reveal">L'honnêteté<br />Comme façade.</h2>
        <p className="s-sub reveal">Nous ne prétendons pas être certifiés. Nous préférons la transparence active et vous inviter à auditer la plateforme vous-même.</p>
        <div className="car-outer reveal" style={{ maxWidth: '960px', margin: '0 auto 3px' }}>
          <div className="car-head"><span className="car-head-t">Données et légal</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('tc1', -1)}><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('tc1', 1)}><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-tc1" ref={el => { carRefs.current['tc1'] = el }} onScroll={() => csync('tc1')}>
            {[...TC1_SLIDES, ...TC1_SLIDES, ...TC1_SLIDES].map((tc, i) => (
              <div key={i} className="cslide"><div className="src" style={{ cursor: 'pointer' }} onClick={() => openM(tc.modal)}><div className="src-icon">{tc.icon}</div><div className="src-name">{tc.name}</div><div className="src-desc">{tc.desc}</div><div className="src-live" style={{ color: 'var(--blue)' }}>En savoir plus →</div></div></div>
            ))}
          </div>
          <Dots id="tc1" logical={TC1_SLIDES.length} />
        </div>
        <div className="car-outer reveal" style={{ maxWidth: '960px', margin: '0 auto 24px' }}>
          <div className="car-head"><span className="car-head-t">Documentation</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('tc2', -1)}><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('tc2', 1)}><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-tc2" ref={el => { carRefs.current['tc2'] = el }} onScroll={() => csync('tc2')}>
            {[...TC2_SLIDES, ...TC2_SLIDES, ...TC2_SLIDES].map((tc, i) => (
              <div key={i} className="cslide"><div className="src" style={{ cursor: 'pointer' }} onClick={() => openM(tc.modal)}><div className="src-icon">{tc.icon}</div><div className="src-name">{tc.name}</div><div className="src-desc">{tc.desc}</div><div className="src-live" style={{ color: 'var(--blue)' }}>Voir →</div></div></div>
            ))}
          </div>
          <Dots id="tc2" logical={TC2_SLIDES.length} />
        </div>
        <div className="audit-card reveal">
          <h3>Niveau 3, Audit participatif, sur demande</h3>
          <p>Börja Swiss Solutions invite les professionnels à auditer gratuitement la plateforme. Cybersécurité, collectivités, experts SIG, services d&apos;urgence, votre regard nous intéresse.</p>
          <div className="audit-actions">
            <div className="aa" onClick={() => openM('m-vuln')}><div><div className="aa-title">Signalement des vulnérabilités</div><div className="aa-sub">Responsible disclosure, délai, contact chiffré</div></div><div className="aa-arr">→</div></div>
            <div className="aa" onClick={() => openM('m-audit')}><div><div className="aa-title">Demander un accès audit complet</div><div className="aa-sub">Architecture détaillée, API sandbox, session technique</div></div><div className="aa-arr">→</div></div>
            <div className="aa" onClick={() => openM('m-partner')}><div><div className="aa-title">Partenariat institutionnel</div><div className="aa-sub">Collectivités, services d&apos;urgence, ONG, autorités</div></div><div className="aa-arr">→</div></div>
          </div>
          <div style={{ padding: '12px 0 0', borderTop: '1px solid var(--border-l)', marginTop: '12px' }}>
            <p style={{ fontSize: '11px', color: 'var(--ink3)', margin: 0 }}>⚠ TIF agrège des informations publiques et ne constitue pas une plateforme officielle d&apos;alerte des autorités cantonales ou fédérales.</p>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section className="final reveal">
        <h2>Voir. Comprendre. <span className="accent">Anticiper.</span></h2>
        <p>Gratuit. Sans inscription. RGPD conforme. Hébergé en Suisse.</p>
        <div className="btns">
          <a className="btn-p" href={user ? '/map' : '/login'} onClick={handleOpenMap}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="white" /><circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" /></svg>
            Ouvrir la carte live
          </a>
          <a className="btn-s" href="#soutien">Soutenir TIF</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="ft">
          <div className="ft-top">
            <div className="ft-brand"><p>TIF</p><span>Tableau de bord citoyen, Grand Genève, par Börja Swiss Solutions RI</span></div>
            <div className="ft-links">
              <a href="#live">Situation live</a><a href="#sources">Sources</a>
              <a href="#soutien">Soutenir</a><a href="#confiance">Transparence</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-contact') }}>Contact</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-privacy') }}>Confidentialité</a>
            </div>
          </div>
          <div className="ft-bottom">
            <p>© 2025 Börja Swiss Solutions RI, Genève, Suisse</p>
            <p>RGPD, nLPD, Hébergé en Suisse, Données anonymisées</p>
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
          <><div className="m-note">💚 100% des dons vont au projet TIF, aucune commission</div>
          <p>TIF est gratuit et le restera. Votre soutien finance les infrastructures serveur, l&apos;intégration de nouvelles sources et l&apos;amélioration de la sécurité au bénéfice de tous.</p>
          <h4>Montant</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '7px', marginBottom: '8px' }}>
            {[5, 10, 20, 50].map(v => <button key={v} className={`amt${selectedAmt === v && !customAmt ? ' sel' : ''}`} onClick={() => { setSelectedAmt(v); setCustomAmt('') }}>CHF {v}</button>)}
          </div>
          <input className="m-input" type="number" min="1" placeholder="Autre montant (CHF)" value={customAmt} onChange={e => { setCustomAmt(e.target.value); setSelectedAmt(null) }} />
          <input className="m-input" type="email" placeholder="Email (optionnel, pour reçu)" />
          <p style={{ fontSize: '11px' }}>Contact pour le paiement : <strong style={{ color: 'var(--ink)' }}>contact@borja-swiss-solutions.ch</strong></p>
          <button className="m-submit g">💚 Confirmer le don</button></>
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
        { id: 'm-faq', tag: { bg: 'var(--green-bg)', c: 'var(--green)', label: 'Public' }, title: 'FAQ', content: (<>{FAQ_ITEMS.map((item, i) => <div key={i}><h4>{item.q}</h4><p>{item.a}</p></div>)}</>) },
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
          <ul><li>Sources officielles → connecteurs (pull toutes les 30s)</li><li>Validation et normalisation des données</li><li>Corrélation croisée multi-sources</li><li>API interne → Frontend via WebSocket</li><li>Hébergement exclusivement Suisse (Infomaniak)</li></ul></>
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
