/**
 * Legacy Electron harness tested the removed Home copywriting stack (ai-sdk stream).
 * APP LLM for films runs in packages/create-core — keep this script as a no-op exit
 * so `pnpm test:electron-llm` does not break CI/scripts that still call it.
 */
console.log('[test:electron-llm] skipped — legacy copywriting Electron harness removed')
process.exit(0)
