#!/usr/bin/env node

const fs = require('fs-extra')
// const path = require('path')
const yaml = require('js-yaml')
const kicad_to_ergogen = require('./kicad-to-ergogen')
const pkg = require('../package.json')
const yargs = require('yargs')

// command line arguments
const args = yargs.argv

const config_file = args._[0]
if (!config_file) {
    console.error('Usage: kicad-to-ergogen <config_file> [options]')
    process.exit(1)
}

console.log('Reading config file...')

// read config file
let config_text
try {
    config_text = fs.readFileSync(config_file).toString()
} catch (err) {
    console.error(`Could not read config file "${config_file}":\n${err}`)
    process.exit(2)
}

// create footprints
kicad_to_ergogen.kicad_to_ergogen(config_text, s => console.log(s))

console.log('Done.')
