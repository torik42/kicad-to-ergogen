const fs = require("fs-extra");
const sexp_parser = require("./sexp-parser");
const SExp = require('./sexp').SExp;
const yaml = require('js-yaml')


const gen_at_in_area = function (area) {
  return (at) => {return at[0] >= area.x_min && at[0] <= area.x_max
      && at[1] >= area.y_min && at[1] <= area.y_max}
}

const add_shift = function (at, shift) {
  at[0] += shift[0]
  at[1] += shift[1]
  return at
}

const add_rot = function (at, rot) {
  if (at.length == 2) at.push(0)
  at[2] += rot
  return at
}

const rotate = function (at, rot) {
  rot = rot/180*Math.PI
  const new_x = Math.cos(rot) * at[0] + Math.sin(rot) * at[1]
  const new_y = -Math.sin(rot) * at[0] + Math.cos(rot) * at[1]
  at[0] = new_x
  at[1] = new_y
  return at
}

/**
 * Elements at top level, whose at-property has a rotation.
 */
const HAS_ROT = ['pad', 'fp_text', 'module']
/**
 * Elements in a module, whose at-property has a rotation.
 */
const MODULE_ROTATE = ['pad', 'fp_text']
/**
 * A Previx, which all keys of the netlist of the footprint get.
 * currently CN for custom net
 */
const NET_PREFIX = 'CN'


/**
 * js code for transformation written to footprint files.
 */
const TRANSFORM_STRING = [
  'const add_shift = function (at, shift) {',
  '  at[0] += shift[0]',
  '  at[1] += shift[1]',
  '  return at',
  '}',
  '',
  'const add_rot = function (at, rot) {',
  '  if (at.length == 2) at.push(0)',
  '  at[2] += rot',
  '  return at',
  '}',
  '',
  'const rotate = function (at, rot) {',
  '  rot = rot/180*Math.PI',
  '  const new_x = Math.cos(rot) * at[0] + Math.sin(rot) * at[1]',
  '  const new_y = -Math.sin(rot) * at[0] + Math.cos(rot) * at[1]',
  '  at[0] = new_x',
  '  at[1] = new_y',
  '  return at',
  '}',
  '',
  'const transform = function (at, shift, rot, change_shift, change_rot) {',
  '  if (change_shift) at = add_shift(rotate(at, rot), shift)',
  '  if (change_rot) at = add_rot(at, rot)',
  '  return at.join(\' \')',
  '}',
  ''
].join('\n')

const inv_transform = function (at, shift, rot, change_shift, change_rot) {
  if (change_shift) at = rotate(add_shift(at, shift.map(x => -x)), -rot)
  if (change_rot) at = add_rot(at, -rot)
  return at
}

const output_tranform = function (at, change_shift, change_rot) {
  if (change_rot && !change_shift) return `${at.slice(0,2).join(' ')} \$\{${at[2] || 0} + p.rot\}`
  return `\$\{transform([${at}], [p.x,p.y], p.rot, ${change_shift}, ${change_rot})\}`
}


const create_footprint = exports.create_footprint = function(raw, base_point, base_rotate, area, logger=()=>{}) {
  const board = sexp_parser.parse(raw)
  /**
   * List of all Elements, we want to keep.
  */
  const group = []
  const all_nets = {}
  const nets_numbers = new Set()
  const is_in_area = gen_at_in_area(area)
  var c_index = undefined

  for (const elem of board.valuesIf('kicad_pcb')) {
    
    if (typeof elem == 'object'){
      
      // collect all nets
      if (elem.key == 'net') {
        all_nets[elem.values[0]] = elem.values[1].replace(/\"/g, "")
      }
    
      // if the element is a module, change the rotation of its subelements
      // and modify the nets
      if (elem.key == 'module') {
        for (const mod_elem of elem.values) {
          if (typeof mod_elem == 'object'){
            if (mod_elem.key != 'model') {
              const transform = (at) => {
                var out = inv_transform(at, base_point, base_rotate, false, MODULE_ROTATE.includes(mod_elem.key))
                out = [output_tranform(out, false, HAS_ROT.includes(mod_elem.key))]
                return out
              }
              mod_elem.change_at('at', true, transform)
            }
      
            var c_net = mod_elem.getNet()
            nets_numbers.add(c_net)
            c_index = mod_elem.indexOf('net')
            if (c_net != undefined){
              // nets of pads etc have syntax (net <net-number> <net-name>)
              mod_elem.values[c_index] = `\$\{p.net.${NET_PREFIX}${c_net}.str\}`
            }
            
          }
        }
      }
      
      // if elem has 'at' attribute, modify it
      const transform = (at) => {
        var out = inv_transform(at, base_point, base_rotate, true, HAS_ROT.includes(elem.key))
        out = [output_tranform(out, true, HAS_ROT.includes(elem.key))]
        return out
      }
      if (elem.change_at('at', is_in_area, transform)) {
        nets_numbers.add(elem.getNet())
        group.push(elem)
      }
      
      if (elem.key == 'zone') {
        var is_included = true
        for (const pt of elem.sexpOf('polygon').sexpOf('pts').values) {
          var xy = pt.values.map(x => +(x))
          if (is_in_area(xy)) {
            xy = inv_transform(xy, base_point, base_rotate, true, false)
            xy = output_tranform(xy, true, false)
            pt.values = [xy]
          } else {
            is_included = false
            break
          }
        }
        if (is_included) {
          const index_filled_polygon = elem.indexOf('filled_polygon')
          if (index_filled_polygon != undefined) {
            elem.values.splice(index_filled_polygon, 1)
          }
          group.push(elem)
        }
      }
      
      // transform traces which have (start …) (end …) instead of (at …)
      if (true){
        const transform = (at) => {
          var out = inv_transform(at, base_point, base_rotate, true, HAS_ROT.includes(elem.key))
          out = [output_tranform(out, true, HAS_ROT.includes(elem.key))]
          return out
        }
        if (elem.change_at('start', is_in_area, transform) &&
        elem.change_at('end', is_in_area, transform)) {
          group.push(elem)
          nets_numbers.add(elem.getNet())
        }
      }
    }
  }

  // collect all used nets
  const nets = {}
  for (const net of nets_numbers.values()) {
    if (net != undefined) {
      nets[NET_PREFIX + net] = all_nets[net]
    }
  }
  
  
  // create the footprint file
  const out = TRANSFORM_STRING + `
module.exports = \{
    nets: ${JSON.stringify(nets, null, 8)},
    params: \{
      class: 'custom'
    \},
    body: p => \{
      return \`${group.map(x => x.toString()).join('\n').replace(/\n/g, "\n    ")}\`
    \}
  \}`

  return out
}

exports.kicad_to_ergogen = function(raw, logger=()=>{}) {
  let config
  try {
    config = yaml.load(raw)
  } catch (err) {
    throw new Error(`Input is not valid YAML or JSON:\n${err}`)
  }
  if (!config.modules) {
    throw new Error('Input does not contain a modules clause!')
  }
  if (!config.modules.length) {
    throw new Error('Input does not contain any modules!')
  }
  for (module of config.modules){
    if (!module.file) {
      module.file = config.file
    }
    if (!module.out) {
      module.out = config.outdir + "/" + module.name + ".js"
    }
    if (module.reference == 'centre') {
      const area = module.area
      module.reference = [(area.x_min + area.x_max)/2, (area.y_min + area.y_max)/2]
    }
  }
  for (module of config.modules){
    logger(`Work on ${module.name}.`)
    let raw
    try {
      raw = fs.readFileSync(module.file).toString();
    } catch (err) {
      console.error(`Could not read config file "${module.file}":\n${err}`)
      process.exit(2)
    }
    const out = create_footprint(raw, module.reference, module.rotation, module.area, logger)
    fs.writeFileSync(module.out, out)
  }
}
