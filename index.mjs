import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import scrapeIDGloss from './library/scrape-idgloss.mjs'
import scrapeTagsList from './library/scrape-tags-list.mjs'
import scrapeTag from './library/scrape-tag-page.mjs'
import fs from 'fs-extra'
import path from 'path'
import yaml from 'yaml'
import sanitize from 'sanitize-filename'
import parseDuration from 'parse-duration'

const { argv } = yargs(hideBin(process.argv))
  .option('url', {
    type: 'string',
    default: 'https://www.auslan.org.au',
    description: 'base url to SignBank service'
  })
  .option('tags-list', {
    type: 'boolean',
    description: 'spider the list of available tags, ignores expiry'
  })
  .option('tag', {
    alias: 't',
    type: 'array',
    description: 'specific tag or list of tags to spider, ignores expiry'
  })
  .option('id-gloss', {
    alias: 'g',
    type: 'array',
    description: 'spider a list of IDGlosses, ignores expiry'
  })
  .option('expiry', {
    alias: 'x',
    type: 'string',
    default: '7d',
    coerce: (str) => parseDuration(str),
    description: 'How old must information be, before it\'s old enough to be spidered again in autopilot mode'
  })
  .option('autopilot', {
    alias: 'a',
    type: 'boolean',
    description: 'Autopilot spiders any known information that is missing, and rechecks anything older than expiry'
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

async function shouldRefetch (config, ...path) {
  const filePath = config.storage.path(...path)
  try {
    const stats = await fs.stat(filePath)
    return (stats.mtimeMs < (Date.now() - config.expiry))
  } catch (err) {
    if (err.code === 'ENOENT') return true
    else throw err
  }
}

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
    console.error('# tag results not available:', tag)
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

  if (argv.autopilot) {
    // get tags list
    if (await shouldRefetch(argv, 'tags-list.yaml')) {
      console.log('# Loading list of tags')
      await fetchTagsList(argv)
    }

    const tagFileData = await fs.readFile(argv.storage.path('tags-list.yaml'))
    const tags = yaml.parse(tagFileData.toString('utf-8'))

    // update tag graph
    for (const tag of tags) {
      if (await shouldRefetch(argv, 'tag', `${tag}.yaml`)) {
        console.log(`# Loading tag graph for tag "${tag}"`)
        await fetchTagGraph(argv, tag)
      }
    }

    // discover all known, published, public id-glosses... this could take a moment...
    console.log('# Analysing data for every known IDGloss. This could take a moment...')
    const idGlossSet = new Set()
    // first scan through all of the tag listings
    for (const tag of tags) {
      let fileData
      try {
        fileData = await fs.readFile(argv.storage.path('tag', `${tag}.yaml`))
      } catch (err) {
        if (err.code === 'ENOENT') continue
        else throw err
      }
      const doc = yaml.parse(fileData.toString('utf-8'))
      for (const gloss of doc.publicGlosses) idGlossSet.add(gloss)
    }

    // read through every
    await fs.ensureDir(argv.storage.path('id-gloss'))
    for await (const file of await fs.opendir(argv.storage.path('id-gloss'))) {
      if (file.name.endsWith('.yaml')) {
        const fileData = await fs.readFile(argv.storage.path('id-gloss', decodeURIComponent(file.name)))
        const doc = yaml.parse(fileData.toString('utf-8'))
        idGlossSet.add(doc.idGloss)
        if (doc.nextGloss) idGlossSet.add(doc.nextGloss)
        if (doc.previousGloss) idGlossSet.add(doc.previousGloss)
      }
    }

    console.log('# Analysis complete, spidering any missing or out of date IDGlosses...')

    let allDone = false
    while (!allDone) {
      allDone = true // optimistic...
      for (const idGloss of idGlossSet) {
        if (await shouldRefetch(argv, 'id-gloss', `${idGloss}.yaml`)) {
          allDone = false // dirty, need to recheck at the end to see if we're finished
          console.log(`# Fetching IDGloss "${idGloss}"`)
          const doc = await fetchIDGloss(argv, idGloss)
          if (doc) {
            if (doc.nextGloss) idGlossSet.add(doc.nextGloss)
            if (doc.previousGloss) idGlossSet.add(doc.previousGloss)
          }
        }
      }
    }

    console.log('# All done! Should have everything now!')
  }
}

run()
