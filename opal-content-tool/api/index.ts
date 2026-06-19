import type { VercelRequest, VercelResponse } from '@vercel/node';
import '../src/functions/OpalToolFunction';
import { getRegisteredTools } from '@optimizely-opal/opal-tool-ocp-sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split('?')[0];

  if (path === '/ready') {
    return res.status(200).json({ status: 'ok' });
  }

  if (path === '/discovery') {
    const tools = getRegisteredTools();
    return res.status(200).json({ tools });
  }

  return res.status(404).json({ error: 'Not found', path });
}