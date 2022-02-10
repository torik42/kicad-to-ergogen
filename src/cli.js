#!/usr/bin/env node

const fs = require('fs-extra')
const path = require('path')
const kicad_to_ergogen = require('./kicad-to-ergogen')
const pkg = require('../package.json')
const { program }= require('commander')



const footprints = function(config_file){
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
  kicad_to_ergogen.kicad_to_ergogen(config_text, path.dirname(path.resolve(config_file)), s => console.log(s))

  console.log('Done.')
}



const traces = function(unmodified_file, modified_file, out_file) {
  console.log('Reading files...')

  // read unmodified file
  let unmodified_text
  try {
      unmodified_text = fs.readFileSync(unmodified_file).toString()
  } catch (err) {
      console.error(`Could not read unmodified file "${unmodified_file}":\n${err}`)
      process.exit(2)
  }

  // read modified file
  let modified_text
  try {
      modified_text = fs.readFileSync(modified_file).toString()
  } catch (err) {
      console.error(`Could not read modified file "${modified_file}":\n${err}`)
      process.exit(2)
  }

  // create footprints
  out = kicad_to_ergogen.create_traces_list(unmodified_text, modified_text, s => console.log(s))
  fs.writeFileSync(out_file, out)

  console.log('Done.')
}


const footprint = function(footprint_file, config_file, out_file){
  
  let config = {nets: {}}
  if (config_file !== undefined) {
    console.log('Reading config file...')
    
    // read config file
    let config_text
    try {
      config_text = fs.readFileSync(config_file).toString()
    } catch (err) {
      console.error(`Could not read config file "${config_file}":\n${err}`)
      process.exit(2)
    }
    
    try {
      config = yaml.load(raw)
    } catch (err) {
      throw new Error(`Input is not valid YAML or JSON:\n${err}`)
    }
    
  }
  
  const nets = config.nets
  
  // read footprint file
  console.log('Reading footprint file...')
  let footprint_text
  try {
      footprint_text = fs.readFileSync(footprint_file).toString()
  } catch (err) {
      console.error(`Could not read footprint file "${footprint_file}":\n${err}`)
      process.exit(2)
  }
  
  out = kicad_to_ergogen.footprint(footprint_text, nets, logger=console.log)
  fs.writeFileSync(out_file, out)
  
  console.log('Done.')
}


program
  .version(pkg.version)
  
program
  .command('footprints <config-file>')
  .description('create ergogen footprint files from KiCad PCB file')
  .action(config_file => footprints(config_file))

program
  .command('traces')
  .description('create ergogen footprint file with all objects that are in KiCad file <modified> but not <plain>')
  .argument('<plain>', 'unmodified ergogen PCB output')
  .argument('<modified>', 'partly routet KiCad File')
  .requiredOption('-o, --output <file>', 'file for ergogen footprint file containing traces')
  .action((unmodified_file, modified_file,options) => traces(unmodified_file, modified_file, options.output))

program
  .command('footprint <footprint-file>')
  .description('create ergogen footprint file from KiCad footprint file')
  .requiredOption('-o, --output <file>', 'file for generated ergogen footprint file')
  .action((footprint_file, options) => footprint(footprint_file, undefined, options.output))

program.parse()
