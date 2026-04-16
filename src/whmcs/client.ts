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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`WHMCS HTTP error (${action}): ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as T & WhmcsApiResponse;

    if (data.result === 'error') {
      throw new Error(`WHMCS API error (${action}): ${data.message ?? 'unknown'}`);
    }

    return data;
  }
}
