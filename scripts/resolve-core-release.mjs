/** Keep dispatch input out of shell source and reject ranges or invalid branch names. */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const target =
	process.env.REQUESTED_VERSION?.trim() ||
	execFileSync('npm', ['view', '@schemd/core', 'version'], { encoding: 'utf8' }).trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(target)) {
	throw new Error('Expected one explicit compiler version, such as 1.3.0 or 1.4.0-beta.1.');
}
if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
appendFileSync(process.env.GITHUB_OUTPUT, `target=${target}\nbranch=chore/core-${target}\n`);
console.log(`Target compiler version: ${target}`);
