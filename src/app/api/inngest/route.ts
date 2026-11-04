import { NextResponse } from 'next/server'
import { jobs } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

/** Inngest est remplacé par le planificateur interne : cette route liste simplement l'état des tâches. */
export async function GET() {
  return NextResponse.json({
    mode: 'planificateur-interne',
    actives: Array.from(jobs.enabled ?? []),
    connues: Array.from(jobs.defs.values()).map(d => ({ id: d.id, declencheurs: d.triggers, active: Boolean(jobs.enabled?.has(d.id)) })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
