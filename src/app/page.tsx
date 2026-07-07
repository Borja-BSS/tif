import type { Metadata } from 'next'
import './home.css'
import { HomeContent } from '@/components/HomeContent'

export const metadata: Metadata = {
  title: 'TIF — Grand Genève en temps réel',
  description: 'Trafic, frontières, transport public et alertes en direct. Sources officielles agrégées en 30 secondes.',
}

export default function HomePage() {
  return <HomeContent />
}
