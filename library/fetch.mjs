import fetch from 'cross-fetch'

const defaultOptions = {
  headers: { 'user-agent': '@auslan-find-sign/pigeon-signbank' }
}

export async function timedFetch (url, init = {}) {
  // AbortController was added in node v14.17.0 globally
  const AbortController = globalThis.AbortController || (await import('abort-controller')).AbortController

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, init.timeout || 5000)

  try {
    const response = await fetch(url, { ...defaultOptions, ...init, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

export default async function retryFetch (url, init = {}) {
  let attempt = 1
  const maxAttempt = 5
  let abortErr

  while (attempt <= maxAttempt) {
    try {
      const response = await timedFetch(url, init)
      return response
    } catch (error) {
      abortErr = error
    }
    attempt += 1
  }

  throw abortErr
}
