import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, CheckCircle2, Clock, Flame, MapPin } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, StatusBadge, TypeBadge } from "@/components/incidents/Badges";
import { StatCard } from "@/components/StatCard";
import { useIncidents } from "@/hooks/use-incidents";
import { formatMinutes, timeAgo } from "@/lib/incidents";
import { byHour, byType, computeStats, last7Days } from "@/lib/stats";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Traffic Insights Dashboard | TrafficSense AI" },
      { name: "description", content: "Charts of Bengaluru traffic incidents by cause, hour and day, plus the top congestion hotspots and recent reports." },
      { property: "og:title", content: "Traffic Insights Dashboard | TrafficSense AI" },
      { property: "og:description", content: "What's causing congestion across the city — by type, hour, day and hotspot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Insights,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 shadow-soft ${className ?? ""}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4 h-64">{children}</div>
    </section>
  );
}

function Insights() {
  const { data = [], isLoading, isError } = useIncidents();
  const stats = computeStats(data);
  const types = byType(data);
  const hours = byHour(data);
  const week = last7Days(data);
  const recent = data.slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal">Insights</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">City traffic at a glance</h1>
        <p className="mt-2 text-muted-foreground">Live numbers from community reports across Bengaluru.</p>
      </header>

      {isError && <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Couldn't load incident data. Please refresh.</p>}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Activity} label="Total incidents" value={stats.total} hint={`${stats.active} active now`} loading={isLoading} />
        <StatCard icon={Clock} label="Average delay" value={`${stats.avgDelay} min`} hint="across active incidents" loading={isLoading} tone="warning" />
        <StatCard icon={CheckCircle2} label="Resolved today" value={stats.resolvedToday} hint="marked cleared" loading={isLoading} tone="success" />
        <StatCard icon={MapPin} label="Most affected area" value={stats.mostAffected} loading={isLoading} tone="danger" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Incidents by type">
          {isLoading ? (
            <Skeleton className="mx-auto h-48 w-48 rounded-full" />
          ) : types.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex h-full flex-col">
              <ResponsiveContainer width="100%" height="75%">
                <PieChart>
                  <Pie data={types} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={3} stroke="var(--card)" strokeWidth={2}>
                    {types.map((t) => <Cell key={t.name} fill={t.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {types.map((t) => (
                  <li key={t.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} /> {t.name} ({t.value})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Incidents by hour of day" className="lg:col-span-2">
          {isLoading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} labelFormatter={(l) => `${l}:00`} />
                <Bar dataKey="count" name="Incidents" fill="var(--teal)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Last 7 days" className="lg:col-span-2">
          {isLoading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={week} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" name="Incidents" stroke="var(--warning)" strokeWidth={3} dot={{ r: 4, fill: "var(--warning)" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-sev-high" /> Top 5 congestion hotspots</h2>
          <ol className="mt-4 space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            {!isLoading && stats.hotspots.length === 0 && <Empty />}
            {stats.hotspots.map((h, i) => {
              const max = stats.hotspots[0]?.totalDelay || 1;
              return (
                <li key={h.name}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                      <span className="truncate font-medium">{h.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatMinutes(h.totalDelay)} lost</span>
                  </div>
                  <div className="ml-8 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-teal" style={{ width: `${(h.totalDelay / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold">Recent incidents</h2>
          <Link to="/map" className="text-sm font-medium text-teal hover:underline">View on map</Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Reported</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))}
              {recent.map((inc) => (
                <TableRow key={inc.id}>
                  <TableCell><TypeBadge type={inc.type} /></TableCell>
                  <TableCell className="min-w-[12rem]">
                    <Link to="/map" search={{ incident: inc.id }} className="font-medium hover:text-teal">{inc.location_name}</Link>
                  </TableCell>
                  <TableCell><SeverityBadge severity={inc.severity} /></TableCell>
                  <TableCell><StatusBadge status={inc.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">{timeAgo(inc.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function Empty() {
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">No data yet</div>;
}
