export interface DominoAlert {
  incidentGeohash:  string
  targetGeohash:    string
  estimatedMinutes: number
  confidence:       number
  message:          string
}

interface DominoInput {
  incidentGeohash:    string
  neighborGeohashes:  string[]
  neighborCapacities: Record<string, number>
  divertedFlowRatio:  number
}

const SATURATION_THRESHOLD = 0.72

export function predictDominoEffect(input: DominoInput): DominoAlert | null {
  const { incidentGeohash, neighborGeohashes, neighborCapacities, divertedFlowRatio } = input

  const target = neighborGeohashes
    .map(g => ({ geohash: g, capacity: neighborCapacities[g] ?? 0 }))
    .filter(z => z.capacity + divertedFlowRatio > SATURATION_THRESHOLD)
    .sort((a, b) => b.capacity - a.capacity)[0]

  if (!target) return null

  const slack            = SATURATION_THRESHOLD - target.capacity
  const estimatedMinutes = Math.max(5, Math.round((slack / divertedFlowRatio) * 15))

  return {
    incidentGeohash,
    targetGeohash: target.geohash,
    estimatedMinutes,
    confidence: 0.65,
    message: `⚡ Effet cascade prédit · Saturation dans ~${estimatedMinutes} min`,
  }
}
