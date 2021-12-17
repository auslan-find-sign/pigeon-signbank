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
    description: 'filesystem location to store signbank spider output'
  })

async function run () {
  // scrape list of available known tags
  if (argv['tags-list']) {
    const output = await scrapeTagsList(argv)
    process.stdout.write(yaml.stringify({ type: 'tags-list', output }) + '...\n')
    await fs.ensureDir(path.join(argv.storage, 'id-gloss'))
    await fs.writeFile(path.join(argv.storage, 'tags-list.yaml'), yaml.stringify(output))
  }

  // scrape specific tag as requested
  for (const tagName of (argv.tag || [])) {
    const output = await scrapeTag(argv, tagName)
    if (output) {
      process.stdout.write(yaml.stringify({ type: 'tag', output }) + '...\n')
      await fs.ensureDir(path.join(argv.storage, 'tag'))
      await fs.writeFile(path.join(argv.storage, 'tag', sanitize(`${output.tag}.yaml`, { replacement: encodeURIComponent })), yaml.stringify(output))
    } else {
      console.error('tag results not available:', tagName)
    }
  }

  // scrape any individual id-glosses specified
  for (const idGloss of (argv['id-gloss'] || [])) {
    const output = await scrapeIDGloss(argv, idGloss)
    if (output) {
      process.stdout.write(yaml.stringify({ type: 'id-gloss', output }) + '...\n')
      await fs.ensureDir(path.join(argv.storage, 'id-gloss'))
      await fs.writeFile(path.join(argv.storage, 'id-gloss', sanitize(`${output.idGloss}.yaml`, { replacement: encodeURIComponent })), yaml.stringify(output))
    } else {
      console.error('id-gloss not available:', idGloss)
    }
  }
}

run()
