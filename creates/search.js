'use strict';

const { PRICING, post, int } = require('../lib/api');
const f = require('../lib/fields');

// One action per Google vertical; each returns the API's JSON response as is.
const VERTICALS = [
  {
    key: 'search_google',
    path: '/v1/search',
    noun: 'Search',
    label: 'Search Google',
    description: 'Searches Google and returns the organic results, answer box, knowledge graph, People also ask and related searches.',
    fields: [f.q(), f.country, f.language, f.location, f.time, { key: 'num', label: 'Number of Results', type: 'integer', choices: { 10: '10', 20: '20', 30: '30', 50: '50', 100: '100' }, helpText: `Results to return. More than 10 costs more. ${PRICING}` }],
    sample: { request: { q: 'kite festival' }, results: [{ position: 1, title: 'Example Kite Festival 2026', link: 'https://www.example.com/kites', domain: 'example.com', snippet: 'The biggest kite festival on the coast.' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_news',
    path: '/v1/news',
    noun: 'News',
    label: 'Search Google News',
    description: 'Searches Google News and returns recent articles with source, date and link.',
    fields: [f.q(), f.country, f.language, f.time],
    sample: { request: { q: 'kite festival' }, results: [{ position: 1, title: 'Example City hosts its kite festival', link: 'https://news.example.com/kites', source: 'Example News', date: '2 hours ago', published_at: '2026-10-29T08:00:00Z' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_maps',
    path: '/v1/maps',
    noun: 'Places',
    label: 'Search Google Maps',
    description: 'Finds places on Google Maps with address, rating, phone, website, opening hours and place ID.',
    fields: [f.q('What to look for, such as `coffee roasters`.'), { ...f.location, helpText: 'The area to search, such as `Berlin, Germany`. Local queries need one.' }, f.country, f.language],
    sample: { request: { q: 'coffee roasters', location: 'Austin, Texas' }, results: [{ position: 1, title: 'Example Coffee Roasters', address: '123 Main St, Austin, TX 78701', rating: 4.7, rating_count: 532, phone_number: '(512) 555-0100', website: 'https://coffee.example.com', place_id: 'ChIJexample0000' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_images',
    path: '/v1/images',
    noun: 'Images',
    label: 'Search Google Images',
    description: 'Searches Google Images and returns image URLs, sizes, titles and source pages.',
    fields: [f.q(), f.country, f.language, f.time],
    sample: { request: { q: 'red kite' }, results: [{ position: 1, title: 'Red kite over a field', image_url: 'https://images.example.com/kite.jpg', image_width: 1600, image_height: 1067, link: 'https://images.example.com/gallery/kite' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_videos',
    path: '/v1/videos',
    noun: 'Videos',
    label: 'Search Google Videos',
    description: 'Searches Google Videos and returns titles, links, durations and channels.',
    fields: [f.q(), f.country, f.language, f.time],
    sample: { request: { q: 'how to fly a kite' }, results: [{ position: 1, title: 'How to fly a kite in light wind', link: 'https://video.example.com/watch/abc123', duration: '8:42', channel: 'Kite School' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_shopping',
    path: '/v1/shopping',
    noun: 'Products',
    label: 'Search Google Shopping',
    description: 'Searches Google Shopping and returns products with price, merchant and rating.',
    fields: [f.q(), f.country, f.language, f.location],
    sample: { request: { q: 'delta kite' }, results: [{ position: 1, title: 'Example Delta Kite, 150 cm', source: 'Example Store', price: '$39.99', price_value: 39.99, currency: 'USD', link: 'https://store.example.com/products/delta-kite' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_scholar',
    path: '/v1/scholar',
    noun: 'Papers',
    label: 'Search Google Scholar',
    description: 'Searches Google Scholar and returns papers with authors, citations and PDF links.',
    fields: [f.q(), f.language],
    sample: { request: { q: 'kite aerodynamics' }, results: [{ position: 1, title: 'An example study of kite aerodynamics', link: 'https://journal.example.com/articles/kite', year: 2024, cited_by: 42, pdf_url: 'https://journal.example.com/articles/kite.pdf' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'search_patents',
    path: '/v1/patents',
    noun: 'Patents',
    label: 'Search Google Patents',
    description: 'Searches Google Patents and returns patents with publication number, dates, inventor and assignee.',
    fields: [f.q(), f.country, f.language],
    sample: { request: { q: 'foldable kite frame' }, results: [{ position: 1, title: 'Kite with a foldable frame', publication_number: 'US1234567B2', inventor: 'Jane Example', assignee: 'Example Kites Inc.', link: 'https://patents.example.com/patent/US1234567B2/en' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 1 } },
  },
  {
    key: 'get_suggestions',
    path: '/v1/autocomplete',
    noun: 'Suggestions',
    label: 'Get Google Autocomplete Suggestions',
    description: 'Returns the suggestions Google autocompletes for a partial query.',
    fields: [f.q('The start of a query, such as `kite fest`.'), f.country, f.language],
    sample: { request: { q: 'kite fest' }, results: [{ value: 'kite festival 2026' }], meta: { request_id: '01a1687d-0000-7000-8000-000000000000', credits_used: 0.5 } },
  },
];

const make = (v) => ({
  key: v.key,
  noun: v.noun,
  display: { label: v.label, description: v.description },
  operation: {
    inputFields: v.fields,
    perform: (z, bundle) => post(z, v.path, { ...bundle.inputData, num: int(bundle.inputData.num) }),
    sample: v.sample,
  },
});

module.exports = VERTICALS.map(make);
