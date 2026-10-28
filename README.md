# SerpKite for Zapier

Source of the SerpKite integration for [Zapier](https://zapier.com): Google search, Maps, webpages, cited answers and what AI assistants (ChatGPT, Gemini, Copilot Search, Google AI Mode, Brave) answer, in any Zap. Built with the [Zapier Platform CLI](https://docs.zapier.com/platform/build-cli/overview).

[SerpKite](https://serpkite.com) is a Google SERP API for AI agents. Every action is one call to `https://api.serpkite.com`, billed like the API call it makes; failed and empty requests are not billed ([pricing](https://serpkite.com/pricing)).

## Authentication

API key (custom auth). The key is sent as `Authorization: Bearer <key>` and tested with the free `GET /v1/account`. Create one at [app.serpkite.com](https://app.serpkite.com/keys).

## Actions

| Action | Endpoint | How it runs |
| --- | --- | --- |
| Search Google | `POST /v1/search` | inline |
| Search Google News / Images / Videos / Shopping / Scholar / Patents | `POST /v1/<vertical>` | inline |
| Search Google Maps | `POST /v1/maps` | inline |
| Get Google Autocomplete Suggestions | `POST /v1/autocomplete` | inline |
| Get Google Maps Place Details | `POST /v1/place` | inline |
| Fetch Webpage | `POST /v1/webpage` | inline |
| Extract Webpages (highlights, AI summary) | `POST /v1/extract` | inline |
| Get Cited Answer | `POST /v1/answer` | inline |
| Ask Brave AI | `POST /v1/brave_ai` | inline (1–10 s) |
| Ask ChatGPT / Gemini / Copilot Search / Google AI Mode | `POST /v1/batches` + `GET /v1/batches/{id}` | callback (see below) |
| Crawl Website | `POST /v1/crawl` + `GET /v1/crawl/{id}` | callback |
| Research a Topic | `POST /v1/research` + `GET /v1/research/{id}` | callback |

## Triggers

| Trigger | How it works |
| --- | --- |
| New Search Result | REST hook: turning the Zap on creates a SerpKite [monitor](https://serpkite.com/docs) for a Google web or News query (hourly, daily or weekly) that posts results it has not seen before to the Zap; turning it off deletes the monitor. One Zap run per new result. |
| New AI Assistant Answer | REST hook: a monitor asks ChatGPT, Gemini, Copilot Search, Google AI Mode or Brave the same prompt on a schedule and posts every answer with its sources and the brand mentions you track. |

## Slow answers and Zapier's time limit

A Zapier action has 30 seconds. ChatGPT takes 10–30 s, Gemini 5–30 s, Copilot Search 15–40 s and Google AI Mode 5–45 s, so those actions queue a one-request batch whose webhook is the step's callback URL (`z.generateCallbackUrl()`). The Zap waits (the task shows as waiting) and continues in `performResume` when SerpKite posts the result; `performResume` reads the job back with the user's key rather than trusting the callback body. In the Zap editor's test step there is no callback, so the assistant is asked inline. Crawls and research work the same way. Brave answers in 1–10 s and is always inline.

## Development

```bash
npm install
npm test                                       # mocked HTTP (nock)
npx zapier-platform validate --without-style
```

Deploying needs a Zapier developer account: `npx zapier-platform login`, `npx zapier-platform register "SerpKite"` once, then `npx zapier-platform push`.

## License

MIT. Google is a trademark of Google LLC; SerpKite is not affiliated with Google. ChatGPT, Gemini, Copilot and Brave are trademarks of their owners.
