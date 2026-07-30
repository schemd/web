/**
 * Diagram sources this site shows in more than one place.
 *
 * A specimen that appears on the landing page, in the playground and as a
 * simulation is one diagram, not three. It previously existed as three
 * byte-identical string literals in three files, so editing the circuit meant
 * finding every copy — and the copies had already begun to drift in bounds.
 *
 * Sources used by exactly one page stay with that page. This module is for the
 * shared ones, and its accompanying bounds travel with them.
 */

/** Natural canvas for a shared specimen, in compiler units. */
export interface DiagramBounds {
	readonly width: number;
	readonly height: number;
}

/**
 * First-order RC low-pass filter.
 *
 * The site's signature specimen: it opens the landing page, seeds an empty
 * playground, and backs the `/simulations/*\/rc` laboratory.
 */
export const RC_FILTER_SOURCE = `// Native first-order RC filter — no UML junction workaround.
source:VIN "V_{in}" at (80, 120) #blue [type=voltage-ac]
resistor:R1 "10 kΩ" at (260, 120) #amber
junction:VOUT "output node" at (440, 120) #cyan
capacitor:C1 "100 nF" at (440, 242) #cyan [orientation=down]
ground:GND "0 V" at (220, 350) #slate
port:OUT "V_{out}" at (680, 120) #emerald

VIN.positive -> R1.in #blue [line]
VIN.negative -> GND.in #slate [ortho]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [line]
C1.out -> GND.in #cyan [ortho]
VOUT.node -> OUT.in #emerald [line marker-end=arrow]`;

/** Canvas the RC filter was drawn for. */
export const RC_FILTER_BOUNDS: DiagramBounds = { width: 760, height: 440 };

/**
 * The RC filter again, positioned by relation instead of by arithmetic.
 *
 * Seeds the inspector, where it earns its place twice: the Place stage has
 * something to resolve, and the diagram is the same circuit the rest of the site
 * opens with — so a visitor comparing the two forms is comparing exactly one
 * thing. Only VIN carries coordinates; everything else states where it sits
 * relative to what came before, and an axis no relation constrains is inherited.
 */
export const RELATIVE_PLACEMENT_SOURCE = `// Relative placement: only VIN states coordinates.
source:VIN "V_{in}" at (90, 150) #blue [type=voltage-ac]
resistor:R1 "10 kΩ" right-of VIN by 150 #amber
junction:VOUT "output node" right-of R1 by 150 #cyan
capacitor:C1 "100 nF" below VOUT by 110 #cyan [orientation=down]
port:OUT "V_{out}" right-of VOUT by 150 #emerald
ground:GND "0 V" below R1 by 190 aligned-x with R1 #slate

VIN.positive -> R1.in #blue [line]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [line]
VOUT.node -> OUT.in #emerald [line marker-end=arrow]
C1.out -> GND.in #cyan [ortho]
VIN.negative -> GND.in #slate [ortho]`;
