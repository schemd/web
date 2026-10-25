/**
 * Component datasheets, generated from the compiler.
 *
 * Every fact on a datasheet page comes from `@schemd/core` itself: the options
 * and their ranges from `SCHEMATIC_COMPONENT_SCHEMAS`, the pins from
 * `describeComponentPorts`, and each pin's side from the geometry of a real
 * compiled specimen. Nothing here lists a kind by hand, so a release that adds
 * a kind or an option adds a page or a table row without an edit to this site.
 */
import {
	COMPONENT_KINDS,
	compileSchematic,
	componentObstacleRectangle,
	componentTextAnchors,
	parseSchematic,
	resolvePortGeometry,
	type SchematicFence
} from '@schemd/core';
import {
	describeComponentPorts,
	SCHEMATIC_COMPONENT_SCHEMAS,
	type SchematicComponentFamily,
	type SchematicComponentSchema,
	type SchematicOptionSchema
} from '@schemd/core/schema';

export const FAMILY_ORDER: readonly SchematicComponentFamily[] = [
	'electrical',
	'digital',
	'quantum',
	'uml'
];

export const FAMILY_LABEL: Readonly<Record<SchematicComponentFamily, string>> = {
	electrical: 'Electrical',
	digital: 'Digital',
	quantum: 'Quantum',
	uml: 'UML'
};

/* Each family prints in one of the compiler's own colours. */
const FAMILY_COLOR: Readonly<Record<SchematicComponentFamily, string>> = {
	electrical: 'amber',
	digital: 'purple',
	quantum: 'blue',
	uml: 'slate'
};

const CANVAS = { width: 1200, height: 900 } as const;
const CENTRE = { x: 600, y: 450 } as const;

export interface Specimen {
	/** The cropped drawing. */
	readonly svg: string;
	/** The one line of schemd that draws it. */
	readonly source: string;
}

export interface PinRow {
	readonly name: string;
	readonly side: 'left' | 'right' | 'top' | 'bottom';
}

export interface OptionRow {
	readonly name: string;
	readonly type: SchematicOptionSchema['type'];
	/** Plain-language statement of what the option accepts. */
	readonly accepts: string;
	/** Exact values, for an enum; printed as code. */
	readonly values: readonly string[];
	readonly defaultValue: string | undefined;
	/** Defaults that depend on the kind's `type`, as `type = value` pairs. */
	readonly defaultsByType: readonly string[];
}

export interface ComponentSheet {
	readonly kind: string;
	readonly family: SchematicComponentFamily;
	readonly familyLabel: string;
	readonly specimen: Specimen;
	readonly pins: readonly PinRow[];
	readonly options: readonly OptionRow[];
	/** The option that selects the symbol (`type`, or `style` for ground), with one specimen per value. */
	readonly variants:
		| {
				readonly option: string;
				readonly specimens: readonly (Specimen & { readonly value: string })[];
		  }
		| undefined;
	readonly requiresOneOf: readonly string[];
	readonly conflicts: readonly (readonly [string, string])[];
}

export interface ComponentSummary {
	readonly kind: string;
	readonly family: SchematicComponentFamily;
	readonly options: number;
	readonly variants: number;
	readonly pins: number;
}

/** A designator a reader would expect: R1 for a resistor, U1 for most blocks. */
function designator(kind: string): string {
	const known: Readonly<Record<string, string>> = {
		resistor: 'R1',
		capacitor: 'C1',
		inductor: 'L1',
		diode: 'D1',
		transistor: 'Q1',
		ground: 'G1',
		source: 'V1',
		switch: 'S1',
		junction: 'J1',
		port: 'P1'
	};
	return known[kind] ?? 'U1';
}

/** Options a specimen needs before it is valid at all: an IC needs pins. */
function baseOptions(schema: SchematicComponentSchema): Record<string, string> {
	return schema.requiresOneOf === undefined ? {} : { left: 'IN1,IN2', right: 'OUT' };
}

function declaration(
	kind: string,
	color: string,
	options: Readonly<Record<string, string>>,
	at: { readonly x: number; readonly y: number } = CENTRE
): string {
	const written = Object.entries(options).map(([name, value]) =>
		/^[A-Za-z0-9_.+-]+$/.test(value) ? `${name}=${value}` : `${name}="${value}"`
	);
	return `${kind}:${designator(kind)} at (${at.x}, ${at.y}) #${color}${written.length === 0 ? '' : ` [${written.join(' ')}]`}`;
}

const fence = (title: string): SchematicFence => ({ bounds: { ...CANVAS }, title });

/** Text that is safe inside SVG markup. */
function escape(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Compile one part alone and crop the drawing to it, its designator and its
 * label row. With `pinLabels`, each pin's name is printed beside its end, as a
 * datasheet's pin diagram does, at the position the compiler reports.
 */
function specimen(
	schema: SchematicComponentSchema,
	options: Readonly<Record<string, string>>,
	idPrefix: string,
	{ scale = 1, pinLabels = false }: { readonly scale?: number; readonly pinLabels?: boolean } = {}
): Specimen {
	const color = FAMILY_COLOR[schema.family];
	const line = declaration(schema.kind, color, { ...baseOptions(schema), ...options });
	const title = `${schema.kind} specimen`;
	const component = parseSchematic(line, fence(title)).components[0]!;
	const body = componentObstacleRectangle(component, 0);
	const text = componentTextAnchors(component);
	const halfText = Math.max(text.designatorWidth, text.labelWidth) / 2;
	/* An IC prints its pin names inside its body already. */
	const labelled = pinLabels && schema.kind !== 'ic';
	const pinNames = labelled
		? describeComponentPorts(schema.kind, { ...baseOptions(schema), ...options })
		: [];
	/* Room for the longest pin name beside its pin, at about 5.5 units a character. */
	const margin = 16 + Math.max(0, ...pinNames.map((name) => name.length * 5.5 + 8));
	const minX = Math.min(body.minX, component.x - halfText) - margin;
	const maxX = Math.max(body.maxX, component.x + halfText) + margin;
	const minY = Math.min(body.minY, component.y + text.designatorY - 14) - margin;
	const maxY = Math.max(body.maxY, component.y + text.labelY) + margin;
	const width = Math.round(maxX - minX);
	const height = Math.round(maxY - minY);
	let labels = '';
	for (const name of pinNames) {
		const { point, normal } = resolvePortGeometry(component, name);
		/* Side pins are labelled past their end; top and bottom pins beside it,
		   clear of the designator and label rows above and below the part. */
		const across = normal.x !== 0;
		const x = across ? point.x + normal.x * 6 : point.x + 5;
		const y = across ? point.y + 3.5 : point.y + (normal.y < 0 ? 8 : -2);
		const anchor = normal.x < 0 ? 'end' : 'start';
		labels += `<text class="pin-label" x="${x}" y="${y}" text-anchor="${anchor}" font-size="9" stroke="none">${escape(name)}</text>`;
	}
	const svg = compileSchematic(line, { ...fence(title), idPrefix })
		.svg.replace(
			`viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" width="${CANVAS.width}" height="${CANVAS.height}"`,
			`viewBox="${Math.round(minX)} ${Math.round(minY)} ${width} ${height}" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}"`
		)
		.replace('</svg>', `${labels}</svg>`);
	return {
		svg,
		source: declaration(
			schema.kind,
			color,
			{ ...baseOptions(schema), ...options },
			{ x: 120, y: 80 }
		)
	};
}

function accepts(option: SchematicOptionSchema): string {
	switch (option.type) {
		case 'enum':
			return option.values.length === 1 ? 'Only' : `One of ${option.values.length} values`;
		case 'integer':
			return option.min === option.max
				? `Exactly ${option.min}`
				: `Whole number from ${option.min} to ${option.max}`;
		case 'number':
			return `Number from ${option.min} to ${option.max}`;
		case 'text':
			return option.maxLength === undefined
				? option.minLength === 0
					? 'Any text, or empty'
					: 'Any text'
				: `Text of ${option.minLength} to ${option.maxLength} characters`;
		case 'pins':
			return `Comma-separated pin names, at most ${option.maxItems}; each starts with a letter, and ${option.reserved.join(' and ')} are reserved`;
		case 'rows':
			return `Semicolon-separated rows, at most ${option.maxItems}, each up to ${option.maxLength} characters`;
	}
}

function optionRow(option: SchematicOptionSchema): OptionRow {
	const isNumeric = option.type === 'integer' || option.type === 'number';
	return {
		name: option.name,
		type: option.type,
		accepts: accepts(option),
		values: option.type === 'enum' ? option.values : [],
		defaultValue:
			option.type === 'enum' || isNumeric
				? option.default === undefined
					? undefined
					: String(option.default)
				: undefined,
		defaultsByType:
			isNumeric && option.defaultsByType !== undefined
				? Object.entries(option.defaultsByType).map(([type, value]) => `${value} when type=${type}`)
				: []
	};
}

function side(normal: { readonly x: number; readonly y: number }): PinRow['side'] {
	if (normal.x < 0) return 'left';
	if (normal.x > 0) return 'right';
	return normal.y < 0 ? 'top' : 'bottom';
}

function pins(schema: SchematicComponentSchema): PinRow[] {
	const options = baseOptions(schema);
	const component = parseSchematic(declaration(schema.kind, 'slate', options), fence('pins'))
		.components[0]!;
	return describeComponentPorts(schema.kind, options).map((name) => ({
		name,
		side: side(resolvePortGeometry(component, name).normal)
	}));
}

const sheets = new Map<string, ComponentSheet>();

/** The datasheet of one kind, or `undefined` for a kind the compiler does not know. */
export function componentSheet(kind: string): ComponentSheet | undefined {
	const cached = sheets.get(kind);
	if (cached !== undefined) return cached;
	const schema = (
		SCHEMATIC_COMPONENT_SCHEMAS as Readonly<Record<string, SchematicComponentSchema>>
	)[kind];
	if (schema === undefined) return undefined;
	const variantOption = schema.options.find(
		(option) => option.type === 'enum' && (option.name === 'type' || option.name === 'style')
	);
	const sheet: ComponentSheet = {
		kind,
		family: schema.family,
		familyLabel: FAMILY_LABEL[schema.family],
		specimen: specimen(schema, {}, `spec-${kind}`, { scale: 1.6, pinLabels: true }),
		pins: pins(schema),
		options: schema.options.map(optionRow),
		variants:
			variantOption === undefined || variantOption.type !== 'enum'
				? undefined
				: {
						option: variantOption.name,
						specimens: variantOption.values.map((value) => ({
							value,
							...specimen(schema, { [variantOption.name]: value }, `spec-${kind}-${value}`, {
								scale: 1.2
							})
						}))
					},
		requiresOneOf: schema.requiresOneOf ?? [],
		conflicts: schema.conflicts ?? []
	};
	sheets.set(kind, sheet);
	return sheet;
}

/** Every kind, in the compiler's order, with the counts the index prints. */
export function componentIndex(): readonly ComponentSummary[] {
	return COMPONENT_KINDS.map((kind) => {
		const schema = SCHEMATIC_COMPONENT_SCHEMAS[kind];
		const variant = schema.options.find(
			(option) => option.type === 'enum' && (option.name === 'type' || option.name === 'style')
		);
		return {
			kind,
			family: schema.family,
			options: schema.options.length,
			variants: variant?.type === 'enum' ? variant.values.length : 0,
			pins: describeComponentPorts(kind, baseOptions(schema)).length
		};
	});
}
