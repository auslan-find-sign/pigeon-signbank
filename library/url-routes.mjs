import uri from 'uri-tag/lib-esm/uri.mjs'

export function tagsList ({ url }) {
  return uri`${uri.raw(url)}/dictionary/ajax/tags/`
}

export function tagPage ({ url }, tag, pageNum) {
  return uri`${uri.raw(url)}/dictionary/tag/${tag}/?query=&page=${pageNum}`
}

export function idgloss ({ url }, idgloss) {
  return uri`${uri.raw(url)}/dictionary/gloss/${idgloss}.html`
}
