/**
 * Human-readable presentation layer for `/sitemap.xml`.
 *
 * A sitemap is a machine document, but it is also the fastest honest answer to
 * "what is actually on this site?" — and unstyled it renders as either a wall of
 * tags or, in Chrome, a terse built-in table. An XSLT stylesheet referenced from
 * the XML gives a reader the same information in the site's own idiom while the
 * bytes a crawler consumes stay byte-identical: the processing instruction is a
 * comment as far as the sitemap protocol is concerned.
 *
 * XSLT 1.0 only — that is what browsers implement, so no 2.0/3.0 constructs and
 * no grouping beyond `count()` over predicates. The sitemap's default namespace
 * has to be bound to a prefix here because XPath 1.0 has no notion of a default
 * namespace: an unprefixed `loc` would silently match nothing.
 *
 * **This feature is on its way out.** Chromium already logs "XSLTProcessor and
 * XSLT Processing Instructions have been deprecated by all browsers. These
 * features will be removed from this browser soon."
 * (https://chromestatus.com/feature/4709671889534976). Accepted knowingly: the
 * degradation is total but harmless — the stylesheet stops being applied and the
 * reader sees raw XML, which is exactly what they saw before this file existed.
 * No crawler behaviour depends on it, so the downside is bounded to losing a
 * convenience rather than breaking anything.
 *
 * If a styled sitemap should outlive XSLT, the durable shape is a separate
 * server-rendered `/sitemap` HTML route reading the same entry list, with
 * `/sitemap.xml` left machine-only. That version would also use the real design
 * system instead of the token copy below, which is this file's other liability.
 */
import type { RequestHandler } from './$types';

/* Tokens are inlined rather than imported from app.css: this document is
   rendered by the browser's XSLT processor outside the SvelteKit asset
   pipeline, so it cannot reference a hashed stylesheet. The palette mirrors the
   `:root` block in src/app.css — the site has one theme, so there is no
   light-mode branch to keep in sync. */
const STYLESHEET = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
	<xsl:output method="html" indent="yes" encoding="UTF-8" />

	<xsl:template match="/">
		<html lang="en">
			<head>
				<title>XML sitemap · schemd</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="robots" content="noindex" />
				<style>
					:root {
						--bg: #0a0d10;
						--bg-raised: #0f1318;
						--bg-panel: #12171d;
						--bg-inset: #070a0c;
						--ink: #dbe4ec;
						--ink-mute: #8b98a5;
						--ink-faint: #83919e;
						--line: #1e262e;
						--line-strong: #2c3844;
						--accent: #57d7c4;
						--accent-2: #7aa8ff;
						--warn: #f2b558;
						--font-sans: 'Avenir Next', 'Futura', 'Century Gothic', 'Segoe UI', system-ui, -apple-system, sans-serif;
						--font-mono: 'Berkeley Mono', 'SF Mono', 'Cascadia Code', 'JetBrains Mono', ui-monospace, 'Menlo', 'Consolas', monospace;
					}
					* { box-sizing: border-box; }
					body {
						margin: 0;
						padding: 2rem 1.25rem 4rem;
						background: var(--bg);
						color: var(--ink);
						font-family: var(--font-sans);
						font-size: 0.9375rem;
						line-height: 1.55;
						-webkit-font-smoothing: antialiased;
					}
					.wrap { max-width: 1080px; margin: 0 auto; }
					header { border-bottom: 1px solid var(--line-strong); padding-bottom: 1.5rem; }
					.eyebrow {
						font-family: var(--font-mono);
						font-size: 0.6875rem;
						letter-spacing: 0.22em;
						text-transform: uppercase;
						color: var(--accent);
						margin: 0 0 0.5rem;
					}
					h1 { font-size: clamp(1.75rem, 3.2vw, 2.25rem); margin: 0 0 0.5rem; font-weight: 600; }
					.lede { color: var(--ink-mute); margin: 0; max-width: 62ch; font-size: 0.9375rem; }
					.lede code {
						font-family: var(--font-mono);
						font-size: 0.8125rem;
						color: var(--ink);
						background: var(--bg-inset);
						border: 1px solid var(--line);
						border-radius: 3px;
						padding: 0.05rem 0.3rem;
					}
					.band {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
						gap: 1px;
						background: var(--line);
						border: 1px solid var(--line);
						border-radius: 5px;
						overflow: hidden;
						margin: 1.75rem 0;
					}
					.stat { background: var(--bg-panel); padding: 0.875rem 1rem; }
					.stat dt {
						font-family: var(--font-mono);
						font-size: 0.6875rem;
						letter-spacing: 0.14em;
						text-transform: uppercase;
						color: var(--ink-faint);
						margin: 0 0 0.35rem;
					}
					.stat dd {
						margin: 0;
						font-family: var(--font-mono);
						font-size: 1.375rem;
						color: var(--ink);
						font-variant-numeric: tabular-nums;
					}
					.tablewrap {
						border: 1px solid var(--line);
						border-radius: 5px;
						overflow-x: auto;
						background: var(--bg-raised);
					}
					table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
					thead th {
						position: sticky;
						top: 0;
						background: var(--bg-panel);
						font-family: var(--font-mono);
						font-size: 0.6875rem;
						letter-spacing: 0.14em;
						text-transform: uppercase;
						color: var(--ink-faint);
						font-weight: 500;
						text-align: left;
						padding: 0.7rem 0.85rem;
						border-bottom: 1px solid var(--line-strong);
						white-space: nowrap;
					}
					tbody td {
						padding: 0.6rem 0.85rem;
						border-bottom: 1px solid var(--line);
						vertical-align: middle;
					}
					tbody tr:last-child td { border-bottom: 0; }
					tbody tr:hover td { background: var(--bg-panel); }
					.idx {
						font-family: var(--font-mono);
						color: var(--ink-faint);
						font-variant-numeric: tabular-nums;
						text-align: right;
						width: 3.5rem;
					}
					.loc a {
						font-family: var(--font-mono);
						color: var(--ink);
						text-decoration: none;
						border-bottom: 1px solid transparent;
					}
					.loc a:hover { color: var(--accent); border-bottom-color: var(--accent); }
					.tag {
						display: inline-block;
						font-family: var(--font-mono);
						font-size: 0.6875rem;
						letter-spacing: 0.14em;
						text-transform: uppercase;
						padding: 0.15rem 0.45rem;
						border-radius: 3px;
						border: 1px solid var(--line-strong);
						color: var(--ink-mute);
						white-space: nowrap;
					}
					.tag-docs { color: var(--accent); border-color: color-mix(in oklab, var(--accent) 40%, var(--line-strong)); }
					.tag-lab { color: var(--accent-2); border-color: color-mix(in oklab, var(--accent-2) 40%, var(--line-strong)); }
					.tag-play { color: var(--warn); border-color: color-mix(in oklab, var(--warn) 40%, var(--line-strong)); }
					.when {
						font-family: var(--font-mono);
						color: var(--ink-mute);
						font-variant-numeric: tabular-nums;
						white-space: nowrap;
					}
					.prio { width: 9rem; }
					.meter {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						font-family: var(--font-mono);
						font-variant-numeric: tabular-nums;
						color: var(--ink-mute);
					}
					.track {
						flex: 1;
						height: 3px;
						background: var(--bg-inset);
						border-radius: 2px;
						overflow: hidden;
						min-width: 40px;
					}
					/* The display declaration is load-bearing: .fill is a span, and an
					   inline box ignores height, so without it every bar renders as a
					   zero-height line and the meter reads identically at 1.0 and 0.4. */
					.fill { display: block; height: 100%; background: var(--accent); border-radius: 2px; }
					footer {
						margin-top: 2rem;
						color: var(--ink-faint);
						font-size: 0.8125rem;
						max-width: 72ch;
					}
					footer a { color: var(--accent); text-decoration: none; }
					footer a:hover { text-decoration: underline; }
					@media (max-width: 640px) {
						.prio, .idx { display: none; }
						body { padding: 1.5rem 0.875rem 3rem; }
						/* The section column is tight at 390px and PLAYGROUND is the
						   longest label; without this it overruns the table edge. */
						.tag { letter-spacing: 0.06em; padding: 0.15rem 0.3rem; }
						tbody td, thead th { padding-left: 0.6rem; padding-right: 0.6rem; }
					}
				</style>
			</head>
			<body>
				<div class="wrap">
					<header>
						<p class="eyebrow">schemd · machine index</p>
						<h1>XML sitemap</h1>
						<p class="lede">
							Every distinct page submitted to crawlers, generated from the release registry
							on request. This table is an XSLT view of <code>/sitemap.xml</code> — the bytes
							a crawler reads are unchanged, and priorities are relative to this site only,
							never an absolute ranking claim.
						</p>
					</header>

					<dl class="band">
						<div class="stat">
							<dt>Total URLs</dt>
							<dd><xsl:value-of select="count(sm:urlset/sm:url)" /></dd>
						</div>
						<div class="stat">
							<dt>Documentation</dt>
							<dd><xsl:value-of select="count(sm:urlset/sm:url[contains(sm:loc, '/docs/')])" /></dd>
						</div>
						<div class="stat">
							<dt>Laboratories</dt>
							<dd><xsl:value-of select="count(sm:urlset/sm:url[contains(sm:loc, '/simulations/')])" /></dd>
						</div>
						<div class="stat">
							<dt>Last modified</dt>
							<dd><xsl:value-of select="sm:urlset/sm:url/sm:lastmod[1]" /></dd>
						</div>
					</dl>

					<div class="tablewrap">
						<table>
							<thead>
								<tr>
									<th class="idx">#</th>
									<th>Location</th>
									<th>Section</th>
									<th>Modified</th>
									<th class="prio">Priority</th>
								</tr>
							</thead>
							<tbody>
								<xsl:for-each select="sm:urlset/sm:url">
									<tr>
										<td class="idx"><xsl:value-of select="position()" /></td>
										<td class="loc">
											<a href="{sm:loc}">
												<xsl:variable name="path"
													select="substring-after(substring-after(sm:loc, '//'), '/')" />
												<xsl:choose>
													<xsl:when test="$path = ''">/</xsl:when>
													<xsl:otherwise>/<xsl:value-of select="$path" /></xsl:otherwise>
												</xsl:choose>
											</a>
										</td>
										<td>
											<xsl:choose>
												<xsl:when test="contains(sm:loc, '/docs/')">
													<span class="tag tag-docs">Docs</span>
												</xsl:when>
												<xsl:when test="contains(sm:loc, '/simulations/')">
													<span class="tag tag-lab">Lab</span>
												</xsl:when>
												<xsl:when test="contains(sm:loc, '/playground/')">
													<span class="tag tag-play">Playground</span>
												</xsl:when>
												<xsl:otherwise>
													<span class="tag">Core</span>
												</xsl:otherwise>
											</xsl:choose>
										</td>
										<td class="when">
											<xsl:choose>
												<xsl:when test="sm:lastmod"><xsl:value-of select="sm:lastmod" /></xsl:when>
												<xsl:otherwise>&#8212;</xsl:otherwise>
											</xsl:choose>
										</td>
										<td class="prio">
											<div class="meter">
												<span class="track">
													<span class="fill" style="width:{sm:priority * 100}%"></span>
												</span>
												<span><xsl:value-of select="sm:priority" /></span>
											</div>
										</td>
									</tr>
								</xsl:for-each>
							</tbody>
						</table>
					</div>

					<footer>
						<p>
							One URL per distinct page, not one per routable URL. The playground and the
							laboratories exist once per published release; only the newest is submitted,
							while historical URLs stay reachable and carry a canonical pointing at their
							current equivalent. Documentation is the opposite case — every documented
							release line teaches with its own prose, so each line is submitted in full.
						</p>
						<p>
							<a href="/">Home</a> · <a href="/docs">Documentation</a> ·
							<a href="/changelog">Changelog</a>
						</p>
					</footer>
				</div>
			</body>
		</html>
	</xsl:template>
</xsl:stylesheet>
`;

export const GET: RequestHandler = async () => {
	return new Response(STYLESHEET, {
		headers: {
			/* `text/xsl` is the type browsers accept for a stylesheet processing
			   instruction. It matters that this is exact: hooks.server.ts sets
			   `x-content-type-options: nosniff` globally, so a wrong type here is
			   not quietly recovered from. */
			'content-type': 'text/xsl; charset=utf-8',
			'cache-control': 'public, max-age=86400'
		}
	});
};
