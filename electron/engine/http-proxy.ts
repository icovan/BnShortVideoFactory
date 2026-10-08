/**
 * 渲染进程 → 主进程 → packages/create-core（Remotion/Manim）HTTP
 */
import http from 'node:http'
import https from 'node:https'
import { startEngineRuntime } from './runtime'

export type EngineProxyRequest = {
  path: string
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

export type EngineProxyResponse = {
  status: number
  headers: Record<string, string>
  body: string
}

async function ensureBase(): Promise<string> {
  const st = await startEngineRuntime()
  if (!st.ready) throw new Error(st.error || '成片核心未就绪')
  return st.url.replace(/\/$/, '')
}

function requestOnce(
  urlStr: string,
  method: string,
  headers: Record<string, string>,
  body?: string | null,
): Promise<EngineProxyResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          Accept: 'application/json',
          ...headers,
          ...(body != null ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
        timeout: 600_000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        res.on('end', () => {
          const outHeaders: Record<string, string> = {}
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') outHeaders[k] = v
            else if (Array.isArray(v)) outHeaders[k] = v.join(', ')
          }
          resolve({
            status: res.statusCode || 500,
            headers: outHeaders,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('成片核心请求超时'))
    })
    if (body != null) req.write(body)
    req.end()
  })
}

export async function proxyEngineRequest(input: EngineProxyRequest): Promise<EngineProxyResponse> {
  const base = await ensureBase()
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`
  const method = (input.method || 'GET').toUpperCase()
  return requestOnce(`${base}${path}`, method, input.headers || {}, input.body)
}
