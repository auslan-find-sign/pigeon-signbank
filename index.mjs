import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import scrapeIDGloss from './library/scrape-idgloss.mjs'
import scrapeTagsList from './library/scrape-tags-list.mjs'
import scrapeTag from './library/scrape-tag-page.mjs'
import fs from 'fs-extra'
import path from 'path'
import yaml from 'yaml'
import sanitize from 'sanitize-filename'

const { argv } = yargs(hideBin(process.argv))
  .option('url', {
    type: 'string',
    default: 'https://www.auslan.org.au',
    description: 'base url to SignBank service'
  })
  .option('tags-list', {
    type: 'boolean',
    description: 'spider the list of available tags'
  })
  .option('tag', {
    alias: 't',
    type: 'array',
    description: 'specific tag or list of tags to spider'
  })
  .option('id-gloss', {
    alias: 'g',
    type: 'array',
    description: 'spider a list of IDGlosses'
  })
  .option('storage', {
    alias: 's',
    type: 'string',
    default: './signbank-data',
    coerce: (basePath) => {
      const storagePath = path.resolve(basePath)
      return {
        base: storagePath,
        path (...args) {
          return path.join(storagePath, ...args.map(x => sanitize(`${x}`, { replacement: encodeURIComponent })))
        }
      }
    },
    description: 'filesystem location to store signbank spider output'
  })

async function fetchTagsList (config) {
  const output = await scrapeTagsList(config)
  process.stdout.write(yaml.stringify({ type: 'tags-list', output }) + '...\n')
  await fs.ensureDir(config.storage.path())
  await fs.writeFile(config.storage.path('tags-list.yaml'), yaml.stringify(output))
  return output
}

async function fetchTagGraph (config, tag) {
  const output = await scrapeTag(config, tag)
  if (output) {
    process.stdout.write(yaml.stringify({ type: 'tag', output }) + '...\n')
    await fs.ensureDir(config.storage.path('tag'))
    await fs.writeFile(config.storage.path('tag', `${output.tag}.yaml`), yaml.stringify(output))
  } else {
    console.error('tag results not available:', tag)
  }
  return output
}

async function fetchIDGloss (config, idGloss) {
  const output = await scrapeIDGloss(config, idGloss)
  if (output) {
    process.stdout.write(yaml.stringify({ type: 'id-gloss', output }) + '...\n')
    await fs.ensureDir(config.storage.path('id-gloss'))
    await fs.writeFile(config.storage.path('id-gloss', `${output.idGloss}.yaml`), yaml.stringify(output))
  } else {
    console.error('id-gloss not available:', idGloss)
  }
  return output
}

async function run () {
  // scrape list of available known tags
  if (argv['tags-list']) {
    await fetchTagsList(argv)
  }

  // scrape specific tag as requested
  for (const tagName of (argv.tag || [])) {
    await fetchTagGraph(argv, tagName)
  }

  // scrape any individual id-glosses specified
  for (const idGloss of (argv['id-gloss'] || [])) {
    await fetchIDGloss(argv, idGloss)
    }
  }
}

run()
