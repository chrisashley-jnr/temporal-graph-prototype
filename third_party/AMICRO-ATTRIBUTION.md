# Amicro attribution

Upstream: https://amicro.dev/ and https://github.com/Subhan-code/Amicro--Micro-transitions-

Source commit: `73a6d5c2b28b30ad6f6d98550bb6175cbf51132b`

Copyright (c) 2026 SYED SUBHAN UDDIN. Licensed under MIT; full text in `AMICRO-LICENSE`.

Adapted source components:
- `src/components/mono-charts/MonoRoundedLineChart.tsx`
- `src/components/mono-charts/MonoRoundedKpiCardChart.tsx`
- `src/components/mono-charts/MonoRoundedDonutChart.tsx`
- `src/components/dither-charts/lib/recharts-tooltip.tsx`
- `src/components/AnimatedButton.tsx` (narrowed to the button surface, spring and rotate interaction)
- `src/hooks/useIsMobile.ts` (retained source helper)

The corresponding local components are in `src/components/amicro/`. Modifications replace fixture financial/latency values with experiment API data, adapt labels and controls, make charts respond to replay, add accessible controls, use unique gradient IDs and simplify light-theme and animation variants. The dashboard shell, transaction tables and graph investigation content are new application code styled using Amicro's monochrome surfaces and controls. Outfit is self-hosted from @fontsource/outfit; its OFL licence is included separately. No claim of affiliation or endorsement is made.
