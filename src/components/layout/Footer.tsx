import { Link } from "@tanstack/react-router";

import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground">Don't just see the traffic. Understand why.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li><Link to="/map" className="text-muted-foreground hover:text-foreground">Live Map</Link></li>
            <li><Link to="/report" className="text-muted-foreground hover:text-foreground">Report Incident</Link></li>
            <li><Link to="/insights" className="text-muted-foreground hover:text-foreground">Insights</Link></li>
            <li><Link to="/login" className="text-muted-foreground hover:text-foreground">Log in</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">© 2026 TrafficSense AI</div>
    </footer>
  );
}
