/** Stable compact message references keep prose out of the client module graph. */
export function messageKey(message: string): string {
	let hash = 2166136261;
	for (let index = 0; index < message.length; index += 1)
		hash = Math.imul(hash ^ message.charCodeAt(index), 16777619);
	return '@' + (hash >>> 0).toString(36);
}
