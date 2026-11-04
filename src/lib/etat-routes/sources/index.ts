import type { SourceEtat } from '../types'
import { sourceTomTom } from './tomtom'
import { sourceHere } from './here'
import { sourceSitgTrafic } from './sitg-trafic'

/**
 * Registre des sources, interchangeables. Une source absente de la variable TIF_TRAFFIC_SOURCE ou sans clé est inactive.
 * Écartées après lecture des conditions officielles (04.11.2026, voir fiche d'avancement) : Waze (CGU : accès
 * automatisé et usage commercial interdits), Mapbox Traffic en lecture serveur (licence Traffic Data payante).
 */
export const SOURCES: SourceEtat[] = [sourceTomTom, sourceHere, sourceSitgTrafic]
export const sourcesActives = () => SOURCES.filter(s => s.active())
