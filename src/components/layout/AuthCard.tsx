import type { ReactNode } from "react";

import { Logo } from "./Logo";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-hero opacity-[0.07] dark:opacity-30" aria-hidden />
      <div className="relative w-full max-w-md animate-fade-up rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}
