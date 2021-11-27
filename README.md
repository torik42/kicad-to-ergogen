# KiCad to ergogen footprint generator

This module aims to simplify making footprint modules for [ergogen](https://github.com/mrzealot/ergogen).
The idea is to generate the schematics of a board in KiCad, place the components on a PCB in groups and then export all groups individually as ergogen modules.
This should make the design process of more complex boards faster.

*The software is still **WIP** and subject to change.*

Also, this is my first JS project.
Feel free to suggest improvements.

If you want to process kicad files with JS, have a look at the [kicad-module-parser](https://github.com/jdthorpe/kicad-module-parser) from which I took the s-expression parser.
Its data format is easier to work with, but makes it harder to output correct kicad files again.

## Installation
Clone the repository and run `npm install`.

## Usage
A sample configuration with some explanation can be found in `example.yaml`.
Create a similar file with all the chunks you want to export from the kicad file.
Run `node src/cli.js <your/config/file>` from within this directory.

## Further plan
- add tests
- allow non-rectangular areas to define which components to choose
- make it possible to rename certain nets to more reasonable names
- generate an `index.js` automatically
