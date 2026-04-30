import type { AnalyzeResponse } from '@youno/shared/schemas/analyze';
import type { AnalysisStatus } from '@youno/shared/schemas/signals';

// Mapping enum statut → libellé FR pour les exports.
const STATUS_LABEL: Record<AnalysisStatus, string> = {
  too_early: 'Trop tôt',
  to_watch: 'À surveiller',
  good_timing: 'Bon timing',
  mature: 'Prospect mature',
};

const SALES_MOTION_CTA: Record<string, string> = {
  signup: 'Inscription directe',
  demo: 'Demande de démo',
  contact_sales: 'Contacter un commercial',
  mixed: 'CTA mixte',
};

// Génère un export Markdown lisible de l'analyse.
// Format pensé pour partage Slack/email : titres, sections, tableaux compacts.
export function analysisToMarkdown(data: AnalyzeResponse): string {
  const { signals } = data;
  const date = new Date(data.scrapedAt).toLocaleString('fr-FR');

  const lines: string[] = [];

  // En-tête boîte
  lines.push(`# ${signals.company.name}`, '');
  lines.push(`> ${signals.company.description}`, '');

  if (signals.company.sector) {
    lines.push(`- **Secteur** : ${signals.company.sector}`);
  }
  if (signals.company.approximateSize !== 'unknown') {
    lines.push(`- **Taille** : ${signals.company.approximateSize} employés`);
  }
  lines.push(`- **Segment** : ${signals.icp.segment}`);
  if (signals.icp.geography) {
    lines.push(`- **Géographie** : ${signals.icp.geography}`);
  }
  lines.push(`- **URL analysée** : ${data.url}`);
  lines.push(`- **Date d'analyse** : ${date}`);
  lines.push(`- **Statut** : ${STATUS_LABEL[data.status]}`, '');

  // Recommandation
  lines.push('## Recommandation', '');
  lines.push(data.recommendation, '');

  // Comment ils vendent
  lines.push('## Comment ils vendent', '');
  lines.push(`- **Modèle commercial** : ${signals.salesMotion.model}`);
  lines.push(`- **Pricing public** : ${signals.salesMotion.pricingPublic ? 'oui' : 'non'}`);
  lines.push(`- **Free trial / freemium** : ${signals.salesMotion.freeTrial ? 'oui' : 'non'}`);
  lines.push(
    `- **CTA principal** : ${SALES_MOTION_CTA[signals.salesMotion.primaryCta] ?? signals.salesMotion.primaryCta}`,
    '',
  );

  // Maturité commerciale
  lines.push('## Maturité commerciale', '');
  const m = signals.maturity;
  lines.push(`- **Page clients dédiée** : ${m.customersPage ? 'oui' : 'non'}`);
  if (m.clientLogosCount !== null) {
    lines.push(`- **Logos clients** : ${m.clientLogosCount}`);
  }
  lines.push(`- **Blog actif récent** : ${m.blogActive ? 'oui' : 'non'}`);
  if (m.blogLastPostHint) {
    lines.push(`- **Dernier post** : ${m.blogLastPostHint}`);
  }
  lines.push(`- **Recrutement sales / marketing** : ${m.salesMarketingHiring ? 'oui' : 'non'}`, '');

  // Cible visée
  lines.push('## Cible visée', '');
  lines.push(`- **Segment** : ${signals.icp.segment}`);
  if (signals.icp.targetRoles.length > 0) {
    lines.push(`- **Rôles ciblés** : ${signals.icp.targetRoles.join(', ')}`);
  }
  if (signals.icp.verticals.length > 0) {
    lines.push(`- **Verticales** : ${signals.icp.verticals.join(', ')}`);
  }
  if (signals.icp.geography) {
    lines.push(`- **Géographie** : ${signals.icp.geography}`);
  }
  lines.push('');

  // Stack technique
  if (signals.techStack.length > 0) {
    lines.push('## Stack technique', '');
    lines.push(signals.techStack.map((t) => `- ${t}`).join('\n'), '');
  }

  lines.push('---', '_Analyse générée par Konsole · Cas pratique Youno_', '');

  return lines.join('\n');
}

// Déclenche un téléchargement de fichier dans le navigateur.
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Slug filesystem-safe à partir du domaine + date.
function buildFilename(domain: string, ext: string): string {
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '_');
  const date = new Date().toISOString().slice(0, 10);
  return `konsole-${safeDomain}-${date}.${ext}`;
}

export function exportAsMarkdown(data: AnalyzeResponse): void {
  const md = analysisToMarkdown(data);
  triggerDownload(md, buildFilename(data.domain, 'md'), 'text/markdown;charset=utf-8');
}

// PDF : on s'appuie sur l'impression native du navigateur. La feuille de style
// @media print dans index.css cache la sidebar et formate l'analyse pour A4.
// L'utilisateur peut choisir "Enregistrer au format PDF" dans la modale d'impression.
export function exportAsPdf(): void {
  window.print();
}
