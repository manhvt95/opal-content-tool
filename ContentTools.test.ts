import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Mock the SDK before importing tools ───────────────────────────────────────
vi.mock('@optimizely-opal/opal-tool-ocp-sdk', () => ({
  ToolFunction: class {},
  tool: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor,
  ParameterType: {
    String: 'string',
    Integer: 'integer',
    Number: 'number',
    Boolean: 'boolean',
  },
}));

vi.mock('@zaiusinc/app-sdk', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ContentTools } from '../src/tools/ContentTools';

// ─────────────────────────────────────────────────────────────────────────────

const tools = new ContentTools();

const SAMPLE_BLOG = `
  Optimizely is a powerful platform for A/B testing and personalization.
  It enables marketing teams to run experiments at scale without requiring
  developer intervention. By using feature flags and audience targeting,
  teams can deliver personalized experiences to every visitor.
  This leads to higher conversion rates and improved customer satisfaction.
  The platform integrates with most CMS tools including Contentful and WordPress.
  Optimizely's data-driven approach helps teams make confident product decisions.
  With real-time analytics and multivariate testing, you can learn faster and ship better.
`;

// ─── analyze_content ──────────────────────────────────────────────────────────

describe('analyze_content', () => {
  it('returns a score and grade', async () => {
    const result = await tools.analyzeContent({ content: SAMPLE_BLOG });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
  });

  it('populates readability metrics', async () => {
    const result = await tools.analyzeContent({ content: SAMPLE_BLOG });
    expect(result.metrics.word_count).toBeGreaterThan(0);
    expect(result.metrics.flesch_reading_ease).toBeGreaterThanOrEqual(0);
    expect(result.metrics.readability_label).toBeTruthy();
  });

  it('detects keyword density', async () => {
    const result = await tools.analyzeContent({
      content: SAMPLE_BLOG,
      target_keywords: 'optimizely, experimentation',
    });
    expect(result.keyword_analysis).toHaveLength(2);
    const opal = result.keyword_analysis.find(k => k.keyword === 'optimizely');
    expect(opal?.density_percent).toBeGreaterThan(0);
  });

  it('flags missing keywords', async () => {
    const result = await tools.analyzeContent({
      content: SAMPLE_BLOG,
      target_keywords: 'unicorn',
    });
    const kw = result.keyword_analysis[0];
    expect(kw.density_percent).toBe(0);
    expect(kw.verdict).toMatch(/missing/i);
  });

  it('strips HTML tags before analysis', async () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const result = await tools.analyzeContent({ content: html });
    expect(result.metrics.word_count).toBe(2);
  });

  it('applies content_type word count benchmark', async () => {
    const tinyContent = 'Short.';
    const resultBlog    = await tools.analyzeContent({ content: tinyContent, content_type: 'blog' });
    const resultEmail   = await tools.analyzeContent({ content: tinyContent, content_type: 'email' });
    // Blog penalises short content harder
    expect(resultBlog.score).toBeLessThanOrEqual(resultEmail.score);
  });
});

// ─── generate_seo_meta ───────────────────────────────────────────────────────

describe('generate_seo_meta', () => {
  it('returns title and description', async () => {
    const result = await tools.generateSeoMeta({ content: SAMPLE_BLOG });
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('respects max_title_length', async () => {
    const result = await tools.generateSeoMeta({ content: SAMPLE_BLOG, max_title_length: 40 });
    expect(result.title.length).toBeLessThanOrEqual(40);
  });

  it('respects max_description_length', async () => {
    const result = await tools.generateSeoMeta({ content: SAMPLE_BLOG, max_description_length: 100 });
    expect(result.description.length).toBeLessThanOrEqual(100);
  });

  it('appends brand name to title', async () => {
    const result = await tools.generateSeoMeta({ content: SAMPLE_BLOG, brand_name: 'Acme' });
    expect(result.title).toContain('| Acme');
  });

  it('returns a valid HTML snippet', async () => {
    const result = await tools.generateSeoMeta({ content: SAMPLE_BLOG });
    expect(result.html_snippet).toContain('<title>');
    expect(result.html_snippet).toContain('<meta name="description"');
  });

  it('strips HTML before processing', async () => {
    const html = '<h1>My Article Title</h1><p>Some description here.</p>';
    const result = await tools.generateSeoMeta({ content: html });
    expect(result.title).not.toContain('<h1>');
  });
});
