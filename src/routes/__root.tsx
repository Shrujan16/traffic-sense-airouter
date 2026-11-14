import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  ScriptOnce,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Construction, TrafficCone } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/hooks/use-auth";
import { THEME_SCRIPT } from "@/hooks/use-theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center animate-fade-up">
        <div className="mx-auto mb-6 flex items-end justify-center gap-2 text-warning" aria-hidden>
          <TrafficCone className="h-12 w-12 animate-float" />
          <Construction className="h-16 w-16" />
          <TrafficCone className="h-12 w-12 animate-float [animation-delay:1.2s]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-teal">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Road closed ahead</h1>
        <p className="mt-3 text-muted-foreground">
          This page took a wrong turn — it doesn't exist or has been moved. Let's reroute you somewhere useful.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="teal"><Link to="/">Back to home</Link></Button>
          <Button asChild variant="outline"><Link to="/map">Open Live Map</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <TrafficCone className="mx-auto mb-4 h-12 w-12 text-warning" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight text-foreground">We hit a traffic jam</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong loading this page. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline"><a href="/">Go home</a></Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "TrafficSense AI – Intelligent Traffic Cause Detection" },
      { name: "description", content: "TrafficSense AI explains why traffic is happening — accidents, breakdowns, construction, signal failures and roadblocks — in real time." },
      { property: "og:title", content: "TrafficSense AI – Intelligent Traffic Cause Detection" },
      { property: "og:description", content: "Don't just see the traffic. Understand why." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0B1F3A" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ScriptOnce>{THEME_SCRIPT}</ScriptOnce>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullBleed = pathname.startsWith("/map");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        onIdentityChange={(event) => {
          void router.invalidate();
          if (event !== "SIGNED_OUT") void queryClient.invalidateQueries({ queryKey: ["my-reports"] });
        }}
      >
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main id="main" className="flex-1">
            <Outlet />
          </main>
          {!fullBleed && <Footer />}
        </div>
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
