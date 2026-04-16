import type { WhmcsClient } from '../client.js';

export interface GetStatsResult {
  income_today: string;
  income_thismonth: string;
  income_thisyear: string;
  income_alltime: string;
  orders_pending_count: number;
  tickets_awaitingreply_count: number;
  invoices_unpaid_count: number;
}

export class SystemDomain {
  constructor(private client: WhmcsClient) {}

  async getStats(): Promise<GetStatsResult> {
    const res = await this.client.call<{ stats: GetStatsResult }>('GetStats');
    return res.stats;
  }
}
