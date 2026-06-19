# UI/UX Overhaul — Design Spec
_Date: 2026-06-19_

## Problem

Current frontend uses inline `React.CSSProperties` throughout. This makes hover/focus/media query impossible without JavaScript workarounds. Result: no mobile layout, no keyboard navigation, no hover feedback, color contrast failures, and no animation — undermining trust in a crypto security app.

## Technology Stack

| Tech | Role |
|------|------|
| **Tailwind CSS v3** | Replace all inline styles. Enables hover:, focus-visible:, sm:/md: responsive breakpoints |
| **shadcn/ui** | Accessible component primitives (Button, Input, Dialog, Badge, Card, Sonner toasts) built on Radix UI |
| **Framer Motion** | Seal/reveal animations; card hover lift; page transitions |
| **Sonner** | Toast notifications for tx confirmations, errors (replaces inline error `<p>` elements) |
| **Geist font** | Replace `fontFamily: "monospace"` — cleaner, still technical feel. Already available in Next.js 14 |

No new backend dependencies. All lib/ files (capsule.ts, contract.ts, storage.ts) stay unchanged.

## Architecture

### Global changes
- `tailwind.config.ts` + `postcss.config.mjs` — Tailwind setup with custom color tokens matching current dark palette (`neutral-950` base, `indigo-600` accent, `green-400` success)
- `app/globals.css` — Tailwind directives, CSS variables for shadcn, `@layer base` for body/html
- `app/layout.tsx` — Add Geist font, `<Toaster />` from Sonner, remove inline body style
- `components/ui/` — shadcn generated components (Button, Input, Textarea, Dialog, Badge, Card, Separator)

### Component rewrites

**Nav** (`components/Nav.tsx`)
- Desktop: flex row with hover underline transitions
- Mobile (< md): hamburger icon → slide-in Sheet drawer (shadcn Sheet)
- Active route highlighted via `usePathname()`
- ConnectButton stays in nav, collapses into drawer on mobile

**ConnectButton** (`components/ConnectButton.tsx`)
- Replace hand-rolled overlay with shadcn `Dialog`
- Add wallet icon per connector using `c.icon`
- Wrong-chain state: amber badge + switch button

**Landing page** (`app/page.tsx`)
- Full Tailwind layout — no style objects
- Hero: Framer Motion `fadeInUp` stagger on title lines
- Cards: hover lift (`hover:translate-y-[-2px] hover:shadow-lg`)
- CTA buttons: proper hover/active states

**Seal page** (`app/seal/page.tsx`)
- shadcn `Textarea` + `Input` for all form fields
- Trigger selector: styled radio group (shadcn RadioGroup or styled buttons with proper `aria-pressed`)
- Loading state: spinner in button + disabled overlay on form
- Errors → Sonner `toast.error()`
- Success → Sonner `toast.success()` + Framer Motion lock animation before redirect

**Onboard page** (`app/onboard/page.tsx`)
- Step indicator: proper labeled steps (number + title visible), connected with animated line
- StepCard: Framer Motion `AnimatePresence` slide-in when step activates
- Mobile: full width, no overflow

**Gallery page** (`app/gallery/page.tsx`)
- Tab bar: proper focus ring, active indicator
- Filter chips: accessible toggle buttons
- Skeleton cards: animated shimmer via Tailwind `animate-pulse`

**CapsuleCard** (`components/CapsuleCard.tsx`)
- Replace hex ID as primary identifier with seal date + trigger type as headline
- Hex ID shown truncated in monospace as secondary info
- Hover: `hover:border-indigo-500 hover:shadow-indigo-500/10` lift effect
- Framer Motion `whileHover` scale(1.005)

**Register page** (`app/register/page.tsx`)
- shadcn `Card` layout
- Badge indicators for on-chain/local key status with proper icons
- File import: styled label wrapping hidden input
- Export/import actions in `ButtonGroup`

**Reveal page** (`app/reveal/page.tsx`)
- Input + button inline (search bar pattern)
- Enter key handler stays

## Design Tokens

```
Background:  #0a0a0a  (neutral-950)
Surface:     #111111  (neutral-900)
Border:      #1e1e1e  (neutral-800)
Text primary: #e5e5e5 (neutral-200)
Text muted:   #737373 (neutral-500)   ← was #666, #888; fixes contrast
Accent:      #4f46e5  (indigo-600)
Accent light: #a5b4fc (indigo-300)
Success:     #4ade80  (green-400)
Warning:     #fb923c  (orange-400)
Danger:      #f87171  (red-400)
```

## Accessibility Requirements
- All interactive elements: `focus-visible:ring-2 focus-visible:ring-indigo-500`
- Color contrast: all text ≥ 4.5:1 against background (neutral-500 on neutral-950 = ~6.5:1 ✓)
- Keyboard navigation: Tab order follows visual order; modal traps focus (Radix Dialog handles this)
- `aria-pressed` on trigger selector buttons
- `aria-label` on icon-only buttons (hamburger, close)

## Animation Principles
- Seal action: lock icon animates closed (Framer Motion keyframe), then fade to success
- Reveal action: lock opens with rotation keyframe
- Page content: `fadeInUp` with 80ms stagger (subtle, not distracting)
- Cards: `whileHover` scale 1.005 + shadow — signals interactivity
- No animation if `prefers-reduced-motion` (Framer Motion respects this via `useReducedMotion`)

## Migration Strategy
1. Install deps (Tailwind, shadcn init, Framer Motion, Sonner)
2. Set up globals.css and layout
3. Build shared UI primitives (shadcn components)
4. Rewrite Nav + ConnectButton (highest mobile impact)
5. Rewrite each page bottom-up: Register → Reveal → Gallery → Onboard → Seal → Landing
6. Delete all inline style objects from rewritten files
7. Verify typecheck passes

## Out of Scope
- No changes to lib/, constants/, or contract logic
- No new routes or features
- No SSR changes — all pages stay client components where they are now
- proof/[id] and triggers/deadman|multisig pages: light Tailwind pass only (not full redesign)
