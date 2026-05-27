// Vehicle positions are no longer rendered on the map.
// The transport layer now shows the static UNIRESO network (see src/lib/transit/network.ts).
// This file is kept to avoid breaking the transport API route signature.

import type { VehicleSplit } from './types'
import type { FeatureCollection } from 'geojson'

function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

export async function getVehiclePositions(): Promise<VehicleSplit> {
  return { tpg: emptyFC(), cff: emptyFC(), generatedAt: new Date().toISOString() }
}
