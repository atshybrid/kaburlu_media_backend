# Node + Express Service Starter

This is a simple API sample in Node.js with express.js based on [Google Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service).

## Getting Started

Server should run automatically when starting a workspace. To run manually, run:
```sh
npm run dev
```

## Admin: Managing AI Prompt Templates

The API uses DB-backed prompt templates for AI features (SEO, moderation, translations). Admins can view and update these via the Prompts API.

- Swagger UI: navigate to `/api/docs` and open the "Prompts" tag.
- Endpoints:
	- GET `/prompts` — list all templates
	- PUT `/prompts` — upsert a template by `{ key, content, description? }`
- Auth: Requires JWT. Roles allowed: `SUPERADMIN`, `LANGUAGE_ADMIN`, `NEWS_DESK_ADMIN`.

Example request body for PUT /prompts:

```json
{
	"key": "SEO_GENERATION",
	"content": "You are an SEO assistant...",
	"description": "Generates SEO tags/meta/alt for ShortNews"
}
```

Notes:
- Templates may use `{{placeholders}}`; the backend fills them at runtime.
- If a key is missing in DB, code-level defaults are used automatically.