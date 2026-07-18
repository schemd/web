export interface PlaygroundExample {
	readonly id: string;
	readonly label: string;
	readonly title: string;
	readonly bounds: `${number}x${number}`;
	readonly source: string;
}

export const PLAYGROUND_EXAMPLES = Object.freeze([
	Object.freeze({
		id: 'sensor-input',
		label: 'Sensor input',
		title: 'Sensor input filter',
		bounds: '760x420',
		source: `port:SENSOR "Sensor" at (70, 165) #blue
resistor:R1 "10 k\\Omega" at (260, 165) #amber
capacitor:C1 "100 nF" at (485, 165) #cyan
port:ADC "ADC" at (700, 165) #emerald
ground:GND "Reference" at (485, 285) #slate

SENSOR.out -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> ADC.in #emerald [line marker-end=arrow]
C1.out -> GND.in #slate [ortho]`
	}),
	Object.freeze({
		id: 'logic',
		label: 'Logic parity',
		title: 'Parity and inversion',
		bounds: '860x340',
		source: `port:A "A" at (60, 90) #blue
port:B "B" at (60, 250) #blue
xor:X1 "Parity" at (330, 170) #cyan [inputs=2 outputs=1]
not:N1 "Invert" at (590, 170) #amber [outputs=1 standard=iec]
port:Y "Y" at (800, 170) #emerald

A.out -> X1.in1 #blue [bezier]
B.out -> X1.in2 #blue [bezier]
X1.out -> N1.in #cyan [line]
N1.out -> Y.in #emerald [line marker-end=arrow]`
	}),
	Object.freeze({
		id: 'uml-order',
		label: 'UML order model',
		title: 'Order model',
		bounds: '960x480',
		source: `package:Domain "Domain" at (120, 70) #slate [width=160]
class:Order "Order" at (280, 215) #blue [attributes="- id: UUID; - total: Money" operations="+ submit(): void"]
class:LineItem "LineItem" at (720, 215) #emerald [attributes="- quantity: number"]
note:Rule "An order owns its items" at (480, 405) #amber [width=210]

Domain.bottom -> Order.top #slate [ortho dependency]
Order.right -> LineItem.left #emerald [ortho composition label="contains"]
Rule.top -> Order.bottom #amber [ortho dependency label="documents"]`
	}),
	Object.freeze({
		id: 'quantum',
		label: 'Quantum path',
		title: 'Small quantum pipeline',
		bounds: '940x400',
		source: `port:QIN "|0〉" at (55, 200) #slate
hadamard:H1 "H" at (230, 200) #purple
qgate:RZ "R_z" at (440, 200) #cyan [parameter="\\theta/2" phase="\\pi/4"]
cnot:CX "CNOT" at (660, 200) #purple
port:QOUT "|1〉" at (880, 200) #emerald
port:CTRL "Control" at (660, 65) #blue

QIN.out -> H1.in #slate [line]
H1.out -> RZ.in #purple [line]
RZ.out -> CX.in #cyan [line]
CX.out -> QOUT.in #emerald [line marker-end=arrow]
CTRL.out -> CX.control #blue [line]`
	})
] as const satisfies readonly PlaygroundExample[]);

export function getPlaygroundExample(id: string): PlaygroundExample | undefined {
	return PLAYGROUND_EXAMPLES.find((example) => example.id === id);
}

export function fenceInfo(example: PlaygroundExample): string {
	return `schemd bounds="${example.bounds}" title="${example.title}"`;
}
