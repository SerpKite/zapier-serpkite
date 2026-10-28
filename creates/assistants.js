'use strict';

const { post, get, list, bool, idempotencyKey } = require('../lib/api');
const f = require('../lib/fields');

// Answer times from https://serpkite.com/docs/ai-assistants. Brave answers well inside
// Zapier's 30-second action limit, so it is asked inline. The others can take longer:
// they run as a one-request batch whose webhook is Zapier's callback URL, and the Zap
// continues when the answer is posted (perform → performResume).
const ASSISTANTS = [
  { id: 'chatgpt', name: 'ChatGPT', label: 'Ask ChatGPT', took: '10–30 seconds', tail: 'with the sources it cited and the products and places it showed', chatgpt: true },
  { id: 'gemini', name: 'Gemini', label: 'Ask Gemini', took: '5–30 seconds', tail: 'with the sources it grounded on' },
  { id: 'copilot', name: 'Copilot Search', label: 'Ask Copilot Search', took: '15–40 seconds', tail: 'with its cited sources and the products shown beside it' },
  { id: 'ai_mode', name: 'Google AI Mode', label: 'Ask Google AI Mode', took: '5–45 seconds', tail: 'with the sources it cited' },
  { id: 'brave_ai', name: "Brave Search's AI answer", label: 'Ask Brave AI', took: '1–10 seconds', tail: 'with its cited sources and the searches it ran', inline: true },
];

const SAMPLE = {
  request: { endpoint: 'chatgpt', prompt: 'What are the best CRMs for a 10-person startup?' },
  text: 'For a 10-person startup, HubSpot CRM and Pipedrive are the most common picks.',
  markdown: 'For a 10-person startup, **HubSpot CRM** and **Pipedrive** are the most common picks [1](https://www.example.com/crm-guide).',
  sources: [{ position: 1, title: 'The best CRMs for startups', link: 'https://www.example.com/crm-guide', domain: 'example.com', cited: true }],
  search_queries: ['best crm for small startup'],
  products: [],
  mentions: [{ term: 'Pipedrive', mentioned: true, cited: false }],
  meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 2 },
};

const body = (a, d) => ({
  prompt: d.prompt,
  country: d.country,
  language: a.chatgpt ? undefined : d.language,
  web_search: a.chatgpt ? bool(d.web_search) : undefined,
  track: list(d.track),
});

const fields = (a) => [
  f.prompt(a.name),
  { ...f.country, helpText: a.chatgpt ? 'Ask from this country (two-letter code, such as `gb`), so the answer is localized like a visitor’s there.' : f.country.helpText },
  ...(a.chatgpt
    ? [{ key: 'web_search', label: 'Search the Web', type: 'boolean', default: 'true', helpText: 'Let ChatGPT search the web before answering, as it does by default.' }]
    : [f.language]),
  f.track,
];

// A late answer (503 upstream_timeout) is finished in the background; asking again
// with the same prompt within 10 minutes returns it, which Zapier's autoreplay does.
const make = (a) => ({
  key: `ask_${a.id}`,
  noun: 'Answer',
  display: {
    label: a.label,
    description: `Asks ${a.name} as a logged-out visitor and returns its answer ${a.tail}. Takes ${a.took}.`,
  },
  operation: {
    inputFields: fields(a),
    perform: async (z, bundle) => {
      const request = body(a, bundle.inputData);
      if (a.inline || (bundle.meta && bundle.meta.isLoadingSample)) {
        return post(z, `/v1/${a.id}`, request, { timeout: 45000 });
      }
      const callbackUrl = z.generateCallbackUrl();
      const res = await post(
        z,
        '/v1/batches',
        { endpoint: a.id, requests: [request], webhook_url: callbackUrl },
        { headers: { 'Idempotency-Key': idempotencyKey(callbackUrl) } },
      );
      const job = res.batches[0];
      if (job.error) {
        throw new z.errors.Error(job.error.message, job.error.code, 400);
      }
      return { batch_id: job.id, status: job.status };
    },
    performResume: async (z, bundle) => {
      // The callback is only a signal: read the job back with the user's key.
      const job = await get(z, `/v1/batches/${bundle.outputData.batch_id}`);
      if (job.status !== 'done' || !job.result) {
        const e = job.error || {};
        throw new z.errors.Error(e.message || `${a.name} did not answer.`, e.code || 'batch_failed', 400);
      }
      return job.result;
    },
    sample: { ...SAMPLE, request: { ...SAMPLE.request, endpoint: a.id } },
  },
});

module.exports = ASSISTANTS.map(make);
