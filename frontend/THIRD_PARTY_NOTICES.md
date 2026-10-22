# Third-party notices

## Rare UI FluidOrb

- Copyright (c) 2026 Swami Malode.
- [Rare UI](https://rareui.com) / [source repository](https://github.com/swamimalode07/rare-ui).
- Source revision: `8944172746e8e836aea2061790ee16b0577dd655`.
- Original file: `components/ui/fluid-orb.tsx`.
- Local adaptation: `src/components/rare/FluidOrb.tsx`.
- License: MIT + Commons Clause License Condition v1.0 + Attribution.
  The full upstream text is in [licenses/rare-ui-LICENSE.txt](licenses/rare-ui-LICENSE.txt).

Changes remove the classname/Tailwind dependency, add a local fallback, improve GPU
cleanup, and limit/pause animation for visibility and reduced-motion preferences.
The original shader's edge smoothing was expressed with an increasing smoothstep range.
No upstream website, registry tooling, analytics, advertising, or dependency stack is bundled.

The Studio appearance includes a visible attribution link. This component is included
as part of the StockAI application, not distributed as a standalone component library.
