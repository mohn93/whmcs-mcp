import type { WhmcsClient } from '../client.js';

export interface ServiceDetails {
  id: number;
  clientid: number;
  orderid: number;
  pid: number;
  name: string;
  groupname: string;
  domain: string;
  status: string;
  regdate: string;
  nextduedate: string;
  billingcycle: string;
  recurringamount: string;
  paymentmethod: string;
  server?: {
    id: number;
    name: string;
    hostname: string;
    ip: string;
  };
  username: string;
}

interface RawProduct {
  id: number; clientid: number; orderid: number; pid: number;
  name: string; groupname: string; domain: string; status: string;
  regdate: string; nextduedate: string; billingcycle: string;
  recurringamount: string; paymentmethod: string;
  serverid: number; servername: string; serverhostname: string; serverip: string;
  username: string;
}

export class ProvisioningDomain {
  constructor(private client: WhmcsClient) {}

  async getServiceDetails(serviceId: number): Promise<ServiceDetails> {
    const res = await this.client.call<{
      totalresults: number;
      products: { product: RawProduct[] };
    }>('GetClientsProducts', { serviceid: serviceId });

    const product = res.products?.product?.[0];
    if (!product) {
      throw new Error(`Service ${serviceId} not found`);
    }
    return {
      id: product.id,
      clientid: product.clientid,
      orderid: product.orderid,
      pid: product.pid,
      name: product.name,
      groupname: product.groupname,
      domain: product.domain,
      status: product.status,
      regdate: product.regdate,
      nextduedate: product.nextduedate,
      billingcycle: product.billingcycle,
      recurringamount: product.recurringamount,
      paymentmethod: product.paymentmethod,
      username: product.username,
      server: product.serverid
        ? {
            id: product.serverid,
            name: product.servername,
            hostname: product.serverhostname,
            ip: product.serverip,
          }
        : undefined,
    };
  }
}
