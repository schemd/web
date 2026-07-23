import katex from 'katex';
import type { SimulationMathRegistry } from '$lib/simulation-math';
import type { RenderedSimulationStage, SimulationStage } from '$lib/simulation-timelines';

/**
 * A value slot is typeset once on the server. LiveMath replaces only its text
 * node, so a 60 FPS instrument never ships or invokes the KaTeX parser.
 */
const slot = (name: string, sample = '-000.000'): string =>
	String.raw`\htmlData{math-slot=${name}}{\mathtt{${sample}}}`;
const escapeTextSample = (value: string): string => value.replace(/([{}_$%&#])/g, '\\$1');
const textSlot = (name: string, sample = 'value'): string =>
	String.raw`\htmlData{math-slot=${name}}{\text{${escapeTextSample(sample)}}}`;

const common = {
	'timeline.delay': String.raw`t_{\mathrm{stage}}=${slot('value', '0.00')}\,\mathrm{s}`
} as const;

/** Trusted, authored TeX only. Dynamic data enters textContent slots client-side. */
const templates = {
	adder: {
		'adder.control.delay': String.raw`t_g=${slot('delay', '0')}\,\mathrm{ns/gate}\quad t_{\mathrm{crit}}\approx${slot('critical', '00')}\,\mathrm{ns}`,
		'adder.value.a': String.raw`A=${slot('bits', '00000000')}_2\;(${slot('value', '000')}_{10})`,
		'adder.value.b': String.raw`B=${slot('bits', '00000000')}_2\;(${slot('value', '000')}_{10})`,
		'adder.value.cin': String.raw`C_{\mathrm{in}}=${slot('value', '0')}`,
		'adder.value.sum': String.raw`\Sigma=${slot('bits', '00000000')}_2\;(${slot('value', '000')}_{10})`,
		'adder.value.total': String.raw`C_{\mathrm{out}}\Sigma=${slot('bits', '000000000')}_2\;(${slot('value', '000')}_{10})`,
		'adder.value.carry': String.raw`C_{\mathrm{out}}=${slot('carry', '0')}\quad ${textSlot('state', 'settled')}`,
		'adder.probe.logic': String.raw`${textSlot('name', 'node')}=\operatorname{logic}\!\left(${slot('logic', '0')}\right)\;\left(${slot('voltage', '0.0')}\,\mathrm{V}\right)`,
		'adder.symbol.cin': String.raw`C_{\mathrm{in}}`,
		'adder.scope.s0': String.raw`S_0\;\text{rail}`
	},
	rc: {
		'rc.axis.low': String.raw`10\,\mathrm{Hz}`,
		'rc.axis.high': String.raw`100\,\mathrm{kHz}`,
		'rc.axis.fc': String.raw`f_c`,
		'rc.control.r': String.raw`R=${textSlot('value', '10.00 kΩ')}`,
		'rc.control.c': String.raw`C=${textSlot('value', '100.00 nF')}`,
		'rc.control.f': String.raw`f=${textSlot('value', '1.00 kHz')}`,
		'rc.readout.fc': String.raw`f_c=${textSlot('value', '1.59 kHz')}`,
		'rc.readout.h': String.raw`\lvert H(j\omega)\rvert=${slot('magnitude', '0.000')}\;\left(${slot('db', '-00.0')}\,\mathrm{dB}\right)`,
		'rc.readout.phase': String.raw`\varphi=${slot('value', '-00.0')}^{\circ}`,
		'rc.caption.response': String.raw`\lvert H(j\omega)\rvert\quad\text{cutoff line damps as the pole falls}`,
		'rc.probe.input': String.raw`V_{\mathrm{in}}=1.000\,\mathrm{V_{pp}}\quad @\quad f=${textSlot('frequency', '1.00 kHz')}`,
		'rc.probe.output': String.raw`V_{\mathrm{out}}=${slot('voltage', '0.000')}\,\mathrm{V_{pp}}\quad ${slot('db', '-00.0')}\,\mathrm{dB}\quad \varphi=${slot('phase', '-00.0')}^{\circ}`,
		'rc.probe.cap': String.raw`${textSlot('state', 'capacitor current path')}\quad f_c=${textSlot('cutoff', '1.59 kHz')}`,
		'rc.scope.vin': String.raw`V_{\mathrm{in}}`,
		'rc.scope.vout': String.raw`V_{\mathrm{out}}`,
		'rc.scope.compare': String.raw`V_{\mathrm{in}}\;\text{versus}\;V_{\mathrm{out}}`
	},
	bell: {
		'bell.correlation': String.raw`\langle Z\otimes Z\rangle=${slot('value', '0.000')}\quad ${slot('shots', '000')}\;\text{shots}`,
		'bell.chsh.bound': String.raw`\text{CHSH witness}\quad \text{local realism}\le 2`,
		'bell.chsh.value': String.raw`S=${slot('value', '0.000')}`,
		'bell.state': String.raw`\lvert\psi\rangle\longrightarrow ${textSlot('state', '|Φ+⟩')}`,
		'bell.gate.q0': String.raw`q_0=${slot('value', '0')}`,
		'bell.gate.q1': String.raw`q_1=${slot('value', '0')}`,
		'bell.gate.h': String.raw`H\lvert q_0\rangle=(\lvert0\rangle+(-1)^{${slot('q0', '0')}}\lvert1\rangle)/\sqrt2`,
		'bell.gate.cx': String.raw`\operatorname{CNOT}:\lvert a,b\rangle\longrightarrow\lvert a,b\oplus a\rangle`,
		'bell.gate.measure': String.raw`\Pr(00)=\Pr(11)=\tfrac12`,
		'bell.symbol.q0': String.raw`q_0`,
		'bell.symbol.q1': String.raw`q_1`,
		'bell.symbol.protocol': String.raw`H\cdot\operatorname{CNOT}`,
		'bell.ket': String.raw`\lvert${slot('value', '00')}\rangle`,
		'bell.scope.correlation': String.raw`\langle Z\otimes Z\rangle_{\mathrm{empirical}}`
	},
	timer: {
		'timer.control.ra': String.raw`R_A=${textSlot('value', '10.00 kΩ')}`,
		'timer.control.rb': String.raw`R_B=${textSlot('value', '10.00 kΩ')}`,
		'timer.control.ct': String.raw`C_T=${textSlot('value', '100.00 nF')}`,
		'timer.readout.f': String.raw`f=${textSlot('value', '1.00 kHz')}`,
		'timer.readout.duty': String.raw`D=${slot('value', '00.0')}\%`,
		'timer.readout.pulse': String.raw`t_p=${textSlot('value', '1.00 ms')}`,
		'timer.probe.vc': String.raw`V_C=${slot('value', '0.00')}\,\mathrm V\quad ${textSlot('state', 'charging')}`,
		'timer.probe.out': String.raw`\mathrm{OUT}=${textSlot('state', 'HIGH')}\quad @\quad f=${textSlot('frequency', '1.00 kHz')}`,
		'timer.probe.vcc': String.raw`V_{CC}=${slot('value', '0.0')}\,\mathrm V`,
		'timer.probe.ic': String.raw`f=${textSlot('frequency', '1.00 kHz')}\quad D=${slot('duty', '00')}\%`,
		'timer.probe.ct': String.raw`C_T=${textSlot('capacitance', '100.00 nF')}\quad V_C=${slot('voltage', '0.00')}\,\mathrm V`
	},
	teleport: {
		'teleport.control.theta': String.raw`\theta=${slot('value', '0.00')}\pi`,
		'teleport.control.phi': String.raw`\phi=${slot('value', '0.00')}\pi`,
		'teleport.state': String.raw`\lvert\psi\rangle=${slot('alpha', '0.000')}\lvert0\rangle+\left(${textSlot('beta', '0.000 + 0.000i')}\right)\lvert1\rangle`,
		'teleport.probability': String.raw`P(${slot('state', '0')})=${slot('value', '0.000')}`,
		'teleport.probe.state': String.raw`\alpha=${slot('alpha', '0.000')}\quad\beta=${textSlot('beta', '0.000 + 0.000i')}\quad P(0)=${slot('p0', '0.000')}\quad P(1)=${slot('p1', '0.000')}`,
		'teleport.gate.h': String.raw`H\lvert0\rangle=(\lvert0\rangle+\lvert1\rangle)/\sqrt2`,
		'teleport.gate.entangle': String.raw`\operatorname{CNOT}:(\lvert00\rangle+\lvert10\rangle)/\sqrt2\longrightarrow\lvert\Phi^+\rangle`,
		'teleport.gate.bell': String.raw`\operatorname{CNOT}_{\psi\to A}:\lvert a,b\rangle\longrightarrow\lvert a,b\oplus a\rangle`,
		'teleport.gate.basis': String.raw`H\lvert\psi\rangle\quad\text{rotates into the Bell basis}`,
		'teleport.gate.measure': String.raw`M_Z\longrightarrow m_{${slot('bit', '1')}}\;${textSlot('result', '∈ {0,1}')}`,
		'teleport.gate.correct': String.raw`${textSlot('gate', 'X')}^{m_{${slot('bit', '2')}}}\quad ${textSlot('action', 'conditional correction')}`,
		'teleport.gate.output': String.raw`\lvert\psi_{\mathrm{out}}\rangle=\alpha\lvert0\rangle+\beta\lvert1\rangle\quad F=${textSlot('fidelity', '…')}`,
		'teleport.step.bits': String.raw`m_1=${slot('m1', '0')}\quad m_2=${slot('m2', '0')}`,
		'teleport.fidelity.label': String.raw`F=\lvert\langle\psi\vert\psi_{\mathrm{out}}\rangle\rvert^2`,
		'teleport.fidelity.value': String.raw`F=${textSlot('value', '—')}`,
		'teleport.scope.alpha': String.raw`\alpha`,
		'teleport.scope.beta': String.raw`\beta\angle\varphi`
	},
	buck: {
		'buck.control.vin': String.raw`V_{\mathrm{in}}=${slot('value', '00.0')}\,\mathrm V`,
		'buck.control.duty': String.raw`D=${slot('value', '00.0')}\%`,
		'buck.control.load': String.raw`R_{\mathrm{load}}=${slot('value', '00.0')}\,\Omega`,
		'buck.control.l': String.raw`L=${slot('value', '000')}\,\mathrm{\mu H}`,
		'buck.control.c': String.raw`C=${slot('value', '000')}\,\mathrm{\mu F}`,
		'buck.control.fsw': String.raw`f_{\mathrm{sw}}=${slot('value', '000')}\,\mathrm{kHz}`,
		'buck.readout.vout': String.raw`V_{\mathrm{out}}=${slot('output', '00.000')}\,\mathrm V\quad V_{\mathrm{ideal}}=${slot('ideal', '00.00')}\,\mathrm V`,
		'buck.readout.current': String.raw`I_{\mathrm{load}}=${slot('load', '0.000')}\,\mathrm A\quad i_L=${slot('inductor', '0.000')}\,\mathrm A`,
		'buck.readout.ripple.i': String.raw`\Delta i_L=${slot('value', '0.000')}\,\mathrm{A_{pp}}`,
		'buck.readout.ripple.v': String.raw`\Delta v_o=${slot('value', '00.0')}\,\mathrm{mV_{pp}}`,
		'buck.readout.efficiency': String.raw`\eta_{\mathrm{est}}=${slot('value', '00.0')}\%`,
		'buck.probe.input': String.raw`V_{\mathrm{in}}=${slot('value', '00.0')}\,\mathrm{V_{DC}}`,
		'buck.probe.pwm': String.raw`v_{\mathrm{sw}}=\operatorname{PWM}(${slot('duty', '00')}\%)\quad @\quad ${slot('frequency', '000')}\,\mathrm{kHz}`,
		'buck.probe.inductor': String.raw`i_L=${slot('current', '0.000')}\,\mathrm A\quad\Delta i_L=${slot('ripple', '0.000')}\,\mathrm{A_{pp}}\quad ${textSlot('mode', 'CCM')}`,
		'buck.probe.output': String.raw`V_{\mathrm{out}}=${slot('voltage', '00.000')}\,\mathrm V\quad\Delta v_o=${slot('ripple', '00.0')}\,\mathrm{mV_{pp}}`,
		'buck.probe.switch': String.raw`Q_H\quad ${textSlot('state', 'switching')}\quad D=${slot('duty', '0.000')}`,
		'buck.probe.cap': String.raw`C_{\mathrm{out}}=${slot('value', '000')}\,\mathrm{\mu F}`,
		'buck.preset': String.raw`${slot('input', '00')}\,\mathrm V\longrightarrow${slot('output', '00')}\,\mathrm V`,
		'buck.scope.il': String.raw`i_L`,
		'buck.scope.vo': String.raw`v_o`
	},
	chua: {
		'chua.control.alpha': String.raw`\alpha=${slot('value', '00.00')}`,
		'chua.control.beta': String.raw`\beta=${slot('value', '00.00')}`,
		'chua.control.m0': String.raw`m_0=${slot('value', '-0.000')}`,
		'chua.control.time': String.raw`t_{\mathrm{scale}}=${slot('value', '0.00')}\times`,
		'chua.readout.xyz': String.raw`${textSlot('axis', 'x')}=${slot('value', '-0.0000')}`,
		'chua.readout.lyapunov': String.raw`\lambda_{\mathrm{local}}\approx${slot('value', '0.0000')}`,
		'chua.caption.bifurcation': String.raw`\text{orbit maxima versus }\alpha\quad(${slot('min', '0')}\text{--}${slot('max', '0')})`,
		'chua.probe.state': String.raw`${textSlot('axis', 'x')}=${textSlot('physical', 'v_C1')}=${slot('value', '-0.0000')}\quad\text{(normalized)}`,
		'chua.probe.nonlinearity': String.raw`g(v)=${slot('value', '-0.0000')}\quad m_0=${slot('m0', '-0.000')}\quad m_1=${slot('m1', '-0.000')}`,
		'chua.probe.alpha': String.raw`\alpha=${slot('value', '00.00')}`,
		'chua.shadow': String.raw`\lVert\delta x_0\rVert=10^{-5}`,
		'chua.perturb': String.raw`\lVert\delta x\rVert\sim10^{-2}`,
		'chua.sweep': String.raw`\text{sweep }\alpha\longrightarrow\text{bifurcation}`,
		'chua.scope.vc1': String.raw`v_{C1}`,
		'chua.scope.vc2': String.raw`v_{C2}`
	},
	pll: {
		'pll.control.ref': String.raw`f_{\mathrm{ref}}=${slot('value', '00.00')}\,\mathrm{kHz}`,
		'pll.control.n': String.raw`N=${slot('value', '000')}`,
		'pll.control.bw': String.raw`\mathrm{BW}_{\mathrm{loop}}=${slot('value', '00.00')}\,\mathrm{kHz}`,
		'pll.control.zeta': String.raw`\zeta=${slot('value', '0.00')}`,
		'pll.readout.target': String.raw`f_{\mathrm{target}}=${slot('value', '000.000')}\,\mathrm{kHz}`,
		'pll.readout.vco': String.raw`f_{\mathrm{VCO}}=${slot('value', '000.000')}\,\mathrm{kHz}`,
		'pll.readout.error': String.raw`\varepsilon_f=${slot('value', '-000.0')}\,\mathrm{ppm}`,
		'pll.readout.phase': String.raw`\Delta\varphi=${slot('value', '-000.00')}^{\circ}`,
		'pll.readout.control': String.raw`V_{\mathrm{ctrl}}=${slot('value', '0.000')}\,\mathrm V`,
		'pll.readout.slips': String.raw`N_{\mathrm{slip}}=${slot('value', '000')}`,
		'pll.probe.reference': String.raw`f_{\mathrm{ref}}=${textSlot('value', 'reference lost')}`,
		'pll.probe.feedback': String.raw`f_{\mathrm{fb}}=${slot('value', '000.000')}\,\mathrm{kHz}\quad N=${slot('divider', '000')}`,
		'pll.probe.vco': String.raw`f_{\mathrm{VCO}}=${slot('frequency', '000.000')}\,\mathrm{kHz}\quad @\quad V_{\mathrm{ctrl}}=${slot('voltage', '0.00')}\,\mathrm V`,
		'pll.probe.output': String.raw`f_{\mathrm{out}}=${slot('frequency', '000.000')}\,\mathrm{kHz}\quad\varepsilon_f=${slot('ppm', '-000')}\,\mathrm{ppm}`,
		'pll.probe.divider': String.raw`N=${slot('value', '000')}`,
		'pll.scope.vctrl': String.raw`V_{\mathrm{ctrl}}`,
		'pll.scope.df': String.raw`\Delta f`
	},
	statechart: {
		'statechart.control.time': String.raw`t_{\mathrm{scale}}=${slot('value', '0.0')}\times`,
		'statechart.guard': String.raw`${textSlot('from', 'RED')}\xrightarrow{\;${textSlot('guard', 't > T')}\;} ${textSlot('to', 'GREEN')}`,
		'statechart.probe.state': String.raw`\operatorname{state}(${textSlot('name', 'RED')})\quad N_{\mathrm{visit}}=${slot('visits', '0')}\quad ${textSlot('status', '')}`,
		'statechart.probe.initial': String.raw`\text{initial pseudostate}`
	},
	qec: {
		'qec.encode': String.raw`\lvert\psi\rangle\longrightarrow\alpha\lvert000\rangle+\beta\lvert111\rangle`,
		'qec.error': String.raw`X_{q_{${slot('qubit', '0')}}}\quad ${textSlot('state', 'bit flip')}`,
		'qec.syndrome': String.raw`s=${slot('value', '00')}_2\quad(q_0\oplus q_1,\;q_1\oplus q_2)`,
		'qec.correction': String.raw`X_{q_{${textSlot('qubit', '—')}}}\quad ${textSlot('state', 'correction')}`,
		'qec.fidelity': String.raw`F_{\mathrm{logical}}=${slot('value', '0')}`,
		'qec.qubit': String.raw`q_{${slot('value', '0')}}`,
		'qec.amplitudes': String.raw`\alpha,\beta`,
		'qec.syndrome.bit': String.raw`s_{${slot('index', '0')}}=${slot('value', '0')}`,
		'qec.decode': String.raw`${textSlot('state', 'no error detected')}\quad X_{q_{${textSlot('qubit', '—')}}}`
	},
	wien: {
		'wien.control.gain': String.raw`A=${slot('value', '0.00')}`,
		'wien.control.r': String.raw`R=${textSlot('value', '10.00 kΩ')}`,
		'wien.control.c': String.raw`C=${textSlot('value', '10.00 nF')}`,
		'wien.readout.f0': String.raw`f_0=${textSlot('value', '1.00 kHz')}`,
		'wien.readout.mu': String.raw`\mu=${slot('value', '-0.00')}`,
		'wien.readout.amplitude': String.raw`A_o\approx${slot('value', '0.00')}`,
		'wien.probe.output': String.raw`v_o=${slot('value', '-0.000')}\quad\text{(normalized)}`,
		'wien.probe.feedback': String.raw`f_0=${textSlot('value', '1.00 kHz')}\quad\text{positive feedback}`,
		'wien.probe.gain': String.raw`A=${slot('gain', '0.00')}\quad\mu=${slot('mu', '-0.00')}`,
		'wien.probe.divider': String.raw`A_{\mathrm{required}}=3`,
		'wien.control.loss': String.raw`\lvert H(j\omega_0)\rvert=\tfrac13`,
		'wien.scope.vo': String.raw`v_o`,
		'wien.scope.dvo': String.raw`\mathrm{d}v_o/\mathrm{d}t`,
		'wien.scope.output': String.raw`v_o(t)`
	},
	lfsr: {
		'lfsr.control.period': String.raw`T_{\mathrm{clk}}=${slot('value', '000')}\,\mathrm{ms}`,
		'lfsr.readout.state': String.raw`Q=${slot('bits', '0000')}_2\;(${slot('value', '00')}_{10})`,
		'lfsr.readout.edges': String.raw`N_{\mathrm{edges}}=${slot('value', '000')}`,
		'lfsr.readout.period': String.raw`T=${textSlot('value', 'searching')}`,
		'lfsr.probe.clock': String.raw`N_{\mathrm{clk}}=${slot('value', '000')}`,
		'lfsr.probe.feedback': String.raw`b_{\mathrm{fb}}=q_3\oplus q_4=${slot('value', '0')}`,
		'lfsr.probe.stage': String.raw`q_{${slot('stage', '0')}}=${slot('value', '0')}`,
		'lfsr.probe.output': String.raw`y=${slot('value', '0')}\quad n=${slot('step', '000')}`
	},
	grover: {
		'grover.control.target': String.raw`\lvert q_2q_1q_0\rangle=\lvert${slot('value', '000')}\rangle`,
		'grover.hud.super': String.raw`\lvert s\rangle=\frac1{\sqrt8}\sum_x\lvert x\rangle\quad a_x=${slot('amplitude', '+0.000')}`,
		'grover.hud.oracle': String.raw`U_f:a_{${slot('state', '000')}}\longrightarrow-a_{${slot('state2', '000')}}`,
		'grover.hud.mean': String.raw`\langle a\rangle=${slot('value', '0.000')}\quad\text{reflection axis}`,
		'grover.hud.diffuse': String.raw`a_i\longrightarrow2\langle a\rangle-a_i\quad P(\lvert${slot('state', '000')}\rangle)=${slot('probability', '00.0')}\%`,
		'grover.hud.measure': String.raw`\operatorname{measure}\longrightarrow P(\lvert${slot('state', '000')}\rangle)=${slot('probability', '00.0')}\%`,
		'grover.probe.oracle': String.raw`U_f\text{ marks }\lvert${slot('state', '000')}\rangle\quad\text{(phase flip)}`,
		'grover.probe.diffuse': String.raw`a_i\longrightarrow2\langle a\rangle-a_i`,
		'grover.probe.measure': String.raw`q_{${slot('qubit', '0')}}\quad P(\mathrm{target})=${slot('probability', '00.0')}\%`,
		'grover.probe.h': String.raw`H_{q_{${slot('qubit', '0')}}}\quad\text{build uniform superposition}`,
		'grover.readout.peak': String.raw`P=${slot('value', '00.0')}\%`
	}
} as const satisfies Readonly<Record<string, Readonly<Record<string, string>>>>;

export const simulationMathTemplateIds = (simulationId: string): readonly string[] => [
	...Object.keys(common),
	...Object.keys(templates[simulationId as keyof typeof templates] ?? {})
];

const renderTemplate = (tex: string): string =>
	katex.renderToString(tex, {
		output: 'html',
		throwOnError: false,
		strict: 'ignore',
		trust: (context) => context.command === '\\htmlData'
	});

const escapeHtml = (value: string): string =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const timelineToken =
	/(A\d+\s*⊕\s*B\d+|\|[^|\n]+⟩|⟨[^⟨\n]+⟩|Cᵢₙ|Cₒᵤₜ|Vᵢₙ|Vₒᵤₜ|Cₜ|q[₀-₉]|m[₀-₉]|s[₀-₉]|Uƒ|H·CNOT|GF\(2\)|⅓|⅔|Σ|ψ|α|β|λ|Δφ|Δf|\b(?:CNOT|PWM|QH|Cout|Vcc|X|Z|L|R|C)\b)/g;
const subscriptDigit: Readonly<Record<string, string>> = {
	'₀': '0',
	'₁': '1',
	'₂': '2',
	'₃': '3',
	'₄': '4',
	'₅': '5',
	'₆': '6',
	'₇': '7',
	'₈': '8',
	'₉': '9'
};
const timelineKatexCache = new Map<string, string>();

function timelineTex(token: string): string {
	const xor = token.match(/^A(\d+)\s*⊕\s*B(\d+)$/);
	if (xor) return `A_{${xor[1]}}\\oplus B_{${xor[2]}}`;
	const ket = token.match(/^\|(.+)⟩$/);
	if (ket) return `\\lvert ${ket[1]}\\rangle`;
	const mean = token.match(/^⟨(.+)⟩$/);
	if (mean) return `\\langle ${mean[1]}\\rangle`;
	const indexed = token.match(/^([qms])([₀-₉])$/);
	if (indexed) return `${indexed[1]}_{${subscriptDigit[indexed[2]!]}}`;
	const fixed: Readonly<Record<string, string>> = {
		Cᵢₙ: 'C_{\\mathrm{in}}',
		Cₒᵤₜ: 'C_{\\mathrm{out}}',
		Vᵢₙ: 'V_{\\mathrm{in}}',
		Vₒᵤₜ: 'V_{\\mathrm{out}}',
		Cₜ: 'C_T',
		Uƒ: 'U_f',
		'H·CNOT': 'H\\cdot\\operatorname{CNOT}',
		CNOT: '\\operatorname{CNOT}',
		PWM: '\\operatorname{PWM}',
		QH: 'Q_H',
		Cout: 'C_{\\mathrm{out}}',
		Vcc: 'V_{CC}',
		'GF(2)': '\\operatorname{GF}(2)',
		'⅓': '\\tfrac13',
		'⅔': '\\tfrac23',
		Σ: '\\Sigma',
		ψ: '\\psi',
		α: '\\alpha',
		β: '\\beta',
		λ: '\\lambda',
		Δφ: '\\Delta\\varphi',
		Δf: '\\Delta f'
	};
	return fixed[token] ?? token;
}

/** Render notation embedded in the causal rail without interpreting arbitrary prose as TeX. */
function renderTimelineText(value: string): string {
	let cursor = 0;
	let html = '';
	for (const match of value.matchAll(timelineToken)) {
		const index = match.index;
		const token = match[0];
		html += escapeHtml(value.slice(cursor, index));
		let rendered = timelineKatexCache.get(token);
		if (rendered === undefined) {
			rendered = katex.renderToString(timelineTex(token), {
				output: 'html',
				throwOnError: false,
				strict: 'ignore'
			});
			timelineKatexCache.set(token, rendered);
		}
		html += rendered;
		cursor = index + token.length;
	}
	return html + escapeHtml(value.slice(cursor));
}

export const renderSimulationTimeline = (
	stages: readonly SimulationStage[]
): readonly RenderedSimulationStage[] =>
	stages.map((stage) => ({
		...stage,
		labelHtml: renderTimelineText(stage.label),
		explanationHtml: renderTimelineText(stage.explanation)
	}));

export const renderSimulationMath = (simulationId: string): SimulationMathRegistry => {
	const selected = templates[simulationId as keyof typeof templates];
	if (!selected)
		return Object.fromEntries(Object.entries(common).map(([id, tex]) => [id, renderTemplate(tex)]));
	return Object.fromEntries(
		[...Object.entries(common), ...Object.entries(selected)].map(([id, tex]) => [
			id,
			renderTemplate(tex)
		])
	);
};
