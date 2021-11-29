const UNIQUE_PROPERTIES = ['at', 'start', 'end']
const ZEROS = ['0', '0','0','0','0','0','0']

/* 
 * Maps a number to a string with `decimal` decimals.
 * The function do not round, it just cuts off the number
 * and adds as many zeros as needed.
 */
const toFormatString = function (number, decimal=4) {
  regexp = new RegExp(`-?\\d+(\\.\\d\{0,${decimal}\})?`)
  const match = number.toString().match(regexp)
  var out = match[0]
  if (match[1] != undefined) out += ZEROS.slice(0, decimal + 1 - match[1].length).join('')
  else out += '.' + ZEROS.slice(0, decimal).join('')
  return out
}

exports.SExp = class SExp {
  constructor(key, values) {
    this.key = key
    if (Array.isArray(values)) {
      this.values = values
    } else {
      this.values = [values]
    }
  }
  
  valuesIf(key) {
    if (key == this.key) {
      return this.values
    }
    return undefined
  }
  
  toString() {
    if (this.key == 'module') return `(${this.key}\n  ${this.values.join('\n  ')}\n)`
    return `(${this.key} ${this.values.join(' ')})`
  }
  
  /*
   * Similar to toString() but with rounding for 'at'/'start'/'end' properties,
   * such that different precisions have no impact.
   */
  toCompareString() {
    if (['at','start', 'end'].includes(this.key)) {
      var values = this.values.map(x => +(x))
      if (values.length == 2) values.push(0)
      while (values[2] < 0) values[2] += 360
      while (values[2] > 360) values[2] -= 360
      values = values.map(x => toFormatString(x))
      return `(${this.key} ${values.join(' ')})`
    }
    return toString()
  }
  
  /*
   * Returns a String which is (hopefully) unique for each component on a PCB
   * but not influenced by any formatting introduced by KiCad, e.g. rounding
   * and not displaying zero values.
   */
  toUniqueString() {
    var values = this.values.filter(x => UNIQUE_PROPERTIES.includes(x.key))
    values.sort((a, b) => a.key-b.key)
    return `(${this.key} ${values.map(x => x.toCompareString()).join(' ')})`
  }
  
  /*
   * Returns the index of the value with key `key`.
   */
  indexOf(key) {
    const index = this.values.findIndex(x => x.key == key)
    if (index >= 0) return index
    return undefined
  }
  
  /*
   * Returns the value with key `key`.
   */
  sexpOf(key) {
    return this.values[this.indexOf(key)]
  }
  
  /*
   * Returns the net index if present.
   */
  getNet() {
    const net = this.sexpOf('net')
    if (net) {
      return net.values[0]
    }
    return undefined
  }
  
  /**
   * Changes a position entry as (at 2.5 3)
   * @param {object} elem - a parsed element of an sexpr which might have a (at …) property.
   * @param {string} at_str - name of the (at …) property, i.e. 'at', 'start' or 'end'
   * @param {boolean || function} which - a function returning a boolean for any given at position on whether or not to modify it, or true if all should be modified
   * @param {function} change - a function to change the at property
   */
  change_at(at_str, which, change) {
    const index = this.indexOf(at_str)
    if (index != undefined) {
      const at = this.values[index].values.map(x => +(x))
      if (which == true || which(at)) {
        this.values[index].values = change(at)
        return true
      }
    }
    return false
  }
}
