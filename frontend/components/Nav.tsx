"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Menu, Hourglass } from "lucide-react";
import { ConnectButton } from "./ConnectButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/seal",     label: "Seal Capsule" },
  { href: "/discover", label: "Discover" },
  { href: "/gallery",  label: "My Capsules" },
  { href: "/stats",    label: "Stats" },
  { href: "/reveal",   label: "Open" },
  { href: "/register", label: "Register Key" },
  { href: "/onboard",  label: "Get Started" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => { router.push(href); });
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/40 backdrop-blur-md transition-all duration-300">
      {isPending && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
          <div className="h-full w-1/3 animate-[nav-slide_1s_ease-in-out_infinite] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_8px_#8b5cf6]" />
        </div>
      )}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-title text-base font-bold tracking-tight text-white/90 transition-all hover:text-white"
        >
          <Hourglass className="h-4.5 w-4.5 text-violet-400 transition-transform group-hover:rotate-180 duration-700" />
          <span>0G <span className="text-violet-400 bg-clip-text">Time Capsule</span></span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={cn(
                "relative text-xs font-semibold uppercase tracking-wider transition-colors duration-250 py-1",
                pathname === href 
                  ? "text-violet-400 font-bold" 
                  : "text-muted-foreground hover:text-white",
                href === "/onboard" && pathname !== "/onboard" && "text-fuchsia-400 hover:text-fuchsia-300"
              )}
            >
              {label}
              {pathname === href && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_8px_#8b5cf6]" />
              )}
            </button>
          ))}
          <ConnectButton />
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <ConnectButton />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/5" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 border-l border-white/[0.08] bg-black/95 backdrop-blur-xl">
              <nav className="mt-8 flex flex-col gap-1.5">
                {NAV_LINKS.map(({ href, label }) => (
                  <button
                    key={href}
                    onClick={() => { setOpen(false); navigate(href); }}
                    className={cn(
                      "rounded-lg px-3 py-3 text-xs font-bold uppercase tracking-wider transition-colors text-left",
                      pathname === href
                        ? "bg-violet-950/40 text-violet-400 border-l-2 border-violet-500"
                        : "text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
