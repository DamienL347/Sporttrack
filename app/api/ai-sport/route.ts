import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// Sonnet 5 : excellent ratio intelligence/coût.
const MODEL = 'claude-sonnet-5'

const SYSTEM = `Tu es un coach sportif expert en physiologie de l'effort. À partir du sport pratiqué, de sa durée et d'un ressenti décrit en texte libre (sans montre cardio ni tracker), estime au mieux la dépense énergétique et l'intensité de la séance.
- Raisonne sur un adulte sportif de corpulence moyenne si aucune info physique n'est fournie.
- Base-toi sur des dépenses caloriques réalistes par sport et par heure (ex : tennis/padel ~500-650 kcal/h, course à pied ~700-900 kcal/h selon l'allure, musculation ~350-450 kcal/h, vélo ~450-700 kcal/h).
- Reste prudent et cohérent : si le ressenti décrit une séance intense, penche vers le haut de la fourchette plausible.
- Réponds en français, uniquement via l'outil fourni.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kcal: { type: 'integer', description: 'Calories totales estimées pour la séance (kcal)' },
    fc_moyenne: { type: 'integer', description: 'Fréquence cardiaque moyenne estimée (BPM)' },
    zone_cardiaque: {
      type: 'string',
      enum: ['Zone 1 — Récupération', 'Zone 2 — Lipides ✅', 'Zone 3 — Mixte', 'Zone 4 — Trop élevé ⚠️'],
      description: 'Zone cardiaque probable correspondant à la FC moyenne estimée',
    },
    confiance: { type: 'string', enum: ['faible', 'moyenne', 'élevée'], description: "Confiance de l'estimation" },
    conseil: { type: 'string', description: 'Un conseil de récupération ou de charge court et actionnable (1 à 2 phrases)' },
  },
  required: ['kcal', 'fc_moyenne', 'zone_cardiaque', 'confiance', 'conseil'],
} as const

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'Clé API manquante. Ajoute ANTHROPIC_API_KEY dans .env.local puis relance le serveur.' }, 500)
  }

  let body: { sport?: string; duree?: string; note?: string; date?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requête invalide.' }, 400)
  }

  if (!body.sport?.trim() || !body.duree?.trim()) {
    return json({ error: 'Précise au moins le sport et la durée.' }, 400)
  }

  const prompt =
    `Séance sans montre :\n` +
    `- Sport : ${body.sport}\n` +
    `- Durée : ${body.duree}\n` +
    (body.date ? `- Date : ${body.date}\n` : '') +
    `- Ressenti : ${body.note?.trim() || 'non précisé'}\n\n` +
    `Estime la dépense énergétique et l'intensité de cette séance.`

  const client = new Anthropic()
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      thinking: { type: 'disabled' },
      system: SYSTEM,
      tools: [{ name: 'record_estimate', description: 'Enregistre l’estimation de la séance.', input_schema: SCHEMA as any }],
      tool_choice: { type: 'tool', name: 'record_estimate' },
      messages: [{ role: 'user', content: prompt }],
    })
    const toolBlock = msg.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) return json({ error: 'Estimation impossible, réessaie.' }, 502)
    return json(toolBlock.input, 200)
  } catch (e: any) {
    return json({ error: e?.message || 'Erreur lors de l’estimation.' }, 500)
  }
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}
