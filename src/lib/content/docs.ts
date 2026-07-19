import { CURRENT_VERSION } from '$lib/platform';

export interface DocumentationSource {
	readonly sourceName: string;
	readonly version: string;
	readonly markdown: string;
}

const overview = `<!-- schemd-doc: id=overview; label=Quickstart; title=Make your first diagram; description=Compile bounded text into deterministic and accessible SVG.; group=Get started; order=10 -->

<!-- schemd-section: id=direct-api; eyebrow=01 / Install; title=Compile text into SVG; example-title=Sensor input; example-summary=A small circuit compiled without a browser or DOM. -->

Install the core package with \`npm install @schemd/core\`, then call \`compileSchematic\` on the server or during a build.

Schemd — pronounced like *"skemd"* (/skɛmd/) — does not require a DOM, a font-loading pass, or a client-side layout library.

\`\`\`ts
import { compileSchematic } from '@schemd/core';

const result = compileSchematic(source, {
  bounds: { width: 720, height: 300 },
  title: 'Sensor input'
});
\`\`\`

\`\`\`schemd bounds="720x300" title="Sensor input"
port:VIN "Sensor" at (60, 150) #blue
resistor:R1 "10 k\\Omega" at (245, 150) #amber
capacitor:C1 "100 nF" at (455, 150) #cyan
port:ADC "ADC" at (660, 150) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> ADC.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=markdown; eyebrow=02 / Markdown; title=Keep Markdown in your app; example-title=Tiny class model; example-summary=The same format covers UML structures and relationships. -->

Recognize only the \`schemd\` fence in your Markdown pipeline. Leave every other token with the host parser and mount only compiler-produced SVG as trusted markup.

\`\`\`schemd bounds="760x360" title="Tiny class model"
class:User "User" at (200, 180) #slate [attributes="- id: UUID; + email: string" operations="+ save(): void"]
class:Admin "Admin" at (560, 180) #blue [operations="+ suspend(user): void"]

Admin.left -> User.right #blue [ortho generalization]
\`\`\`

<!-- /schemd-section -->`;

const grammar = `<!-- schemd-doc: id=grammar; label=Grammar; title=Learn the small Schemd grammar; description=Place nodes, connect named ports, and select bounded routes.; group=Author diagrams; order=20 -->

<!-- schemd-section: id=nodes; eyebrow=01 / Nodes; title=Place a component on a bounded canvas; example-title=Bounded analog canvas; example-summary=Four nodes share one stable engineering coordinate system. -->

Every compilation needs integer bounds from 64 through 4096. A node follows \`kind:ID "label" at (x, y) color [options]\`; identifiers are case-sensitive.

\`\`\`schemd bounds="760x320" title="Bounded analog canvas"
port:VIN "Signal" at (60, 160) #blue
resistor:R1 "10 k\\Omega" at (250, 160) #amber
capacitor:C1 "100 nF" at (470, 160) #cyan
port:VOUT "Filtered" at (700, 160) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> VOUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Connections; title=Connect named ports; example-title=Mixed route styles; example-summary=Straight, curved, and obstacle-aware routes can share a canvas. -->

A connection follows \`ID.port -> ID.port color [options]\`. Choose \`line\`, \`bezier\`, or \`ortho\`, then add markers only where the diagram needs them.

\`\`\`schemd bounds="780x340" title="Mixed route styles"
port:A "A" at (60, 90) #blue
port:B "B" at (60, 250) #slate
xor:G1 "Parity" at (390, 170) #cyan [inputs=2 outputs=1]
port:Y "Result" at (720, 170) #emerald

A.out -> G1.in1 #blue [bezier]
B.out -> G1.in2 #slate [ortho]
G1.out -> Y.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=uml-relations; eyebrow=03 / UML; title=Use semantic relationship names; example-title=Class relationships; example-summary=Generalization and composition select their own markers. -->

Relationship options include association, dependency, generalization, realization, aggregation, composition, message, transition, include, and extend.

\`\`\`schemd bounds="860x420" title="Class relationships"
class:Account "Account" at (220, 150) #slate [attributes="- id: UUID" operations="+ close(): void"]
class:Admin "Admin" at (620, 120) #blue [operations="+ suspend(): void"]
class:Session "Session" at (620, 310) #emerald [attributes="- token: string"]

Admin.left -> Account.right #blue [ortho generalization]
Account.right -> Session.left #emerald [ortho composition label="owns"]
\`\`\`

<!-- /schemd-section -->`;

const mathLabels = `<!-- schemd-doc: id=math-labels; label=Math labels; title=Write compact math labels; description=Use nested scripts and common symbols without shipping a TeX runtime.; group=Author diagrams; order=30 -->

<!-- schemd-section: id=scripts; eyebrow=01 / Scripts; title=Use subscripts and superscripts; example-title=Nested engineering labels; example-summary=Nested scripts return cleanly to the main baseline. -->

Use \`_x\` or \`^2\` for one shifted glyph and braces for a group. Script groups can nest, but their input remains bounded with the document.

\`\`\`schemd bounds="920x320" title="Nested engineering labels"
port:VIN "V_{in} = 1 V" at (80, 160) #blue
resistor:R1 "R_{load} = 10 k\\Omega" at (335, 160) #amber
capacitor:C1 "C_f e^{x^2}" at (590, 160) #cyan
port:VOUT "A_{x_{sub}} done" at (840, 160) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [line]
C1.out -> VOUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=symbols-and-escapes; eyebrow=02 / Symbols; title=Use built-in commands or raw Unicode; example-title=Quantum notation; example-summary=Symbols and qgate metadata share the same small parser. -->

Common commands cover Greek letters, operators, roots, comparisons, and arrows. Labels are XML-escaped before they reach the output.

\`\`\`schemd bounds="880x340" title="Quantum notation"
port:QIN "|\\psi_0〉 = |0〉" at (80, 170) #slate
hadamard:H1 "H: |0〉 \\rightarrow |+〉" at (330, 170) #purple
qgate:RY1 "R_y(\\theta)" at (600, 170) #cyan [parameter="\\theta = \\pi/2" phase="\\phi = \\pi/4"]
port:QOUT "|\\psi_1〉" at (810, 170) #emerald

QIN.out -> H1.in #slate [line]
H1.out -> RY1.in #purple [line]
RY1.out -> QOUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

const componentReference = `<!-- schemd-doc: id=component-reference; label=Component API; title=Find a component and its ports; description=A compact reference for circuit, logic, quantum, IC, and UML nodes.; group=Author diagrams; order=40 -->

<!-- schemd-section: id=passives; eyebrow=01 / Circuit; title=Passive components; example-title=RLC signal path; example-summary=The three passive symbols share a left-to-right port contract. -->

Resistors, capacitors, and inductors expose \`in\` and \`out\` aliases, plus left and right port names.

\`\`\`schemd bounds="900x300" title="RLC signal path"
port:IN "Input" at (55, 150) #blue
resistor:R1 "10 k\\Omega" at (240, 150) #amber
inductor:L1 "22 \\muH" at (450, 150) #purple
capacitor:C1 "100 nF" at (660, 150) #cyan
port:OUT "Output" at (845, 150) #emerald
IN.out -> R1.in #blue [line]
R1.out -> L1.in #amber [line]
L1.out -> C1.in #purple [line]
C1.out -> OUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=semiconductors; eyebrow=02 / Circuit; title=Diodes and transistors; example-title=NMOS protected switch; example-summary=A gate-controlled transistor feeds a protected output. -->

Diodes expose anode and cathode aliases. Transistors expose base or gate, collector or drain, and emitter or source aliases.

\`\`\`schemd bounds="860x400" title="NMOS protected switch"
port:CTRL "Gate" at (70, 190) #blue
transistor:Q1 "2N7002" at (350, 190) #cyan [type=nmos]
diode:D1 "Clamp" at (590, 105) #purple [type=schottky]
port:OUT "Load" at (800, 105) #emerald
ground:GND "Ground" at (350, 325) #slate
CTRL.out -> Q1.gate #blue [line]
Q1.drain -> D1.anode #cyan [ortho]
D1.cathode -> OUT.in #emerald [line marker-end=arrow]
Q1.source -> GND.in #slate [ortho]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=boundaries; eyebrow=03 / Circuit; title=Ports and grounds; example-title=Referenced input; example-summary=A boundary port feeds a resistor tied to signal ground. -->

Port nodes mark system boundaries. Ground nodes accept signal, earth, or chassis styles.

\`\`\`schemd bounds="720x320" title="Referenced input"
port:VIN "Input" at (70, 100) #blue
resistor:R1 "1 M\\Omega" at (320, 100) #amber
ground:GND "Reference" at (520, 240) #slate [style=earth]
VIN.out -> R1.in #blue [line]
R1.out -> GND.in #slate [ortho]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=logic-gates; eyebrow=04 / Logic; title=Classical logic gates; example-title=Parity and inversion; example-summary=Indexed pins keep configurable fan-in and fan-out explicit. -->

And, NAND, OR, NOR, XOR, and NOT gates can use IEEE or IEC geometry with bounded input and output counts.

\`\`\`schemd bounds="860x340" title="Parity and inversion"
port:A "A" at (60, 90) #blue
port:B "B" at (60, 250) #blue
xor:X1 "Parity" at (330, 170) #cyan [inputs=2 outputs=1]
not:N1 "Invert" at (590, 170) #amber [outputs=1 standard=iec]
port:Y "Y" at (800, 170) #emerald
A.out -> X1.in1 #blue [bezier]
B.out -> X1.in2 #blue [bezier]
X1.out -> N1.in #cyan [line]
N1.out -> Y.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=quantum-gates; eyebrow=05 / Quantum; title=Quantum gates; example-title=Small quantum pipeline; example-summary=Native and custom operators share a register path. -->

Hadamard, CNOT, and custom qgate nodes expose deterministic ports and optional parameter metadata.

\`\`\`schemd bounds="940x400" title="Small quantum pipeline"
port:QIN "|0〉" at (55, 200) #slate
hadamard:H1 "H" at (230, 200) #purple
qgate:RZ "R_z" at (440, 200) #cyan [parameter="\\theta/2" phase="\\pi/4"]
cnot:CX "CNOT" at (660, 200) #purple
port:QOUT "|1〉" at (880, 200) #emerald
QIN.out -> H1.in #slate [line]
H1.out -> RZ.in #purple [line]
RZ.out -> CX.in #cyan [line]
CX.out -> QOUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=integrated-circuits; eyebrow=06 / Blocks; title=Integrated circuits; example-title=Configurable controller; example-summary=Named pin lists create an addressable package. -->

IC nodes accept comma-separated left, right, top, and bottom pin lists. Connect using the exact pin name.

\`\`\`schemd bounds="960x480" title="Configurable controller"
port:INPUT "Sensor bus" at (60, 230) #blue
port:CLOCK "Clock" at (430, 60) #amber
ic:U1 "Flight computer" at (480, 240) #cyan [left="DATA,ENABLE,RESET" right="ACTUATOR,FAULT" top="CLK,VCC" bottom="GND,VSS"]
port:OUTPUT "Actuator" at (900, 220) #emerald
ground:GND "Reference" at (520, 410) #slate
INPUT.out -> U1.DATA #blue [ortho]
CLOCK.out -> U1.CLK #amber [ortho]
U1.ACTUATOR -> OUTPUT.in #emerald [ortho marker-end=arrow]
U1.GND -> GND.in #slate [ortho]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=uml-structure; eyebrow=07 / UML; title=Classes, packages, and notes; example-title=Order model; example-summary=Auto-sized class compartments connect to package and note nodes. -->

Classes grow around attribute and operation rows. Package and note nodes use explicit dimensions.

\`\`\`schemd bounds="960x480" title="Order model"
package:Domain "Domain" at (120, 70) #slate [width=160]
class:Order "Order" at (280, 215) #blue [attributes="- id: UUID; - total: Money" operations="+ submit(): void"]
class:LineItem "LineItem" at (720, 215) #emerald [attributes="- quantity: number"]
note:Rule "An order owns its items" at (480, 405) #amber [width=210]
Domain.bottom -> Order.top #slate [ortho dependency]
Order.right -> LineItem.left #emerald [ortho composition label="contains"]
Rule.top -> Order.bottom #amber [ortho dependency label="documents"]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=uml-behavior; eyebrow=08 / UML; title=Actors, use cases, states, and pseudostates; example-title=Checkout flow; example-summary=Use-case and state nodes share the relationship grammar. -->

Behavior nodes use semantic association, include, extend, and transition relations.

\`\`\`schemd bounds="920x440" title="Checkout flow"
actor:Customer "Customer" at (80, 145) #blue
usecase:Checkout "Checkout" at (300, 145) #cyan
state:Pending "Pending" at (590, 145) #amber [details="entry / reserve; exit / charge"]
initial:Start "Start" at (590, 330) #slate
final:Done "Done" at (820, 330) #emerald
Customer.right -> Checkout.left #blue [line association]
Checkout.right -> Pending.left #amber [line transition label="submit"]
Start.right -> Done.left #emerald [line transition label="complete"]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=uml-sequence; eyebrow=09 / UML; title=Sequence lifelines and messages; example-title=Request and response; example-summary=Offsets place messages at exact heights along two lifelines. -->

Lifeline ports accept numeric vertical offsets. Message relations render open arrows and can be dashed for replies.

\`\`\`schemd bounds="800x440" title="Request and response"
lifeline:Client "Client" at (200, 220) #blue [width=140 height=320]
lifeline:API "Orders API" at (600, 220) #emerald [width=140 height=320]
Client.right80 -> API.left80 #blue [line message label="GET /orders"]
API.left160 -> Client.right160 #emerald [line message dashed label="200 OK"]
\`\`\`

<!-- /schemd-section -->`;

const responsiveSvg = `<!-- schemd-doc: id=responsive-svg; label=Responsive SVG; title=Scale one diagram everywhere; description=Preserve geometry with the viewBox while the host controls display size.; group=Author diagrams; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Sizing; title=Let the viewBox do the scaling; example-title=Responsive telemetry path; example-summary=One SVG works in a narrow card or a wide documentation rail. -->

Do not recalculate coordinates in the browser. Reserve the aspect ratio before content arrives and set the generated SVG to \`width: 100%; height: auto\`.

\`\`\`css
.schemd-host { container-type: inline-size; aspect-ratio: 8 / 3; }
.schemd-host svg { display: block; width: 100%; height: auto; }
\`\`\`

\`\`\`schemd bounds="960x360" title="Responsive telemetry path"
port:BUS "Sensor bus" at (70, 180) #blue
ic:U1 "Signal processor" at (330, 180) #cyan [left="CLK,DATA,ENABLE" right="FILTERED,FAULT"]
qgate:Q1 "Phase estimator" at (610, 120) #purple [parameter="\\theta/2"]
port:OUT "Telemetry" at (875, 180) #emerald
BUS.out -> U1.DATA #blue [ortho]
U1.FILTERED -> Q1.in #purple [bezier]
Q1.out -> OUT.in #emerald [bezier marker-end=arrow]
U1.FAULT -> OUT.in #amber [ortho marker-end=dot]
\`\`\`

<!-- /schemd-section -->`;

const outputModes = `<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose how much SVG to emit; description=Keep static diagrams small or add CSS and semantic hooks on demand.; group=Ship output; order=60 -->

<!-- schemd-section: id=mode-selection; eyebrow=01 / Output; title=Pick a mode at the render boundary; example-title=Mode comparison; example-summary=The same geometry compiles into all three output budgets. -->

Default mode emits minimal static SVG. Embedded CSS adds isolated interaction styles. Full mode adds stable node, port, and wire metadata for editors and simulations.

\`\`\`schemd bounds="760x300" title="Mode comparison"
port:IN "Input" at (70, 150) #blue
nand:G1 "Safety inhibit" at (380, 150) #amber [inputs=2 outputs=1 standard=iec]
port:OUT "Output" at (690, 150) #emerald
IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

const integrations = `<!-- schemd-doc: id=integrations; label=Interaction; title=Add interaction without changing the compiler; description=Use full-mode attributes and one delegated listener on the SVG host.; group=Ship output; order=70 -->

<!-- schemd-section: id=event-delegation; eyebrow=01 / Events; title=Listen once at the SVG host; example-title=Interactive parity network; example-summary=Full mode exposes stable node, port, and connection metadata. -->

Delegate events from one host element and find the nearest \`[data-node-id]\` or wire metadata target. Keep application state outside the generated SVG.

\`\`\`schemd bounds="760x320" title="Interactive parity network"
port:A "A" at (60, 90) #blue
port:B "B" at (60, 230) #blue
xor:G1 "Parity" at (380, 160) #cyan [inputs=2 outputs=1]
port:Y "Y" at (700, 160) #emerald
A.out -> G1.in1 #blue [bezier]
B.out -> G1.in2 #blue [bezier]
G1.out -> Y.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

const frameworkAdapters = `<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Mount compiled SVG in any framework; description=Compile on the server and hand a reviewed SVG string to the UI layer.; group=Connect toolchains; order=80 -->

<!-- schemd-section: id=framework-contract; eyebrow=01 / Host; title=Keep compilation outside the component; example-title=Framework-neutral signal chain; example-summary=One compiled SVG can be mounted by every major UI framework. -->

React, Vue, Angular, and Svelte all expose a trusted-HTML boundary. Pass only Schemd compiler output through that boundary; never arbitrary user HTML.

\`\`\`schemd bounds="720x300" title="Framework-neutral signal chain"
port:IN "Input" at (60, 150) #blue
and:G1 "Enable" at (360, 150) #cyan [inputs=2 outputs=1]
port:OUT "Output" at (660, 150) #emerald
IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

const markdownAdapters = `<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Add Schemd to a Markdown pipeline; description=Handle schemd fences and leave every other token to the host parser.; group=Connect toolchains; order=90 -->

<!-- schemd-section: id=adapter-contract; eyebrow=01 / Adapter; title=Keep the compiler boundary small; example-title=Adapter test circuit; example-summary=A portable fixture for checking any Markdown adapter. -->

Parse fence metadata with \`parseSchematicFence\`, compile only recognized Schemd blocks, and return all other fence languages to the host Markdown engine.

\`\`\`schemd bounds="720x300" title="Adapter test circuit"
port:IN "Input" at (60, 150) #blue
diode:D1 "Protection" at (360, 150) #cyan [type=zener]
port:OUT "Output" at (660, 150) #emerald
IN.out -> D1.anode #blue [line]
D1.cathode -> OUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

const performance = `<!-- schemd-doc: id=performance; label=Performance; title=Keep compilation predictable; description=Use hard limits, bounded caches, and measurements from the SVG you ship.; group=Operate safely; order=100 -->

<!-- schemd-section: id=limits; eyebrow=01 / Limits; title=Reject oversized work early; example-title=Bounded processing chain; example-summary=A representative route inside the compiler budget. -->

One document is capped at 131,072 source characters, 512 components, 2,048 connections, 32,768 crossings, and 2 MiB of SVG output.

\`\`\`schemd bounds="760x320" title="Bounded processing chain"
port:IN "Input" at (60, 160) #blue
resistor:R1 "1 k\\Omega" at (240, 160) #amber
not:G1 "Condition" at (450, 160) #cyan [outputs=1]
port:OUT "Output" at (700, 160) #emerald
IN.out -> R1.in #blue [line]
R1.out -> G1.in #amber [ortho]
G1.out -> OUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=budget-calculator; eyebrow=02 / Measure; title=Check a real output budget; example-title=Budget reference; example-summary=Measure source, topology, and emitted SVG bytes. -->

Treat each measurement as evidence for that topology and output mode. Labels, markers, routing, and semantic metadata all affect the result.

\`\`\`schemd bounds="760x300" title="Budget reference"
port:IN "Input" at (60, 150) #blue
or:G1 "Aggregate" at (380, 150) #cyan [inputs=2 outputs=1]
port:OUT "Output" at (700, 150) #emerald
IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

const roadmap = `<!-- schemd-doc: id=roadmap; label=Roadmap; title=Help shape Schemd; description=Work through known correctness limits before expanding the symbol surface.; group=Contribute; order=110 -->

<!-- schemd-section: id=now; eyebrow=01 / Now · P1; title=Build the topology and routing foundation; example-title=Routing foundation; example-summary=Topology and reusable routing come before a larger catalog. -->

- Model explicit nets and junctions before bridging separate traces.
- Reuse a document-level routing index instead of rescanning every obstacle.
- Validate straight and Bézier routes against occupied geometry.

\`\`\`schemd bounds="760x320" title="Routing foundation"
port:IN "Input" at (60, 160) #blue
resistor:R1 "10 k\\Omega" at (250, 160) #amber
capacitor:C1 "100 nF" at (490, 160) #cyan
port:OUT "Output" at (700, 160) #emerald
IN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> OUT.in #emerald [ortho marker-end=arrow]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=next; eyebrow=02 / Next · P1; title=Make every rendered detail deliberate; example-title=Visual precision; example-summary=Markers, typography, routes, and tests must agree. -->

- Account for wire and label occupancy in route costs.
- Define a policy for dense bridge clusters.
- Trim UML connectors against background-independent markers.
- Publish deterministic typography and adversarial visual gates.

\`\`\`schemd bounds="800x400" title="Visual precision"
class:Service "Service" at (210, 200) #slate [attributes="- id: UUID" operations="+ execute(): void"]
class:Worker "Worker" at (590, 200) #blue [operations="+ run(): void"]
Worker.left -> Service.right #blue [ortho realization label="implements"]
\`\`\`

<!-- /schemd-section -->

<!-- schemd-section: id=later; eyebrow=03 / Later · P2; title=Grow the language without growing the runtime; example-title=Language growth; example-summary=New symbols should share one bounded architecture. -->

- Put parsing, ports, bounds, and primitives behind a typed registry.
- Reuse one byte-counted serializer result.
- Add bounded delimiter escapes through a small lexer.
- Permit controlled hosts to reuse one external style asset.

\`\`\`schemd bounds="960x480" title="Language growth"
port:INPUT "Sensor bus" at (60, 230) #blue
ic:U1 "Controller" at (480, 240) #cyan [left="DATA,ENABLE" right="ACTUATOR,FAULT" top="CLK,VCC" bottom="GND"]
port:OUTPUT "Actuator" at (900, 220) #emerald
INPUT.out -> U1.DATA #blue [ortho]
U1.ACTUATOR -> OUTPUT.in #emerald [ortho marker-end=arrow]
\`\`\`

<!-- /schemd-section -->`;

export const DOCUMENTATION_SOURCES: readonly DocumentationSource[] = Object.freeze([
	{ sourceName: 'overview.md', version: CURRENT_VERSION, markdown: overview },
	{ sourceName: 'grammar.md', version: CURRENT_VERSION, markdown: grammar },
	{ sourceName: 'math-labels.md', version: CURRENT_VERSION, markdown: mathLabels },
	{
		sourceName: 'component-reference.md',
		version: CURRENT_VERSION,
		markdown: componentReference
	},
	{ sourceName: 'responsive-svg.md', version: CURRENT_VERSION, markdown: responsiveSvg },
	{ sourceName: 'output-modes.md', version: CURRENT_VERSION, markdown: outputModes },
	{ sourceName: 'integrations.md', version: CURRENT_VERSION, markdown: integrations },
	{
		sourceName: 'framework-adapters.md',
		version: CURRENT_VERSION,
		markdown: frameworkAdapters
	},
	{
		sourceName: 'markdown-adapters.md',
		version: CURRENT_VERSION,
		markdown: markdownAdapters
	},
	{ sourceName: 'performance.md', version: CURRENT_VERSION, markdown: performance },
	{ sourceName: 'roadmap.md', version: CURRENT_VERSION, markdown: roadmap }
]);
