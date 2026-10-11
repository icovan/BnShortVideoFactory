/**
 * URL validation helpers for ConfigDialog / settings normalization.
 * Model streaming (ai-sdk) was removed with the legacy TextGenerate stack.
 */
import type { LlmConfig, RequestUrlIssue } from './types'

const normalizeUrl = (url: unknown) =>
  typeof url === 'string' ? url.trim().replace(/\/+$/, '') : ''

const knownEndpointPaths = ['/chat/completions', '/responses', '/messages']

const getEndpointPath = (config: LlmConfig) => {
  if (config.protocol === 'anthropic-messages') return '/messages'
  if (config.protocol === 'openai-responses') return '/responses'
  return '/chat/completions'
}

export function getRequestUrlIssue(config: LlmConfig): RequestUrlIssue | undefined {
  const baseUrl = normalizeUrl(config.apiUrl)
  if (!baseUrl) return undefined

  let parsedUrl: URL
  try {
    parsedUrl = new URL(baseUrl)
  } catch {
    return 'invalid'
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol)
    || parsedUrl.search
    || parsedUrl.hash
    || parsedUrl.username
    || parsedUrl.password
  ) {
    return 'invalid'
  }

  const path = parsedUrl.pathname.replace(/\/+$/, '').toLowerCase()
  if (knownEndpointPaths.some((endpoint) => path === endpoint || path.endsWith(endpoint))) {
    return 'full-endpoint'
  }

  return undefined
}

export function getRequestUrlHint(config: LlmConfig): string {
  const baseUrl = normalizeUrl(config.apiUrl)
  if (!baseUrl) return ''
  if (getRequestUrlIssue(config)) return ''
  return `${baseUrl}${getEndpointPath(config)}`
}
