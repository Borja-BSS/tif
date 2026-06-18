import type { Metadata } from 'next'
import './home.css'
import { HomeContent } from '@/components/HomeContent'

export const metadata: Metadata = {
  title: 'TIF — Événements & Mobilité Grand Genève',
  description: 'Agenda événementiel, trafic, frontières et transport public en temps réel. Sources officielles agrégées en 30 secondes.',
}

export default function HomePage() {
  return <HomeContent />
}
