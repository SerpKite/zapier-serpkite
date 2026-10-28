'use strict';

const crypto = require('crypto');

const API_BASE = 'https://api.serpkite.com';
const PRICING = 'Pricing: https://serpkite.com/pricing. Failed and empty requests are not billed.';

// Adds the key to every request to the API (and nowhere else).
const addAuth = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key && request.url.startsWith(API_BASE)) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

// Turns the API's {"error":{"code","message","request_id"}} body into a Zapier error.
const handleErrors = (response, z) => {
  if (response.status < 400 || !response.request.url.startsWith(API_BASE)) {
    return response;
  }
  let error = {};
  try {
    error = (response.json && response.json.error) || JSON.parse(response.content).error || {};
  } catch (e) {
    error = {};
  }
  const message = error.message || `SerpKite API returned HTTP ${response.status}`;
  const code = error.code || `http_${response.status}`;
  if (response.status === 401) {
    throw new z.errors.RefreshAuthError(`${message} Check your SerpKite API key.`);
  }
  if (response.status === 429) {
    const retry = parseInt(response.getHeader('retry-after') || '60', 10);
    throw new z.errors.ThrottledError(message, Number.isFinite(retry) ? retry : 60);
  }
  throw new z.errors.Error(message, code, response.status);
};

// Drops empty optional values: the API rejects unknown or malformed fields.
const compact = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
};

const post = async (z, path, body, options = {}) => {
  const response = await z.request({
    method: 'POST',
    url: `${API_BASE}${path}`,
    body: compact(body),
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    timeout: options.timeout,
  });
  return response.data;
};

const get = async (z, path) => {
  const response = await z.request({ method: 'GET', url: `${API_BASE}${path}` });
  return response.data;
};

// Zapier maps a "list" field to an array; accept comma-separated text too.
const list = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = Array.isArray(value) ? value : String(value).split(',');
  const out = items.map((s) => String(s).trim()).filter(Boolean);
  return out.length ? out : undefined;
};

const int = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

const bool = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['true', 'yes', '1'].includes(String(value).toLowerCase());
};

const idempotencyKey = (seed) => crypto.createHash('sha256').update(seed).digest('hex').slice(0, 64);

module.exports = { API_BASE, PRICING, addAuth, handleErrors, compact, post, get, list, int, bool, idempotencyKey };
