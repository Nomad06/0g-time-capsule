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
