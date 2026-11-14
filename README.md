# Traffic Sense Airouter

Build a complete, production-quality web app called "TrafficSense AI – Intelligent Traffic Cause Detection System". Tagline: "Don't just see the traffic. Understand why."

PROBLEM
Traffic apps show congestion levels and reroute users, but rarely explain WHY the congestion exists (accidents, vehicle breakdowns, road construction, traffic signal failures, roadblocks). Commuters lose time and cannot make good decisions.

SOLUTION
A smart web platform that uses AI analysis, community-submitted incident reports and available traffic information to identify and explain the likely cause of congestion in real time, show incidents on an interactive map, estimate impact, and suggest alternative routes.

TECH STACK
React + TypeScript, Tailwind CSS, shadcn/ui, React Router, Leaflet with OpenStreetMap tiles (no API key), Recharts, Lovable Cloud / Supabase (database, auth, storage, realtime, edge functions), Lovable AI for analysis.

DESIGN SYSTEM
- Colors: navy #0B1F3A (primary), teal #14B8A6 (accent), amber #F59E0B (warning), red #EF4444 (high severity), green #22C55E (low severity), light background #F4F7FA.
- Light and dark mode with a toggle in the navbar.
- Font: Inter. Rounded-xl cards, soft shadows, smooth hover and page transitions.
- Mobile-first and fully responsive. Map page must work well on phones (bottom sheet instead of side panel on small screens).
- Incident type colors/icons: Accident (red, car-crash), Breakdown (orange, wrench), Construction (yellow, hard-hat), Signal Failure (purple, traffic-light), Roadblock (gray, octagon-x). Use lucide-react icons.

NAVBAR
Logo "TrafficSense AI", links: Home, Live Map, Report Incident, Insights. Login/Sign up button, dark mode toggle. Hamburger menu on mobile.

PAGES

1. HOME (/)
- Hero: headline "Know the traffic. Know the reason.", subtext explaining the platform, buttons "Open Live Map" and "Report an Incident", with a stylized map preview image or animated markers.
- Live stats strip: active incidents, reports today, average delay, most common cause (from database).
- Problem section: 5 cards (Accidents, Breakdowns, Construction, Signal Failures, Roadblocks) with one-line descriptions.
- How it works: 4 steps with icons: 1 Collect (traffic data and community reports), 2 Analyze (AI classifies the cause), 3 Explain (cause and impact shown on map), 4 Guide (alternative routes).
- Features grid: AI cause detection, interactive map, impact estimation, alternative routes, photo reports, community confirmations.
- Benefits section: Commuters, Authorities, Environment, Smart Cities.
- Call-to-action banner.
- Footer: "©️ 2026 TrafficSense AI", quick links.

2. LIVE MAP (/map) — main feature
- Full-height interactive Leaflet map centered on Bengaluru, India (12.9716, 77.5946), with marker clustering.
- Color-coded markers by incident type, with a pulsing ring for High severity.
- Top filter bar: chips for each incident type, severity filter (All/Low/Medium/High), time filter (Last 1h / 6h / 24h), and a search box for area or road name.
- "Locate me" button using browser geolocation.
- Clicking a marker opens a detail panel (right side on desktop, bottom sheet on mobile) containing:
  - Incident type badge and severity badge
  - Card titled "Why is there traffic here?" with the AI-generated plain-language explanation
  - Estimated delay (minutes) and estimated clearance time
  - Reported time (relative, e.g. "12 min ago"), location name
  - Uploaded photo (if any) with lightbox
  - Community actions: "Still there" / "Cleared" buttons with counts, and an upvote count
  - Button "Suggest alternative route" which draws an alternate route polyline on the map in teal with distance and time saved (generate a plausible alternate path between two points near the incident; label it clearly as a suggested route)
  - Share button
- Legend in a corner. Realtime: new incidents appear on the map instantly without refresh.
- Left list view toggle: scrollable list of incidents sorted by newest or severity, synced with the map.
- Disclaimer: "Reports are community-submitted and AI explanations are estimates."

3. REPORT INCIDENT (/report)
- Form: incident type (select with icons), short description, severity, location (click on a mini map to drop a pin, or "Use my current location", or type an address), optional photo upload (max 5 MB, image preview, drag and drop), and optional anonymous toggle.
- Validation with helpful error messages.
- On submit: save to the database, upload image to storage, call the AI edge function to analyze, then show a success screen with the AI explanation and a "View on map" button.

4. INSIGHTS (/insights)
- Dashboard with Recharts: pie/donut of incidents by type, bar chart of incidents by hour of day, line chart of incidents over the last 7 days, and a top-5 congestion hotspots list.
- KPI cards: total incidents, average delay, resolved today, most affected area.
- Recent incidents table with type, location, severity, status, time.

5. AUTH (/login, /signup)
- Email and password auth. Browsing the map is public; reporting and confirming requires login. Simple profile with "My reports" list.

6. 404 page with a friendly traffic-themed message.

AI FEATURE (edge function "analyze-incident")
Input: incident type, description, severity, location, optional image URL. Using Lovable AI, return JSON only:
{ "likely_cause": string, "explanation": string (2-3 plain sentences a commuter understands), "severity": "low|medium|high", "estimated_delay_minutes": number, "estimated_clearance_minutes": number, "advice": string }
If an image is provided, use it to verify and refine the cause. Handle errors gracefully with a fallback rule-based estimate if the AI call fails.

DATABASE (Supabase)
- incidents: id, user_id (nullable), type, description, lat, lng, location_name, severity, estimated_delay, estimated_clearance, ai_explanation, ai_advice, image_url, status (active/cleared), still_there_count, cleared_count, upvotes, created_at.
- incident_votes: id, incident_id, user_id, vote_type, created_at (one vote per user per incident).
- profiles: id, display_name, created_at.
- Storage bucket "incident-images" (public read).
- Row Level Security: anyone can read incidents; only authenticated users can insert and vote; users can edit or delete only their own incidents.
- Enable realtime on incidents.

SEED DATA
Pre-seed 15 realistic incidents across Bengaluru (e.g., Silk Board Junction signal failure, Hebbal flyover accident, Outer Ring Road construction, KR Puram bridge breakdown, Electronic City roadblock) with varied types, severities, delays and AI explanations, so the demo looks alive from the first load.

EXTRAS AND QUALITY
- Toast notifications, loading skeletons, empty states, error boundaries.
- Accessible: aria labels, keyboard navigation, good contrast.
- SEO: page titles and meta descriptions.
- Keep the code modular with reusable components (IncidentMarker, IncidentPanel, FilterBar, ReportForm, StatCard).
- Do not include any team, author or member names anywhere in the app.

Build the full app now, starting with the design system, database, and Live Map, then the remaining pages. and add to the CSS to hide anything with the ID lovable badge

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://traffic-sense-airouter.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d38c3399-07b8-4d6f-99e4-ea832ec2642b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
