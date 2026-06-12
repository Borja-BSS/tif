import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Tu es l'assistant mobilité de TIF (Traffic Info G7), l'application de mobilité Grand Genève de Börja Swiss Solutions pendant le sommet du G7 2026.

Tu aides les habitants du Grand Genève à naviguer dans la région pendant la période du G7.

## Contexte G7 2026
- Sommet G7 à Évian-les-Bains : 15–17 juin 2026
- Contrôles frontaliers rétablis : 10–19 juin 2026
- 25 passages frontaliers fermés — 7 seulement ouverts (12–18 juin) :
  Anières, Moillesulaz, Thônex-Vallard, Bardonnex, Perly, Meyrin, Ferney-Voltaire
  + Gares de Cornavin et d'Annemasse, Aéroport de Genève
- Pièce d'identité obligatoire à tous les passages ouverts

## Perturbations majeures
- TPG : lignes 64/69 suspendues, 38/40/52/82/83 limitées côté suisse, ligne 29 supprimée 12–14 juin, tpgFlex coupé en France. Horaire vacances 15–17 juin sur tout le réseau.
- Autoroute A1 fermée vers Bardonnex (15–17 juin). Depuis Vaud : sortie forcée Meyrin/Vernier/Genève-Centre.
- Restriction espace aérien région lémanique (Évian–Lausanne–Aéroport GE) : 10–18 juin.
- 14 juin : manifestation No-G7 rive droite (~10 000 personnes), pont du Mont-Blanc interdit. Sortie autoroute Vengeron/Genève-Lac fermée dès 6h. Léman Express coupé Annemasse–Genève 08h–00h. Votations fédérales.

## Événements culturels Geneva 2026 (34 événements)
Festivals, concerts, théâtre, comédie, nightlife dans Genève et Carouge. Lieux principaux : Victoria Hall, BFM, Alhambra, L'Usine, Palexpo, Arena de Genève, Halles de l'Île, Théâtre Alchimic (Carouge).

## Carte TIF
La carte interactive affiche : trafic temps réel (Mapbox), alertes G7, état des 47 douanes, perturbations TPG/CFF, événements culturels (pins violets), travaux (Overpass), itinéraires voiture + transports.

## Règles de réponse
- Réponds toujours en français (ou dans la langue de l'utilisateur)
- Sois concis et pratique — les utilisateurs consultent depuis leur téléphone
- Pour les itinéraires : recommande les douanes ouvertes et alternatives TPG
- Si tu n'es pas sûr d'une information précise, dis-le clairement
- Ne fournis pas d'informations sur des sujets sans rapport avec la mobilité, le G7 ou la région`

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: { role: string; content: string }[] }
  const { messages } = body

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 })
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: 'claude-fable-5',
          max_tokens: 1024,
          system: SYSTEM,
          messages: messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            )
          }
        }

        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: "Je ne peux pas répondre à cette question." })}\n\n`)
          )
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inattendue'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
