import uri from 'uri-tag/lib-esm/uri.mjs'

function format ({ url }, path) {
  const u = new URL(path, url)
  return u.toString()
}

export function tagsList (config) {
  return format(config, uri`/dictionary/ajax/tags/`)
}

export function tagPage (config, tag, pageNum) {
  return format(config, uri`/dictionary/tag/${tag}/?query=&page=${pageNum}`)
}

export function idgloss (config, idgloss) {
  return format(config, uri`/dictionary/gloss/${idgloss}.html`)
}
