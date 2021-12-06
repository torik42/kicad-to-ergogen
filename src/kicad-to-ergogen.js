const fs = require("fs-extra");
const sexp_parser = require("./sexp-parser");
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
 * A Prefix, which all nets in the footprint get.
 * Currently CN for custom net
 */
const NET_PREFIX = 'CN'

/**
 * Make KiCad position into relative position.
 * Shift `at` attribute by `-shift` and then rotated by `-rot`.
 * Then change the rotation property (i.e. `at[2]`) by `-rot`.
 * @param {at} array - array like [<x pos>, <y pos>] or [<x pos>, <y pos>, <rotation>]
 * @param {shift} array - [<x shift>, <y shift>]
 * @param {rot} number - additional rotation
 * @param {change_shift} boolean - the position is only changed, if this key is true
 * @param {change_rot} boolean - the rotation is only changed, if this key is true
 */
const inv_transform = function (at, shift, rot, change_shift, change_rot) {
  if (change_shift) at = rotate(add_shift(at, shift.map(x => -x)), -rot)
  if (change_rot) at = add_rot(at, -rot)
  return at
}

/**
 * Create the Output for the ergogen footprint file,
 * which takes care of positioning.
 * Arguments as with `inv_transform`
 */
const output_tranform = function (at, change_shift, change_rot) {
  let out = ''
  // if (change_rot && at.length == 2) at.push(0)
  if (change_shift) {
    out += `\$\{p.xy(${at[0]}, ${at[1]})\}`
  } else {
    out += at.slice(0,2).join(' ')
  }
  if (change_rot) {
    if (at.length == 2 || at[2] == 0) out += ' ${p.rot}'
    else out += ` \$\{${at[2]} + p.rot\}`
  } else {
    if (at.length == 3) out += ` ${at[2]}`
  }
  return out
}

const modify_net = (elem, all_nets) => {
  // get net index
  const c_net = elem.getNet()
  // proceed if net present and net not ""
  if (c_net != undefined && c_net > 0) {
    const netsexp = elem.sexpOf('net')
    // nets are either specified as (net <net_index> <net_name>)
    // or (net <net_index>), sometimes accompanied by (net_name <net_name>)
    if (netsexp.values.length == 1) {
      netsexp.values[0] =  `\$\{p.net["${all_nets[c_net]}"].index\}`
      const netnamesexp = elem.sexpOf('net_name')
      if (netnamesexp) netnamesexp.values[0] = `\$\{p.net["${all_nets[c_net]}"].name\}`
    } else if (netsexp.values.length == 2) {
      elem.values[elem.indexOf('net')] = `\$\{p.net["${all_nets[c_net]}"].str\}`
    }
  }
}

/*
 * Collects all nets from a KiCad file
 */
const get_all_nets = function (pcb) {
  const nets_sexpr = pcb.filter(x => x.key == 'net')
  const all_nets = {}
  for (x of nets_sexpr) {
    all_nets[x.values[0]] = x.values[1].replace(/\"/g, "").replace(/\//g, "").replace(/\./g, "-")
  }
  return all_nets
}


const create_footprint_file = function(nets, body_sexpr) {
  // create the footprint file
  const out = `module.exports = \{
    nets: ${JSON.stringify(nets, null, 8)},
    params: \{
      class: 'custom'
    \},
    body: p => \{
      return \`${body_sexpr.map(x => x.toString()).join('\n').replace(/\n/g, "\n    ")}\`
    \}
  \}`
  return out
}


const create_footprint = exports.create_footprint = function(raw, base_point, base_rotate, area, logger=()=>{}) {
  const board = sexp_parser.parse(raw)
  /**
   * List of all Elements, we want to keep.
  */
  const group = []
  const nets_numbers = new Set()
  if (area.size) {
    if (area.x_min === undefined) area.x_min = base_point[0] - area.size[0]/2
    if (area.x_max === undefined) area.x_max = base_point[0] + area.size[0]/2
    if (area.y_min === undefined) area.y_min = base_point[1] - area.size[1]/2
    if (area.y_max === undefined) area.y_max = base_point[1] + area.size[1]/2
  }
  const is_in_area = gen_at_in_area(area)
  const all_nets = get_all_nets(board.valuesIf('kicad_pcb'))
  
  for (const elem of board.valuesIf('kicad_pcb')) {
    
    if (typeof elem == 'object'){
    
      // if the element is a module, change the rotation of its subelements
      // and modify the nets
      if (elem.key == 'module') {
        // only process module if it’s in the specified region
        // do not change `at` property yet, it will be done later
        if (!elem.change_at('at', is_in_area, x => x)) continue
        for (const mod_elem of elem.values) {
          if (typeof mod_elem == 'object'){
            // change rotation of mod_elem if necessary 
            if (mod_elem.key != 'model') {
              const transform = (at) => {
                var out = inv_transform(at, base_point, base_rotate, false, MODULE_ROTATE.includes(mod_elem.key))
                out = [output_tranform(out, false, HAS_ROT.includes(mod_elem.key))]
                return out
              }
              mod_elem.change_at('at', true, transform)
            }
            nets_numbers.add(mod_elem.getNet())
            modify_net(mod_elem, all_nets)
          }
        }
      }
            
      // Transformation for 'at', 'start', 'end' attributes of non-modules
      const transform = (at) => {
        var out = inv_transform(at, base_point, base_rotate, true, HAS_ROT.includes(elem.key))
        out = [output_tranform(out, true, HAS_ROT.includes(elem.key))]
        return out
      }
      
      // if elem has 'at' attribute, modify it
      if (elem.change_at('at', is_in_area, transform)) {
        group.push(elem)
        nets_numbers.add(elem.getNet())
      }
      
      // transform traces which have (start …) (end …) instead of (at …)
      if (elem.change_at('start', is_in_area, transform) &&
      elem.change_at('end', is_in_area, transform)) {
        group.push(elem)
        nets_numbers.add(elem.getNet())
      }
      
      // Include zones, if all points specifying the zone are in the specified area
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
          // remove filled polygon
          const index_filled_polygon = elem.indexOf('filled_polygon')
          if (index_filled_polygon != undefined) {
            elem.values.splice(index_filled_polygon, 1)
          }
          group.push(elem)
          nets_numbers.add(elem.getNet())
        }
      }
      
      // parametrise nets
      modify_net(elem, all_nets)
    }
  }

  // collect all used nets
  const nets = {}
  for (const net of nets_numbers.values()) {
    if (net != undefined) {
      nets[all_nets[net]] = all_nets[net]
    }
  }

  return create_footprint_file(nets, group)
}

const POSSIBLY_NEW_OBJECTS = ['module','segment','via']

exports.create_traces_list = function(raw_unmodified, raw_modified, logger=()=>{}) {
  // Load files
  const unmodified = sexp_parser.parse(raw_unmodified).valuesIf('kicad_pcb')
  const string_unmodified = unmodified.filter(item => POSSIBLY_NEW_OBJECTS.includes(item.key)).map(item => item.toUniqueString());
  var modified = sexp_parser.parse(raw_modified).valuesIf('kicad_pcb')
  const all_nets = get_all_nets(modified)
  modified = modified.filter(item => POSSIBLY_NEW_OBJECTS.includes(item.key))
  // Find the new objects
  var new_objects = modified.filter(item => !string_unmodified.includes(item.toUniqueString()))
  const nets_numbers = new Set()
  new_objects.map(item => {nets_numbers.add(item.getNet()); return modify_net(item, all_nets)})
  
  // collect all used nets
  const nets = {}
  for (const net of nets_numbers.values()) {
    if (net != undefined) {
      nets[all_nets[net]] = all_nets[net]
    }
  }
  logger(`Identified ${new_objects.length} new objects out of ${modified.length}.`)
  return create_footprint_file(nets, new_objects)
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
  for (const module of config.modules){
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
  var index_js = `// Index File for footprints generated with kicad-to-ergogen
// include it in ergogen/src/footprints/index.js using
//     ...require('${config.indexfile}')
module.exports = {`
  for (const module of config.modules){
    logger(`Work on ${module.name}.`)
    let raw
    try {
      raw = fs.readFileSync(module.file).toString();
    } catch (err) {
      console.error(`Could not read config file "${module.file}":\n${err}`)
      process.exit(2)
    }
    let out = create_footprint(raw, module.reference, module.rotation, module.area, logger)
    out = `// ${module.name}\n// footprint file for ergogen automatically generated by kicad-to-ergogen\n` + out
    fs.writeFileSync(module.out, out)
    
    index_js += `\n    ${module.name}: require('`
    if (config.outdir == module.out.slice(0, config.outdir.length)) {
      index_js += './' + module.out.slice(config.outdir.length+1)
    } else {
      index_js += module.out
    }
    index_js += `'),`
  }
  index_js = index_js.slice(0,-1)
  index_js += `\n}`
  if (config.indexfile) {
    logger('Write index file.')
    fs.writeFileSync(config.indexfile, index_js)
  }
}
