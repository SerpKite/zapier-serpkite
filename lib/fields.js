'use strict';

const { PRICING } = require('./api');

const q = (helpText = 'What to search for, as you would type it into Google.') => ({
  key: 'q',
  label: 'Query',
  required: true,
  helpText,
});
const country = {
  key: 'country',
  label: 'Country',
  helpText: 'Two-letter country code, such as `us`, `gb` or `de`. Defaults to `us`.',
};
const language = {
  key: 'language',
  label: 'Language',
  helpText: 'Language code, such as `en`, `de` or `pt-br`. Defaults to `en`.',
};
const location = {
  key: 'location',
  label: 'Location',
  helpText: 'Free-text place to search from, such as `Austin, Texas, United States`.',
};
const time = {
  key: 'time',
  label: 'Time Range',
  choices: { hour: 'Past hour', day: 'Past 24 hours', week: 'Past week', month: 'Past month', year: 'Past year' },
  helpText: 'Only return results from this recent period.',
};
const prompt = (name) => ({
  key: 'prompt',
  label: 'Prompt',
  type: 'text',
  required: true,
  helpText: `The question to ask ${name}, at most 4,000 characters. ${PRICING}`,
});
const track = {
  key: 'track',
  label: 'Track Brands or Domains',
  list: true,
  helpText:
    'Up to 20 brands or domains, such as `Pipedrive` or `hubspot.com`. **Mentions** then says whether the answer names each one and whether a cited source is on it.',
};

module.exports = { q, country, language, location, time, prompt, track };
