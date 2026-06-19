import { logger } from '@zaiusinc/app-sdk';
import { tool, ParameterType, OptiIdAuthData } from '@optimizely-opal/opal-tool-ocp-sdk';

// ─── Parameter interfaces ─────────────────────────────────────────────────────

interface AnalyzeContentParameters {
  content: string;
  target_keywords?: string;   // comma-separated
  content_type?: string;      // 'blog' | 'product' | 'landing_page' | 'email'
}

interface GenerateSeoMetaParameters {
  content: string;
  brand_name?: string;
  max_title_length?: number;
  max_description_length?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}

function averageWordsPerSentence(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  return sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0;
}

/**
 * Flesch Reading Ease approximation.
 * Score 90-100: very easy, 60-70: standard, 0-30: very difficult.
 */
function fleschReadingEase(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  const syllables = countSyllables(text);
  if (words === 0 || sentences === 0) return 0;
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

function countSyllables(text: string): number {
  // Simple syllable heuristic — count vowel groups per word
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .reduce((total, word) => {
      const matches = word.match(/[aeiou]+/g);
      const count = matches ? matches.length : 1;
      // subtract silent trailing 'e'
      const adjusted = word.endsWith('e') && count > 1 ? count - 1 : count;
      return total + Math.max(1, adjusted);
    }, 0);
}

function readabilityLabel(score: number): string {
  if (score >= 90) return 'Very Easy';
  if (score >= 70) return 'Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Difficult';
}

function keywordDensity(content: string, keyword: string): number {
  const words = content.toLowerCase().split(/\s+/);
  const kw = keyword.toLowerCase().trim();
  const occurrences = words.filter(w => w.includes(kw)).length;
  return words.length > 0 ? Math.round((occurrences / words.length) * 1000) / 10 : 0;
}

function recommendedWordCount(contentType: string): { min: number; max: number } {
  switch (contentType) {
  case 'blog':         return { min: 800, max: 2000 };
  case 'product':      return { min: 150, max: 500 };
  case 'landing_page': return { min: 300, max: 800 };
  case 'email':        return { min: 50,  max: 300 };
  default:             return { min: 300, max: 1500 };
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3).trimEnd() + '...';
}

/**
 * Naively extract a candidate title from the first sentence
 * and a meta description from the first 2–3 sentences.
 */
function extractLeadSentences(text: string, count: number): string {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(0, count)
    .join(' ');
}

// ─── Tool class ───────────────────────────────────────────────────────────────

export class ContentTools {

  /**
   * Tool 1: Analyze Content
   *
   * Scores content quality across readability, word count, keyword usage,
   * and structural signals. Returns actionable recommendations.
   */
  @tool({
    name: 'analyze_content',
    description:
      'Analyzes content quality and returns a score with readability metrics, ' +
      'keyword density, and actionable improvement recommendations. ' +
      'Accepts plain text or HTML (tags are stripped).',
    endpoint: '/tools/analyze_content',
    parameters: [
      {
        name: 'content',
        type: ParameterType.String,
        description: 'The content body to analyze. Plain text or HTML.',
        required: true,
      },
      {
        name: 'target_keywords',
        type: ParameterType.String,
        description: 'Comma-separated list of target keywords to check density for.',
        required: false,
      },
      {
        name: 'content_type',
        type: ParameterType.String,
        description:
          'Content category used for word-count benchmarking. ' +
          'Accepted values: blog, product, landing_page, email. Defaults to blog.',
        required: false,
      },
    ],
  })
  public async analyzeContent(
    parameters: AnalyzeContentParameters,
    _authData?: OptiIdAuthData,
  ) {
    logger.info('analyze_content called', { content_type: parameters.content_type });

    // Strip HTML tags for clean analysis
    const plainText = parameters.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const contentType = parameters.content_type ?? 'blog';
    const wordCount = countWords(plainText);
    const sentenceCount = countSentences(plainText);
    const avgWordsPerSentence = averageWordsPerSentence(plainText);
    const fleschScore = fleschReadingEase(plainText);
    const { min, max } = recommendedWordCount(contentType);

    // ── Keyword analysis ──────────────────────────────────────────────────────
    const keywordResults: Array<{ keyword: string; density_percent: number; verdict: string }> = [];
    if (parameters.target_keywords) {
      const keywords = parameters.target_keywords.split(',').map(k => k.trim()).filter(Boolean);
      for (const kw of keywords) {
        const density = keywordDensity(plainText, kw);
        let verdict = 'Good';
        if (density === 0)   verdict = 'Missing — add this keyword';
        else if (density < 0.5) verdict = 'Low — consider using more often';
        else if (density > 3)   verdict = 'High — risk of keyword stuffing';
        keywordResults.push({ keyword: kw, density_percent: density, verdict });
      }
    }

    // ── Scoring ───────────────────────────────────────────────────────────────
    let score = 100;
    const recommendations: string[] = [];

    // Readability (30 pts)
    if (fleschScore < 30) {
      score -= 30;
      recommendations.push('Content is very difficult to read. Shorten sentences and use simpler vocabulary.');
    } else if (fleschScore < 60) {
      score -= 15;
      recommendations.push('Readability is below standard. Aim for shorter sentences (under 20 words on average).');
    }

    // Word count (25 pts)
    if (wordCount < min) {
      score -= 25;
      recommendations.push(`Content is too short (${wordCount} words). Aim for at least ${min} words for a ${contentType}.`);
    } else if (wordCount > max) {
      score -= 10;
      recommendations.push(`Content may be too long (${wordCount} words). Consider trimming to under ${max} words.`);
    }

    // Sentence length (20 pts)
    if (avgWordsPerSentence > 25) {
      score -= 20;
      recommendations.push(`Average sentence length is ${avgWordsPerSentence} words — too long. Break sentences up.`);
    } else if (avgWordsPerSentence > 20) {
      score -= 10;
      recommendations.push(`Average sentence length (${avgWordsPerSentence} words) is slightly high. Try to keep it under 20.`);
    }

    // Keywords (25 pts)
    if (keywordResults.length > 0) {
      const missing = keywordResults.filter(k => k.density_percent === 0);
      const stuffed = keywordResults.filter(k => k.density_percent > 3);
      if (missing.length > 0) {
        score -= 15;
        recommendations.push(`Missing keywords: ${missing.map(k => k.keyword).join(', ')}.`);
      }
      if (stuffed.length > 0) {
        score -= 10;
        recommendations.push(`Overused keywords (possible stuffing): ${stuffed.map(k => k.keyword).join(', ')}.`);
      }
    }

    score = Math.max(0, score);

    let grade = 'A';
    if (score < 90) grade = 'B';
    if (score < 75) grade = 'C';
    if (score < 60) grade = 'D';
    if (score < 45) grade = 'F';

    return {
      score,
      grade,
      summary: recommendations.length === 0
        ? 'Content looks great! No major issues found.'
        : `${recommendations.length} issue(s) found. See recommendations.`,
      metrics: {
        word_count: wordCount,
        sentence_count: sentenceCount,
        avg_words_per_sentence: avgWordsPerSentence,
        flesch_reading_ease: fleschScore,
        readability_label: readabilityLabel(fleschScore),
        content_type: contentType,
        recommended_word_count: `${min}–${max}`,
      },
      keyword_analysis: keywordResults,
      recommendations,
    };
  }

  /**
   * Tool 2: Generate SEO Meta
   *
   * Generates an SEO-optimised title tag and meta description from content.
   */
  @tool({
    name: 'generate_seo_meta',
    description:
      'Generates an SEO-optimised <title> tag and meta description from the provided content. ' +
      'Respects character limits (default: 60 chars for title, 160 for description).',
    endpoint: '/tools/generate_seo_meta',
    parameters: [
      {
        name: 'content',
        type: ParameterType.String,
        description: 'The content body (plain text or HTML) to generate meta tags from.',
        required: true,
      },
      {
        name: 'brand_name',
        type: ParameterType.String,
        description: 'Optional brand name appended to the title (e.g. "| Acme Inc.").',
        required: false,
      },
      {
        name: 'max_title_length',
        type: ParameterType.Integer,
        description: 'Maximum title character length. Defaults to 60.',
        required: false,
      },
      {
        name: 'max_description_length',
        type: ParameterType.Integer,
        description: 'Maximum meta description character length. Defaults to 160.',
        required: false,
      },
    ],
  })
  public async generateSeoMeta(
    parameters: GenerateSeoMetaParameters,
    _authData?: OptiIdAuthData,
  ) {
    logger.info('generate_seo_meta called', { brand: parameters.brand_name });

    const plainText = parameters.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const maxTitle = parameters.max_title_length ?? 60;
    const maxDesc  = parameters.max_description_length ?? 160;

    // Title: first sentence, capitalised, with optional brand suffix
    const firstSentence = plainText.split(/[.!?]/)[0].trim();
    // Capitalise first letter
    const rawTitle = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);

    let title: string;
    if (parameters.brand_name) {
      const suffix = ` | ${parameters.brand_name}`;
      const availableForTitle = maxTitle - suffix.length;
      title = truncate(rawTitle, availableForTitle) + suffix;
    } else {
      title = truncate(rawTitle, maxTitle);
    }

    // Description: first 2-3 sentences, truncated to limit
    const leadText = extractLeadSentences(plainText, 3);
    const description = truncate(leadText, maxDesc);

    // Quality hints
    const warnings: string[] = [];
    if (title.length < 30) {
      warnings.push('Title is quite short. Consider adding more descriptive context.');
    }
    if (description.length < 100) {
      warnings.push('Meta description is short. Google typically prefers 120–160 characters.');
    }
    if (description.endsWith('...')) {
      warnings.push('Description was truncated. Consider editing your content lead paragraph to be more concise.');
    }

    return {
      title,
      description,
      character_counts: {
        title: title.length,
        description: description.length,
      },
      limits: {
        max_title: maxTitle,
        max_description: maxDesc,
      },
      warnings,
      html_snippet: `<title>${title}</title>\n<meta name="description" content="${description}">`,
    };
  }
}
