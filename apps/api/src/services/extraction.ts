import { gtmSignalsSchema, type GtmSignals } from '@youno/shared/schemas/signals';
import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { env } from '../lib/env.js';
import type { ScrapedPage } from '@youno/shared/schemas/analyze';

// OpenRouter endpoint - API OpenAI-compatible (voir ADR-009).
// Headers HTTP-Referer et X-Title sont des conventions OpenRouter pour le
// classement public des apps qui utilisent leur API. Pas critique mais propre.
const client = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/XiTawS/youno-cas-pratique-dev',
    'X-Title': 'Youno cas pratique - Konsole',
  },
});

const TOOL_NAME = 'extract_company_signals';

const SYSTEM_PROMPT = `Tu es un analyste GTM pour Konsole, un SaaS de Revenue Engineering. \
Un SDR (Sales Development Rep) reçoit une URL et doit qualifier rapidement le prospect sur 3 axes :
1. Comment ils vendent (sales motion : self-serve / sales-led / hybride)
2. Sont-ils en croissance / en train d'acheter (signaux growth)
3. Est-ce un ICP qui correspond à mon offre

Tu dois extraire ces 3 axes depuis le contenu fourni (markdown de 3-5 pages du site + tech stack détectée).

RÈGLES STRICTES :
- N'INVENTE JAMAIS. Si une info n'est pas explicitement dans le contenu, mets null pour les strings, [] pour les arrays, false pour les booléens, 'unknown' pour les enums quand cette valeur existe.
- Pour 'evidence' (sales motion), cite TEXTUELLEMENT un passage du markdown (max 200 chars). Pas de paraphrase.
- 'notesForSdr' : 1-3 phrases concrètes et actionnables pour le SDR (ex. "Hiring 5 SDRs en EMEA, signal d'expansion fort").
- Si le contenu est trop maigre pour conclure (markdown tronqué, site bloqué), mets extractionConfidence='low' et notesForSdr explicite la limite.

Tu DOIS appeler l'outil ${TOOL_NAME} une et une seule fois avec ta réponse structurée.`;

export class ExtractionError extends Error {
  override name = 'ExtractionError';
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Convertit le schema Zod en JSON Schema pour le tool input.
// Calculé une fois au boot, pas à chaque appel.
const toolParameters = zodToJsonSchema(gtmSignalsSchema, {
  $refStrategy: 'none', // OpenRouter accepte mieux du JSON Schema flat sans $refs
  target: 'openApi3',
});

// Construit le user message en concaténant le markdown des pages + tech stack.
// On tronque chaque page à ~3000 chars pour rester sous ~15k input tokens total.
function buildUserContent(url: string, pages: ScrapedPage[], techStack: string[]): string {
  const pagesBlock = pages
    .map((p, i) => {
      const md =
        p.markdown.length > 3000 ? p.markdown.slice(0, 3000) + '\n[...tronqué]' : p.markdown;
      return `### Page ${i + 1}: ${p.url}\nTitre: ${p.title ?? '(sans titre)'}\n\n${md}`;
    })
    .join('\n\n---\n\n');

  return `URL analysée: ${url}

Tech stack détectée par Wappalyzer (${techStack.length} technos):
${techStack.length > 0 ? techStack.map((t) => `- ${t}`).join('\n') : '(aucune)'}

Contenu scrappé des pages (${pages.length} pages):

${pagesBlock}`;
}

interface ExtractInput {
  url: string;
  pages: ScrapedPage[];
  techStack: string[];
}

// Extraction one-shot avec tool use forcé. Validation Zod redondante en post-pro
// même si le tool schema force déjà la conformité (belt + suspenders).
export async function extractSignals({ url, pages, techStack }: ExtractInput): Promise<GtmSignals> {
  let response;
  try {
    response = await client.chat.completions.create({
      model: env.LLM_MODEL,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserContent(url, pages, techStack) },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: TOOL_NAME,
            description:
              'Retourne les signaux GTM extraits depuis le contenu du site (3 axes : sales motion, growth, ICP fit).',
            parameters: toolParameters as Record<string, unknown>,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: TOOL_NAME } },
    });
  } catch (err) {
    throw new ExtractionError(`Appel OpenRouter échoué: ${(err as Error).message}`);
  }

  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];

  if (!toolCall || toolCall.type !== 'function' || toolCall.function.name !== TOOL_NAME) {
    throw new ExtractionError(
      `Le LLM n'a pas appelé l'outil ${TOOL_NAME} (stop_reason=${response.choices[0]?.finish_reason ?? 'unknown'})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new ExtractionError(
      `JSON arguments du tool call invalide: ${toolCall.function.arguments.slice(0, 200)}`,
    );
  }

  // Validation Zod redondante - si le LLM a baroqué le schema malgré le tool use,
  // on échoue ici plutôt que d'écrire de la merde en DB.
  const result = gtmSignalsSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExtractionError(
      `Sortie LLM non conforme à gtmSignalsSchema: ${JSON.stringify(result.error.flatten().fieldErrors)}`,
    );
  }

  return result.data;
}
