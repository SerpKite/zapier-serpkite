'use strict';

const { PRICING, post, get, list, int, bool, idempotencyKey } = require('../lib/api');
const f = require('../lib/fields');

const META = { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 };

const getPlace = {
  key: 'get_place',
  noun: 'Place',
  display: {
    label: 'Get Google Maps Place Details',
    description: "Returns one place's full listing: address, coordinates, categories, opening hours per weekday, website, phone, rating, description and photos.",
  },
  operation: {
    inputFields: [
      { key: 'place_id', label: 'Place ID', required: true, helpText: 'Google place ID (`ChIJ…`) from a **Search Google Maps** result.' },
      f.country,
      f.language,
    ],
    perform: async (z, bundle) => {
      const data = await post(z, '/v1/place', bundle.inputData);
      // One place: put its fields at the top level so later steps can map them directly.
      return { ...((data.results && data.results[0]) || {}), meta: data.meta };
    },
    sample: { title: 'Example Coffee Roasters', address: '123 Main St, Austin, TX 78701', rating: 4.7, phone_number: '(512) 555-0100', opening_hours: { Monday: '7 am–6 pm' }, place_id: 'ChIJexample0000', meta: META },
  },
};

const fetchWebpage = {
  key: 'fetch_webpage',
  noun: 'Webpage',
  display: {
    label: 'Fetch Webpage',
    description: 'Returns a public web page or PDF as clean Markdown and plain text, with its title, description, author and dates.',
  },
  operation: {
    inputFields: [
      { key: 'url', label: 'URL', required: true, helpText: 'A public HTML page or PDF.' },
      { key: 'include_links', label: 'Include Links', type: 'boolean', default: 'false' },
      { key: 'country', label: 'Country', helpText: 'Fetch the page as seen from this country (two-letter code), for pages that differ by location.' },
    ],
    perform: (z, bundle) => post(z, '/v1/webpage', { ...bundle.inputData, include_links: bool(bundle.inputData.include_links) }),
    sample: { url: 'https://www.example.com/blog/kites', status_code: 200, markdown: '# A short history of kites\n\nKites were first flown in China.', text: 'A short history of kites', metadata: { title: 'A short history of kites', language: 'en' }, meta: META },
  },
};

const extractWebpages = {
  key: 'extract_webpages',
  noun: 'Pages',
  display: {
    label: 'Extract Webpages',
    description: 'Reads up to 20 pages or PDFs as Markdown, with passages ranked by a query and an optional AI summary per page.',
  },
  operation: {
    inputFields: [
      { key: 'urls', label: 'URLs', list: true, required: true, helpText: 'Up to 20 public pages or PDFs.' },
      { key: 'query', label: 'Query', helpText: "Rank each page's passages by this phrase and return the best as highlights." },
      { key: 'summary', label: 'Summarize', type: 'boolean', default: 'false', helpText: `Add an AI summary of each page. ${PRICING}` },
      { key: 'prompt', label: 'Summary Instructions', helpText: 'What the summary should focus on, such as `pricing and plans`. Used with Summarize.' },
    ],
    perform: (z, bundle) =>
      post(z, '/v1/extract', { ...bundle.inputData, urls: list(bundle.inputData.urls), summary: bool(bundle.inputData.summary) }, { timeout: 29000 }),
    sample: { results: [{ url: 'https://www.example.com/blog/kites', title: 'A short history of kites', markdown: '# A short history of kites', summary: 'Kites began in China about 2,500 years ago.' }], failed: [], meta: META },
  },
};

const getAnswer = {
  key: 'get_answer',
  noun: 'Answer',
  display: {
    label: 'Get Cited Answer',
    description: 'Answers a question from live Google results and returns the answer with numbered citations.',
  },
  operation: {
    inputFields: [
      { key: 'q', label: 'Question', required: true, helpText: `The question to answer. ${PRICING}` },
      {
        key: 'depth',
        label: 'Depth',
        choices: { fast: 'Fast: from search results (a few seconds)', standard: 'Standard: reads the top pages (slower)' },
        default: 'fast',
      },
      f.country,
      f.language,
      f.location,
      f.time,
    ],
    perform: (z, bundle) => post(z, '/v1/answer', bundle.inputData, { timeout: 29000 }),
    sample: { answer: 'Kites were first flown in China about 2,500 years ago [1].', citations: [{ index: 1, title: 'A short history of kites', link: 'https://www.example.com/blog/kites', domain: 'example.com' }], meta: { ...META, credits_used: 3 } },
  },
};

// Long tasks: start them with Zapier's callback URL as the webhook, then the Zap
// continues when SerpKite posts the result (perform → performResume).
const longTask = ({ key, noun, label, description, inputFields, path, body, poll, sample }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    inputFields,
    perform: async (z, bundle) => {
      if (bundle.meta && bundle.meta.isLoadingSample) {
        return sample; // Zap editor test: no callback is possible, and a real run takes minutes.
      }
      const callbackUrl = z.generateCallbackUrl();
      const task = await post(z, path, { ...body(bundle.inputData), webhook_url: callbackUrl }, { headers: { 'Idempotency-Key': idempotencyKey(callbackUrl) } });
      return { id: task.id, status: task.status, poll_url: task.poll_url };
    },
    performResume: async (z, bundle) => {
      const task = await get(z, `${poll}/${bundle.outputData.id}`);
      if (task.status === 'failed' || task.status === 'canceled') {
        const e = task.error || {};
        throw new z.errors.Error(e.message || `The ${noun.toLowerCase()} ${task.status}.`, e.code || task.status, 400);
      }
      return task;
    },
    sample,
  },
});

const crawlSite = longTask({
  key: 'crawl_site',
  noun: 'Crawl',
  label: 'Crawl Website',
  description: 'Reads a site or section page by page and continues the Zap with every page as Markdown when the crawl ends.',
  inputFields: [
    { key: 'url', label: 'Start URL', required: true, helpText: 'The site or section to read, such as `https://example.com/docs`.' },
    { key: 'limit', label: 'Page Limit', type: 'integer', default: '10', helpText: `Maximum pages to read (1–1,000). Credits for this many pages are held at the start and the pages not read are refunded. ${PRICING}` },
    { key: 'include_paths', label: 'Include Paths', list: true, helpText: 'Only read paths matching these patterns, such as `/docs/*`.' },
    { key: 'query', label: 'Query', helpText: 'Read the pages most relevant to this phrase first.' },
  ],
  path: '/v1/crawl',
  poll: '/v1/crawl',
  body: (d) => ({ url: d.url, limit: int(d.limit), include_paths: list(d.include_paths), query: d.query }),
  sample: { id: '01926a3e-7b2c-7c4e-9f1a-2b3c4d5e6f70', status: 'completed', credits_used: 2, result: { url: 'https://www.example.com/docs', pages: [{ url: 'https://www.example.com/docs', title: 'Docs', markdown: '# Docs' }] } },
});

const research = longTask({
  key: 'research',
  noun: 'Research',
  label: 'Research a Topic',
  description: 'Searches and reads the web in several steps and continues the Zap with a cited report when it is done (usually a few minutes).',
  inputFields: [
    { key: 'input', label: 'Research Task', type: 'text', required: true, helpText: 'What to research, in plain words.' },
    { key: 'effort', label: 'Effort', choices: { lite: 'Lite', standard: 'Standard', deep: 'Deep' }, default: 'lite', helpText: `Deeper research reads more sources and costs more. ${PRICING}` },
    f.country,
    f.language,
  ],
  path: '/v1/research',
  poll: '/v1/research',
  body: (d) => ({ input: d.input, effort: d.effort, country: d.country, language: d.language }),
  sample: { id: '01926a3e-7b2c-7c4e-9f1a-2b3c4d5e6f71', status: 'completed', credits_used: 30, result: { report: '# Kites\n\nKites were first flown in China [1].', sources: [{ title: 'A short history of kites', link: 'https://www.example.com/blog/kites' }] } },
});

module.exports = [getPlace, fetchWebpage, extractWebpages, getAnswer, crawlSite, research];
