'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const SLIDE_COUNTS: Record<string, number> = { why: 4, inc: 8, src: 9, tc1: 4, tc2: 4 }

export function HomeContent() {
  const [openModal, setOpenModal] = useState<string | null>(null)
  const [selectedAmt, setSelectedAmt] = useState<number | null>(null)
  const [activeDots, setActiveDots] = useState<Record<string, number>>({})
  const lastFocus = useRef<HTMLElement | null>(null)
  const carRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Clock
  const [clock, setClock] = useState('--:--')
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Nav scroll shadow
  useEffect(() => {
    const nav = document.getElementById('nav')
    const fn = () => nav?.classList.toggle('scrolled', window.scrollY > 10)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Reveal on scroll
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
            const el = b as HTMLElement
            const w = el.style.width; el.style.width = '0'
            requestAnimationFrame(() => setTimeout(() => { el.style.width = w }, 80))
          })
          bo.unobserve(e.target)
        }
      })
    }, { threshold: 0.3 })
    document.querySelectorAll('.dash-row').forEach(el => bo.observe(el))
    return () => bo.disconnect()
  }, [])

  // Escape key for modals
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && openModal) closeM() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [openModal])

  function openM(id: string) {
    lastFocus.current = document.activeElement as HTMLElement
    setOpenModal(id)
    document.body.style.overflow = 'hidden'
  }

  function closeM() {
    setOpenModal(null)
    document.body.style.overflow = ''
    lastFocus.current?.focus()
  }

  const carMove = useCallback((key: string, dir: number) => {
    const el = carRefs.current[key]
    if (!el) return
    const slide = el.querySelector('.cslide') as HTMLElement | null
    if (!slide) return
    el.scrollBy({ left: dir * (slide.offsetWidth + 3), behavior: 'smooth' })
  }, [])

  const csync = useCallback((key: string) => {
    const el = carRefs.current[key]
    if (!el) return
    const slide = el.querySelector('.cslide') as HTMLElement | null
    if (!slide) return
    const idx = Math.round(el.scrollLeft / (slide.offsetWidth + 3))
    setActiveDots(prev => ({ ...prev, [key]: idx }))
  }, [])

  function Dots({ id }: { id: string }) {
    const count = SLIDE_COUNTS[id] ?? 0
    return (
      <div className="cdots">
        {Array.from({ length: count }).map((_, i) => (
          <button key={i} className={`cdot${(activeDots[id] ?? 0) === i ? ' on' : ''}`}
            onClick={() => {
              const el = carRefs.current[id]
              if (!el) return
              const slide = el.querySelector('.cslide') as HTMLElement | null
              if (!slide) return
              el.scrollTo({ left: i * (slide.offsetWidth + 3), behavior: 'smooth' })
            }}
          />
        ))}
      </div>
    )
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
          <a className="n-cta" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">Carte live →</a>
        </div>
      </nav>

      {/* TICKER */}
      <div className="ticker" aria-label="Flux d'informations en direct">
        <div className="ticker-inner">
          {[
            { cls: 'tb-r', label: 'Accident', text: 'A1 Bardonnex → Lausanne · +47 min · 2 voies bloquées' },
            { cls: 'tb-gold', label: 'G7', text: 'Zones rouges · Palais des Nations · Quai Wilson · actives' },
            { cls: 'tb-o', label: 'TPG', text: 'Ligne 12 · Déviation Cornavin–Rive · Retard +8 min' },
            { cls: 'tb-b', label: 'CFF', text: 'IR90 Genève–Berne · Retard 14 min · Incident Lausanne' },
            { cls: 'tb-y', label: 'Météo', text: 'Alerte orange · Orage dès 17h · Rafales 80 km/h' },
            { cls: 'tb-g', label: 'Frontière', text: 'Bardonnex 22 min · Moillesulaz 8 min · Ferney 5 min' },
            { cls: 'tb-gold', label: 'G7 Sécurité', text: 'Restrictions circulation · Rive gauche · 08h–22h' },
            { cls: 'tb-o', label: 'Travaux', text: "Rue de Rive · Fermeture totale jusqu'au 28 juin" },
            { cls: 'tb-b', label: 'CEVA', text: 'Léman Express · Service normal · Tous trains à l\'heure' },
          ].concat([
            { cls: 'tb-r', label: 'Accident', text: 'A1 Bardonnex → Lausanne · +47 min · 2 voies bloquées' },
            { cls: 'tb-gold', label: 'G7', text: 'Zones rouges · Palais des Nations · Quai Wilson · actives' },
            { cls: 'tb-o', label: 'TPG', text: 'Ligne 12 · Déviation Cornavin–Rive · Retard +8 min' },
            { cls: 'tb-b', label: 'CFF', text: 'IR90 Genève–Berne · Retard 14 min · Incident Lausanne' },
            { cls: 'tb-y', label: 'Météo', text: 'Alerte orange · Orage dès 17h · Rafales 80 km/h' },
            { cls: 'tb-g', label: 'Frontière', text: 'Bardonnex 22 min · Moillesulaz 8 min · Ferney 5 min' },
            { cls: 'tb-gold', label: 'G7 Sécurité', text: 'Restrictions circulation · Rive gauche · 08h–22h' },
            { cls: 'tb-o', label: 'Travaux', text: "Rue de Rive · Fermeture totale jusqu'au 28 juin" },
          ]).map((item, i) => (
            <div key={i} className="ti"><span className={`tb ${item.cls}`}>{item.label}</span>{item.text}</div>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">
          <div className="hero-badge-dot" />
          Sommet G7 · Grand Genève · Veille opérationnelle
        </div>
        <h1 className="hero-h1">Le Grand Genève,<br />en <span className="accent">temps réel.</span></h1>
        <p className="hero-p">
          Un accident. Une route fermée. Une alerte G7.<br />
          <strong>Ces informations existent.</strong> Elles sont dispersées.<br />
          TIF les centralise — avant qu&apos;il soit trop tard.
        </p>
        <div className="hero-btns">
          <a className="btn-p" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="white" /><circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" /></svg>
            Ouvrir la carte live
          </a>
          <a className="btn-s" href="https://tif.borja-swiss-solutions.ch/veille" target="_blank" rel="noreferrer">Veille G7</a>
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
        <p className="s-sub">Mis à jour toutes les 30 secondes depuis les sources officielles.</p>
        <div className="dash reveal">
          <div className="dash-row dash-row-4">
            <div className="dc">
              <div className="dc-top"><div className="dc-label">Trafic A1 / A40</div><div className="dc-live-dot" /></div>
              <div className="dc-val r">+47 min</div>
              <div className="dc-desc">Bardonnex → Lausanne<br />Accident km 4.2 · 2 voies bloquées</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: '88%', background: 'var(--red)' }} /></div>
            </div>
            <div className="dc">
              <div className="dc-top"><div className="dc-label">TPG perturbations</div><div className="dc-live-dot" /></div>
              <div className="dc-val o">7 lignes</div>
              <div className="dc-desc">Lignes 3, 5, 12, 15, 18, 25, 36<br />Déviations en cours</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: '60%', background: 'var(--orange)' }} /></div>
            </div>
            <div className="dc">
              <div className="dc-top"><div className="dc-label">CFF / CEVA</div><div className="dc-live-dot" /></div>
              <div className="dc-val b">+14 min</div>
              <div className="dc-desc">IR90 Genève–Berne en retard<br />Léman Express : service normal</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: '35%', background: 'var(--blue)' }} /></div>
            </div>
            <div className="dc">
              <div className="dc-top"><div className="dc-label">Météo · MétéoSuisse</div><div className="dc-live-dot" /></div>
              <div className="dc-val y">⚠ Orange</div>
              <div className="dc-desc">Orage dès 17h00<br />Rafales 80 km/h · Grêle possible</div>
              <div className="dc-bar"><div className="dc-fill" style={{ width: '72%', background: 'var(--yellow-text)' }} /></div>
            </div>
          </div>
          <div className="dash-row dash-row-3">
            <div className="dc">
              <div className="g7-head">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polygon points="5,1 9,3 9,7 5,9 1,7 1,3" stroke="currentColor" strokeWidth="1.2" /></svg>
                Veille G7 — Restrictions actives
              </div>
              <div className="g7-grid">
                <div className="g7m"><div className="g7m-l">Zones rouge</div><div className="g7m-v" style={{ color: 'var(--red)' }}>4</div><div className="g7m-d">Palais Nations, Quai Wilson, Rue de Lausanne, IATA</div></div>
                <div className="g7m"><div className="g7m-l">Routes fermées</div><div className="g7m-v" style={{ color: 'var(--orange)' }}>11</div><div className="g7m-d">Rive gauche + accès aéroport réglementés</div></div>
                <div className="g7m"><div className="g7m-l">Consignes sécurité</div><div className="g7m-v" style={{ color: 'var(--gold)' }}>3</div><div className="g7m-d">Police Cantonale + Zone Frontière</div></div>
                <div className="g7m"><div className="g7m-l">Alertes diffusées</div><div className="g7m-v" style={{ color: 'var(--blue-d)' }}>28</div><div className="g7m-d">Depuis 06h00 ce matin</div></div>
              </div>
            </div>
            <div className="dc">
              <div className="dc-top"><div className="dc-label">Frontières CH-FR</div><div className="dc-live-dot" /></div>
              <div className="mini-table" style={{ marginTop: '4px' }}>
                <div className="mt-row"><span className="mt-name">Bardonnex</span><span className="mt-val mt-warn">22 min</span></div>
                <div className="mt-row"><span className="mt-name">Moillesulaz</span><span className="mt-val mt-warn">8 min</span></div>
                <div className="mt-row"><span className="mt-name">Ferney</span><span className="mt-val mt-ok">5 min</span></div>
                <div className="mt-row"><span className="mt-name">Thônex</span><span className="mt-val mt-ok">3 min</span></div>
                <div className="mt-row"><span className="mt-name">Vallard</span><span className="mt-val mt-bad">41 min ⚠</span></div>
              </div>
            </div>
            <div className="dc">
              <div className="dc-top"><div className="dc-label">Léman Express · CEVA</div><div className="dc-live-dot" /></div>
              <div className="mini-table" style={{ marginTop: '4px' }}>
                <div className="mt-row"><span className="mt-name">L1 Coppet–Annemasse</span><span className="mt-val mt-ok">Normal</span></div>
                <div className="mt-row"><span className="mt-name">L2 Bellegarde–Évian</span><span className="mt-val mt-ok">Normal</span></div>
                <div className="mt-row"><span className="mt-name">L3 Genève–Annecy</span><span className="mt-val mt-warn">+6 min</span></div>
                <div className="mt-row"><span className="mt-name">L4 Cornavin–Meyrin</span><span className="mt-val mt-ok">Normal</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="live-cta reveal">
          <div className="lct"><strong>Vous venez de voir la situation en direct.</strong><br />La carte live regroupe tout ça en une seule vue — routes, TPG, G7, météo, frontières.</div>
          <div className="lcb">
            <a className="lc-a" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" /></svg>
              Ouvrir la carte live
            </a>
            <a className="lc-a lc-g" href="https://tif.borja-swiss-solutions.ch/veille" target="_blank" rel="noreferrer">Veille G7 →</a>
          </div>
        </div>
      </section>

      {/* POURQUOI G7 */}
      <section className="s reveal">
        <div className="s-label">Sommet G7</div>
        <h2 className="s-h">Pourquoi chaque<br />minute compte</h2>
        <p className="s-sub">Lors d&apos;un sommet international, la ville change de nature. Sans information centralisée, chaque perturbation touche des milliers de personnes simultanément.</p>
        <div className="car-outer" style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="car-head">
            <span className="car-head-t">4 scénarios réels</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('why', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('why', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-why" ref={el => { carRefs.current['why'] = el }} onScroll={() => csync('why')}>
            <div className="cslide"><div className="why-card">
              <div className="why-num">01 · Mobilité</div>
              <div className="why-title">Une infirmière. 7h45. Bardonnex fermée.</div>
              <div className="why-body"><span className="before">Sans TIF</span> — elle l&apos;apprend sur place après 20 min de queue. <span className="after">Avec TIF</span> — alerte à 6h30, itinéraire de déviation choisi à la maison. Elle arrive à l&apos;heure.</div>
            </div></div>
            <div className="cslide"><div className="why-card">
              <div className="why-num">02 · Sécurité</div>
              <div className="why-title">Une famille. Quai Wilson. Zone rouge.</div>
              <div className="why-body"><span className="before">Sans TIF</span> — bloquée face à un périmètre de sécurité non signalé. <span className="after">Avec TIF</span> — restriction visible dès 6h00 avec l&apos;alternative et la durée estimée.</div>
            </div></div>
            <div className="cslide"><div className="why-card">
              <div className="why-num">03 · Entreprise</div>
              <div className="why-title">Un livreur. 14 arrêts. 4 zones fermées.</div>
              <div className="why-body"><span className="before">Sans TIF</span> — découvre les blocages un par un, perd 3 heures. <span className="after">Avec TIF</span> — tournée planifiée le matin sur la carte G7. 14 livraisons avant 16h.</div>
            </div></div>
            <div className="cslide"><div className="why-card">
              <div className="why-num">04 · Réaction rapide</div>
              <div className="why-title">Un incident. Qui informe en premier ?</div>
              <div className="why-body"><span className="before">Sans TIF</span> — Twitter, rumeurs, Google Maps en retard. <span className="after">Avec TIF</span> — sources officielles agrégées en 30 secondes, information vérifiée avant la confusion.</div>
            </div></div>
          </div>
          <Dots id="why" />
        </div>
      </section>

      {/* INCIDENTS ACTIFS */}
      <section className="s s-alt reveal" id="incidents">
        <div className="s-label">Incidents actifs</div>
        <h2 className="s-h">Grand Genève · En ce moment</h2>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="car-outer">
            <div className="car-head">
              <span className="car-head-t">8 incidents actifs · mis à jour en continu</span>
              <div className="car-arrows">
                <button className="c-arr" onClick={() => carMove('inc', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
                <button className="c-arr" onClick={() => carMove('inc', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
              </div>
            </div>
            <div className="ctrack" id="ctr-inc" ref={el => { carRefs.current['inc'] = el }} onScroll={() => csync('inc')}>
              {[
                { dot: 'd-crit', title: 'Accident A1 — Km 4.2 direction Lausanne · 2 voies bloquées sur 3', tagStyle: { background: 'var(--red-bg)', color: 'var(--red)' }, tag: 'Critique', meta: 'A1 · Bardonnex', src: 'OFROU/ASTRA', time: '07:43' },
                { dot: 'd-g7', title: 'G7 — Zones rouges : Palais des Nations, Quai Wilson, Rue de Lausanne', tagStyle: { background: 'var(--gold-bg)', color: 'var(--gold)' }, tag: 'G7', meta: 'Sécurité · Rive droite', src: 'Police Cantonale GE', time: '06:00' },
                { dot: 'd-high', title: 'Manifestation — Quai du Mont-Blanc · Blocage · durée estimée 45 min', tagStyle: { background: 'var(--orange-bg)', color: 'var(--orange)' }, tag: 'Perturbation', meta: 'Quai du Mont-Blanc', src: 'Waze for Cities', time: '08:12' },
                { dot: 'd-high', title: 'TPG Ligne 12 — Déviation Cornavin ↔ Rive · retard cumulé +8 min', tagStyle: { background: 'var(--orange-bg)', color: 'var(--orange)' }, tag: 'TPG', meta: 'Ligne 12', src: 'TPG Opendata', time: '07:58' },
                { dot: 'd-med', title: 'Alerte météo ORANGE — Orages dès 17h · Rafales 80 km/h · Grêle', tagStyle: { background: 'var(--yellow-bg)', color: 'var(--yellow-text)' }, tag: 'Météo', meta: 'Canton de Genève', src: 'MétéoSuisse', time: '05:30' },
                { dot: 'd-info', title: 'CFF IR90 Genève–Berne — Retard 14 min suite incident technique Lausanne', tagStyle: { background: 'var(--blue-bg)', color: 'var(--blue-d)' }, tag: 'CFF', meta: 'IR90 · Gare Cornavin', src: 'OpenTransportData.swiss', time: '08:02' },
                { dot: 'd-g7', title: 'G7 Consigne — Éviter secteur aéroport 11h–14h · Convois officiels', tagStyle: { background: 'var(--gold-bg)', color: 'var(--gold)' }, tag: 'G7', meta: 'Mobilité · Aéroport GVA', src: 'Police Cantonale GE', time: '09:00' },
                { dot: 'd-med', title: 'Travaux Rue de Rive — Fermeture totale · Déviation Cours de Rive', tagStyle: { background: 'var(--yellow-bg)', color: 'var(--yellow-text)' }, tag: 'Travaux', meta: 'Rue de Rive', src: 'SITG Geneva', time: '00:00' },
              ].map((inc, i) => (
                <div key={i} className="cslide">
                  <div className="inc-slide">
                    <div className={`inc-dot ${inc.dot}`} />
                    <div className="inc-body">
                      <div className="inc-title">{inc.title}</div>
                      <div className="inc-meta">
                        <span className="itag" style={inc.tagStyle}>{inc.tag}</span>
                        <span>{inc.meta}</span>
                        <span>{inc.src}</span>
                      </div>
                    </div>
                    <div className="inc-t">{inc.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <Dots id="inc" />
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="s" id="sources">
        <div className="s-label reveal">Sources officielles</div>
        <h2 className="s-h reveal">Données vérifiées.<br />Tracées à la source.</h2>
        <p className="s-sub reveal">Chaque information publiée sur TIF est attribuée à sa source officielle. Aucune donnée invérifiable.</p>
        <div className="car-outer reveal" style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <div className="car-head">
            <span className="car-head-t">9 sources officielles connectées</span>
            <div className="car-arrows">
              <button className="c-arr" onClick={() => carMove('src', -1)} aria-label="Précédent"><svg viewBox="0 0 11 11"><polyline points="7.5,1.5 3,5.5 7.5,9.5" /></svg></button>
              <button className="c-arr" onClick={() => carMove('src', 1)} aria-label="Suivant"><svg viewBox="0 0 11 11"><polyline points="3.5,1.5 8,5.5 3.5,9.5" /></svg></button>
            </div>
          </div>
          <div className="ctrack" id="ctr-src" ref={el => { carRefs.current['src'] = el }} onScroll={() => csync('src')}>
            {[
              { icon: '🛣️', name: 'OFROU / ASTRA', desc: 'Trafic autoroutier A1, A40 et réseau national. Incidents, fermetures, travaux en temps réel.', live: 'Live · 60s' },
              { icon: '🗺️', name: 'SITG Geneva', desc: "Système d'Information du Territoire Genevois. Voirie, événements et restrictions officielles.", live: 'Officiel Canton GE' },
              { icon: '🚌', name: 'TPG', desc: 'Perturbations, retards et déviations sur le réseau trams, bus et trolleybus du Grand Genève.', live: 'Live · 30s' },
              { icon: '🚆', name: 'CFF / SBB + CEVA', desc: 'Léman Express, InterRegio, retards via OpenTransportData.swiss. Toutes lignes couvertes.', live: 'Live · 30s' },
              { icon: '🌩️', name: 'MétéoSuisse', desc: 'Alertes météo officielles, précipitations, orages et vigilance pour le Canton de Genève.', live: 'Officiel Confédération' },
              { icon: '🛂', name: 'Frontières CH-FR', desc: "Temps d'attente aux 8 postes frontaliers franco-suisses. Bardonnex, Moillesulaz, Ferney...", live: 'Live · 5 min' },
              { icon: '🚗', name: 'HERE Maps · Waze', desc: 'Données trafic communautaires. Incidents terrain, congestion, signalements citoyens.', live: 'Live · corrélation' },
              { icon: '⬡', name: 'Veille G7', desc: 'Restrictions, zones de sécurité et consignes agrégées depuis les sources publiques officielles liées au Sommet.', live: 'Actif · Durée du Sommet', gold: true },
              { icon: '📡', name: 'Réseau Börja', desc: "Signalements anonymes de la communauté TIF. Corrélation terrain pour affinage des données officielles.", live: 'Complémentaire', blue: true },
            ].map((s, i) => (
              <div key={i} className="cslide">
                <div className="src" style={s.gold ? { border: '1px solid var(--gold-border)' } : {}}>
                  <div className="src-icon">{s.icon}</div>
                  <div className="src-name" style={s.gold ? { color: 'var(--gold)' } : {}}>{s.name}</div>
                  <div className="src-desc">{s.desc}</div>
                  <div className="src-live" style={s.gold ? { color: 'var(--gold)' } : s.blue ? { color: 'var(--blue-d)' } : {}}>{s.live}</div>
                </div>
              </div>
            ))}
          </div>
          <Dots id="src" />
        </div>
      </section>

      {/* CTA DARK */}
      <div className="cta-dark reveal">
        <h2>Voir avant<br />tout le monde.</h2>
        <p>La carte live est gratuite, sans inscription, sans publicité. Ouvrez-la maintenant — avant de prendre la route.</p>
        <div className="btns">
          <a className="btn-w" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" fill="currentColor" /><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" /></svg>
            Ouvrir la carte live
          </a>
          <a className="btn-ow" href="https://tif.borja-swiss-solutions.ch/veille" target="_blank" rel="noreferrer">Veille G7 →</a>
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
            <span className="cc-tag pub">Citoyen · Public</span>
            <div className="cc-h">Faire un don<br />au projet</div>
            <div className="cc-p">TIF est financé par des contributions volontaires. Chaque don améliore directement la résilience et la sécurité de l&apos;information pour tous les habitants du Grand Genève.</div>
            <div className="amts">
              {[5, 10, 20, 50].map(v => (
                <button key={v} className={`amt${selectedAmt === v ? ' sel' : ''}`} onClick={() => setSelectedAmt(v)}>CHF {v}</button>
              ))}
            </div>
            <button className="btn-full green" onClick={() => openM('m-don')}>💚 Soutenir TIF</button>
            <p className="cc-note">100% des dons vont au projet · Aucune commission</p>
          </div>
          <div className="cc">
            <span className="cc-tag pro">Professionnel · Sur demande</span>
            <div className="cc-h">Accès TIF Pro<br />pour votre organisation</div>
            <div className="cc-p">Réservé aux collectivités, services publics, entreprises et professionnels de sécurité. Chaque demande est évaluée manuellement.</div>
            <ul className="pro-list">
              {['API REST temps réel — flux de données brutes', 'Dashboard dédié avec alertes personnalisées', 'Export JSON/CSV + intégration webhooks', 'Support prioritaire · réponse sous 4h ouvrées', 'SLA contractuel · confidentialité des données'].map(item => (
                <li key={item}>
                  <span className="check-icon"><svg viewBox="0 0 9 9"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" /></svg></span>
                  {item}
                </li>
              ))}
            </ul>
            <button className="btn-full dark" onClick={() => openM('m-pro')}>Demander un accès Pro →</button>
            <p className="cc-note">Délai de réponse : 2–5 jours ouvrés</p>
          </div>
        </div>
      </section>

      {/* CONTACT BAND */}
      <div className="contact-band reveal">
        <p>Une question ? Un partenariat ? Une idée ? <strong>Notre équipe est à Genève — 48h ouvrées.</strong></p>
        <button className="btn-p" style={{ fontSize: '14px', padding: '11px 22px', cursor: 'pointer', border: 'none' }} onClick={() => openM('m-contact')}>✉ Nous contacter</button>
      </div>

      {/* TRANSPARENCE */}
      <section className="s" id="confiance">
        <div className="s-label reveal">Confiance &amp; Transparence</div>
        <h2 className="s-h reveal">Honnêteté<br />plutôt que façade.</h2>
        <p className="s-sub reveal">Nous ne prétendons pas être certifiés. Nous préférons la transparence active — et vous inviter à auditer la plateforme vous-même.</p>
        <div className="transp-wrap reveal">
          {/* Niveau 1 */}
          <div className="level">
            <div className="level-head"><span className="lvl-badge lvl-pub">Public</span><span className="lvl-title">Niveau 1 — Transparence de base</span></div>
            <div className="car-outer" style={{ background: 'var(--off2)', padding: '3px' }}>
              <div className="ctrack" id="ctr-tc1" ref={el => { carRefs.current['tc1'] = el }} onScroll={() => csync('tc1')} style={{ background: 'var(--off2)', gap: '3px' }}>
                {[
                  { icon: '🏢', name: 'Hébergement', desc: 'Infomaniak · Suisse · Données jamais hors UE', modal: 'm-hosting' },
                  { icon: '🔒', name: 'Protection des données', desc: 'RGPD · nLPD · Aucune donnée vendue', modal: 'm-rgpd' },
                  { icon: '📄', name: 'Confidentialité', desc: 'Données collectées · Durée · Droits', modal: 'm-privacy' },
                  { icon: '🛡️', name: 'Contact sécurité', desc: 'security@borja-swiss-solutions.ch', modal: 'm-secu' },
                ].map(tc => (
                  <div key={tc.modal} className="cslide"><div className="tc" onClick={() => openM(tc.modal)}>
                    <div className="tc-icon">{tc.icon}</div>
                    <div className="tc-name">{tc.name}</div>
                    <div className="tc-desc">{tc.desc}</div>
                    <div className="tc-link">En savoir plus →</div>
                  </div></div>
                ))}
              </div>
            </div>
          </div>
          {/* Niveau 2 */}
          <div className="level" style={{ marginTop: '2px' }}>
            <div className="level-head"><span className="lvl-badge lvl-pub">Public</span><span className="lvl-title">Niveau 2 — Documentation</span></div>
            <div className="car-outer" style={{ background: 'var(--off2)', padding: '3px' }}>
              <div className="ctrack" id="ctr-tc2" ref={el => { carRefs.current['tc2'] = el }} onScroll={() => csync('tc2')} style={{ background: 'var(--off2)', gap: '3px' }}>
                {[
                  { icon: '❓', name: 'FAQ', desc: 'Questions fréquentes · Sources · Fiabilité', modal: 'm-faq', link: 'Lire →' },
                  { icon: '📚', name: 'Documentation', desc: 'Guide utilisateur · Fonctionnalités', modal: 'm-doc', link: 'Voir →' },
                  { icon: '🎯', name: "Cas d'usage", desc: 'Habitants · Frontaliers · Entreprises · G7', modal: 'm-usecases', link: 'Voir →' },
                  { icon: '🏗️', name: 'Architecture', desc: 'Schéma simplifié · Sources · Flux', modal: 'm-archi', link: 'Voir →' },
                ].map(tc => (
                  <div key={tc.modal} className="cslide"><div className="tc" onClick={() => openM(tc.modal)}>
                    <div className="tc-icon">{tc.icon}</div>
                    <div className="tc-name">{tc.name}</div>
                    <div className="tc-desc">{tc.desc}</div>
                    <div className="tc-link">{tc.link}</div>
                  </div></div>
                ))}
              </div>
            </div>
          </div>
          {/* Niveau 3 */}
          <div className="level" style={{ marginTop: '2px' }}>
            <div className="level-head" style={{ background: 'rgba(0,113,227,.05)' }}><span className="lvl-badge lvl-pro">Professionnels</span><span className="lvl-title">Niveau 3 — Audit participatif · Sur demande</span></div>
            <div className="audit-body">
              <div>
                <h3>Börja Swiss Solutions invite les professionnels à auditer gratuitement la plateforme.</h3>
                <p style={{ marginTop: '10px' }}>Nous ne prétendons pas être déjà certifiés. Nous préférons la transparence active à la certification de façade. Cybersécurité, collectivités, experts SIG, services d&apos;urgence — votre regard nous intéresse.</p>
              </div>
              <div className="audit-actions">
                <div className="aa" onClick={() => openM('m-vuln')}><div><div className="aa-title">Signalement des vulnérabilités</div><div className="aa-sub">Responsible disclosure · Délai · Contact chiffré</div></div><div className="aa-arr">→</div></div>
                <div className="aa" onClick={() => openM('m-audit')}><div><div className="aa-title">Demander un accès audit complet</div><div className="aa-sub">Architecture détaillée · API sandbox · Session technique</div></div><div className="aa-arr">→</div></div>
                <div className="aa" onClick={() => openM('m-partner')}><div><div className="aa-title">Partenariat institutionnel</div><div className="aa-sub">Collectivités · Services d&apos;urgence · ONG · Autorités</div></div><div className="aa-arr">→</div></div>
              </div>
            </div>
            <div className="level-foot"><p>⚠ TIF agrège des informations publiques. Elle ne constitue pas une plateforme officielle d&apos;alerte des autorités cantonales ou fédérales.</p></div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final reveal">
        <h2>Voir. Comprendre.<br /><span className="accent">Anticiper.</span></h2>
        <p>Gratuit. Sans inscription. RGPD conforme. Hébergé en Suisse.</p>
        <div className="btns">
          <a className="btn-p" href="https://tif.borja-swiss-solutions.ch/map" target="_blank" rel="noreferrer">
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
            <div className="ft-brand"><p>TIF</p><span>Tableau de bord citoyen · Grand Genève · Par Börja Swiss Solutions RI</span></div>
            <div className="ft-links">
              <a href="#live">Situation live</a>
              <a href="#sources">Sources</a>
              <a href="#soutien">Soutenir</a>
              <a href="#confiance">Transparence</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-contact') }}>Contact</a>
              <a href="#" onClick={e => { e.preventDefault(); openM('m-privacy') }}>Confidentialité</a>
            </div>
          </div>
          <div className="ft-bottom">
            <p>© 2025 Börja Swiss Solutions RI — Genève, Suisse</p>
            <p>RGPD · nLPD · Hébergé en Suisse · Données anonymisées</p>
          </div>
        </div>
      </footer>

      {/* ═══ MODALS ═══ */}

      {/* Don */}
      <div className={`overlay${openModal === 'm-don' ? ' on' : ''}`} role="dialog" aria-modal="true" aria-label="Soutenir TIF" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>Soutenir TIF</h3></div><button className="m-x" onClick={closeM} aria-label="Fermer">✕</button></div>
          <div className="m-body">
            <div className="m-note">💚 100% des dons vont au projet TIF · Aucune commission · Börja Swiss Solutions RI</div>
            <p>TIF est gratuit et le restera. Votre soutien finance les infrastructures serveur, l&apos;intégration de nouvelles sources et l&apos;amélioration de la sécurité au bénéfice de tous.</p>
            <h4>Montant</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '7px', marginBottom: '12px' }}>
              {[5, 10, 20, 50].map(v => <button key={v} className={`amt${selectedAmt === v ? ' sel' : ''}`} onClick={() => setSelectedAmt(v)}>CHF {v}</button>)}
            </div>
            <input className="m-input" type="number" placeholder="Montant libre (CHF)" aria-label="Montant libre" />
            <input className="m-input" type="email" placeholder="Email (optionnel — pour reçu)" aria-label="Email" />
            <p style={{ fontSize: '11px' }}>Paiement sécurisé bientôt disponible. Pour l&apos;instant : <strong style={{ color: 'var(--ink)' }}>contact@borja-swiss-solutions.ch</strong></p>
            <button className="m-submit g">💚 Confirmer le don</button>
          </div>
        </div>
      </div>

      {/* Pro */}
      <div className={`overlay${openModal === 'm-pro' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--blue-bg)', color: 'var(--blue-d)' }}>Professionnel · Sur demande</span><h3>Accès TIF Pro</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <p>Réservé aux collectivités, services publics, entreprises et professionnels de sécurité. Chaque demande est évaluée manuellement.</p>
            <h4>Ce qui est inclus</h4>
            <ul>
              <li>API REST temps réel — flux de données brutes (trafic, TPG, CFF, météo, frontières)</li>
              <li>Dashboard dédié avec alertes personnalisées par zone géographique</li>
              <li>Export JSON/CSV + intégration webhooks vers vos systèmes</li>
              <li>Support technique prioritaire (réponse sous 4h ouvrées)</li>
              <li>SLA contractuel et confidentialité des données</li>
            </ul>
            <h4>Votre demande</h4>
            <input className="m-input" type="text" placeholder="Nom · Prénom" aria-label="Nom" />
            <input className="m-input" type="text" placeholder="Organisation" aria-label="Organisation" />
            <input className="m-input" type="email" placeholder="Email professionnel" aria-label="Email professionnel" />
            <input className="m-input" type="text" placeholder="Fonction / Rôle" aria-label="Fonction" />
            <textarea className="m-input m-ta" placeholder="Décrivez votre cas d'usage..." aria-label="Cas d'usage" />
            <button className="m-submit">Envoyer la demande →</button>
            <p style={{ fontSize: '11px', textAlign: 'center', marginTop: '8px', color: 'var(--ink4)' }}>Délai de réponse : 2–5 jours ouvrés</p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className={`overlay${openModal === 'm-contact' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--off2)', color: 'var(--ink3)' }}>Public</span><h3>Nous contacter</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <div className="m-row"><label>Général</label><span>contact@borja-swiss-solutions.ch</span></div>
            <div className="m-row"><label>Sécurité</label><span>security@borja-swiss-solutions.ch</span></div>
            <div className="m-row"><label>Partenariats</label><span>partnerships@borja-swiss-solutions.ch</span></div>
            <div className="m-row"><label>Délai de réponse</label><span>48h ouvrées</span></div>
            <h4>Envoyer un message</h4>
            <input className="m-input" type="text" placeholder="Nom" aria-label="Nom" />
            <input className="m-input" type="email" placeholder="Email" aria-label="Email" />
            <select className="m-input m-select" aria-label="Sujet">
              <option>Sujet...</option>
              <option>Question générale</option>
              <option>Signalement d&apos;incident</option>
              <option>Accès professionnel</option>
              <option>Partenariat</option>
              <option>Presse / Média</option>
              <option>Sécurité</option>
            </select>
            <textarea className="m-input m-ta" placeholder="Votre message..." aria-label="Message" />
            <button className="m-submit">✉ Envoyer</button>
          </div>
        </div>
      </div>

      {/* Hébergement */}
      <div className={`overlay${openModal === 'm-hosting' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>Hébergement</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <div className="m-note">🇨🇭 TIF est intégralement hébergé en Suisse, chez Infomaniak Network SA — entreprise genevoise indépendante.</div>
            <div className="m-row"><label>Hébergeur</label><span>Infomaniak Network SA</span></div>
            <div className="m-row"><label>Localisation</label><span>Genève, Suisse</span></div>
            <div className="m-row"><label>Juridiction</label><span>Droit suisse (LPD / nLPD)</span></div>
            <div className="m-row"><label>Données hors UE</label><span>Jamais</span></div>
            <div className="m-row"><label>Cloud Act US</label><span>Non applicable</span></div>
            <div className="m-row"><label>Certifications</label><span>ISO 27001 · ISO 50001</span></div>
            <p style={{ marginTop: '14px' }}>Nous avons délibérément choisi Infomaniak pour sa souveraineté numérique suisse et son indépendance vis-à-vis des GAFAM.</p>
          </div>
        </div>
      </div>

      {/* RGPD */}
      <div className={`overlay${openModal === 'm-rgpd' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>Protection des données</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <p>TIF applique les principes du RGPD européen et de la nLPD (en vigueur depuis le 1er septembre 2023).</p>
            <h4>Ce que nous collectons</h4>
            <ul><li>Adresse email (si création de compte)</li><li>Données de navigation anonymisées</li><li>Signalements terrain soumis volontairement (anonymisés)</li><li>Localisation approximative si activée (jamais stockée)</li></ul>
            <h4>Ce que nous ne collectons jamais</h4>
            <ul><li>Données de paiement</li><li>Localisation précise sans consentement</li><li>Données vendues ou partagées avec des tiers</li></ul>
            <div className="m-row"><label>Conservation</label><span>12 mois maximum</span></div>
            <div className="m-row"><label>Droit à l&apos;oubli</label><span>Traité sous 30 jours</span></div>
            <div className="m-row"><label>DPO</label><span>privacy@borja-swiss-solutions.ch</span></div>
          </div>
        </div>
      </div>

      {/* Confidentialité */}
      <div className={`overlay${openModal === 'm-privacy' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>Politique de confidentialité</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <p>Version 1.0 — En vigueur depuis juin 2025. Applicable à tif.borja-swiss-solutions.ch et toutes les sous-pages.</p>
            <h4>Responsable du traitement</h4><p>Börja Swiss Solutions RI · Genève · contact@borja-swiss-solutions.ch</p>
            <h4>Cookies</h4>
            <ul><li>Cookies techniques strictement nécessaires</li><li>Aucun cookie publicitaire ou tracking tiers</li><li>Analytics internes anonymisés uniquement</li></ul>
            <h4>Vos droits</h4>
            <ul><li>Droit d&apos;accès à vos données (art. 25 nLPD)</li><li>Droit de rectification et d&apos;effacement</li><li>Droit à la portabilité des données</li><li>Droit d&apos;opposition au traitement</li></ul>
            <p>Pour exercer vos droits : <strong style={{ color: 'var(--ink)' }}>privacy@borja-swiss-solutions.ch</strong></p>
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className={`overlay${openModal === 'm-secu' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public · Sécurité</span><h3>Contact sécurité</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <div className="m-note">🛡️ Pour tout signalement de vulnérabilité, contactez-nous directement et en toute confidentialité.</div>
            <div className="m-row"><label>Email</label><span>security@borja-swiss-solutions.ch</span></div>
            <div className="m-row"><label>Délai</label><span>24h ouvrées maximum</span></div>
            <div className="m-row"><label>PGP</label><span>Disponible sur demande</span></div>
            <p style={{ marginTop: '14px' }}>Nous nous engageons à traiter chaque signalement avec sérieux et confidentialité. Aucune action légale contre un chercheur agissant de bonne foi.</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className={`overlay${openModal === 'm-faq' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>FAQ</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <h4>TIF est-il une plateforme officielle ?</h4><p>Non. TIF est un tableau de bord citoyen qui agrège des informations publiques. Il ne se substitue pas aux communications des autorités cantonales, fédérales ou de la Police.</p>
            <h4>Les données sont-elles fiables ?</h4><p>Chaque source est tracée jusqu&apos;à son origine : OFROU, SITG, TPG, CFF, MétéoSuisse. Aucune donnée invérifiable n&apos;est publiée.</p>
            <h4>La plateforme est-elle vraiment gratuite ?</h4><p>Oui, sans conditions, sans publicité, sans limite de fonctionnalités. Les dons volontaires nous aident à maintenir et améliorer le service.</p>
            <h4>Comment contribuer un signalement ?</h4><p>Après création d&apos;un compte gratuit, vous pouvez signaler un incident via la carte live. Votre signalement est anonymisé et croisé avec les sources officielles.</p>
            <h4>Fréquence de mise à jour ?</h4><p>30 secondes pour le trafic et les transports. 5 minutes pour les frontières. Immédiat pour les alertes G7 et météo critiques.</p>
          </div>
        </div>
      </div>

      {/* Documentation */}
      <div className={`overlay${openModal === 'm-doc' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>Documentation utilisateur</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <p>Documentation complète bientôt disponible sur <strong style={{ color: 'var(--ink)' }}>docs.tif.borja-swiss-solutions.ch</strong></p>
            <h4>Modules prévus</h4>
            <ul><li>Prise en main — Créer un compte, naviguer sur la carte</li><li>Alertes — Configurer des notifications par zone et type</li><li>Carte live — Couches de données et filtres</li><li>Signalements — Comment contribuer et modération</li><li>Veille G7 — Tableau de bord pendant le Sommet</li><li>Mobile — Application web progressive (PWA)</li></ul>
            <div className="m-note">📩 Pour être notifié à la publication : contact@borja-swiss-solutions.ch</div>
          </div>
        </div>
      </div>

      {/* Cas d'usage */}
      <div className={`overlay${openModal === 'm-usecases' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public</span><h3>Cas d&apos;usage</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <h4>🏠 Habitant</h4><p>Vérifier les conditions avant de partir. Recevoir une alerte météo. Savoir qu&apos;une ligne de tram est perturbée avant de quitter son domicile.</p>
            <h4>🚗 Frontalier quotidien</h4><p>Connaître les temps d&apos;attente aux 8 postes frontière. Anticiper les restrictions G7. Choisir son passage selon la situation en direct.</p>
            <h4>🏥 Professionnel de santé</h4><p>Arriver à l&apos;heure malgré les perturbations. Connaître les déviations validées. Recevoir les alertes critiques avant de partir.</p>
            <h4>🚚 Entreprise logistique</h4><p>Planifier les tournées avec les restrictions G7. Adapter les livraisons selon les incidents actifs. Réduire les coûts liés aux retards.</p>
            <h4>⬡ Période G7</h4><p>Visualiser les zones rouges. Recevoir les consignes de sécurité agrégées. Comprendre les impacts sur les transports et les frontières.</p>
          </div>
        </div>
      </div>

      {/* Architecture */}
      <div className={`overlay${openModal === 'm-archi' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Public · Simplifié</span><h3>Architecture générale</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <div className="m-note">Présentation volontairement simplifiée. Documentation technique complète disponible aux professionnels sur demande.</div>
            <h4>Flux de données</h4>
            <ul><li>Sources officielles → Connecteurs d&apos;ingestion (pull toutes les 30s)</li><li>Validation et normalisation des données brutes</li><li>Corrélation croisée multi-sources pour détection d&apos;anomalies</li><li>Base de données temps réel → API interne</li><li>Frontend → WebSocket pour mise à jour sans rechargement</li><li>Système d&apos;alertes → Push notifications</li></ul>
            <h4>Principes</h4>
            <ul><li>Aucune donnée personnelle dans les flux temps réel</li><li>Sources toujours attribuées et traçables</li><li>Dégradation gracieuse si une source tombe</li><li>Hébergement exclusivement Suisse (Infomaniak)</li></ul>
          </div>
        </div>
      </div>

      {/* Vulnérabilités */}
      <div className={`overlay${openModal === 'm-vuln' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--blue-bg)', color: 'var(--blue-d)' }}>Professionnels</span><h3>Signalement des vulnérabilités</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <div className="m-note">⚠ Pour professionnels de la cybersécurité. Agir de bonne foi et dans le respect de la loi suisse.</div>
            <h4>Procédure Responsible Disclosure</h4>
            <ul><li>Identifiez et documentez la vulnérabilité (sans l&apos;exploiter)</li><li>Envoyez un rapport à security@borja-swiss-solutions.ch</li><li>Accusé de réception sous 24h ouvrées</li><li>Traitement : 30 à 90 jours selon criticité</li><li>Vous êtes informé de la résolution et crédité si souhaité</li></ul>
            <h4>Ce que nous demandons</h4>
            <ul><li>Ne pas accéder aux données d&apos;autres utilisateurs</li><li>Ne pas perturber le service en production</li><li>Ne pas divulguer publiquement avant résolution</li><li>Agir dans le cadre de la loi suisse (LPD, CP)</li></ul>
            <div className="m-row"><label>Email</label><span>security@borja-swiss-solutions.ch</span></div>
            <div className="m-row"><label>PGP</label><span>Disponible sur demande</span></div>
            <div className="m-row"><label>Bug bounty</label><span>Programme en cours de définition</span></div>
          </div>
        </div>
      </div>

      {/* Audit */}
      <div className={`overlay${openModal === 'm-audit' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--blue-bg)', color: 'var(--blue-d)' }}>Professionnels · Sur demande</span><h3>Accès audit complet</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <p>Nous invitons les professionnels qualifiés à auditer gratuitement TIF. Documentation technique approfondie et environnement sandbox inclus.</p>
            <h4>Ce qui est accessible</h4>
            <ul><li>Documentation technique complète de l&apos;architecture</li><li>Schémas de flux de données et modèles</li><li>Environnement sandbox avec données simulées</li><li>Logs d&apos;audit anonymisés</li><li>Session de travail avec l&apos;équipe technique Börja</li></ul>
            <h4>Profils concernés</h4>
            <ul><li>Experts cybersécurité et pentest</li><li>Professionnels protection des données (DPO, juristes)</li><li>Collectivités territoriales et services publics</li><li>Chercheurs académiques (EPFL, UNIGE, HEG...)</li><li>Journalistes spécialisés données publiques</li></ul>
            <input className="m-input" type="text" placeholder="Nom · Prénom" aria-label="Nom" />
            <input className="m-input" type="text" placeholder="Organisation" aria-label="Organisation" />
            <input className="m-input" type="email" placeholder="Email professionnel" aria-label="Email" />
            <textarea className="m-input m-ta" placeholder="Expertise et objectif de l'audit..." aria-label="Description" />
            <button className="m-submit">Soumettre la demande →</button>
          </div>
        </div>
      </div>

      {/* Partenariat */}
      <div className={`overlay${openModal === 'm-partner' ? ' on' : ''}`} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) closeM() }}>
        <div className="modal">
          <div className="m-head"><div><span className="m-tag" style={{ background: 'var(--blue-bg)', color: 'var(--blue-d)' }}>Professionnels · Institutionnel</span><h3>Partenariat institutionnel</h3></div><button className="m-x" onClick={closeM}>✕</button></div>
          <div className="m-body">
            <p>TIF cherche à collaborer avec les acteurs publics et institutionnels du Grand Genève pour renforcer l&apos;utilité et la crédibilité de la plateforme.</p>
            <h4>Partenariats envisagés</h4>
            <ul><li>Ville de Genève · Canton — intégration de données officielles</li><li>Services d&apos;urgence — diffusion prioritaire d&apos;alertes vérifiées</li><li>TPG · CFF — flux de données directs et partenariat officiel</li><li>Collectivités françaises — extension Ain / Haute-Savoie</li><li>CICR · ONG — tableau de bord événements humanitaires</li><li>Aéroport de Genève — intégration perturbations aéroport</li></ul>
            <input className="m-input" type="text" placeholder="Institution / Organisation" aria-label="Institution" />
            <input className="m-input" type="text" placeholder="Nom · Fonction" aria-label="Nom et fonction" />
            <input className="m-input" type="email" placeholder="Email institutionnel" aria-label="Email" />
            <textarea className="m-input m-ta" placeholder="Nature du partenariat envisagé..." aria-label="Description" />
            <button className="m-submit">Initier le partenariat →</button>
          </div>
        </div>
      </div>

    </div>
  )
}
