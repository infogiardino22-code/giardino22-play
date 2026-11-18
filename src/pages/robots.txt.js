import { url } from '../lib/catalogo.js';

// Tutti i motori possono leggere Play, compresi quelli che alimentano le risposte AI
// (ChatGPT, Claude, Perplexity, Gemini, Copilot, Apple Intelligence): vogliamo essere citati.
const AI = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
  'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'Bingbot', 'CCBot', 'Meta-ExternalAgent', 'DuckAssistBot'];

export function GET({ site }) {
  const abs = (p) => new URL(url(p), site).href;
  const testo = [
    'User-agent: *', 'Allow: /', '',
    ...AI.flatMap(b => [`User-agent: ${b}`, 'Allow: /', '']),
    `Sitemap: ${abs('sitemap.xml')}`,
    `# Riassunto per i modelli AI: ${abs('llms.txt')}`, '',
  ].join('\n');
  return new Response(testo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
