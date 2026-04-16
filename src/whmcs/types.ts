export interface WhmcsApiResponse {
  result: 'success' | 'error';
  message?: string;
}

export interface WhmcsClientConfig {
  apiUrl: string;
  identifier: string;
  secret: string;
  accesskey?: string;
}
