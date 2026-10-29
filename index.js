'use strict';

const authentication = require('./authentication');
const { addAuth, handleErrors } = require('./lib/api');
const searches = require('./creates/search');
const web = require('./creates/web');
const assistants = require('./creates/assistants');
const triggers = require('./triggers/monitors');

const byKey = (list) => Object.fromEntries(list.map((x) => [x.key, x]));

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication,
  // Inputs arrive as entered; lib/api.js drops empty values itself.
  flags: { cleanInputData: false },
  beforeRequest: [addAuth],
  afterResponse: [handleErrors],
  triggers: byKey(triggers),
  creates: byKey([...searches, ...web, ...assistants]),
  searches: {},
};
