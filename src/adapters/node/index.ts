/**
 * TLL OS - Node.js Runtime Adapter
 *
 * Node.js 运行时适配器实现。
 * 这是 TLL OS 的第一 Runtime Adapter。
 *
 * 架构修正：TLL OS 不与 Node.js 永久绑定。
 * 未来可以通过实现 Runtime Adapter 接口来支持 Bun、Deno 等运行时。
 */

import type { RuntimeAdapter, HttpMethod } from '../../public/types.js';

export function createNodeAdapter(): RuntimeAdapter {
  return {
    name: 'node',
    version: process.version,

    fs: {
      async readFile(path: string): Promise<string> {
        const fs = await import('node:fs/promises');
        return fs.readFile(path, 'utf-8');
      },
      async writeFile(path: string, data: string): Promise<void> {
        const fs = await import('node:fs/promises');
        await fs.writeFile(path, data, 'utf-8');
      },
      async exists(path: string): Promise<boolean> {
        const fs = await import('node:fs/promises');
        try {
          await fs.access(path);
          return true;
        } catch {
          return false;
        }
      },
      async readDir(path: string): Promise<string[]> {
        const fs = await import('node:fs/promises');
        return fs.readdir(path);
      },
    },

    env: {
      get(key: string): string | undefined {
        return process.env[key];
      },
      set(key: string, value: string): void {
        process.env[key] = value;
      },
      all(): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
          if (value !== undefined) result[key] = value;
        }
        return result;
      },
    },

    process: {
      exit(code?: number): void {
        process.exit(code);
      },
      cwd(): string {
        return process.cwd();
      },
    },

    // HTTP 服务器（PoC 中可选，真实实现中用于启动 HTTP 服务）
    createServer(handler) {
      // 延迟导入，避免在非 HTTP 场景下加载 http 模块
      let server: import('node:http').Server | null = null;

      return {
        async listen(port: number): Promise<void> {
          const http = await import('node:http');
          server = http.createServer(async (req, res) => {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined;

            const request = {
              method: (req.method ?? 'GET').toUpperCase() as HttpMethod,
              path: req.url ?? '/',
              headers: req.headers as Record<string, string>,
              query: {},
              params: {},
              body,
            };

            const response = await handler(request as never);
            res.writeHead(response.status, response.headers);
            res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
          });
          return new Promise((resolve) => server!.listen(port, () => resolve()));
        },
        async close(): Promise<void> {
          return new Promise((resolve, reject) => {
            if (server) server.close((err) => err ? reject(err) : resolve());
            else resolve();
          });
        },
      };
    },
  };
}
