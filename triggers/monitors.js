'use strict';

const { PRICING, post, list } = require('../lib/api');
const f = require('../lib/fields');

// REST hooks backed by SerpKite monitors: subscribing creates a monitor that posts to
// the Zap's hook URL; turning the Zap off deletes it.
const INTERVAL = {
  key: 'interval',
  label: 'Check Every',
  required: true,
  choices: { hourly: 'Hour', daily: 'Day', weekly: 'Week' },
  default: 'daily',
  helpText: `Each check is billed like the request it makes. ${PRICING}`,
};

const subscribe = (body) => async (z, bundle) => {
  const monitor = await post(z, '/v1/monitors', {
    ...body(bundle.inputData),
    interval: bundle.inputData.interval,
    name: `Zapier: ${bundle.inputData.q || bundle.inputData.prompt}`.slice(0, 200),
    webhook_url: bundle.targetUrl,
  });
  return { id: monitor.id };
};

const unsubscribe = async (z, bundle) => {
  await z.request({ method: 'DELETE', url: `https://api.serpkite.com/v1/monitors/${bundle.subscribeData.id}` });
  return {};
};

const newResult = {
  key: 'new_search_result',
  noun: 'Result',
  display: {
    label: 'New Search Result',
    description: 'Triggers when a Google search or Google News query you watch has a result it did not have before.',
  },
  operation: {
    type: 'hook',
    inputFields: [
      f.q('The query to watch, such as your brand name.'),
      { key: 'endpoint', label: 'Search', required: true, choices: { search: 'Google web results', news: 'Google News' }, default: 'news' },
      INTERVAL,
      f.country,
      f.language,
    ],
    performSubscribe: subscribe((d) => ({ q: d.q, endpoint: d.endpoint, country: d.country, language: d.language })),
    performUnsubscribe: unsubscribe,
    perform: (z, bundle) => {
      const event = bundle.cleanedRequest || {};
      return (event.new_results || []).map((r) => ({
        ...r,
        id: `${event.monitor_id}:${r.link || r.position}`,
        monitor_id: event.monitor_id,
        run_at: event.run_at,
        q: event.q,
      }));
    },
    // Sample data for the Zap editor: one live search with the same options (billed like any search).
    performList: async (z, bundle) => {
      const d = bundle.inputData;
      const data = await post(z, `/v1/${d.endpoint || 'news'}`, { q: d.q, country: d.country, language: d.language });
      return (data.results || []).map((r) => ({ ...r, id: `sample:${r.link || r.position}`, q: d.q }));
    },
    sample: { id: 'monitor:https://news.example.com/kites', position: 1, title: 'Example City hosts its kite festival', link: 'https://news.example.com/kites', source: 'Example News', date: '2 hours ago', q: 'kite festival', run_at: '2026-10-29T08:00:00Z' },
  },
};

const ASSISTANT_CHOICES = { chatgpt: 'ChatGPT', gemini: 'Gemini', copilot: 'Copilot Search', ai_mode: 'Google AI Mode', brave_ai: 'Brave AI' };

const newAnswer = {
  key: 'new_assistant_answer',
  noun: 'Answer',
  display: {
    label: 'New AI Assistant Answer',
    description: 'Triggers when an AI assistant answers a prompt you watch: SerpKite asks it on a schedule and sends every answer, its sources and your tracked brand mentions.',
  },
  operation: {
    type: 'hook',
    inputFields: [
      { key: 'endpoint', label: 'Assistant', required: true, choices: ASSISTANT_CHOICES, default: 'chatgpt' },
      f.prompt('the assistant'),
      f.track,
      INTERVAL,
      { ...f.country, helpText: 'Two-letter country code, such as `us` or `gb`.' },
    ],
    performSubscribe: subscribe((d) => ({ endpoint: d.endpoint, prompt: d.prompt, track: list(d.track), country: d.country })),
    performUnsubscribe: unsubscribe,
    perform: (z, bundle) => {
      const event = bundle.cleanedRequest || {};
      return (event.new_results || []).map((answer) => ({
        ...answer,
        id: event.run_id,
        monitor_id: event.monitor_id,
        assistant: event.endpoint,
        prompt: event.prompt,
        run_at: event.run_at,
      }));
    },
    // Sample data for the Zap editor: ask the assistant once now (billed like any answer).
    performList: async (z, bundle) => {
      const d = bundle.inputData;
      const answer = await post(
        z,
        `/v1/${d.endpoint || 'brave_ai'}`,
        { prompt: d.prompt, track: list(d.track), country: d.country },
        { timeout: 45000 },
      );
      return [{ ...answer, id: `sample:${answer.meta ? answer.meta.request_id : Date.now()}`, assistant: d.endpoint, prompt: d.prompt }];
    },
    sample: {
      id: '01926a3e-7b2c-7c4e-9f1a-2b3c4d5e6f72',
      assistant: 'chatgpt',
      prompt: 'What are the best CRMs for a 10-person startup?',
      markdown: 'For a 10-person startup, **HubSpot CRM** and **Pipedrive** are the most common picks [1](https://www.example.com/crm-guide).',
      sources: [{ position: 1, title: 'The best CRMs for startups', link: 'https://www.example.com/crm-guide' }],
      mentions: [{ term: 'Pipedrive', mentioned: true, cited: false }],
      run_at: '2026-10-29T08:00:00Z',
    },
  },
};

module.exports = [newResult, newAnswer];
