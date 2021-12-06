# Changelog

## Version 0.2.1

- let `kicad-to-ergogen traces` export nets, such that ergogen can change net indices
- replace `.` in net names with `-` such that they can be referenced within ergogen config files more easily
- add `area.size` and auto generate `x_min`, `x_max`, etc.
- automate the generation of the `index.js` file needed for ergogen

## Version 0.2.0

- add function to export traces from edited KiCad File
  - generation of footprints changed to `kicad-to-ergogen footprints`
  - export of traces with `kicad-to-ergogen traces`

## Version 0.0.2

_(not published as such)_

- fix handling of zones
- use ergogens `p.xy()` function instead of custom transformations
- unify handling of nets
- comment code

## Version 0.0.1

Initial version for footprint creation from KiCad File
