// Verifie qu'une zone manuelle (greve du 20.11) s'affiche par simple ajout de donnee. N'ajoute AUCUNE zone au depot.
import { IMPACT_ZONES, getActiveImpactZones, getImpactZoneGeoJSON } from '../src/data/impact-zones.ts'
const avant = getActiveImpactZones(new Date('2026-11-20T10:00:00+01:00')).length
IMPACT_ZONES.push({ id: 'zone-essai', title: 'ESSAI', description: 'zone factice du test, jamais ecrite', type: 'TRANSPORT_DISRUPTION', severity: 'HIGH',
  coordinates: [[6.14, 46.20], [6.15, 46.20], [6.15, 46.21], [6.14, 46.21], [6.14, 46.20]], activeFrom: new Date('2026-11-20T00:00:00+01:00'), activeTo: new Date('2026-11-20T23:59:00+01:00'),
  fillColor: '#FF9F0A', fillOpacity: 0.15, strokeColor: '#FF9F0A', source: 'essai', sourceRef: 'essai' })
const actives = getActiveImpactZones(new Date('2026-11-20T10:00:00+01:00'))
const geo = getImpactZoneGeoJSON(actives)
console.log('zones actives le 20.11 a 10h avant ajout:', avant, '| apres ajout:', actives.length, '| entites GeoJSON:', geo.features.length)
console.log('le 21.11 a 10h apres ajout:', getActiveImpactZones(new Date('2026-11-21T10:00:00+01:00')).length)
