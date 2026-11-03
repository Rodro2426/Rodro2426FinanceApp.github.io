// Pockets server: forwards assistant requests to Claude (keeping the API key
// off the device) and, in production, serves the built app from dist/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, TOOLS, systemPrompt, type AssistantContext } from '../shared/assistant';

const PORT = Number(process.env.PORT || 8787);
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const MAX_BODY = 2_000_000;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const str = (v: unknown, max = 200) => String(v ?? '').slice(0, max);

async function chat(req: http.IncomingMessage, res: http.ServerResponse) {
  let body: { messages?: unknown; context?: Partial<AssistantContext> };
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'Invalid request' }); }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 80) return send(res, 400, { error: 'Invalid messages' });
  const c = body.context || {};
  const context: AssistantContext = { name: str(c.name, 60) || 'there', today: str(c.today), week: str(c.week), currency: str(c.currency, 80) };

  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: 'no_key' });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(context),
      tools: TOOLS,
      messages: messages as Anthropic.Beta.BetaMessageParam[],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    });
    send(res, 200, { content: response.content, stop_reason: response.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) { console.error('Anthropic API key missing or invalid'); return send(res, 502, { error: 'auth' }); }
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'rate_limited' });
    if (err instanceof Anthropic.BadRequestError) { console.error('Bad request to Claude:', err.message); return send(res, 400, { error: 'bad_request' }); }
    if (err instanceof Anthropic.APIError) { console.error(`Claude API error ${err.status}:`, err.message); return send(res, 502, { error: 'upstream' }); }
    console.error(err);
    send(res, 500, { error: 'server' });
  }
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', 'http://x');
  let file = path.join(DIST, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Run "npm run build" first.'); }
  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

// Set ALLOWED_ORIGIN (e.g. https://you.github.io) when the app is hosted elsewhere, like GitHub Pages.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

http.createServer((req, res) => {
  if (ALLOWED_ORIGIN && req.headers.origin === ALLOWED_ORIGIN) {
    res.setHeader('access-control-allow-origin', ALLOWED_ORIGIN);
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    res.setHeader('vary', 'origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && req.url === '/api/chat') { chat(req, res); return; }
  if (req.url?.startsWith('/api/')) return send(res, 404, { error: 'not found' });
  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Pockets server on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('ANTHROPIC_API_KEY is not set: the Assistant tab will not be able to answer.');
});
