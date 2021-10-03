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
  
  indexOf(key) {
    const index = this.values.findIndex(x => x.key == key)
    if (index >= 0) return index
    return undefined
  }
  
  sexpOf(key) {
    return this.values[this.indexOf(key)]
  }
  
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
