'use strict';

const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

const API = 'https://api.serpkite.com';
const authData = { api_key: 'skt_live_test' };
const bearer = { reqheaders: { authorization: 'Bearer skt_live_test' } };

afterEach(() => nock.cleanAll());

describe('authentication', () => {
  it('tests the key with the free account endpoint', async () => {
    nock(API, bearer).get('/v1/account').reply(200, { balance: 10, plan: 'free', key: { name: 'Zapier' } });
    const res = await appTester(App.authentication.test, { authData });
    expect((res.data || res).key.name).toBe('Zapier');
  });

  it('turns a 401 into a reconnect prompt', async () => {
    nock(API).get('/v1/account').reply(401, { error: { code: 'invalid_api_key', message: 'Invalid API key.', request_id: 'r1' } });
    await expect(appTester(App.authentication.test, { authData })).rejects.toThrow(/Invalid API key/);
  });
});

describe('search actions', () => {
  it('sends only filled fields', async () => {
    let sent;
    nock(API, bearer)
      .post('/v1/search', (b) => {
        sent = b;
        return true;
      })
      .reply(200, { results: [{ title: 'A' }], meta: { credits_used: 1 } });
    const res = await appTester(App.creates.search_google.operation.perform, {
      authData,
      inputData: { q: 'kites', country: 'us', language: '', num: '20' },
    });
    expect(sent).toEqual({ q: 'kites', country: 'us', num: 20 });
    expect(res.results[0].title).toBe('A');
  });

  it('passes API errors through with code and message', async () => {
    nock(API).post('/v1/news').reply(400, { error: { code: 'invalid_param', message: 'time must be one of hour, day', request_id: 'r2' } });
    await expect(
      appTester(App.creates.search_news.operation.perform, { authData, inputData: { q: 'x', time: 'decade' } }),
    ).rejects.toThrow(/time must be one of/);
  });

  it('flattens the place', async () => {
    nock(API).post('/v1/place', { place_id: 'ChIJx' }).reply(200, { results: [{ title: 'Cafe' }], meta: { credits_used: 1 } });
    const res = await appTester(App.creates.get_place.operation.perform, { authData, inputData: { place_id: 'ChIJx' } });
    expect(res.title).toBe('Cafe');
  });

  it('splits URL lists for extract', async () => {
    nock(API).post('/v1/extract', { urls: ['https://a.example', 'https://b.example'], summary: true }).reply(200, { results: [], failed: [] });
    await appTester(App.creates.extract_webpages.operation.perform, {
      authData,
      inputData: { urls: 'https://a.example, https://b.example', summary: 'true' },
    });
  });
});

describe('AI assistants', () => {
  it('asks Brave inline', async () => {
    nock(API, bearer).post('/v1/brave_ai', { prompt: 'best headphones', track: ['Sony'] }).reply(200, { markdown: 'Sony [1]', sources: [] });
    const res = await appTester(App.creates.ask_brave_ai.operation.perform, {
      authData,
      inputData: { prompt: 'best headphones', track: ['Sony'] },
    });
    expect(res.markdown).toBe('Sony [1]');
  });

  it('queues slower assistants with the callback URL as webhook', async () => {
    let sent;
    let idem;
    nock(API, bearer)
      .post('/v1/batches', function (b) {
        sent = b;
        idem = this.headers['idempotency-key'];
        return true;
      })
      .reply(202, { batches: [{ id: 'job-1', status: 'queued' }] });
    const res = await appTester(App.creates.ask_chatgpt.operation.perform, {
      authData,
      inputData: { prompt: 'best CRM', web_search: 'false', language: 'de' },
      meta: {},
    });
    expect(res).toEqual({ batch_id: 'job-1', status: 'queued' });
    expect(sent.endpoint).toBe('chatgpt');
    expect(sent.requests).toEqual([{ prompt: 'best CRM', web_search: false }]); // chatgpt takes no language
    expect(sent.webhook_url).toMatch(/^http/);
    expect(idem).toMatch(/^[0-9a-f]{64}$/);
  });

  it('asks inline while the Zap editor loads a sample', async () => {
    nock(API).post('/v1/gemini', { prompt: 'heat pumps', language: 'en' }).reply(200, { markdown: 'Heat pumps…' });
    const res = await appTester(App.creates.ask_gemini.operation.perform, {
      authData,
      inputData: { prompt: 'heat pumps', language: 'en' },
      meta: { isLoadingSample: true },
    });
    expect(res.markdown).toBe('Heat pumps…');
  });

  it('reads the job back on resume and returns the answer', async () => {
    nock(API, bearer).get('/v1/batches/job-1').reply(200, { id: 'job-1', status: 'done', result: { markdown: 'HubSpot [1]', sources: [] } });
    const res = await appTester(App.creates.ask_chatgpt.operation.performResume, {
      authData,
      outputData: { batch_id: 'job-1' },
      cleanedRequest: { id: 'job-1', status: 'done' },
    });
    expect(res.markdown).toBe('HubSpot [1]');
  });

  it('fails the step when the job failed', async () => {
    nock(API).get('/v1/batches/job-2').reply(200, { id: 'job-2', status: 'failed', error: { code: 'upstream_error', message: 'Copilot did not answer.' } });
    await expect(
      appTester(App.creates.ask_copilot.operation.performResume, { authData, outputData: { batch_id: 'job-2' } }),
    ).rejects.toThrow(/Copilot did not answer/);
  });
});

describe('long tasks', () => {
  it('starts a crawl with the callback URL and resumes with the pages', async () => {
    let sent;
    nock(API)
      .post('/v1/crawl', (b) => {
        sent = b;
        return true;
      })
      .reply(202, { id: 'c1', status: 'queued', poll_url: `${API}/v1/crawl/c1` });
    const started = await appTester(App.creates.crawl_site.operation.perform, {
      authData,
      inputData: { url: 'https://example.com', limit: '2' },
      meta: {},
    });
    expect(started.id).toBe('c1');
    expect(sent).toMatchObject({ url: 'https://example.com', limit: 2 });
    expect(sent.webhook_url).toMatch(/^http/);

    nock(API).get('/v1/crawl/c1').reply(200, { id: 'c1', status: 'completed', result: { pages: [{ url: 'https://example.com' }] } });
    const done = await appTester(App.creates.crawl_site.operation.performResume, { authData, outputData: started });
    expect(done.result.pages).toHaveLength(1);
  });
});

describe('monitor triggers', () => {
  it('creates a monitor on subscribe and deletes it on unsubscribe', async () => {
    let sent;
    nock(API)
      .post('/v1/monitors', (b) => {
        sent = b;
        return true;
      })
      .reply(201, { id: 'm1' });
    const sub = await appTester(App.triggers.new_search_result.operation.performSubscribe, {
      authData,
      targetUrl: 'https://hooks.zapier.com/hooks/standard/1/abc',
      inputData: { q: 'serpkite', endpoint: 'news', interval: 'hourly' },
    });
    expect(sub).toEqual({ id: 'm1' });
    expect(sent).toMatchObject({ q: 'serpkite', endpoint: 'news', interval: 'hourly', webhook_url: 'https://hooks.zapier.com/hooks/standard/1/abc' });

    nock(API).delete('/v1/monitors/m1').reply(204);
    await appTester(App.triggers.new_search_result.operation.performUnsubscribe, { authData, subscribeData: { id: 'm1' } });
  });

  it('turns a monitor webhook into one item per new result', async () => {
    const items = await appTester(App.triggers.new_search_result.operation.perform, {
      authData,
      cleanedRequest: {
        event: 'monitor.results',
        monitor_id: 'm1',
        run_id: 'r1',
        q: 'serpkite',
        run_at: '2026-10-29T08:00:00Z',
        new_results: [{ link: 'https://a.example', title: 'A' }, { link: 'https://b.example', title: 'B' }],
      },
    });
    expect(items.map((i) => i.id)).toEqual(['m1:https://a.example', 'm1:https://b.example']);
  });

  it('turns an assistant monitor run into one answer', async () => {
    const items = await appTester(App.triggers.new_assistant_answer.operation.perform, {
      authData,
      cleanedRequest: { monitor_id: 'm2', run_id: 'r9', endpoint: 'gemini', prompt: 'p', new_results: [{ markdown: 'answer' }] },
    });
    expect(items).toEqual([expect.objectContaining({ id: 'r9', assistant: 'gemini', markdown: 'answer' })]);
  });
});
