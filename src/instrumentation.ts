export async function register() {
  // Planificateur interne : processus Node seulement (pas l'edge runtime), et pas pendant le build.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.TIF_JOBS === 'none') return
  await import('@/inngest/registry')
  const { startScheduler } = await import('@/lib/scheduler')
  startScheduler()
}
