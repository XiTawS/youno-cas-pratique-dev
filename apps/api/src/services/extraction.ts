import type { ScrapedPage } from '@youno/shared/schemas/analyze';
import { SignalsSchema, type Signals } from '@youno/shared/schemas/signals';
import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { env } from '../lib/env.js';

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
Un commercial reçoit une URL et doit qualifier rapidement le prospect.

Tu dois extraire des signaux factuels depuis le contenu fourni (markdown de 3-5 pages du site + tech stack détectée) et générer une recommandation actionnable.

RÈGLES STRICTES :

- N'INVENTE JAMAIS. Si une info n'est pas explicitement dans le contenu, mets null pour les strings, [] pour les arrays, false pour les booléens. Pour les enums, choisis la valeur la plus prudente.
- Recopie tel quel le tableau techStack qu'on te fournit dans la section "Tech stack". Ne le modifie pas.
- Pour la recommandation : 2-3 phrases en français, actionnables pour un commercial qui prospecterait cette boîte. Indique l'approche commerciale recommandée (démo, free trial, contact direct) et un angle d'accroche concret basé sur les signaux les plus saillants (hiring sales, blog actif récent, segment enterprise, etc.). Pas de blabla générique.
- description : 1-2 phrases en français qui résument ce que fait la boîte. Pas de marketing copy.
- Tous les libellés visibles côté front sont en français, mais les enums (PLG, Sales-led, SMB, Enterprise...) restent en anglais (standards GTM).

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
const toolParameters = zodToJsonSchema(SignalsSchema, {
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

Tech stack détectée par Wappalyzer (${techStack.length} technos) - à recopier tel quel dans le champ techStack :
${techStack.length > 0 ? techStack.map((t) => `- ${t}`).join('\n') : '(aucune)'}

Contenu scrappé des pages (${pages.length} pages):

${pagesBlock}`;
}

interface ExtractInput {
  url: string;
  pages: ScrapedPage[];
  techStack: string[];
}

// Sanitize défensive : Sonnet 4.5 peut dépasser les .max() malgré le tool schema.
// On tronque AVANT le safeParse pour éviter de planter sur des dépassements bénins.
function sanitizeBeforeParse(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.recommendation === 'string' && obj.recommendation.length > 2000) {
    obj.recommendation = obj.recommendation.slice(0, 2000);
  }

  const truncate = (path: string[], max: number): void => {
    let cursor: Record<string, unknown> | undefined = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (key === undefined || cursor === undefined) return;
      const next = cursor[key];
      if (!next || typeof next !== 'object') return;
      cursor = next as Record<string, unknown>;
    }
    const lastKey = path[path.length - 1];
    if (cursor && lastKey !== undefined && Array.isArray(cursor[lastKey])) {
      cursor[lastKey] = (cursor[lastKey] as unknown[]).slice(0, max);
    }
  };
  truncate(['icp', 'targetRoles'], 5);
  truncate(['icp', 'verticals'], 5);

  return obj;
}

// Extraction one-shot avec tool use forcé. Validation Zod redondante en post-pro
// même si le tool schema force déjà la conformité (belt + suspenders).
export async function extractSignals({ url, pages, techStack }: ExtractInput): Promise<Signals> {
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
              'Retourne les signaux extraits depuis le contenu du site (entreprise, sales motion, maturité commerciale, ICP, recommandation actionnable).',
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

  parsed = sanitizeBeforeParse(parsed);

  const result = SignalsSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExtractionError(
      `Sortie LLM non conforme à SignalsSchema: ${JSON.stringify(result.error.flatten().fieldErrors)}`,
    );
  }

  return result.data;
}
