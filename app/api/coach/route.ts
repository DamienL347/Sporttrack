import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// SDK Node.js requis (pas Edge)
export const runtime = 'nodejs'
export const maxDuration = 60

// Sonnet 5 : le meilleur ratio intelligence / effort / coût (~5× moins cher
// qu'Opus, qualité proche). Idéal pour un coach conversationnel.
const MODEL = 'claude-sonnet-5'

const SYSTEM_BASE = `Tu es "Coach", un coach personnel expert et intégré à une app de suivi (tennis, padel, course).

Tes trois domaines de spécialité, à part égale :
1. SPORT & performance — charge d'entraînement, planification, zones cardiaques, prévention des blessures.
2. SOMMEIL & récupération — qualité/durée de sommeil, dette, rythme circadien, récupération.
3. NUTRITION — apports, macros, timing autour des séances, hydratation, alimentation avant/après tournoi.

Ton rôle :
- Répondre aux questions de l'athlète et donner des conseils CONCRETS et ACTIONNABLES basés sur SES données réelles (fournies ci-dessous).
- Raisonner à partir des métriques : score de récupération, ACWR (charge aiguë/chronique), dette de sommeil, monotonie, zones cardiaques, apports nutritionnels, ressenti.
- Faire le lien entre les trois domaines (ex : un mauvais sommeil ou une nutrition insuffisante expliquent une récup basse).
- Aider au pilotage : quand pousser, quand récupérer, comment structurer la semaine, quoi manger autour des séances.

Style :
- Français, tutoiement, ton motivant mais direct et honnête.
- Réponses courtes et structurées (puces quand utile). Va droit au but, cite les chiffres pertinents des données.
- Quand tu recommandes quelque chose, explique brièvement le "pourquoi" (le mécanisme).

Photos : l'athlète peut t'envoyer des images (écran de montre/app, position ou geste technique, terrain, matériel, courbatures visibles...). Décris ce que tu y vois d'utile et intègre-le à ton analyse.

Garde-fous :
- Tu n'es pas médecin ni diététicien clinique. Pour toute douleur persistante, blessure, trouble alimentaire ou symptôme inquiétant, recommande de consulter un professionnel de santé — ne pose jamais de diagnostic médical.
- Les valeurs nutritionnelles sont des estimations : reste dans l'ordre de grandeur, ne prétends pas à une précision au gramme.
- Si une donnée manque pour répondre précisément, dis-le et suggère quoi logger.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          'Clé API manquante. Ajoute ANTHROPIC_API_KEY dans .env.local puis relance le serveur.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
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

  const raw = (body.messages || []).filter(
    (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  )
  if (raw.length === 0) {
    return new Response(JSON.stringify({ error: 'Aucun message.' }), { status: 400 })
  }

  const messages: Anthropic.MessageParam[] = raw.map((m) => {
    if (m.role === 'user' && m.image?.data) {
      const mt = m.image.media_type
      const media_type = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mt) ? mt : 'image/jpeg') as
        | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: m.image.data } },
          { type: 'text', text: m.content || 'Analyse cette photo.' },
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
        const msg = e?.message || 'Erreur inconnue'
        controller.enqueue(encoder.encode(`\n\n⚠️ Erreur : ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
