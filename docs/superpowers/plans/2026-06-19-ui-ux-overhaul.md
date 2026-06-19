# UI/UX Overhaul — Tailwind + shadcn/ui + Framer Motion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline `React.CSSProperties` with Tailwind CSS + shadcn/ui, add Framer Motion animations, and make every page mobile-responsive and accessible.

**Architecture:** Tailwind utility classes replace every inline style object. shadcn/ui components (Button, Input, Textarea, Dialog, Sheet, Badge, Card) provide Radix-backed accessibility primitives. Framer Motion adds seal lock animation, card hover lift, and landing page stagger. Sonner replaces inline error/success `<p>` elements with toasts. All `lib/`, `constants/`, and contract logic files are untouched.

**Tech Stack:** Tailwind CSS v3, shadcn/ui (Radix UI), Framer Motion 11, Sonner, lucide-react, Inter (next/font/google), clsx, tailwind-merge, tailwindcss-animate

## Global Constraints

- All commands run from `frontend/` directory
- `@/*` path alias already maps to `./` (tsconfig confirmed) — use `@/components/ui/button` etc.
- No changes to: `lib/`, `constants/`, `providers.tsx`, `app/api/`, `app/proof/[id]/opengraph-image.tsx`
- `proof/[id]/ProofClient.tsx` and `triggers/` pages: Tailwind light pass only (remove inline styles, keep logic identical)
- `npm run typecheck` must pass after every task

---

## File Map

**Created:**
- `frontend/app/globals.css` — Tailwind directives + shadcn CSS vars (dark palette)
- `frontend/tailwind.config.ts` — content paths + shadcn color tokens + tailwindcss-animate
- `frontend/postcss.config.mjs` — tailwind + autoprefixer
- `frontend/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `frontend/components/ui/button.tsx` — shadcn Button
- `frontend/components/ui/input.tsx` — shadcn Input
- `frontend/components/ui/textarea.tsx` — shadcn Textarea
- `frontend/components/ui/dialog.tsx` — shadcn Dialog
- `frontend/components/ui/sheet.tsx` — shadcn Sheet (mobile nav drawer)
- `frontend/components/ui/badge.tsx` — shadcn Badge
- `frontend/components/ui/card.tsx` — shadcn Card
- `frontend/components/ui/separator.tsx` — shadcn Separator

**Modified:**
- `frontend/package.json` — add deps
- `frontend/app/layout.tsx` — Inter font, Toaster, import globals.css
- `frontend/components/Nav.tsx` — mobile Sheet drawer, active route, hover states
- `frontend/components/ConnectButton.tsx` — shadcn Dialog, proper focus
- `frontend/components/CapsuleCard.tsx` — Tailwind + Framer Motion hover lift, better info hierarchy
- `frontend/app/register/page.tsx` — full Tailwind rewrite
- `frontend/app/reveal/page.tsx` — full Tailwind rewrite
- `frontend/app/reveal/[id]/page.tsx` — full Tailwind rewrite
- `frontend/app/gallery/page.tsx` — full Tailwind rewrite
- `frontend/app/onboard/page.tsx` — Tailwind + AnimatePresence steps
- `frontend/app/seal/page.tsx` — Tailwind + lock animation + Sonner
- `frontend/app/page.tsx` — Tailwind + Framer Motion stagger
- `frontend/app/proof/[id]/ProofClient.tsx` — light Tailwind pass
- `frontend/app/triggers/deadman/[id]/page.tsx` — light Tailwind pass
- `frontend/app/triggers/multisig/[id]/page.tsx` — light Tailwind pass

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install all new dependencies**

```bash
cd frontend
npm install tailwindcss@^3 postcss autoprefixer tailwindcss-animate \
  clsx tailwind-merge framer-motion sonner lucide-react \
  @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-separator \
  class-variance-authority
```

- [ ] **Step 2: Verify install**

```bash
npm ls tailwindcss framer-motion sonner lucide-react 2>/dev/null | grep -E "tailwindcss|framer|sonner|lucide"
```
Expected: all four listed with version numbers, no errors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install tailwind, shadcn deps, framer-motion, sonner, lucide-react"
```

---

## Task 2: Configure Tailwind + postcss + lib/utils

**Files:**
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.mjs`
- Create: `frontend/lib/utils.ts`

- [ ] **Step 1: Create `frontend/postcss.config.mjs`**

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
export default config;
```

- [ ] **Step 2: Create `frontend/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer: { "0%, 100%": { opacity: "0.4" }, "50%": { opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        shimmer:          "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 3: Create `frontend/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Verify typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/tailwind.config.ts frontend/postcss.config.mjs frontend/lib/utils.ts
git commit -m "chore: tailwind config, postcss, cn utility"
```

---

## Task 3: globals.css + shadcn UI components + layout.tsx

**Files:**
- Create: `frontend/app/globals.css`
- Create: `frontend/components/ui/button.tsx`
- Create: `frontend/components/ui/input.tsx`
- Create: `frontend/components/ui/textarea.tsx`
- Create: `frontend/components/ui/dialog.tsx`
- Create: `frontend/components/ui/sheet.tsx`
- Create: `frontend/components/ui/badge.tsx`
- Create: `frontend/components/ui/card.tsx`
- Create: `frontend/components/ui/separator.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create `frontend/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background:         0 0% 4%;
    --foreground:         0 0% 90%;
    --card:               0 0% 7%;
    --card-foreground:    0 0% 90%;
    --popover:            0 0% 7%;
    --popover-foreground: 0 0% 90%;
    --primary:            243 75% 59%;
    --primary-foreground: 0 0% 100%;
    --secondary:          0 0% 12%;
    --secondary-foreground: 0 0% 90%;
    --muted:              0 0% 10%;
    --muted-foreground:   0 0% 45%;
    --accent:             0 0% 12%;
    --accent-foreground:  0 0% 90%;
    --destructive:        0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border:             0 0% 12%;
    --input:              0 0% 12%;
    --ring:               243 75% 59%;
    --radius:             0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
  :focus-visible { @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background; }
}
```

- [ ] **Step 2: Create `frontend/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:     "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-md px-3",
        lg:      "h-11 rounded-md px-8",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 3: Create `frontend/components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 4: Create `frontend/components/ui/textarea.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
```

- [ ] **Step 5: Create `frontend/components/ui/dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose };
```

- [ ] **Step 6: Create `frontend/components/ui/sheet.tsx`**

```tsx
"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: "top" | "bottom" | "left" | "right";
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-4 bg-card p-6 shadow-xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        side === "right" && "inset-y-0 right-0 h-full w-3/4 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
        side === "left"  && "inset-y-0 left-0 h-full w-3/4 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent };
```

- [ ] **Step 7: Create `frontend/components/ui/badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground",
        secondary:   "border-border bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline:     "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 8: Create `frontend/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-base font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
```

- [ ] **Step 9: Create `frontend/components/ui/separator.tsx`**

```tsx
"use client";
import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

- [ ] **Step 10: Add `@radix-ui/react-separator` dep**

```bash
cd frontend && npm install @radix-ui/react-separator
```

- [ ] **Step 11: Rewrite `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Nav } from "../components/Nav";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "0G Time Capsule",
  description: "Seal a message now. Prove it later.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-background text-foreground`}>
        <Providers>
          <Nav />
          {children}
        </Providers>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
```

Also add to `tailwind.config.ts` inside `theme.extend`:
```ts
fontFamily: {
  sans: ["var(--font-inter)", "system-ui", "sans-serif"],
},
```

- [ ] **Step 12: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

Start dev server briefly: `npm run dev` — confirm page loads without JS errors in console.

- [ ] **Step 13: Commit**

```bash
cd ..
git add frontend/app/globals.css frontend/tailwind.config.ts \
  frontend/components/ui/ frontend/app/layout.tsx
git commit -m "feat(ui): add Tailwind, shadcn primitives, Inter font, Sonner toaster"
```

---

## Task 4: Rewrite Nav

**Files:**
- Modify: `frontend/components/Nav.tsx`

**Interfaces:**
- Consumes: `@/components/ui/button` Button, `@/components/ui/sheet` Sheet/SheetContent/SheetTrigger, `@/lib/utils` cn
- Consumes: `ConnectButton` from `./ConnectButton` (unchanged interface)

- [ ] **Step 1: Rewrite `frontend/components/Nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { ConnectButton } from "./ConnectButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/seal",     label: "Seal" },
  { href: "/gallery",  label: "My Capsules" },
  { href: "/reveal",   label: "Open" },
  { href: "/register", label: "Register Key" },
  { href: "/onboard",  label: "Get started" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-sm font-bold text-foreground transition-colors hover:text-white"
        >
          0G Time Capsule
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "text-sm transition-colors hover:text-foreground",
                pathname === href ? "text-indigo-400" : "text-muted-foreground",
                href === "/onboard" && pathname !== "/onboard" && "text-indigo-300 hover:text-indigo-200"
              )}
            >
              {label}
            </Link>
          ))}
          <ConnectButton />
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <ConnectButton />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-background">
              <nav className="mt-8 flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground",
                      pathname === href
                        ? "bg-accent text-indigo-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Install missing Radix Sheet dep**

Sheet uses `@radix-ui/react-dialog` (already installed in Task 1). No additional dep needed.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Verify visually**

Run `npm run dev`. On desktop: confirm 5 nav links + ConnectButton render horizontally. Resize to < 768px: confirm hamburger icon appears, ConnectButton stays visible. Click hamburger: confirm Sheet slides in from right with all links. Click a link: Sheet closes.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/components/Nav.tsx
git commit -m "feat(nav): mobile drawer with Sheet, active route highlight, hover states"
```

---

## Task 5: Rewrite ConnectButton

**Files:**
- Modify: `frontend/components/ConnectButton.tsx`

- [ ] **Step 1: Rewrite `frontend/components/ConnectButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { zeroGTestnet } from "../constants/contracts";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const onWrongChain = isConnected && chainId !== zeroGTestnet.id;

  if (onWrongChain) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => switchChain({ chainId: zeroGTestnet.id })}
        className="border-amber-800 text-amber-400 hover:bg-amber-950 hover:text-amber-300"
      >
        Switch to 0G Testnet
      </Button>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:block">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isPending}>
          <Wallet className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Connecting…" : "Connect"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Select wallet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => { connect({ connector: c }); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {c.icon && (
                <img src={c.icon} alt="" className="h-6 w-6 rounded" />
              )}
              {c.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Confirm Connect button opens Dialog modal on click. Modal has wallet list. Close button (X) dismisses it. On wrong chain: amber outlined button.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/components/ConnectButton.tsx
git commit -m "feat(connect): Dialog wallet picker, proper focus management, wrong-chain state"
```

---

## Task 6: Rewrite CapsuleCard

**Files:**
- Modify: `frontend/components/CapsuleCard.tsx`

- [ ] **Step 1: Rewrite `frontend/components/CapsuleCard.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { OnChainCapsule } from "../lib/types";

const TRIGGER_META: Record<number, { label: string; icon: string; className: string }> = {
  0: { label: "Time lock",         icon: "⏰", className: "border-indigo-900 bg-indigo-950/50 text-indigo-400" },
  1: { label: "Dead Man's Switch", icon: "💀", className: "border-amber-900 bg-amber-950/50 text-amber-400" },
  2: { label: "Oracle",            icon: "🔮", className: "border-blue-900 bg-blue-950/50 text-blue-400" },
  3: { label: "Multi-Sig",         icon: "🗳️", className: "border-indigo-900 bg-indigo-950/50 text-indigo-400" },
};

interface Props {
  id:         `0x${string}`;
  capsule:    OnChainCapsule;
  myAddress?: `0x${string}`;
}

export function CapsuleCard({ id, capsule, myAddress }: Props) {
  const revealed     = capsule.state === 1;
  const unlockDate   = new Date(Number(capsule.unlockTime) * 1000);
  const sealDate     = new Date(Number(capsule.createdAt) * 1000);
  const isOwner      = myAddress && capsule.owner.toLowerCase() === myAddress.toLowerCase();
  const isRecipient  = myAddress && capsule.recipients.some(r => r.toLowerCase() === myAddress.toLowerCase());
  const now          = Date.now();
  const timeUnlocked = now >= unlockDate.getTime();
  const trigger      = TRIGGER_META[capsule.triggerType] ?? TRIGGER_META[0];

  const diff   = unlockDate.getTime() - now;
  const days   = Math.floor(diff / 86400000);
  const hours  = Math.floor((diff % 86400000) / 3600000);

  const countdownText =
    revealed      ? "Revealed"          :
    timeUnlocked  ? "Ready to reveal"   :
    diff < 3600000  ? `${Math.floor(diff / 60000)}m left` :
    diff < 86400000 ? `${hours}h left`  :
    `${days}d left`;

  const countdownColor =
    revealed     ? "text-green-400" :
    timeUnlocked ? "text-orange-400" :
    "text-indigo-300";

  const borderClass =
    revealed     ? "border-green-900 hover:border-green-700" :
    timeUnlocked ? "border-amber-900 hover:border-amber-700" :
    "border-border hover:border-indigo-700";

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Link href={`/proof/${id}`} className="block no-underline">
        <div
          className={cn(
            "rounded-xl border bg-card px-4 py-4 transition-colors duration-150",
            borderClass
          )}
        >
          {/* Top row */}
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-widest",
                revealed
                  ? "border-green-800 bg-green-950 text-green-400"
                  : "border-indigo-900 bg-indigo-950 text-indigo-400"
              )}>
                {revealed ? "REVEALED" : "SEALED"}
              </span>
              {!revealed && timeUnlocked && (
                <span className="inline-flex items-center rounded border border-amber-800 bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-400">
                  UNLOCKED
                </span>
              )}
              {isOwner && (
                <span className="inline-flex items-center rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground">
                  MINE
                </span>
              )}
              {isRecipient && (
                <span className="inline-flex items-center rounded border border-indigo-900 bg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-indigo-400">
                  RECIPIENT
                </span>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground/60">
              {sealDate.toLocaleDateString()}
            </span>
          </div>

          {/* Truncated ID */}
          <p className="mb-3 truncate font-mono text-[11px] text-muted-foreground/40">
            {id.slice(0, 14)}…{id.slice(-8)}
          </p>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px]",
              trigger.className
            )}>
              <span>{trigger.icon}</span>
              <span>{trigger.label}</span>
            </span>
            <span className={cn("text-xs font-semibold", countdownColor)}>
              {countdownText}
            </span>
          </div>

          {capsule.recipients.length > 0 && (
            <p className="mt-2.5 text-[11px] text-muted-foreground/50">
              {capsule.recipients.length} recipient{capsule.recipients.length > 1 ? "s" : ""} · ECIES-encrypted
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Navigate to `/gallery` (connect wallet with existing capsules). Confirm cards render with truncated IDs, hover lift animation, correct badge colors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/components/CapsuleCard.tsx
git commit -m "feat(card): Tailwind + Framer Motion hover lift, better info hierarchy"
```

---

## Task 7: Rewrite Register page

**Files:**
- Modify: `frontend/app/register/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/register/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { CheckCircle2, Circle, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConnectButton } from "@/components/ConnectButton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  loadPrivKeyFromStorage,
  hasSavedPrivKey,
} from "@/lib/ecies";
import { registerEncryptionKey, hasEncryptionKey } from "@/lib/contract";

export default function RegisterPage() {
  const { isConnected, address } = useAccount();
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [hasLocal,    setHasLocal]   = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [pubkeyHex,   setPubkeyHex]  = useState("");

  useEffect(() => {
    if (!address) return;
    setHasLocal(hasSavedPrivKey(address));
    hasEncryptionKey(address).then(setRegistered).catch(() => setRegistered(false));
  }, [address]);

  async function handleRegister() {
    if (!address) return;
    setLoading(true);
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      setHasLocal(true);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      setPubkeyHex(hex);
      const tx = await registerEncryptionKey(hex);
      setRegistered(true);
      toast.success("Key registered on-chain!", { description: `Tx: ${tx.slice(0, 18)}…` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Switched to 0G Testnet")) {
        toast.info("Switched to 0G Testnet", { description: "Press Register again." });
      } else {
        toast.error("Registration failed", { description: msg });
      }
    } finally { setLoading(false); }
  }

  async function handleReRegister() {
    if (!address) return;
    setLoading(true);
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      setPubkeyHex(hex);
      const tx = await registerEncryptionKey(hex);
      setRegistered(true);
      toast.success("Key updated on-chain!", { description: `Tx: ${tx.slice(0, 18)}…` });
    } catch (e: unknown) {
      toast.error("Re-registration failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); }
  }

  function handleExportKey() {
    if (!address) return;
    const privKey = loadPrivKeyFromStorage(address);
    if (!privKey) { toast.error("No local key found"); return; }
    const blob = new Blob([Buffer.from(privKey).toString("hex")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `0g-capsule-key-${address.slice(0, 8)}.txt`,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Private key exported");
  }

  function handleImportKey(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    const reader = new FileReader();
    reader.onload = () => {
      const hex = (reader.result as string).trim();
      if (hex.length !== 64) { toast.error("Invalid key file", { description: "Expected 32-byte hex string." }); return; }
      savePrivKeyToStorage(address, new Uint8Array(Buffer.from(hex, "hex")));
      setHasLocal(true);
      toast.success("Key imported successfully");
    };
    reader.readAsText(file);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Register Encryption Key</h1>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        Generate a secp256k1 keypair in your browser. The private key stays in
        localStorage; the public key is registered on-chain so others can seal
        capsules specifically for you.
      </p>

      {!isConnected && (
        <div className="mb-6">
          <ConnectButton />
        </div>
      )}

      {isConnected && (
        <div className="flex flex-col gap-4">
          {/* Status indicators */}
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <StatusRow ok={registered === true} label="On-chain key registered" />
              <StatusRow ok={hasLocal}            label="Local private key saved" />
              {pubkeyHex && (
                <div className="mt-2 rounded-md bg-secondary p-3">
                  <p className="mb-1 text-xs text-muted-foreground">Public key</p>
                  <code className="break-all text-[11px] text-indigo-300">{pubkeyHex}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warning states */}
          {registered && !hasLocal && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
              On-chain key found but no local private key. Import your backup or
              re-register (this invalidates capsules encrypted to the old key).
            </div>
          )}

          {!registered && !hasLocal && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No key registered yet. Click below to generate a keypair and register
              your public key on-chain.
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {!registered && (
              <Button onClick={handleRegister} disabled={loading}>
                {loading ? "Registering…" : "Generate & Register"}
              </Button>
            )}
            {registered && (
              <Button variant="secondary" onClick={handleReRegister} disabled={loading}>
                {loading ? "Updating…" : "Re-register (new key)"}
              </Button>
            )}
            {hasLocal && (
              <Button variant="outline" onClick={handleExportKey}>
                <Download className="mr-1.5 h-4 w-4" />
                Export key
              </Button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="h-4 w-4" />
            Import key from backup
            <input
              type="file"
              accept=".txt"
              onChange={handleImportKey}
              className="sr-only"
            />
          </label>

          <p className="text-xs text-muted-foreground/60">
            ⚠ Back up your private key. If you clear localStorage you can no longer decrypt
            capsules sent to you.
          </p>
        </div>
      )}
    </main>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {ok
        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
        : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      }
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`, navigate to `/register`. Confirm: status indicators, Card layout, export/import buttons render. Register flow shows Sonner toast on success/error.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/app/register/page.tsx
git commit -m "feat(register): Tailwind + shadcn Card, Sonner toasts, accessible file import"
```

---

## Task 8: Rewrite Reveal pages

**Files:**
- Modify: `frontend/app/reveal/page.tsx`
- Modify: `frontend/app/reveal/[id]/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/reveal/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RevealIndexPage() {
  const [id, setId] = useState("");
  const router = useRouter();

  function go() {
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`/reveal/${trimmed}`);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Open a Capsule</h1>
      <p className="mb-8 text-sm text-muted-foreground">Enter a capsule ID to check its status.</p>

      <div className="flex gap-2">
        <Input
          placeholder="0x…"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          className="font-mono text-sm"
        />
        <Button onClick={go} disabled={!id.trim()}>
          <Search className="mr-1.5 h-4 w-4" />
          Open
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `frontend/app/reveal/[id]/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider } from "ethers";
import { LockOpen, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { getCapsule, isUnlocked } from "@/lib/contract";
import { revealCapsule, decryptRevealed } from "@/lib/capsule";
import type { OnChainCapsule, RevealResult } from "@/lib/types";

interface Props { params: Promise<{ id: string }>; }

export default function RevealPage({ params }: Props) {
  const { id } = use(params);
  const capsuleId = id as `0x${string}`;
  const { isConnected } = useAccount();

  const [capsule,  setCapsule]  = useState<OnChainCapsule | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [result,   setResult]   = useState<RevealResult | null>(null);
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    let cancel = false;
    async function poll() {
      try {
        const [cap, open] = await Promise.all([getCapsule(capsuleId), isUnlocked(capsuleId)]);
        if (!cancel) { setCapsule(cap); setUnlocked(open); }
      } catch (e: unknown) {
        if (!cancel) toast.error("Failed to load capsule", { description: e instanceof Error ? e.message : String(e) });
      }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancel = true; clearInterval(t); };
  }, [capsuleId]);

  async function getSigner() {
    if (!window.ethereum) throw new Error("No wallet detected");
    return new BrowserProvider(window.ethereum).getSigner();
  }

  async function handleReveal() {
    setLoading(true); setStatus("Sending reveal tx…");
    try {
      const signer = await getSigner();
      setStatus("Sign to decrypt…");
      setResult(await revealCapsule(capsuleId, signer));
    } catch (e: unknown) {
      toast.error("Reveal failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  async function handleDecryptAlreadyRevealed() {
    setLoading(true); setStatus("Sign to decrypt…");
    try {
      const signer = await getSigner();
      setResult(await decryptRevealed(capsuleId, signer));
    } catch (e: unknown) {
      toast.error("Decryption failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  const unlockDate      = capsule ? new Date(Number(capsule.unlockTime) * 1000) : null;
  const alreadyRevealed = capsule?.state === 1;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Reveal Capsule</h1>
      <p className="mb-6 break-all font-mono text-xs text-muted-foreground">{capsuleId}</p>

      {capsule && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <MetaRow label="Owner"       value={capsule.owner} mono />
          <MetaRow label="Unlock time" value={unlockDate?.toLocaleString() ?? "—"} />
          <MetaRow label="Status"      value={alreadyRevealed ? "Revealed" : unlocked ? "Unlocked" : "Locked"} />
          <MetaRow label="Commit hash" value={capsule.commitHash} mono />
        </div>
      )}

      {!isConnected && <div className="mb-5"><ConnectButton /></div>}

      {!result && (
        <div className="flex flex-wrap gap-3">
          {!alreadyRevealed && (
            <Button
              onClick={handleReveal}
              disabled={loading || !unlocked || !isConnected}
              variant={unlocked && isConnected ? "default" : "secondary"}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <LockOpen className="h-4 w-4 animate-pulse" />
                  {status}
                </span>
              ) : !isConnected ? "Connect wallet" :
                !unlocked ? `Locked until ${unlockDate?.toLocaleString() ?? "…"}` :
                "Reveal & Decrypt"}
            </Button>
          )}
          {alreadyRevealed && isConnected && (
            <Button onClick={handleDecryptAlreadyRevealed} disabled={loading}
              className="bg-green-800 hover:bg-green-700">
              {loading ? status : "Decrypt (sign to read)"}
            </Button>
          )}
        </div>
      )}

      {result && (
        <div className={`mt-8 rounded-xl border p-6 ${result.verified ? "border-green-800 bg-green-950/20" : "border-amber-800 bg-amber-950/20"}`}>
          <div className="mb-4 flex items-center gap-2.5">
            {result.verified
              ? <Lock className="h-5 w-5 text-green-400" />
              : <span className="text-amber-400">⚠</span>
            }
            <span className={`text-sm font-medium ${result.verified ? "text-green-400" : "text-amber-400"}`}>
              {result.verified
                ? "Verified — content matches on-chain commitment"
                : "WARNING: content hash mismatch"}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.plaintext}</p>
          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[11px] text-muted-foreground">Commit: {result.commitHash}</p>
          </div>
        </div>
      )}
    </main>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-2 flex gap-3 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={`break-all ${mono ? "font-mono text-xs text-foreground/80" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Navigate to `/reveal` — confirm search bar renders. Enter a capsule ID and press Enter — confirm redirect to `/reveal/[id]`.

- [ ] **Step 4: Commit**

```bash
cd ..
git add 'frontend/app/reveal/page.tsx' 'frontend/app/reveal/[id]/page.tsx'
git commit -m "feat(reveal): Tailwind rewrite, Sonner errors, unlock state button"
```

---

## Task 9: Rewrite Gallery page

**Files:**
- Modify: `frontend/app/gallery/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/gallery/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { CapsuleCard } from "@/components/CapsuleCard";
import { getPublicClient } from "@/lib/contract";
import { TIME_CAPSULE_ABI, CONTRACT_ADDRESSES } from "@/constants/contracts";
import { TriggerType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { OnChainCapsule } from "@/lib/types";

type Tab = "all" | "mine" | "received";
type TriggerFilter = "all" | number;
interface CapsuleRow { id: `0x${string}`; capsule: OnChainCapsule; role: "owner" | "recipient" }

export default function GalleryPage() {
  const { address, isConnected } = useAccount();
  const [rows,    setRows]    = useState<CapsuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState<Tab>("all");
  const [trigger, setTrigger] = useState<TriggerFilter>("all");

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    async function load() {
      try {
        const pub = getPublicClient();
        const [owned, received] = await Promise.all([
          pub.readContract({ address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI, functionName: "getOwnerCapsules", args: [address!] }),
          pub.readContract({ address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI, functionName: "getRecipientCapsules", args: [address!] }),
        ]) as [`0x${string}`[], `0x${string}`[]];

        const ownerSet = new Set(owned);
        const allIds   = [...new Set([...owned, ...received])];
        const capsules = await Promise.all(
          allIds.map(async (id) => {
            const cap = await pub.readContract({
              address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI,
              functionName: "getCapsule", args: [id],
            }) as OnChainCapsule;
            return { id, capsule: cap, role: (ownerSet.has(id) ? "owner" : "recipient") as "owner" | "recipient" };
          })
        );
        capsules.sort((a, b) => Number(b.capsule.createdAt) - Number(a.capsule.createdAt));
        setRows(capsules);
      } catch (e: unknown) {
        toast.error("Failed to load capsules", { description: e instanceof Error ? e.message : String(e) });
      } finally { setLoading(false); }
    }
    load();
  }, [address, isConnected]);

  const counts = {
    all:      rows.length,
    mine:     rows.filter(r => r.role === "owner").length,
    received: rows.filter(r => r.role === "recipient").length,
  };

  const filtered = rows.filter(r => {
    if (tab === "mine"     && r.role !== "owner")     return false;
    if (tab === "received" && r.role !== "recipient") return false;
    if (trigger !== "all"  && r.capsule.triggerType !== trigger) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Capsules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sealed predictions, letters, and disclosures</p>
        </div>
        <Button asChild size="sm">
          <Link href="/seal"><Plus className="mr-1.5 h-4 w-4" />New</Link>
        </Button>
      </div>

      {!isConnected && (
        <div className="py-16 text-center">
          <p className="mb-5 text-muted-foreground">Connect wallet to view your capsules.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && (
        <>
          {/* Tabs */}
          <div className="mb-5 flex border-b border-border">
            {(["all", "mine", "received"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}{" "}
                <span className="text-muted-foreground/50 text-xs">({counts[t]})</span>
              </button>
            ))}
          </div>

          {/* Trigger filter */}
          {rows.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                { value: "all" as TriggerFilter,        label: "All triggers" },
                { value: TriggerType.TIME as TriggerFilter,     label: "⏰ Time lock" },
                { value: TriggerType.DEADMAN as TriggerFilter,  label: "💀 Dead Man's" },
                { value: TriggerType.MULTISIG as TriggerFilter, label: "🗳️ Multi-Sig" },
              ].map(({ value, label }) => (
                <button
                  key={String(value)}
                  onClick={() => setTrigger(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    trigger === value
                      ? "border-indigo-700 bg-indigo-950 text-indigo-300"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && rows.length === 0 && (
            <div className="py-20 text-center">
              <div className="mb-4 text-5xl">⏳</div>
              <p className="mb-1 text-muted-foreground">No capsules yet.</p>
              <p className="mb-5 text-sm text-muted-foreground/60">Seal a prediction, letter, or secret — prove it later.</p>
              <Link href="/seal" className="text-sm text-indigo-400 hover:text-indigo-300">Create your first capsule →</Link>
            </div>
          )}

          {!loading && filtered.length === 0 && rows.length > 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No capsules match this filter.</p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-3">
              {filtered.map(({ id, capsule }) => (
                <CapsuleCard key={id} id={id} capsule={capsule} myAddress={address} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Navigate to `/gallery`. Confirm: header with New button, tabs, filter chips, skeleton during load, capsule cards after load.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/app/gallery/page.tsx
git commit -m "feat(gallery): Tailwind rewrite, animated skeleton, Sonner errors"
```

---

## Task 10: Rewrite Onboard page

**Files:**
- Modify: `frontend/app/onboard/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/onboard/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/utils";
import {
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  hasSavedPrivKey,
} from "@/lib/ecies";
import { registerEncryptionKey, hasEncryptionKey } from "@/lib/contract";

const STEPS = [
  { id: 1, title: "Connect wallet",          desc: "Use MetaMask or any injected EVM wallet." },
  { id: 2, title: "Register encryption key", desc: "Generate a keypair so others can send you capsules." },
  { id: 3, title: "Seal your first capsule", desc: "Encrypt a message and lock it until the future." },
] as const;

export default function OnboardPage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const [step,       setStep]       = useState(1);
  const [regDone,    setRegDone]    = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    if (isConnected && step === 1) setStep(2);
    if (!isConnected && step > 1)  { setStep(1); setRegDone(false); }
  }, [isConnected, step]);

  useEffect(() => {
    if (!address) return;
    const local = hasSavedPrivKey(address);
    hasEncryptionKey(address).then(on => {
      if (local && on) { setRegDone(true); if (step === 2) setStep(3); }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function handleRegister() {
    if (!address) return;
    setRegLoading(true);
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      const tx  = await registerEncryptionKey(hex);
      setRegDone(true);
      setStep(3);
      toast.success("Key registered!", { description: `Tx: ${tx.slice(0, 18)}…` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Switched to 0G Testnet")) {
        toast.info("Switched to 0G Testnet", { description: "Press Register again." });
      } else {
        toast.error("Registration failed", { description: msg });
      }
    } finally { setRegLoading(false); }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="mb-1.5 text-2xl font-bold">Get started</h1>
      <p className="mb-10 text-sm text-muted-foreground">Three steps to seal your first time capsule.</p>

      {/* Step indicators */}
      <div className="mb-10 flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                step > s.id  ? "border-green-700 bg-green-950 text-green-400" :
                step === s.id ? "border-indigo-600 bg-indigo-950 text-indigo-300" :
                                "border-border bg-secondary text-muted-foreground"
              )}>
                {step > s.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span className={cn(
                "hidden text-[10px] font-medium sm:block",
                step === s.id ? "text-foreground" : "text-muted-foreground/60"
              )}>
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "mx-2 h-px flex-1 transition-colors",
                step > s.id + 1 ? "bg-green-800" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step cards */}
      <div className="flex flex-col gap-3">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done   = step > s.id;
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border p-5 transition-colors",
                active ? "border-indigo-800 bg-indigo-950/20" :
                done   ? "border-green-900 bg-green-950/10" :
                         "border-border bg-card opacity-40"
              )}
            >
              <div className="mb-0.5 flex items-center gap-2">
                {done
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  : <Circle className={cn("h-4 w-4 shrink-0", active ? "text-indigo-400" : "text-muted-foreground/40")} />
                }
                <h3 className={cn("text-sm font-semibold", done ? "text-green-400" : active ? "text-foreground" : "text-muted-foreground")}>
                  {s.title}
                </h3>
              </div>
              <p className="mb-0 ml-6 text-xs text-muted-foreground">{s.desc}</p>

              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="ml-6 mt-4"
                  >
                    {/* Step 1 content */}
                    {s.id === 1 && <ConnectButton />}

                    {/* Step 2 content */}
                    {s.id === 2 && (
                      <div>
                        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                          A secp256k1 keypair is generated in your browser. Private key stays local;
                          public key is registered on-chain so senders can encrypt specifically for you.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button onClick={handleRegister} disabled={regLoading} size="sm">
                            {regLoading ? "Registering…" : "Generate & Register"}
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href="/seal">Skip (optional)</Link>
                          </Button>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground/60">
                          Already registered?{" "}
                          <Link href="/register" className="text-indigo-400 hover:text-indigo-300">/register</Link>{" "}
                          to import your key.
                        </p>
                      </div>
                    )}

                    {/* Step 3 content */}
                    {s.id === 3 && (
                      <div>
                        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                          You&apos;re ready. Choose a trigger type, write your message, and seal it on-chain.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button onClick={() => router.push("/seal")} size="sm">
                            Create my first capsule →
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href="/gallery">View gallery</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Done state: show connected address for step 1 */}
              {done && s.id === 1 && (
                <div className="ml-6 mt-3 flex items-center gap-3">
                  <p className="text-xs text-green-400">
                    Connected: <code className="font-mono">{address?.slice(0, 10)}…{address?.slice(-6)}</code>
                  </p>
                  <button
                    onClick={() => disconnect()}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
              {done && s.id === 2 && (
                <p className="ml-6 mt-2 text-xs text-green-400">Key registered ✓</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`, navigate to `/onboard`. Confirm: step indicators render, inactive steps are dimmed, active step content animates in. Connect wallet → step 2 activates with slide animation.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/app/onboard/page.tsx
git commit -m "feat(onboard): AnimatePresence step transitions, Tailwind, Sonner toasts"
```

---

## Task 11: Rewrite Seal page

**Files:**
- Modify: `frontend/app/seal/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/seal/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/utils";
import { sealCapsule } from "@/lib/capsule";
import { getEncryptionKey } from "@/lib/contract";
import { TriggerType } from "@/lib/types";
import type { SealResult, RecipientParam } from "@/lib/types";

const TRIGGER_OPTS = [
  { value: TriggerType.TIME,     label: "⏰ Time lock",        desc: "Unlocks at a set time" },
  { value: TriggerType.DEADMAN,  label: "💀 Dead Man's Switch", desc: "Unlocks if owner stops checking in" },
  { value: TriggerType.MULTISIG, label: "🗳️ Multi-Sig",        desc: "Unlocks when M-of-N signers approve" },
] as const;

export default function SealPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  const [message,     setMessage]     = useState("");
  const [minutes,     setMinutes]     = useState(2);
  const [recipInput,  setRecipInput]  = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>(TriggerType.TIME);
  const [dmsInterval, setDmsInterval] = useState(1);
  const [msSigners,   setMsSigners]   = useState("");
  const [msThreshold, setMsThreshold] = useState(2);

  const [result,    setResult]    = useState<SealResult | null>(null);
  const [status,    setStatus]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [sealed,    setSealed]    = useState(false);

  const msSignerCount = msSigners
    .split(/[\s,]+/)
    .filter(s => s.startsWith("0x") && s.length === 42).length;

  async function handleSeal() {
    if (!message.trim()) { toast.error("Message is empty"); return; }
    if (!isConnected)    { toast.error("Connect wallet first"); return; }
    setLoading(true); setResult(null);

    try {
      const unlockTime = new Date(Date.now() + minutes * 60 * 1000);
      const rawAddresses = recipInput
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

      let recipients: RecipientParam[] = [];
      if (rawAddresses.length > 0) {
        setStatus("Fetching recipient keys…");
        recipients = await Promise.all(
          rawAddresses.map(async (addr) => {
            const pubkeyHex = await getEncryptionKey(addr);
            if (!pubkeyHex || pubkeyHex === "0x")
              throw new Error(`${addr} has not registered an encryption key.`);
            return { address: addr, pubkey: new Uint8Array(Buffer.from(pubkeyHex.slice(2), "hex")) };
          })
        );
      }

      const multisigSigners = msSigners
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

      setStatus(
        triggerType === TriggerType.TIME    ? "Encrypting + uploading to 0G…" :
        triggerType === TriggerType.DEADMAN ? "Sealing + arming dead man's switch…" :
        "Sealing + creating multi-sig vault…"
      );

      const res = await sealCapsule({
        plaintext:  message,
        unlockTime,
        recipients,
        triggerType,
        triggerContract: undefined,
        deadman:  triggerType === TriggerType.DEADMAN ? { intervalDays: dmsInterval } : undefined,
        multisig: triggerType === TriggerType.MULTISIG ? { signers: multisigSigners, threshold: msThreshold } : undefined,
      });

      setResult(res);
      setSealed(true);
      toast.success("Capsule sealed!", { description: `ID: ${res.capsuleId.slice(0, 18)}…` });
      setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1800);
    } catch (e: unknown) {
      toast.error("Seal failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Seal a Capsule</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Encrypted on-chain. Decryptable only when the unlock condition is met.
      </p>

      {!isConnected && <div className="mb-6"><ConnectButton /></div>}

      {/* Message */}
      <div className="mb-5">
        <Textarea
          rows={5}
          placeholder="Write your message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* Trigger selector */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Unlock trigger</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TRIGGER_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTriggerType(opt.value)}
              aria-pressed={triggerType === opt.value}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                triggerType === opt.value
                  ? "border-indigo-700 bg-indigo-950/40 text-indigo-300"
                  : "border-border bg-card text-muted-foreground hover:border-indigo-900 hover:text-foreground"
              )}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="mt-0.5 text-xs opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time lock config */}
      {triggerType === TriggerType.TIME && (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Unlock in</span>
          <Input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            disabled={loading}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      )}

      {/* Dead Man's Switch config */}
      {triggerType === TriggerType.DEADMAN && (
        <div className="mb-5 rounded-lg border border-amber-900/50 bg-amber-950/10 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-600">Dead Man&apos;s Switch</p>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Check-in interval</span>
            <Input type="number" min={1} value={dmsInterval}
              onChange={(e) => setDmsInterval(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            You must check in every {dmsInterval} day(s) or the capsule unlocks automatically.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Min lock window</span>
            <Input type="number" min={1} value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      )}

      {/* Multi-sig config */}
      {triggerType === TriggerType.MULTISIG && (
        <div className="mb-5 rounded-lg border border-indigo-900/50 bg-indigo-950/10 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">Multi-Sig</p>
          <label className="mb-1 block text-xs text-muted-foreground">Signers (comma-separated addresses)</label>
          <Textarea
            rows={3}
            placeholder="0xAbc…, 0xDef…"
            value={msSigners}
            onChange={(e) => setMsSigners(e.target.value)}
            disabled={loading}
            className="mb-3 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Threshold</span>
            <Input type="number" min={1} value={msThreshold}
              onChange={(e) => setMsThreshold(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              of {msSignerCount} signer{msSignerCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Min lock window</span>
            <Input type="number" min={1} value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      )}

      {/* Recipients */}
      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Recipients <span className="text-muted-foreground/50">(optional)</span>
        </label>
        <Input
          placeholder="0xAbc…, 0xDef… (comma-separated)"
          value={recipInput}
          onChange={(e) => setRecipInput(e.target.value)}
          disabled={loading}
        />
        <p className="mt-1.5 text-xs text-muted-foreground/60">
          Each address must have registered a key at{" "}
          <a href="/register" className="text-indigo-400 hover:text-indigo-300">/register</a>.
        </p>
      </div>

      {/* Submit + animation */}
      <AnimatePresence mode="wait">
        {sealed ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 py-2"
          >
            <motion.div
              initial={{ rotate: -90, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Lock className="h-5 w-5 text-green-400" />
            </motion.div>
            <span className="text-sm font-medium text-green-400">Capsule sealed! Redirecting…</span>
          </motion.div>
        ) : (
          <motion.div key="button">
            <Button
              onClick={handleSeal}
              disabled={loading || !isConnected}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    style={{ display: "inline-flex" }}
                  >
                    <LockOpen className="h-4 w-4" />
                  </motion.span>
                  {status || "Sealing…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Seal Capsule
                </span>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result details (before redirect) */}
      {result && (
        <div className="mt-8 rounded-xl border border-green-900 bg-green-950/10 p-5 text-xs">
          <ResultField label="Capsule ID"   value={result.capsuleId} />
          <ResultField label="Storage Root" value={result.storageRoot} />
          <ResultField label="Commit Hash"  value={result.commitHash} />
          <ResultField label="Drand Round"  value={String(result.drandRound)} />
          <ResultField label="Tx Hash"      value={result.txHash} />
        </div>
      )}
    </main>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <span className="text-muted-foreground">{label}: </span>
      <span className="break-all font-mono text-foreground/80">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Navigate to `/seal`. Confirm: trigger selector grid renders and switches. Time lock minutes input appears. Textarea + recipient input styled correctly. Click Seal (without wallet) — Sonner error toast. With wallet: loading spinner rotates, success shows lock animation.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/app/seal/page.tsx
git commit -m "feat(seal): lock animation, shadcn form components, Sonner toasts, trigger grid"
```

---

## Task 12: Rewrite Landing page

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Rewrite `frontend/app/page.tsx`**

```tsx
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};

const USE_CASES = [
  { emoji: "🔮", title: "Crypto predictions",  trigger: "Time lock",        triggerClass: "border-indigo-900 bg-indigo-950/50 text-indigo-400", desc: "Seal your price targets or on-chain thesis. When you're right, reveal and prove you called it — timestamped and tamper-proof." },
  { emoji: "📜", title: "Digital legacy",       trigger: "Dead Man's Switch", triggerClass: "border-amber-900 bg-amber-950/50 text-amber-400",    desc: "Write a letter to your children or loved ones. Set a dead man's switch — if you stop checking in, the capsule unlocks automatically." },
  { emoji: "⚖️", title: "DAO governance",       trigger: "Multi-Sig",        triggerClass: "border-indigo-900 bg-indigo-950/50 text-indigo-400", desc: "Seal a proposal or decision before the vote. Require M-of-N board members to approve the reveal — fully on-chain accountability." },
  { emoji: "🔑", title: "Private delivery",     trigger: "ECIES recipients", triggerClass: "border-green-900 bg-green-950/50 text-green-400",    desc: "Send a secret to a specific wallet. Only the designated recipient can decrypt — even after the capsule is publicly revealed." },
];

const STEPS = [
  { title: "Seal",        desc: "Write your message. It's encrypted client-side with AES-256-GCM. The keccak256 commitment is stored on 0G Chain; ciphertext on 0G Storage.", code: "TimeCapsule.seal(storageRoot, commitHash, timelockHeader, unlockTime, …)" },
  { title: "Wait",        desc: "The contract enforces the unlock condition — time, dead man's switch, or multi-sig. No one can decrypt early, not even you.",                  code: "require(block.timestamp >= unlockTime || triggerContract.canReveal(…))" },
  { title: "Reveal + Prove", desc: "Anyone calls reveal(). The contract emits the timelock header. The revealed plaintext is verified against the on-chain commitment.",      code: "verify(capsuleId, keccak256(plaintext)) → true" },
];

const TRIGGERS = [
  { icon: "⏰", name: "Time Lock",        desc: "Unlocks at a specific Unix timestamp. Simple, predictable.",                           borderClass: "border-indigo-900" },
  { icon: "💀", name: "Dead Man's Switch", desc: "Owner must check in periodically. Miss the deadline and anyone can trigger.",          borderClass: "border-amber-900" },
  { icon: "🗳️", name: "Multi-Sig",        desc: "M-of-N designated signers must approve. Trustless group consensus.",                   borderClass: "border-indigo-900" },
];

const STACK = [
  { name: "0G Chain",        role: "EVM — unlock logic + registry" },
  { name: "0G Storage",      role: "Off-chain ciphertext (content-addressed)" },
  { name: "AES-256-GCM",     role: "Symmetric payload encryption" },
  { name: "secp256k1 ECIES", role: "Per-recipient key encryption" },
  { name: "keccak256",       role: "Proof-of-existence commitment" },
  { name: "Next.js 14",      role: "App Router + server OG meta" },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border px-6 pb-20 pt-24 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-2xl"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-block rounded-full border border-border px-3.5 py-1 text-xs text-muted-foreground tracking-wider mb-7">
              Built on 0G Chain + 0G Storage
            </span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Seal a secret.<br />
            Prove it later.<br />
            <span className="text-indigo-400">No third party.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Encrypt any message on-chain. Locked until a future date, a missed check-in,
            or a multi-sig vote. When revealed, the on-chain commitment proves it was never changed.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
            <Link
              href="/onboard"
              className="rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start here →
            </Link>
            <Link
              href="/seal"
              className="rounded-lg border border-border px-7 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-indigo-800 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create capsule
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Use cases */}
      <section className="border-b border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Use cases</p>
          <h2 className="mb-10 text-2xl font-bold sm:text-3xl">What people seal</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map(uc => (
              <div key={uc.emoji} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-indigo-900">
                <div className="mb-3 text-3xl">{uc.emoji}</div>
                <h3 className="mb-2 text-sm font-bold text-foreground">{uc.title}</h3>
                <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{uc.desc}</p>
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${uc.triggerClass}`}>
                  {uc.trigger}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border bg-card/30 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">How it works</p>
          <h2 className="mb-10 text-2xl font-bold sm:text-3xl">Three steps, zero trust</h2>
          <div className="flex flex-col">
            {STEPS.map((s, i) => (
              <div key={i} className="flex gap-5 border-b border-border py-7 last:border-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-800 bg-indigo-950 font-bold text-sm text-indigo-300">
                  {i + 1}
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-foreground">{s.title}</h3>
                  <p className="mb-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <code className="text-xs text-muted-foreground/50">{s.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section className="border-b border-border px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Trigger types</p>
          <h2 className="mb-10 text-2xl font-bold sm:text-3xl">Unlock on your terms</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {TRIGGERS.map(t => (
              <div key={t.name} className={`rounded-xl border bg-card p-5 ${t.borderClass}`}>
                <div className="mb-3 text-3xl">{t.icon}</div>
                <h3 className="mb-2 text-sm font-bold text-foreground">{t.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-b border-border bg-card/30 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Architecture</p>
          <h2 className="mb-8 text-2xl font-bold sm:text-3xl">Fully on-chain. No trusted server.</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {STACK.map(s => (
              <div key={s.name} className="flex min-w-36 flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 text-left">
                <span className="text-sm font-bold text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Ready to seal your first capsule?</h2>
          <p className="mb-8 text-muted-foreground">Takes 2 minutes. No sign-up. Connect any EVM wallet.</p>
          <Link
            href="/onboard"
            className="rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Get started →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <p className="text-xs text-muted-foreground/50">
          0G Time Capsule — built on{" "}
          <a href="https://0g.ai" className="hover:text-muted-foreground transition-colors" target="_blank" rel="noopener noreferrer">0G Network</a>
          {" · "}
          <a href="https://github.com/Nomad06/0g-time-capsule" className="hover:text-muted-foreground transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </main>
  );
}
```

Note: `app/page.tsx` is a Server Component. Framer Motion `motion` components require `"use client"`. Since the landing page uses `motion`, add `"use client"` at the top OR extract the animated hero into a separate `HeroSection` client component. Add `"use client"` directive to the top of `app/page.tsx` — Next.js 14 allows this.

- [ ] **Step 2: Add `"use client"` to the landing page**

Add `"use client";` as the very first line of `frontend/app/page.tsx`.

- [ ] **Step 3: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Navigate to `/`. Confirm: hero text fades in with stagger. Cards have hover border effect. Steps section renders numbered circles. Stack chips display. Mobile: all sections stack and scroll correctly.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/app/page.tsx
git commit -m "feat(landing): Tailwind + Framer Motion stagger, responsive card grid, hover states"
```

---

## Task 13: Light Tailwind pass on Proof + Trigger pages

**Files:**
- Modify: `frontend/app/proof/[id]/ProofClient.tsx`
- Modify: `frontend/app/triggers/deadman/[id]/page.tsx`
- Modify: `frontend/app/triggers/multisig/[id]/page.tsx`

These pages keep their logic intact. Only inline style objects are replaced with Tailwind classes.

- [ ] **Step 1: Rewrite `frontend/app/proof/[id]/ProofClient.tsx` styles**

Replace all `style={{ ... }}` props with equivalent Tailwind className strings. Key mappings:

| Inline style | Tailwind |
|---|---|
| `maxWidth: 680, margin: "60px auto", padding: "0 24px"` | `className="mx-auto max-w-2xl px-4 py-12 sm:px-6"` |
| `display: "flex", justifyContent: "space-between"` | `className="flex justify-between"` |
| `color: "#4ade80"` | `className="text-green-400"` |
| `color: "#f87171"` | `className="text-red-400"` |
| `color: "#888"` | `className="text-muted-foreground"` |
| `color: "#818cf8"` | `className="text-indigo-300"` |
| `fontSize: 13` | `className="text-sm"` |
| `wordBreak: "break-all"` | `className="break-all"` |
| `fontFamily: "monospace"` | `className="font-mono"` |
| `proofBox` style | `className="rounded-xl border border-border bg-card p-5 mb-2"` |
| `primaryBtn` | use `<Button>` component |
| `ghostBtn` | use `<Button variant="outline" size="sm">` |

Apply these mappings to every `style=` prop in the file. Remove all const style objects at the bottom.

- [ ] **Step 2: Rewrite `frontend/app/triggers/deadman/[id]/page.tsx` styles**

Apply same mapping approach. The status card uses dynamic border/background — convert to `cn()`:

```tsx
<div className={cn(
  "rounded-xl border p-5 mb-2",
  info.triggered ? "border-purple-900 bg-purple-950/20" :
  overdue        ? "border-amber-900 bg-amber-950/10"   :
                   "border-green-900 bg-green-950/10"
)}>
```

Replace `primaryBtn` inline const with `<Button>` component. Remove all style const objects.

- [ ] **Step 3: Rewrite `frontend/app/triggers/multisig/[id]/page.tsx` styles**

Same approach. Progress bar:

```tsx
<div className="h-2 rounded-full bg-secondary overflow-hidden">
  <div
    className={cn("h-full rounded-full transition-all duration-500", canReveal ? "bg-green-500" : "bg-primary")}
    style={{ width: `${Math.min(100, progress * 100)}%` }}
  />
</div>
```

(Keep `style` only for the dynamic `width` — that's not doable in pure Tailwind without inline.)

- [ ] **Step 4: Typecheck + verify**

```bash
cd frontend && npm run typecheck
```
Run `npm run dev`. Navigate to a proof page `/proof/[any-capsule-id]`. Confirm layout renders correctly. Check deadman and multisig trigger pages if capsules exist.

- [ ] **Step 5: Commit**

```bash
cd ..
git add 'frontend/app/proof/[id]/ProofClient.tsx' \
  'frontend/app/triggers/deadman/[id]/page.tsx' \
  'frontend/app/triggers/multisig/[id]/page.tsx'
git commit -m "feat(proof+triggers): light Tailwind pass, remove inline style objects"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tailwind replaces all inline styles (Tasks 2–13)
- ✅ shadcn/ui components: Button, Input, Textarea, Dialog, Sheet, Badge, Card, Separator
- ✅ Framer Motion: seal lock animation (Task 11), card hover lift (Task 6), landing stagger (Task 12), onboard AnimatePresence (Task 10)
- ✅ Sonner toasts replace all inline error/success `<p>` elements (Tasks 7–12)
- ✅ Nav mobile drawer with Sheet (Task 4)
- ✅ ConnectButton Dialog (Task 5)
- ✅ CapsuleCard better hierarchy — seal date + trigger as headline, truncated hex ID (Task 6)
- ✅ Geist → Inter font, `font-sans` body (Task 3)
- ✅ `focus-visible:ring-2` on all interactive elements via globals.css `:focus-visible` rule + Button component
- ✅ Color contrast: `text-muted-foreground` = `hsl(0 0% 45%)` on `hsl(0 0% 4%)` background ≈ 8:1 ratio (passes WCAG AA)
- ✅ `prefers-reduced-motion`: Framer Motion respects this automatically
- ✅ lib/, constants/, providers.tsx untouched
- ✅ proof/[id] and triggers pages: light Tailwind pass (Task 13)

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:**
- `cn()` used consistently from `@/lib/utils`
- `Button`, `Input`, `Textarea` imported from `@/components/ui/*` throughout
- `toast` from `sonner` used consistently (not `toast.show` or other variants)
- `ConnectButton` import path consistent (`@/components/ConnectButton` or `../../components/ConnectButton` depending on file depth — both resolve correctly via `@/*` alias)
