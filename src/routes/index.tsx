import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  Camera,
  Car,
  Clock,
  Compass,
  Database,
  Leaf,
  Map as MapIcon,
  MessageSquareText,
  Route as RouteIcon,
  ShieldCheck,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";

import heroMap from "@/assets/hero-map.jpg";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { useIncidents } from "@/hooks/use-incidents";
import { INCIDENT_TYPES } from "@/lib/incidents";
import { computeStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrafficSense AI – Know the traffic. Know the reason." },
      { name: "description", content: "TrafficSense AI detects and explains why traffic is happening — accidents, breakdowns, construction, signal failures and roadblocks — with live maps and alternate routes." },
      { property: "og:title", content: "TrafficSense AI – Know the traffic. Know the reason." },
      { property: "og:description", content: "Don't just see the traffic. Understand why. AI-explained incidents and smarter routes for Bengaluru commuters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const HERO_MARKERS = [
  { top: "28%", left: "58%", type: "accident", delay: "0s" },
  { top: "52%", left: "40%", type: "signal_failure", delay: "0.6s" },
  { top: "64%", left: "68%", type: "construction", delay: "1.2s" },
  { top: "38%", left: "24%", type: "breakdown", delay: "0.3s" },
  { top: "74%", left: "36%", type: "roadblock", delay: "0.9s" },
] as const;

const STEPS = [
  { icon: Database, title: "Collect", text: "Traffic data and community reports stream in from across the city." },
  { icon: Brain, title: "Analyze", text: "AI classifies the most likely cause and checks photos when available." },
  { icon: MessageSquareText, title: "Explain", text: "Cause, delay and clearance time appear right on the map." },
  { icon: Compass, title: "Guide", text: "Suggested alternative routes help you skip the jam." },
];

const FEATURES = [
  { icon: Brain, title: "AI cause detection", text: "Plain-language explanations of why the road is slow." },
  { icon: MapIcon, title: "Interactive map", text: "Colour-coded incidents, clustering and live updates." },
  { icon: Timer, title: "Impact estimation", text: "Expected delay and clearance time for every incident." },
  { icon: RouteIcon, title: "Alternative routes", text: "A suggested detour drawn around the problem." },
  { icon: Camera, title: "Photo reports", text: "Attach a photo — the AI uses it to verify the cause." },
  { icon: Users, title: "Community confirmations", text: "“Still there” and “Cleared” votes keep the map honest." },
];

const BENEFITS = [
  { icon: Car, title: "Commuters", text: "Decide to wait, reroute or take the metro — with the reason in hand." },
  { icon: ShieldCheck, title: "Authorities", text: "Spot signal failures and breakdowns faster and dispatch help." },
  { icon: Leaf, title: "Environment", text: "Less idling in jams means lower fuel use and emissions." },
  { icon: Building2, title: "Smart Cities", text: "Cause-level data reveals hotspots that need long-term fixes." },
];

function Home() {
  const { data = [], isLoading } = useIncidents();
  const stats = computeStats(data);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-navy-foreground">
        <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/20 bg-navy-foreground/5 px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-teal" /> Live in Bengaluru
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Know the traffic.
              <br />
              <span className="text-gradient-teal">Know the reason.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-foreground/75">
              TrafficSense AI combines community reports and AI analysis to explain <em>why</em> roads are jammed — accidents, breakdowns,
              construction, signal failures or roadblocks — and how long it will last.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/map">
                  <MapIcon /> Open Live Map
                </Link>
              </Button>
              <Button asChild variant="heroOutline" size="lg">
                <Link to="/report">Report an Incident <ArrowRight /></Link>
              </Button>
            </div>
          </div>
          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div className="relative overflow-hidden rounded-3xl border border-navy-foreground/15 shadow-elevated">
              <img src={heroMap} alt="Stylized city map with congested roads highlighted" width={1600} height={1104} className="aspect-[4/3] w-full object-cover" />
              {HERO_MARKERS.map((m) => {
                const t = INCIDENT_TYPES.find((x) => x.value === m.type)!;
                return (
                  <span key={m.type} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: m.top, left: m.left }} aria-hidden>
                    <span className={cn("absolute inset-0 animate-pulse-ring rounded-full", t.bg)} style={{ animationDelay: m.delay }} />
                    <span className={cn("relative grid h-9 w-9 place-items-center rounded-full border-2 border-navy-foreground text-navy-foreground shadow-elevated", t.bg)}>
                      <t.icon className="h-4 w-4" size={16} />
                    </span>
                  </span>
                );
              })}
              <div className="absolute bottom-4 left-4 right-4 animate-float rounded-xl glass p-4 text-card-foreground shadow-elevated sm:right-auto sm:max-w-xs">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-teal"><Brain className="h-3.5 w-3.5" /> Why is there traffic here?</p>
                <p className="mt-1 text-sm font-semibold">Signal outage at Silk Board</p>
                <p className="mt-0.5 text-xs text-muted-foreground">All four directions crossing at once · +35 min delay</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section aria-label="Live statistics" className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Activity} label="Active incidents" value={stats.active} loading={isLoading} tone="danger" />
          <StatCard icon={TrendingUp} label="Reports today" value={stats.reportsToday} loading={isLoading} />
          <StatCard icon={Clock} label="Average delay" value={`${stats.avgDelay} min`} loading={isLoading} tone="warning" />
          <StatCard icon={BarChart3} label="Most common cause" value={stats.mostCommon} loading={isLoading} tone="success" />
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="The problem" title="Traffic apps show red lines. Not reasons." text="Congestion has a cause. Knowing it changes what you do next." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {INCIDENT_TYPES.map((t) => (
            <div key={t.value} className="group rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl text-navy-foreground transition-transform group-hover:scale-110", t.bg)}>
                <t.icon className="h-5 w-5" size={20} />
              </span>
              <h3 className="mt-4 font-semibold">{t.label === "Signal Failure" ? "Signal Failures" : t.label === "Construction" ? "Construction" : `${t.label}s`}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From report to reroute in seconds" />
          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                {i < STEPS.length - 1 && <span className="absolute left-14 right-0 top-7 hidden h-px bg-gradient-to-r from-teal/60 to-transparent md:block" aria-hidden />}
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-teal text-teal-foreground shadow-glow">
                  <s.icon className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-navy text-xs font-bold text-navy-foreground">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Features" title="Everything you need to beat the jam" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-teal/40 hover:shadow-elevated">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal/12 text-teal"><f.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-secondary/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Who benefits" title="Better decisions for everyone on the road" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-xl bg-card p-6 shadow-soft">
                <b.icon className="h-7 w-7 text-teal" />
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-cta px-6 py-14 text-center text-navy-foreground shadow-elevated sm:px-12">
          <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Stuck in traffic? Find out why.</h2>
            <p className="mx-auto mt-3 max-w-xl text-navy-foreground/75">Open the live map to see what's happening on your route — or report what you see to help thousands of commuters.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="hero" size="lg"><Link to="/map"><MapIcon /> Open Live Map</Link></Button>
              <Button asChild variant="heroOutline" size="lg"><Link to="/signup">Create free account</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-muted-foreground">{text}</p>}
    </div>
  );
}
