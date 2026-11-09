---
name: Admission Portal
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2f1500'
  on-tertiary-container: '#c76c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 2.5rem
    fontWeight: '700'
    lineHeight: 3rem
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 1.875rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
  body-md:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-lg:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.025em
  label-sm:
    fontFamily: Inter, Hind Siliguri, sans-serif
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.05em
  mono-metric:
    fontFamily: Inter, monospace
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system reflects institutional authority, absolute clarity, and calm efficiency for high-stakes K-12 admissions in Bangladesh. It balances the solemn dignity expected of premier educational establishments with the responsive speed of enterprise-grade SaaS infrastructure. 

Targeted toward two core groups—anxious parents completing time-bound seat claims across diverse network conditions and school administrators orchestrating rigorous multi-tier enrollment workflows—the emotional tone is unswervingly dependable, transparent, and legally reassuring.

The aesthetic philosophy is a rigorous synthesis of **Corporate Modernism** and **Civic Functionalism**:
- Zero decorative ornamentation, whimsical gamification, or child-oriented visual tropes.
- Structured grid alignments prioritize immediate legibility over visual novelty.
- High-contrast visual cues communicate irreversible lifecycle events (e.g., temporary lock expirations, payment verifications).
- Biliterate typography balances optical weights equally across Bengali and English scripts.

## Colors
The color architecture relies on a high-clarity institutional foundation, engineered to satisfy WCAG 2.1 AAA contrast targets across critical transactional states.

### Primary Canvas & Accents
- **Primary Navy (`#0F172A`, `#1E293B`)**: Serves as the bedrock of structural trust. Used for high-level navigation, structural framing, prominent headers, and high-emphasis button states.
- **Emerald/Teal (`#0D9488`, `#059669`)**: Communicates successful verification, confirmed seat allocations, and positive capacity.
- **Amber/Orange (`#D97706`, `#F59E0B`)**: Reserved strictly for transient states, actionable deadlines, and active countdown timers during temporary seat holds.
- **Alert Crimson (`#DC2626`, `#991B1B`)**: Applied exclusively to fatal validation failures, full-capacity locks, session timeouts, and destructive actions.

### Neutral Scale
- `neutral-000` (`#FFFFFF`): Primary surface for cards, dialogs, and elevated sheets.
- `neutral-100` (`#F8FAFC`): Base application canvas background.
- `neutral-200` (`#F1F5F9`): Table headers, inactive panels, and input backgrounds.
- `neutral-300` (`#E2E8F0`): Borders, structural dividers, and focus targets.
- `neutral-600` (`#64748B`): Secondary text labels, timestamps, and contextual captions.
- `neutral-800` (`#334155`): Secondary interactive states and subheadings.
- `neutral-900` (`#0F172A`): Primary body text, labels, and icons.

Functional badges must always use deliberate, tinted background pairings: Confirmed (`#ECFDF5` background with `#065F46` text), Held (`#FFFBEB` background with `#92400E` text), Expired (`#F1F5F9` background with `#475569` text), and Cancelled/Rejected (`#FEF2F2` background with `#991B1B` text).

## Typography
The system supports dual-language operation (Bangla and English) with unified optical rhythm. **Inter** is deployed as the base Latin system, pairing natively with **Hind Siliguri** or **Noto Sans Bengali** system fallbacks.

### Composition Rules
1. **Vertical Alignment**: Bengali glyphs with deep conjuncts (যুক্তাক্ষর) and matras require explicit vertical breathing room. Line heights for mixed-text blocks are maintained at a minimum of `1.5` to prevent diacritic clipping.
2. **Numeric Representation**: System metrics, fee currencies (BDT / ৳), serials, and date records employ tabular figures (`tnum`) with monospaced digit tracking to ensure consistent alignment in data tables.
3. **Hierarchy**: High-prominence labels (`label-sm`, `label-md`) use uppercase tracking for Latin script, but rely strictly on bold weight (`font-weight: 700`) without letter-spacing modification when rendering Bengali text.

## Layout & Spacing
The layout follows a responsive, fluid grid system anchored by strict horizontal margins:
- **Desktop (>= 1280px)**: 12-column layout with 24px (`1.5rem`) gutters and a max-width container of `1440px`.
- **Tablet (768px - 1279px)**: 8-column layout with 16px (`1rem`) gutters and flexible padding.
- **Mobile (< 768px)**: 4-column layout with 16px (`1rem`) gutters and 16px margins.

### Spatial Rhythm
- **Data Densities**: Metrics boards and admin inventory tables follow a compact vertical cadence using `space-xs` and `space-sm` for data density.
- **Citizen Journey Spacing**: Multi-step parent registration forms switch to an expanded cadence using `space-lg` and `space-xl` to prevent input fatigue and reduce form errors.

## Elevation & Depth
Depth conveys situational importance and modal urgency while maintaining a grounded, non-distracting surface architecture. 

1. **Flat Structural Tier (0dp)**: Canvas (`#F8FAFC`) and embedded panels use sharp boundaries rather than elevation. Tonal separation is achieved via `1px solid #E2E8F0`.
2. **Surface Layer (1dp)**: Administrative data cards, summary metric blocks, and parent input fields sit on `#FFFFFF` with a crisp baseline edge: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`.
3. **Transient Sticky Tier (2dp)**: Persistent countdown timer bars and floating submission headers utilize: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
4. **Modal & Interruption Tier (3dp)**: Critical cancellation modals, seat timeout warnings, and parent action sheets take center precedence, casting a deep ambient shadow: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)` underpinned by a 60% opacity dark navy scrim (`#0F172A` at 60%).

## Shapes
The visual architecture uses compact geometry (`roundedness: 1` / Soft). This preserves the authoritative, official character of the platform:
- Interactive inputs, primary CTA buttons, tabular search containers, and status cards employ `0.25rem` (4px) radii.
- Modals, large metric summary panels, and floating notification modules implement `rounded-lg` (`0.5rem` / 8px).
- Pill shapes are reserved exclusively for high-visibility status indicators (`rounded-full`) to differentiate metadata from interactive buttons.

## Components

### Buttons
- **Primary Action**: Solid `#0F172A` background, `#FFFFFF` text, `40px` height (`48px` on mobile), `space-lg` horizontal padding. Hover: `#1E293B`. Focus: `2px solid #0D9488` with `2px` offset.
- **Confirmed/Final Step**: Solid `#0D9488` background, `#FFFFFF` text. Hover: `#0F766E`.
- **Destructive/Cancel**: Outlined `1px solid #DC2626`, `#DC2626` text, transparent background. Hover: `#FEF2F2` background.

### Input Fields & 17-Digit Birth Registration Number (BRN)
- Form inputs feature a default border of `1px solid #CBD5E1`, crisp white background, and standard height of `44px`. Focus introduces a crisp `2px solid #0F172A` ring.
- **BRN Specific Widget**: Formatted as a segmented 17-character input grouped visually into `4 - 4 - 9` or fixed monospaced cells (`font-variant-numeric: tabular-nums`). 
  - Inline validation triggers as the parent types: provides instantaneous feedback against the mandatory 17-digit length constraint.
  - Success displays an embedded `#059669` checkmark icon accompanied by concise Bengali/English subtext: "বৈধ জন্ম নিবন্ধন নম্বর / Valid BRN".
  - Failure displays a fixed `#DC2626` state outline with an explicit character counter: "১৭ ডিজিট প্রয়োজন (X/17) / 17 digits required".

### Status Badges
Pill-shaped containers (`rounded-full`) using micro typography (`label-sm`), fixed padding (`2px 10px`), and high-contrast color pairings:
- **HELD**: Amber fill (`#FFFBEB`), `#92400E` text, `1px solid #FDE68A`.
- **CONFIRMED**: Emerald fill (`#ECFDF5`), `#065F46` text, `1px solid #A7F3D0`.
- **EXPIRED**: Neutral slate fill (`#F1F5F9`), `#475569` text, `1px solid #CBD5E1`.
- **CANCELLED**: Crimson fill (`#FEF2F2`), `#991B1B` text, `1px solid #FECACA`.

### Metric Cards
Structured summary blocks for enrollment overview displaying:
- Top border highlight indicating tier category (`4px` solid `#0F172A` for Total, `#D97706` for Held, `#0D9488` for Confirmed, `#64748B` for Available).
- Uppercase metric label in `label-md` (`#64748B`).
- Prominent tabular metric number rendered via `mono-metric` (`#0F172A`).
- Bottom progress micro-bar rendering dynamic percentage of total capacity.

### Timer Widget
Fixed contextual card or sticky bar denoting temporary reservation lock status:
- Features an active, high-visibility countdown clock rendered in tabular numerals (`MM:SS`).
- Warning transition: shifts from default navy framing to `#D97706` at `<= 5 minutes`, and pulses `#DC2626` at `<= 2 minutes`.
- Explicit warning copy: "আসনটি সাময়িকভাবে সংরক্ষিত / Seat temporarily held".

### Admin Data Tables
- Header: `#F8FAFC` background, `1px solid #E2E8F0` top and bottom borders, `label-md` text in `#334155`.
- Rows: Alternating zebra hover (`#F8FAFC`), explicit `48px` minimum height, cell padding of `12px 16px`.
- Direct alignment: Numeric columns right-aligned, text left-aligned, status badges centered.

### Cancellation Modals
- High-visibility warning dialog containing a top-anchored red warning shield icon.
- Explicit copy detailing that the temporary seat hold will be immediately released to the waiting pool.
- Mandatory secondary confirmation step (e.g., clicking a red destructive button or confirming the student's name).