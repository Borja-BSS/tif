import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [directives, sources, alerts] = await Promise.all([
    db.g7Directive.findMany({
      orderBy: { publishedAt: 'desc' },
    }),
    db.g7Source.findMany({
      where:   { active: true },
      orderBy: { lastChecked: 'desc' },
      select: {
        id: true, label: true, url: true, category: true,
        lastChecked: true, lastStatus: true, lastHash: true,
      },
    }),
    db.g7WatchAlert.findMany({
      orderBy: { detectedAt: 'desc' },
      take:    20,
      include: { source: { select: { label: true, url: true } } },
    }),
  ])

  return NextResponse.json({ directives, sources, alerts })
}
