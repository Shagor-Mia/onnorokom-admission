# Frontend Pages — Implementation Guide

> এই ফাইলটি প্রতিটি frontend page/screen এর বিস্তারিত বর্ণনা দেয়।
> UI mockup reference: `UI/school_admission_portal_ui/` ফোল্ডার।
> Design system reference: `UI/school_admission_portal_ui/admission_portal/DESIGN.md`
> API contract reference: `docs/API_CONTRACT.md`

---

## Tech Stack

```
Framework:    React 18 + TypeScript
Build tool:   Vite
Styling:      Tailwind CSS
Fonts:        Inter + Hind Siliguri (Bengali)
Icons:        Material Symbols Outlined (Google)
State:        React Context / useState / useEffect
Routing:      React Router v6
HTTP client:  fetch / axios (centralised in src/lib/api.ts)
```

---

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx               # Router setup
│   │   └── Layout.tsx            # Shared header/nav
│   ├── components/
│   │   ├── ui/
│   │   │   ├── StatusBadge.tsx   # HELD/CONFIRMED/EXPIRED/CANCELLED badge
│   │   │   ├── MetricCard.tsx    # Seat count KPI card
│   │   │   ├── CountdownTimer.tsx # MM:SS countdown widget
│   │   │   ├── BrnInput.tsx      # 17-digit BRN input field
│   │   │   └── LoadingSpinner.tsx
│   │   └── modals/
│   │       └── CancelHoldModal.tsx
│   ├── features/
│   │   ├── classes/
│   │   │   ├── ClassCard.tsx
│   │   │   └── ClassList.tsx
│   │   ├── holds/
│   │   │   ├── HoldStatusCard.tsx
│   │   │   └── ConfirmButton.tsx
│   │   ├── student/
│   │   │   └── StudentContext.tsx  # 17-digit ID in localStorage
│   │   └── admin/
│   │       ├── ClassForm.tsx
│   │       └── AdminClassTable.tsx
│   ├── hooks/
│   │   ├── useClasses.ts     # GET /classes polling hook
│   │   ├── useHold.ts        # GET /holds/{holdId} polling hook
│   │   └── useMyHolds.ts     # GET /me/holds
│   ├── lib/
│   │   └── api.ts            # Centralised API client
│   ├── pages/
│   │   ├── GuardianHomePage.tsx   # Route: /
│   │   ├── MyApplicationsPage.tsx # Route: /my-applications
│   │   └── AdminPage.tsx          # Route: /admin
│   └── types/
│       └── api.ts            # TypeScript interfaces for API responses
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile
```

---

## Environment Variables

```env
VITE_API_BASE_URL=http://localhost:8080
```

Set in `.env` (from `.env.example`). Never hardcode the API base URL.

---

## Shared Layout (`src/app/Layout.tsx`)

**Reference:** Header present in ALL screen HTML mockups.

### Header Structure
```
[Top governess bar]
  "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার অনুমোদিত শিক্ষাবর্ষ ২০২৫ ভর্তি নির্দেশিকা ও সরাসরি আসন বরাদ্দ পোর্টাল"
  Right: "হেল্পডেস্ক: ০৯৬১২-XXXXXX"

[Main header bar — 80px height]
  Left: Logo image + "বিদ্যালয় ভর্তি পোর্টাল" + FCFS pill badge
        Sub: "Dhaka Model Residential Academy • শিক্ষাবর্ষ ২০২৫"
  Right: Nav links + Session status pill + User avatar icon
```

### Nav Links (Guardian view)
- `ভর্তি কার্যক্রম` → `/`
- `আমার আবেদনসমূহ` → `/my-applications`
- `স্কুল অ্যাডমিন` → `/admin`

Active link: `bg-primary text-on-primary rounded-lg`
Inactive link: `text-on-surface-variant hover:bg-surface-container`

### Admin Header (when on /admin)
- Sub-title: "প্রশাসনিক কন্ট্রোল প্যানেল (Admin Portal) • শিক্ষাবর্ষ ২০২৫"
- Badge: "অ্যাডমিন প্যানেল" (black pill)
- Right: "অ্যাডমিন ডেস্ক (আইটি সেল)" label + admin icon

---

## Shared Types (`src/types/api.ts`)

```typescript
export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface AdmissionClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface Hold {
  holdId: string;
  classId: string;
  studentId?: string;
  status: HoldStatus;
  expiresAt: string; // ISO-8601 UTC
}

export interface MyHold extends Hold {
  className: string;
}

export interface CreateClassRequest {
  name: string;
  totalSeats: number;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
}
```

---

## API Client (`src/lib/api.ts`)

```typescript
// Base URL from env
const BASE = import.meta.env.VITE_API_BASE_URL;

// Helper to get student ID from localStorage
function getStudentId(): string | null {
  return localStorage.getItem('studentId');
}

// Generic fetch wrapper
async function request<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(studentId ? { 'X-Student-Id': studentId } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json();
    throw err; // throw ApiError shape
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  classes: {
    list: () => request<AdmissionClass[]>('/classes'),
    get: (id: string) => request<AdmissionClass>(`/classes/${id}`),
    create: (body: CreateClassRequest) =>
      request<AdmissionClass>('/classes', { method: 'POST', body: JSON.stringify(body) }),
  },
  holds: {
    create: (classId: string, studentId: string) =>
      request<Hold>(`/classes/${classId}/holds`, { method: 'POST' }, studentId),
    get: (holdId: string) => request<Hold>(`/holds/${holdId}`),
    confirm: (holdId: string, studentId: string) =>
      request<{ holdId: string; status: string }>(`/holds/${holdId}/confirm`, { method: 'POST' }, studentId),
    cancel: (holdId: string, studentId: string) =>
      request<void>(`/holds/${holdId}`, { method: 'DELETE' }, studentId),
  },
  me: {
    holds: (studentId: string) => request<MyHold[]>('/me/holds', {}, studentId),
  },
};
```

---

## Shared Components

### `StatusBadge.tsx`
Pill-shaped badge for hold status.

```
HELD      → bg: #FFFBEB  text: #92400E  border: #FDE68A
CONFIRMED → bg: #ECFDF5  text: #065F46  border: #A7F3D0
EXPIRED   → bg: #F1F5F9  text: #475569  border: #CBD5E1
CANCELLED → bg: #FEF2F2  text: #991B1B  border: #FECACA
```

Bengali labels:
- `HELD` → "সাময়িক সংরক্ষিত"
- `CONFIRMED` → "নিশ্চিত"
- `EXPIRED` → "মেয়াদোত্তীর্ণ"
- `CANCELLED` → "বাতিল"

### `MetricCard.tsx`
Used in class list and admin dashboard.

```
Props: { label: string; value: number; total: number; color: string }

Top border: 4px solid {color}
  TOTAL     → #0F172A (navy)
  HELD      → #D97706 (amber)
  CONFIRMED → #0D9488 (teal)
  AVAILABLE → #64748B (slate)

Body: uppercase label (label-md) + large number (mono-metric) + progress micro-bar
```

### `CountdownTimer.tsx`
```
Props: { expiresAt: string; onExpire?: () => void }

- Calculate remaining = new Date(expiresAt) - Date.now()
- Display as MM:SS (tabular numeric font)
- Color change:
    > 5 min  → navy (#0F172A)
    ≤ 5 min  → amber (#D97706)
    ≤ 2 min  → crimson (#DC2626) + pulse animation
- When expired: call onExpire(), show "০০:০০" struck through
- Cleanup interval on unmount
```

### `BrnInput.tsx`
17-digit birth registration number input.

```
Props: { value: string; onChange: (v: string) => void; onConfirm: () => void }

- Only accept digits, max 17 chars
- Show character counter: "X/17"
- Valid (17 digits):  green checkmark + "বৈধ জন্ম নিবন্ধন নম্বর / Valid BRN"
- Invalid (< 17):    red border + "১৭ ডিজিট প্রয়োজন (X/17) / 17 digits required"
- Persist to localStorage on confirm
- Monospaced font (tabular-nums)
```

### `CancelHoldModal.tsx`
```
- Warning dialog with red shield icon
- Text: seat will be immediately released
- Two buttons: [বাতিল করুন (destructive red)] [ফিরে যান]
- Call DELETE /holds/{holdId} on confirm
```

---

## Page 1 — Guardian Home (`/`)

**Reference screens:**
- `UI/screen_a_guardian_admission_home_class_catalogue/`
- `UI/screen_a_mobile_guardian_admission_home_catalogue/`

### Purpose
Guardian enters student BRN, sees class list with seat counts, and creates a hold.

### State
```typescript
studentId: string | null       // from localStorage
classes: AdmissionClass[]      // polled every 5 seconds
loading: boolean
error: string | null
holdingClassId: string | null  // which class is being held
holdError: string | null       // 409 message
```

### On Mount
1. Load `studentId` from `localStorage.getItem('studentId')`
2. Start polling `GET /classes` every 5 seconds (clear on unmount)

### UI Sections (top to bottom)

#### 1. Live Broadcast Bar
```
[bolt icon] "লাইভ ভর্তি সেশন ২০২৫:" [FCFS policy text] | [ping dot] সার্ভার রিফ্রেশ: লাইভ | UTC+06:00 BST
```
Background: `bg-surface-container`

#### 2. Hero Banner (12-column grid on desktop)
**Left 8 cols:** Government notice, heading, BRN info, 3 info badges
- Badge 1: ⏳ `HOLD_DURATION_SECONDS/60` মিনিট রিজার্ভেশন লক
- Badge 2: 🔒 ১৭-ডিজিট যাচাই
- Badge 3: 💳 তাৎক্ষণিক স্লিপ

**Right 4 cols (dark primary card):** Overall seat metric
- Total seats (sum across all classes)
- Confirmed seats
- Fill percentage progress bar

#### 3. BRN Input Section
Show only if `studentId` is null or user clicks "পরিবর্তন করুন":
```
<BrnInput> → on confirm: save to localStorage, reload
```
If studentId exists, show: "শিক্ষার্থী আইডি: ****...{last4}" + "পরিবর্তন করুন" button

#### 4. Class List (card grid)
For each class in `classes` array:

```
[Class Card]
  Header: class name + available seats badge
  Metrics row: Total | Held | Confirmed | Available (MetricCard × 4)
  Progress bar: (heldSeats + confirmedSeats) / totalSeats
  
  Button logic:
    availableSeats > 0 AND studentId exists → "আসন বুক করুন" (primary button)
    availableSeats === 0                     → "আসন পূর্ণ" (disabled, red)
    studentId is null                        → "প্রথমে BRN দিন" (disabled)
    holdingClassId === class.id (loading)    → Spinner + disabled
```

On "আসন বুক করুন" click:
1. Set `holdingClassId = class.id`
2. Call `POST /classes/{classId}/holds` with `X-Student-Id`
3. On 201: navigate to `/my-applications` (or show inline hold status)
4. On 409: show Bengali error message inline on card
5. On error: clear holdingClassId

#### Bengali Error Messages for 409
```
"No seats available"     → "দুঃখিত, এই শ্রেণিতে কোনো আসন খালি নেই।"
"Duplicate active hold"  → "আপনার এই শ্রেণিতে ইতিমধ্যে একটি সক্রিয় আবেদন আছে।"
```

---

## Page 2 — My Applications (`/my-applications`)

**Reference screens:**
- `UI/screen_e_my_applications/`
- `UI/screen_e_mobile_my_applications/`
- `UI/screen_b_hold_created_application_details/` (hold detail card)
- `UI/screen_c_confirmed_admission_state/` (confirmed card)
- `UI/screen_d_expired_hold_state/` (expired card)

### Purpose
Guardian sees all applications for their student ID. Can confirm or cancel HELD applications.

### State
```typescript
studentId: string | null
myHolds: MyHold[]      // from GET /me/holds
loading: boolean
selectedHoldId: string | null  // for hold detail view
showCancelModal: boolean
```

### On Mount
1. Load `studentId` from localStorage. If null → redirect to `/` or show BRN input.
2. Call `GET /me/holds` with `X-Student-Id`
3. If any hold has status `HELD`, start polling that hold every 3 seconds

### UI Sections

#### 1. Student Identity Header
```
[School icon] Student name placeholder + "আবেদনকারী শিক্ষার্থী" badge
BRN: masked display (first 4 digits + **** + last 2)
[প্রিন্ট করুন] [নতুন আবেদন করুন → /]
```

#### 2. Summary Metric Cards (4-column)
```
মোট দাখিলকৃত  | সাময়িক সংরক্ষিত (HELD) | নিশ্চিত (CONFIRMED) | মেয়াদোত্তীর্ণ/বাতিল
     count     |       count              |       count          |       count
```

#### 3. Applications List

For each hold in `myHolds`:

**If status === 'HELD':**
Show Hold Detail Card (Screen B layout):
```
Left card:
  "আসন সাময়িকভাবে সংরক্ষিত হয়েছে"
  Tracking ID: #ADM-{holdId last chars}
  Class name
  HELD badge
  [ভর্তি ফি দিন] button (primary teal)
  [বাতিল করুন] button (outlined red)

Right card (countdown):
  <CountdownTimer expiresAt={hold.expiresAt} onExpire={refetchHold} />
  "আসনটি সাময়িকভাবে সংরক্ষিত / Seat temporarily held"
```

**If status === 'CONFIRMED':**
Show Confirmed Card (Screen C layout):
```
  Green top bar (2px)
  ✅ "ভর্তি নিশ্চিত হয়েছে • CONFIRMED" badge
  "অভিনন্দন! আপনার ভর্তি আবেদনটি চূড়ান্তভাবে নিশ্চিত করা হয়েছে"
  Confirmation time, tracking ID
  Simulated notice: "এটি ডেমো পোর্টালের অধীনে একটি পরীক্ষামূলক নিশ্চিতকরণ।"
  [ভর্তি কপি ডাউনলোড (PDF)] [প্রিন্ট করুন]
```

**If status === 'EXPIRED':**
Show Expired Card (Screen D layout):
```
  Gray neutral stripe
  ⏱ "EXPIRED • সময়সীমা উত্তীর্ণ" badge
  "আসন সংরক্ষণের নির্ধারিত সময় শেষ হয়ে গেছে"
  Timeline: Hold started → Expired at
  "স্বয়ংক্রিয়ভাবে বাতিল / Seat Released"
  [নতুন আবেদন করুন →]  (re-apply button)
```

**If status === 'CANCELLED':**
```
  Red border card
  "CANCELLED • বাতিল করা হয়েছে"
  Cancellation time
  [নতুন আবেদন করুন →]
```

### Confirm Button Logic (`ভর্তি ফি দিন`)
1. Show confirmation dialog: "নিশ্চিত করতে চান?" (simulated payment)
2. Call `POST /holds/{holdId}/confirm` with `X-Student-Id`
3. On 200: update hold status in state → `CONFIRMED`
4. On 409 (expired/cancelled): show error, refetch hold status
5. Button must be disabled if `expiresAt < now` (frontend guard only — backend enforces too)

### Cancel Button Logic
1. Open `<CancelHoldModal>`
2. On confirm: call `DELETE /holds/{holdId}` with `X-Student-Id`
3. On 204: update hold status in state → `CANCELLED`
4. Refetch `GET /me/holds`

---

## Page 3 — Admin Dashboard (`/admin`)

**Reference screens:**
- `UI/screen_f_admin_dashboard/`
- `UI/screen_f_mobile_admin_dashboard/`
- `UI/screen_g_create_class_shift_form_1/`
- `UI/screen_g_create_class_shift_form_2/`

### Purpose
Admin creates class/shift entries and monitors seat counts.

> [!NOTE]
> Admin authentication is NOT required by the assignment. The admin section is accessible via nav link. Document this as a demo limitation in ASSUMPTIONS.md.

### State
```typescript
classes: AdmissionClass[]
showCreateForm: boolean
createForm: { name: string; totalSeats: number }
createLoading: boolean
createError: string | null
createSuccess: boolean
```

### On Mount
1. Call `GET /classes`
2. Start polling every 5 seconds (clear on unmount)

### UI Sections

#### 1. Admin-specific Alert Banner
```
[verified_user icon] "কনকারেন্ট লক ইঞ্জিন সক্রিয়" | "ACID কমপ্লায়েন্ট" badge
PostgreSQL row-level exclusive lock service active
Currently X seats being processed for payment | {HOLD_DURATION_SECONDS/60} minute limit
```

#### 2. KPI Summary Cards (5-column)
```
মোট শ্রেণি ও শিফট | মোট আসনসংখ্যা | সাময়িক সংরক্ষিত | নিশ্চিত ভর্তি | উপলব্ধ আসন
   classes.length  |  sum(total)   |   sum(held)      |  sum(confirmed) |  sum(available)
```
Each card has top border color: navy / amber / amber / teal / slate

#### 3. Class Table / List
For each class:
```
| শ্রেণি ও শিফটের নাম | মোট আসন | সাময়িক (HELD) | নিশ্চিত | উপলব্ধ | ব্যবহার % |
Metric cards variant with progress bar per row
```
On desktop: table layout
On mobile: card stack

#### 4. Create Class Form (Screen G)

Triggered by "নতুন শ্রেণি/শিফট যোগ" button.

**Step 1 (Screen G - Form 1):**
```
Field: শ্রেণির নাম (name)
  Input: text, required, max 100 chars
  Placeholder: "যেমন: ষষ্ঠ শ্রেণি - সকাল শিফট"
  Validation: non-empty

Field: মোট আসন সংখ্যা (totalSeats)  
  Input: number, min 1, required
  Validation: positive integer

[পূর্ববর্তী] [পরবর্তী →]
```

**Step 2 (Screen G - Form 2):**
```
Review summary of entered data
Disclaimer: seats cannot be over-allocated
[সম্পাদন করুন (back)] [শ্রেণি তৈরি করুন ✓ (submit)]
```

On submit:
1. Call `POST /classes` with `{ name, totalSeats }`
2. On 201: close form, refetch class list, show success toast
3. On 400/422: show validation error message in Bengali
4. On network error: show generic error

---

## Routing Setup (`src/app/App.tsx`)

```tsx
<BrowserRouter>
  <StudentProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<GuardianHomePage />} />
        <Route path="/my-applications" element={<MyApplicationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  </StudentProvider>
</BrowserRouter>
```

---

## Student Context (`src/features/student/StudentContext.tsx`)

```tsx
interface StudentContextType {
  studentId: string | null;
  setStudentId: (id: string) => void;
  clearStudentId: () => void;
}

// Persist to localStorage key: 'studentId'
// Validate: exactly 17 digits /^\d{17}$/
```

---

## Polling Strategy

| Endpoint | Interval | When to poll | Cleanup |
|----------|----------|-------------|---------|
| `GET /classes` | 5 seconds | Always on Guardian Home + Admin pages | On unmount |
| `GET /holds/{holdId}` | 3 seconds | Only when status is HELD | On unmount or status changes |
| `GET /me/holds` | 5 seconds | On My Applications page | On unmount |

Use `setInterval` / `clearInterval` in `useEffect` cleanup.

---

## Error Handling

| HTTP Status | Frontend behavior |
|-------------|-------------------|
| 400/422 | Show validation message below the relevant field |
| 409 | Show specific business conflict message in Bengali (see messages above) |
| 404 | Show "পাওয়া যায়নি" message |
| 500 | Show "সার্ভার সমস্যা হয়েছে, পুনরায় চেষ্টা করুন" |
| Network error | Show "নেটওয়ার্ক সংযোগ পরীক্ষা করুন" |

Never show raw error JSON to users. Never show console-only errors.

---

## Accessibility

- All inputs must have `<label>` elements
- Buttons must have descriptive text (not just icons)
- Status badges must have `aria-label`
- Focus rings visible (`:focus-visible { outline: 2px solid #0D9488 }`)
- Color contrast must meet WCAG 2.1 AA

---

## Mobile Responsiveness

| Breakpoint | Layout |
|------------|--------|
| `< 768px` | 4-column, 1rem gutters, stack all cards vertically |
| `768–1279px` | 8-column, 1rem gutters |
| `≥ 1280px` | 12-column, 1.5rem gutters, max-width 1440px |

Refer to mobile-specific screens: `screen_*_mobile_*` for layout guidance.

---

## Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',  // needed for Docker
  },
})
```

---

## Tailwind Config

```typescript
// tailwind.config.ts
// Copy the full color palette and typography from:
// UI/school_admission_portal_ui/screen_a_.../code.html
// (see the tailwind.config script block in any HTML mockup)
// Key custom colors: surface, primary, secondary, error, etc.
// Key custom spacing: space-xs, space-sm, space-md, space-lg, space-xl, gutter
// Key custom borderRadius: DEFAULT(2px), lg(4px), xl(8px), full(12px)
```

---

## Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# frontend/nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;  # SPA routing
    }
}
```

> [!IMPORTANT]
> `VITE_API_BASE_URL` must be set at **build time** (Vite bakes env vars into the bundle). In Docker Compose, pass it as a build arg. The frontend browser makes requests to `http://localhost:8080` on the host — not to the Docker internal hostname.
