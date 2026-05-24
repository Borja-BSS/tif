import pino from 'pino'

const isDev  = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'
const isProd = process.env.NODE_ENV === 'production'

function buildTransport() {
  if (isTest) return undefined

  if (isDev) {
    return {
      target:  'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    }
  }

  // Production : ship vers Axiom si token configuré
  if (isProd && process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
    return {
      target: 'pino/file',  // stdout — collecté par Vercel puis envoyé via drain
      options: { destination: 1 },
    }
  }

  return undefined
}

export const logger = pino({
  level: isTest ? 'silent' : isDev ? 'debug' : 'info',
  base: {
    app:     'tif',
    version: process.env.npm_package_version ?? '0',
    env:     process.env.NODE_ENV,
  },
  transport: buildTransport(),
})

/** Logger enfant avec contexte de requête (requestId, route, method) */
export function requestLogger(requestId: string, route: string, method: string) {
  return logger.child({ requestId, route, method })
}

/** Logger enfant pour les jobs Inngest */
export function jobLogger(jobId: string, jobName: string) {
  return logger.child({ jobId, jobName })
}
