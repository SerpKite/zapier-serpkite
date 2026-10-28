'use strict';

const { API_BASE } = require('./lib/api');

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText:
        'Create a key in the [SerpKite dashboard](https://app.serpkite.com/keys). It starts with `skt_live_`. A dedicated key with a monthly credit limit is a good idea.',
    },
  ],
  // GET /v1/account is free: it checks the key without spending credits.
  test: { url: `${API_BASE}/v1/account` },
  connectionLabel: '{{key.name}}',
};
