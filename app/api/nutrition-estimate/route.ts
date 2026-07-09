import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// Sonnet 5 : excellent ratio intelligence/coût, supporte la vision haute résolution.
const MODEL = 'claude-sonnet-5'

const SYSTEM = `Tu es un nutritionniste expert. À partir d'une description textuelle et/ou d'une photo d'un repas, estime au mieux ses valeurs nutritionnelles.
- Raisonne sur une portion réaliste pour un adulte sportif si la quantité n'est pas précisée.
- Sois prudent et cohérent (les macros doivent être plausibles vs les calories : ~4 kcal/g protéines et glucides, ~9 kcal/g lipides).
- Identifie les aliments visibles sur la photo. Si l'info est ambiguë, fais une estimation raisonnable et baisse ta confiance.
- Réponds en français, uniquement via l'outil fourni.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: { type: 'string', description: 'Description normalisée et concise du repas identifié (ex: "Pâtes bolognaise + salade verte")' },
    kcal: { type: 'integer', description: 'Calories totales estimées (kcal)' },
    proteines: { type: 'number', description: 'Protéines en grammes' },
    glucides: { type: 'number', description: 'Glucides en grammes' },
    lipides: { type: 'number', description: 'Lipides en grammes' },
    qualite: { type: 'integer', description: 'Qualité nutritionnelle globale sur 10 (10 = très sain et équilibré)' },
    confiance: { type: 'string', enum: ['faible', 'moyenne', 'élevée'], description: "Confiance de l'estimation" },
    commentaire: { type: 'string', description: 'Un conseil nutritionnel court et actionnable (1 à 2 phrases)' },
  },
  required: ['description', 'kcal', 'proteines', 'glucides', 'lipides', 'qualite', 'confiance', 'commentaire'],
} as const

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'Clé API manquante. Ajoute ANTHROPIC_API_KEY dans .env.local puis relance le serveur.' }, 500)
  }

  let body: { text?: string; repas?: string; image?: { media_type: string; data: string } }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requête invalide.' }, 400)
  }

  const hasText = !!body.text?.trim()
  const hasImage = !!body.image?.data
  if (!hasText && !hasImage) {
    return json({ error: 'Décris ton repas ou ajoute une photo.' }, 400)
  }

  const content: Anthropic.ContentBlockParam[] = []
  if (hasImage) {
    const mt = body.image!.media_type
    const media_type = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mt) ? mt : 'image/jpeg') as
      | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    content.push({ type: 'image', source: { type: 'base64', media_type, data: body.image!.data } })
  }
  content.push({
    type: 'text',
    text:
      `Type de repas : ${body.repas || 'non précisé'}.\n` +
      (hasText ? `Description fournie : ${body.text}\n` : '') +
      (hasImage ? 'Analyse la photo ci-dessus.' : 'Estime les valeurs nutritionnelles.'),
  })

  const client = new Anthropic()
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: SYSTEM,
      tools: [{ name: 'record_nutrition', description: 'Enregistre l’estimation nutritionnelle du repas.', input_schema: SCHEMA as any }],
      tool_choice: { type: 'tool', name: 'record_nutrition' },
      messages: [{ role: 'user', content }],
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
