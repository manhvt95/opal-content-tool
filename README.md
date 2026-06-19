# Content Intelligence Tool — Optimizely Opal

An Opal tool that gives your agents **content quality scoring** and **SEO meta generation** capabilities.

## Tools

### `analyze_content`
Scores content on readability, word count, and keyword usage. Returns a 0–100 score, letter grade, Flesch reading ease, and prioritised recommendations.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `content` | string | ✅ | Plain text or HTML body |
| `target_keywords` | string | — | Comma-separated keywords to check density |
| `content_type` | string | — | `blog` \| `product` \| `landing_page` \| `email` |

**Example response**
```json
{
  "score": 82,
  "grade": "B",
  "metrics": {
    "word_count": 320,
    "flesch_reading_ease": 67.4,
    "readability_label": "Standard"
  },
  "keyword_analysis": [
    { "keyword": "optimizely", "density_percent": 1.2, "verdict": "Good" }
  ],
  "recommendations": ["Average sentence length is 24 words — try to keep it under 20."]
}
```

---

### `generate_seo_meta`
Generates an SEO-optimised `<title>` and `<meta name="description">` from your content, respecting character limits.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `content` | string | ✅ | Plain text or HTML body |
| `brand_name` | string | — | Appended as `\| Brand` suffix to title |
| `max_title_length` | integer | — | Default: 60 |
| `max_description_length` | integer | — | Default: 160 |

**Example response**
```json
{
  "title": "Optimizely is a powerful platform for A/B testing | Acme",
  "description": "Optimizely is a powerful platform for A/B testing and personalization. It enables marketing teams to run experiments at scale...",
  "character_counts": { "title": 57, "description": 158 },
  "html_snippet": "<title>...</title>\n<meta name=\"description\" content=\"...\">"
}
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Register app in OCP
ocp app register

# 3. Edit app.yml — set app_id, vendor, display_name

# 4. Validate
ocp app validate

# 5. Build & publish
ocp app prepare --bump-dev-version --publish

# 6. Install to your sandbox
ocp directory install <YOUR_APP_ID>@<YOUR_APP_VERSION> <PUBLIC_API_KEY>
```

Then in Opal UI: **Tools → Registries → Add tool registry** and paste the `Opal Tool URL` from your OCP app's Settings tab.

## Tests

```bash
npm test
```

## Project structure

```
opal-content-tool/
├── app.yml                          # OCP app manifest
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── forms/
│   └── settings.yml                 # Optional brand name & content type defaults
└── src/
    ├── functions/
    │   └── OpalToolFunction.ts      # OCP entry point (matches app.yml entry_point)
    └── tools/
        ├── ContentTools.ts          # @tool implementations
        └── ContentTools.test.ts     # Unit tests
```
