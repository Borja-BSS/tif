'use client'

import dynamic from 'next/dynamic'

// Dynamic import côté client uniquement — mapboxgl nécessite window
const TerritorialMap = dynamic(
  () => import('./TerritorialMap').then(m => ({ default: m.TerritorialMap })),
  { ssr: false },
)

export default function TerritorialMapLoader() {
  return <TerritorialMap />
}
