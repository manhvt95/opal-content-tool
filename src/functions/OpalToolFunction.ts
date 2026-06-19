import { logger } from '@zaiusinc/app-sdk';
import { ToolFunction } from '@optimizely-opal/opal-tool-ocp-sdk';

// Importing ContentTools registers all @tool decorators globally with the SDK.
// No additional wiring is needed — the ToolFunction base class handles
// /discovery, /ready, and request routing automatically.
import '../tools/ContentTools';

/**
 * OpalToolFunction
 *
 * Entry point for the Content Intelligence Opal tool.
 * Name must match both the file name and the `entry_point` value in app.yml.
 *
 * Tools provided:
 *   - analyze_content      → content quality score + readability metrics
 *   - generate_seo_meta    → SEO title + meta description generator
 */
export class OpalToolFunction extends ToolFunction {

  /**
   * Health check — called by the /ready endpoint.
   * Add any startup validation here (API key checks, DB pings, etc.).
   */
  protected async ready(): Promise<boolean> {
    logger.info('OpalToolFunction ready check passed');
    return true;
  }
}
