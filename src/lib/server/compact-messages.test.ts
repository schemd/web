import { expect, it } from 'vitest';
import { compactMessageSource } from '../../../scripts/compact-messages';
import { messageKey } from '#lib/i18n/message-key.ts';

it('compacts real message calls while preserving literal code and comments', () => {
	const source = `<script>
 // t('Save') is a source example.
 const example = "t('Save')";
 const label = t('Save');
 </script><p>{t('Save')}</p><pre>t('Save')</pre>`;
	const result = compactMessageSource(source, new Set(['Save']));
	expect(result).toContain(`const example = "t('Save')";`);
	expect(result).toContain("// t('Save') is a source example.");
	expect(result).toContain("<pre>t('Save')</pre>");
	expect(result.split(messageKey('Save'))).toHaveLength(3);
});
