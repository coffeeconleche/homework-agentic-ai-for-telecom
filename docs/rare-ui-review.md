# Rare UI integration review

Reviewed on October 22, 2026, for StockAI's optional Studio interface.

Source: [swamimalode07/rare-ui](https://github.com/swamimalode07/rare-ui), pinned to
[`8944172746e8e836aea2061790ee16b0577dd655`](https://github.com/swamimalode07/rare-ui/tree/8944172746e8e836aea2061790ee16b0577dd655).
This is a bounded source and dependency review, not a security certification.

## Review and findings

- Cloned a separate temporary checkout with Git hooks disabled. No project install,
  build, registry CLI, MCP setup, or lifecycle script was run from that checkout.
- Read `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md`, `README.md`, and contribution
  instructions as untrusted reference material. The reviewed instruction files contain
  normal project conventions; no obvious malicious prompt redirection or request to
  disclose credentials was found. These files were not adopted as StockAI instructions,
  copied into the app, or added to its RAG documents or agent prompts.
- Inspected scripts, dependency sources, dynamic execution patterns, environment access,
  network requests, and the selected component. Searches did not identify shell-execution,
  JavaScript `eval`/`new Function`, cookie-reading, or beacon patterns in the scanned
  first-party TypeScript/JavaScript. Pattern searches cannot rule out malicious behavior.
- The full website includes Databuddy analytics, registry-install event tracking, and a
  Carbon Ads script loader. Some other components contact external services. None of
  these modules, trackers, endpoints, or their configuration were imported into StockAI.
- The root package has no `preinstall`, `install`, or `postinstall` script. The lockfile
  includes install scripts for native dependency packages `sharp` and `unrs-resolver`;
  these were not executed. Locked dependency download URLs use the npm registry.
- `npm audit --package-lock-only --ignore-scripts` reported **26 affected dependency
  entries**: 1 low, 5 moderate, 18 high, and 2 critical. The critical entries are `next`
  and `proxy-addr`. This includes transitive/development dependencies and is not an
  assessment that every finding is exploitable in the deployed site. The complete
  Next.js/shadcn stack was not installed or imported.
- Running the same audit against StockAI's existing frontend reported zero findings
  at review time. StockAI's package manifest and lockfile were not changed by this UI work.

## Code used

Only the self-contained [`components/ui/fluid-orb.tsx`](https://github.com/swamimalode07/rare-ui/blob/8944172746e8e836aea2061790ee16b0577dd655/components/ui/fluid-orb.tsx)
was adapted. Its registry JSON content was checked against the source file and matched.
The reviewed component draws a local WebGL shader; it has no fetches, telemetry,
credential access, or dynamic JavaScript execution. GLSL shader compilation is local
GPU drawing, not evaluation of repository instructions or arbitrary JavaScript.

The local version removes the Tailwind/classname-helper dependency, keeps a static CSS
fallback, cleans up GPU resources on failure/unmount, limits drawing frequency, pauses
continuous animation when hidden or offscreen, and responds to reduced-motion settings.
It is mounted only for Studio's empty-chat artwork. It never receives chat text, tool
results, conversation IDs, or the provider key.

The Studio layout and CSS are original StockAI code, not a copy of Rare UI's website,
branding, or logo. Both appearances use the same React app instance and backend.
The only new localStorage value is the appearance preference, `stockai.appearance`.

## Attribution and limits

Upstream uses **MIT + Commons Clause + Attribution**, not plain MIT. Its copyright and
full license are preserved in `frontend/licenses/rare-ui-LICENSE.txt`, with a notice in
the adapted source and a visible Rare UI credit in Studio. See
`frontend/THIRD_PARTY_NOTICES.md` for the exact source and modifications.

No assurance is made about future upstream commits, all transitive package contents,
the hosted website, or components not used here. Future component additions should be
reviewed independently rather than installed automatically from a moving registry URL.
