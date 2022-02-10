# KiCad to ergogen footprint generator

This module aims to simplify making footprint modules for [ergogen](https://github.com/mrzealot/ergogen).
The idea is to generate the schematics of a board in KiCad, place the components on a PCB in groups and then export all groups individually as ergogen modules.
Furthermore, it allows to export all traces which are added with KiCad to an ergogen PCB back into a footprint (see below for further explanation).
This should make the design process of more complex boards faster.

**This project works with KiCad 5 only!**
As ergogen is build around KiCad 5 syntax, this project only supports KiCad 5 as well.
I will consider rewriting the software, when ergogen changes to KiCad 6.

*The software is still **WIP** and subject to change.*

Also, this is my first JS project.
Feel free to suggest improvements.

If you want to process KiCad files with JS, have a look at the [kicad-module-parser](https://github.com/jdthorpe/kicad-module-parser) from which I took the s-expression parser.
Its data format is easier to work with, but makes it harder to output correct KiCad files again.

## Installation
Clone the repository and run `npm install`.

## Usage

### Creation of ergogen modules from KiCad PCBs
A sample configuration with some explanation can be found in `example.yaml`.
Create a similar file with all the chunks you want to export from the kicad file.
Run `node src/cli.js footprints <your/config/file>` from within this directory.

### Export traces from modified footprint file
You first start you ergogen project as usual.
In the PCB section you use YAML-anchors to copy the whole PCB.
After running ergogen again, you add the traces footprint which we will generate afterwards.
```yaml
pcbs:
    pcb: &pcb
        […]
    pcb_with_traces:
        <<: *pcb
        footprints.traces:
            type: traces
```
Now you run `node src/cli.js traces pcb.kicad_pcb pcb_with_traces.kicad_pcb --output traces_footprint_file` which will generate the ergogen footprint file `traces_footprint_file` containing all traces, vias and modules which are present in `pcb_with_traces.kicad_pcb` but not in `pcb.kicad_pcb`.
You now need to make this available to ergogen by adding it to `src/footprints/index.js`.
On all later runs of ergogen, you obtain the usual PCB and the PCB with the additional traces.
From now on, only edit the latter in KiCad.
After saving in KiCad, run `traces` again to update the traces footprint file.
Now running ergogen again, should not change `pcb_with_traces.kicad_pcb`.

**Always make backups from your work!
I take no responsibility for anything that might get lost.**

## Further plan
- add tests
- allow non-rectangular areas to define which components to choose
- make it possible to rename certain nets to more reasonable names
