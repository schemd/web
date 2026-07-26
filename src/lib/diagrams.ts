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
