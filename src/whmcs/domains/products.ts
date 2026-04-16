import type { WhmcsClient } from '../client.js';

export interface ProductFull {
  pid: number;
  gid: number;
  type: string;
  name: string;
  description: string;
  module: string;
  paytype: string;
  pricing: Record<string, {
    prefix: string; suffix: string;
    monthly: string; quarterly: string; semiannually: string;
    annually: string; biennially: string; triennially: string;
    msetupfee: string; asetupfee: string;
  }>;
}

export interface ProductGroup {
  id: number;
  name: string;
  headline: string;
  tagline: string;
}

export class ProductDomain {
  constructor(private client: WhmcsClient) {}

  async getProductFull(productId: number): Promise<ProductFull> {
    const res = await this.client.call<{
      products: { product: ProductFull[] };
    }>('GetProducts', { pid: productId });
    const product = res.products?.product?.[0];
    if (!product) throw new Error(`Product ${productId} not found`);
    return product;
  }

  async getProductGroups(): Promise<ProductGroup[]> {
    const res = await this.client.call<{
      productgroups: { productgroup: ProductGroup[] };
    }>('GetProductGroups');
    return res.productgroups?.productgroup ?? [];
  }

  async getClientAddons(clientId: number): Promise<Array<{
    id: number; name: string; domain: string; status: string;
    billingcycle: string; recurringamount: string;
  }>> {
    const res = await this.client.call<{
      products: { product: Array<{
        id: number; name: string; domain: string; status: string;
        billingcycle: string; recurringamount: string; groupname: string;
      }> };
    }>('GetClientsProducts', { clientid: clientId });
    return (res.products?.product ?? []).map((p) => ({
      id: p.id, name: p.name, domain: p.domain,
      status: p.status, billingcycle: p.billingcycle,
      recurringamount: p.recurringamount,
    }));
  }
}
