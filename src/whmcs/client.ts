import type { WhmcsApiResponse, WhmcsClientConfig } from './types.js';

export class WhmcsClient {
  private baseUrl: string;

  constructor(private config: WhmcsClientConfig) {
    this.baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
  }

  async call<T extends Record<string, unknown> = Record<string, unknown>>(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<T & WhmcsApiResponse> {
    const body = new URLSearchParams({
      action,
      identifier: this.config.identifier,
      secret: this.config.secret,
      responsetype: 'json',
      ...(this.config.accesskey ? { accesskey: this.config.accesskey } : {}),
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ),
    });

    const url = `${this.baseUrl}includes/api.php`;

    if (process.env.WHMCS_DEBUG === 'true') {
      console.error(`[whmcs-mcp] → ${action}`, Object.fromEntries(
        Object.entries(params).filter(([k]) => k !== 'secret' && k !== 'identifier'),
      ));
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err) {
      throw new Error(`WHMCS connection error (${action}): ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new Error(`WHMCS HTTP error (${action}): ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();

    if (process.env.WHMCS_DEBUG === 'true') {
      console.error(`[whmcs-mcp] ← ${action} (${res.status}): ${rawText.slice(0, 500)}`);
    }

    // WHMCS sometimes returns HTML (PHP errors/warnings) instead of JSON
    let data: T & WhmcsApiResponse;
    try {
      data = JSON.parse(rawText) as T & WhmcsApiResponse;
    } catch {
      // Extract useful info from the HTML error
      const snippet = rawText.slice(0, 300).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(
        `WHMCS returned non-JSON response for "${action}". ` +
        `This usually means WHMCS has PHP errors/warnings enabled, or the API action is not supported. ` +
        `Response preview: ${snippet}`,
      );
    }

    if (data.result === 'error') {
      throw new Error(`WHMCS API error (${action}): ${data.message ?? 'unknown'}`);
    }

    return data;
  }
}
