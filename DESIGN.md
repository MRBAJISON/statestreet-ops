# StateStreet Product Design System

## Theme

The physical scene is a bright retail office or store counter during a working
day, where a manager needs clear information without visual fatigue. The default
theme is light, with cool green-tinted neutrals and a darker sidebar layer. Dark
mode is not part of the first rebuild.

## Color Strategy

Use a restrained product foundation with a full data-visualization palette.
Primary emerald identifies actions and current selection. Cobalt carries actual
revenue and primary series. Amber carries targets and watch states. Coral marks
risk and negative movement. Teal and orchid support secondary categories.

- Background: `oklch(0.975 0.008 165)`
- Surface: `oklch(0.995 0.004 165)`
- Raised surface: `oklch(0.985 0.012 165)`
- Sidebar: `oklch(0.94 0.025 166)`
- Foreground: `oklch(0.22 0.02 168)`
- Muted foreground: `oklch(0.50 0.025 170)`
- Border: `oklch(0.89 0.018 165)`
- Primary emerald: `oklch(0.55 0.15 155)`
- Cobalt data: `oklch(0.58 0.18 255)`
- Amber target: `oklch(0.77 0.15 82)`
- Coral risk: `oklch(0.66 0.17 28)`
- Teal secondary: `oklch(0.64 0.13 190)`
- Orchid secondary: `oklch(0.63 0.15 305)`

Semantic states always pair color with text or iconography.

## Typography

Use Geist throughout. Product labels, controls, navigation, and data stay in one
family. Use fixed sizes rather than viewport-scaled type.

- Page title: 24px, 650, 30px line height
- Section heading: 15px, 650, 22px line height
- KPI value: 26px, 650, tabular numerals
- Body: 14px, 400, 21px line height
- Control: 13px, 550, 18px line height
- Caption: 12px, 500, 17px line height
- No negative letter spacing

## Shape And Depth

- Base radius: 8px. Compact controls use 6px.
- Use unframed sections, table rows, and softly tinted analytical bands before
  introducing cards.
- Cards are reserved for repeated records and genuinely contained tools.
- No nested cards.
- Raised surfaces use a one-pixel tinted border and a soft two-layer shadow.
- Chart canvases may use a subtle cool tint to create depth without gradients or
  decorative blobs.

## Application Shell

- Desktop uses a 244px shadcn sidebar with StateStreet as a clear brand signal,
  role-aware navigation, and the account control at the bottom.
- Compact desktop collapses to the shadcn icon rail.
- Mobile uses a sheet and a 56px top bar.
- Content width is fluid with a 1560px maximum and stable 24px desktop gutters.
- Page headers keep title, period, store filter, and primary action in one line
  where space permits.

## Analytics

- The executive dashboard leads with one broad revenue-versus-target canvas,
  not a grid of KPI cards.
- Supporting KPIs sit as an inline rail with separators and selected color cues.
- Store rankings use bars and precise values. Category contribution uses a
  compact chart plus a scannable legend. Attention is a short ordered queue.
- Recharts is the common chart engine. Tooltips, axes, empty states, and loading
  skeletons use shared shadcn chart primitives.
- Actual, target, prior period, and forecast keep stable colors across roles.
- Every chart has an adjacent table or textual value path for accessibility.

## Forms

- Forms open as full work pages or wide drawers for short tasks, never chains of
  small modals.
- Prefilled store, user, and business date are visible context, not editable
  repeated fields.
- Progressive disclosure keeps the common fields visible and advanced notes
  secondary.
- Header and line-item documents use a stable table with product search, derived
  metadata, inline errors, and totals anchored below.
- Draft, submit, approve, reopen, dispatch, receive, and complete are distinct
  commands with explicit confirmation only when data or state cannot be undone.

## Motion

- Use 160 to 220ms ease-out transitions for sidebar, tabs, drawers, hover, and
  state feedback.
- Charts may animate once on data-range changes.
- No orchestrated page entrance, bounce, decorative parallax, or looping motion.
- Disable non-essential transitions under `prefers-reduced-motion`.
