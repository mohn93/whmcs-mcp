import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

export interface MockRequest {
  params: URLSearchParams;
  rawBody: string;
}

export interface MockWhmcsServer {
  url: string;
  stop: () => Promise<void>;
  lastRequest: () => MockRequest | undefined;
  setFixture: (action: string, response: unknown) => void;
}

interface MockOptions {
  fixtures?: Record<string, unknown>;
}

export async function startMockWhmcs(options: MockOptions = {}): Promise<MockWhmcsServer> {
  const fixtures = new Map<string, unknown>(Object.entries(options.fixtures ?? {}));
  let last: MockRequest | undefined;

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const params = new URLSearchParams(body);
      last = { params, rawBody: body };
      const action = params.get('action') ?? '';
      const fixture = fixtures.get(action);
      res.setHeader('Content-Type', 'application/json');
      if (fixture === undefined) {
        res.statusCode = 200;
        res.end(JSON.stringify({ result: 'error', message: `unknown action: ${action}` }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(fixture));
    });
  };

  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
    lastRequest: () => last,
    setFixture: (action, response) => fixtures.set(action, response),
  };
}
