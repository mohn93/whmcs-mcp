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

  async getModuleLog(
    serviceId: number,
    options: { limit?: number } = {},
  ): Promise<Array<{ date: string; user: string; userid: number; description: string }>> {
    const res = await this.client.call<{
      activity: { entry: Array<{ date: string; user: string; userid: number; description: string }> };
    }>('GetActivityLog', {
      description: `Service ID ${serviceId}`,
      limitnum: options.limit ?? 50,
    });
    const entries = res.activity?.entry ?? [];
    return entries.filter(
      (e) =>
        new RegExp(
          `\\b(Service ID ${serviceId}|Service #${serviceId}|service ${serviceId})\\b`,
          'i',
        ).test(e.description) || /Module /i.test(e.description),
    );
  }

  async getModuleQueue(caps: { hasModuleQueue: boolean }): Promise<
    | { supported: true; items: Array<{
        id: number; service_type: string; service_id: number;
        module: string; action: string; related_id: number;
        last_attempt: string; last_attempt_error: string;
      }> }
    | { supported: false; reason: string }
  > {
    if (!caps.hasModuleQueue) {
      return {
        supported: false,
        reason: 'ModuleQueue API action requires WHMCS 8.0 or later.',
      };
    }
    const res = await this.client.call<{
      queue: { item: Array<{
        id: number; service_type: string; service_id: number;
        module: string; action: string; related_id: number;
        last_attempt: string; last_attempt_error: string;
      }> };
    }>('ModuleQueue');
    return { supported: true, items: res.queue?.item ?? [] };
  }

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

  async getServerUsage(): Promise<
    Array<{
      id: number; name: string; hostname: string; ip: string;
      module: string; active: boolean;
      used: number; capacity: number; percentUsed: number; headroom: number;
    }>
  > {
    const res = await this.client.call<{
      servers: Array<{
        id: number; name: string; hostname: string; ipaddress: string;
        noofservices: number; maxallowedservices: number; percentused: number;
        activestatus: boolean; module: string;
      }>;
    }>('GetServers');

    return (res.servers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      hostname: s.hostname,
      ip: s.ipaddress,
      module: s.module,
      active: s.activestatus,
      used: s.noofservices,
      capacity: s.maxallowedservices,
      percentUsed: s.percentused,
      headroom: Math.max(0, s.maxallowedservices - s.noofservices),
    }));
  }
}
