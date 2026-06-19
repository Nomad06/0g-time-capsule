"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Menu } from "lucide-react";
import { ConnectButton } from "./ConnectButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/seal",     label: "Seal" },
  { href: "/discover", label: "Discover" },
  { href: "/gallery",  label: "My Capsules" },
  { href: "/stats",    label: "Stats" },
  { href: "/reveal",   label: "Open" },
  { href: "/register", label: "Register Key" },
  { href: "/onboard",  label: "Get started" },
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
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      {isPending && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[nav-slide_1s_ease-in-out_infinite] bg-indigo-500" />
        </div>
      )}
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
            <button
              key={href}
              onClick={() => navigate(href)}
              className={cn(
                "text-sm transition-colors hover:text-foreground",
                pathname === href ? "text-indigo-400" : "text-muted-foreground",
                href === "/onboard" && pathname !== "/onboard" && "text-indigo-300 hover:text-indigo-200"
              )}
            >
              {label}
            </button>
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
                  <button
                    key={href}
                    onClick={() => { setOpen(false); navigate(href); }}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground text-left",
                      pathname === href
                        ? "bg-accent text-indigo-400"
                        : "text-muted-foreground"
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
