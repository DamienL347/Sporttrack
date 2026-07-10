import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-sonnet-5'

const SYSTEM_BASE = `Tu es "Chef", un chef nutritionniste personnel intégré à une app de suivi sportif.

Ta mission : à partir des aliments dont dispose l'athlète (liste texte OU photo de son frigo/placard) et de SES données/objectifs (ci-dessous), propose des repas CONCRETS qui le rapprochent le plus vite possible de ses objectifs.

Règles :
- Utilise EN PRIORITÉ les aliments réellement disponibles (identifie-les sur la photo si fournie).
- Aligne les repas sur l'objectif : cible calorique/protéines, poids visé, et le contexte sportif du jour (ex : post-match → glucides + protéines pour la récup ; jour de repos → plus léger).
- Respecte STRICTEMENT les préférences et restrictions alimentaires du profil.
- Pour chaque idée de repas, donne : le nom, les ingrédients utilisés (parmi les dispo), les macros approximatives (kcal / protéines / glucides / lipides), le temps de prépa, et une phrase sur POURQUOI ça sert l'objectif.
- Propose 2 à 3 idées, de la plus simple à la plus complète.
- Si un aliment clé manque pour équilibrer (souvent une source de protéines ou des légumes), suggère 1-2 ajouts simples à acheter.

Style : français, tutoiement, concret et sans blabla. Va droit aux repas.

Garde-fous : tu n'es pas diététicien clinique ; les macros sont des estimations. Pour un régime médical ou une pathologie, renvoie vers un professionnel.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'Clé API manquante. Ajoute ANTHROPIC_API_KEY dans .env.local puis relance le serveur.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  let body: {
    messages?: { role: 'user' | 'assistant'; content: string; image?: { media_type: string; data: string } }[]
    context?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Requête invalide.' }), { status: 400 })
  }

  const raw = (body.messages || []).filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
  if (raw.length === 0) return new Response(JSON.stringify({ error: 'Aucun message.' }), { status: 400 })

  const messages: Anthropic.MessageParam[] = raw.map((m) => {
    if (m.role === 'user' && m.image?.data) {
      const mt = m.image.media_type
      const media_type = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mt) ? mt : 'image/jpeg') as
        | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: m.image.data } },
          { type: 'text', text: m.content || 'Voici les aliments dont je dispose (photo). Propose-moi des repas.' },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })

  const system = SYSTEM_BASE + '\n\n=== DONNÉES DE L’ATHLÈTE ===\n' + (body.context || '(aucune donnée)')

  const client = new Anthropic()
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = client.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          system,
          messages,
        })
        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (e: any) {
        controller.enqueue(encoder.encode(`\n\n⚠️ Erreur : ${e?.message || 'inconnue'}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } })
}
