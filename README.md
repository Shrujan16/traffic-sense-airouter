<div align="center">

# 🚦 TrafficSense AI

### Intelligent Traffic Cause Detection System

**Don't just see the traffic. Understand why.**

[🌐 Live Demo](https://traffic-sense-airouter.lovable.app/) · [🗺️ Live Map](https://traffic-sense-airouter.lovable.app/map) · [📝 Report Incident](https://traffic-sense-airouter.lovable.app/report) · [📊 Insights](https://traffic-sense-airouter.lovable.app/insights)

</div>

---

## 📌 Overview

Traffic and navigation apps show congestion levels and suggest alternative routes, but they rarely explain **why** the road is jammed. Commuters face unexpected delays caused by road accidents, vehicle breakdowns, road construction, traffic signal failures and roadblocks, and without knowing the cause they cannot decide whether to wait, reroute or change plans.

**TrafficSense AI** is a smart web platform that goes beyond traditional traffic monitoring. It combines **AI-based analysis**, **community-submitted incident reports** and available traffic information to identify, explain and map the likely causes of congestion in real time.

## ❗ Problem Statement

- Existing apps show *where* traffic is slow, not *why*.
- Unclear information about incidents wastes commuters' time.
- There is no easy way for the community to share what is happening on the road.
- Cities lack cause-level data to find recurring hotspots.

## ✅ Our Solution

TrafficSense AI identifies and explains the possible causes of traffic congestion, displays them on an interactive map, estimates their impact, and suggests alternative routes where possible. Users can also upload images and report incidents to help other commuters.

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Cause Detection** | Plain-language explanation of why the road is slow, with photo verification when an image is attached |
| 🗺️ **Interactive Live Map** | Colour-coded incident markers, clustering, filters and live updates |
| ⏱️ **Impact Estimation** | Expected delay and clearance time for every incident |
| 🔀 **Alternative Routes** | A suggested detour drawn around the problem area |
| 📸 **Photo Reports** | Attach an image to a report so the AI can verify the cause |
| 👥 **Community Confirmations** | "Still there" and "Cleared" votes keep the map accurate |
| 📊 **Insights Dashboard** | Charts for incidents by type, time of day, trends and hotspots |
| 🔐 **Authentication** | Browse publicly; log in to report and confirm incidents |
| 🌗 **Light / Dark Mode** | Responsive, mobile-first interface |

### Incident types detected

🚗 Accidents · 🔧 Vehicle breakdowns · 🚧 Road construction · 🚦 Traffic signal failures · ⛔ Roadblocks

## ⚙️ How It Works

```
 Collect  ───►  Analyze  ───►  Explain  ───►  Guide
 Traffic data    AI classifies   Cause, delay     Alternative
 + community     the most        and clearance    routes help
 reports         likely cause    shown on map     skip the jam
```

1. **Collect:** traffic data and community reports (with optional photos) come in.
2. **Analyze:** an AI model classifies the most probable cause and estimates severity and delay.
3. **Explain:** the cause, delay and clearance time appear on the map.
4. **Guide:** the app suggests an alternative route.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui, React Router
- **Maps:** Leaflet with OpenStreetMap
- **Charts:** Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **AI:** Lovable AI (cause classification and explanation)
- **Built with:** [Lovable](https://lovable.dev)

## 📁 Project Structure

```
trafficsense-ai/
├── public/
├── src/
│   ├── components/     # IncidentMarker, IncidentPanel, FilterBar, ReportForm, StatCard
│   ├── pages/          # Home, Map, Report, Insights, Login, Signup, NotFound
│   ├── hooks/
│   ├── integrations/   # Supabase client
│   └── lib/
├── supabase/
│   ├── functions/      # analyze-incident edge function
│   └── migrations/     # database schema
├── package.json
└── README.md
```

> Adjust folder names to match your actual repository.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (or Lovable Cloud)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 2. Install dependencies
npm install

# 3. Add environment variables (see below)
cp .env.example .env

# 4. Start the dev server
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Database

Apply the migrations in `supabase/migrations` to create:

- `incidents`: type, description, location, severity, estimated delay and clearance, AI explanation, image, status, votes
- `incident_votes`: one vote per user per incident
- `profiles`: user display names
- Storage bucket `incident-images` for photo uploads
- Row Level Security: public read; authenticated users can insert and vote; users can edit or delete only their own incidents

## 🖼️ Screenshots

Add screenshots to a `docs/` folder and link them here.

| Home | Live Map |
|---|---|
| ![Home](docs/home.png) | ![Map](docs/map.png) |

| Report Incident | Insights |
|---|---|
| ![Report](docs/report.png) | ![Insights](docs/insights.png) |

## 🔮 Future Scope

- CCTV and IoT sensor integration for automatic incident detection
- Predictive alerts before congestion builds up
- Mobile app with push notifications
- Integration with emergency services and traffic police
- Multi-language support (including Kannada)
- Live integration with official traffic APIs

## 👥 Team Godlike

| Name | Role |
|---|---|
| Manoj Reddy | Team Leader |
| Bharath Y N | Team Member |
| Harsha M | Team Member |
| Chandan S Reddy | Team Member |
| C Shrujan Reddy | Team Member |

## ⚠️ Disclaimer

Reports are community-submitted and AI explanations are estimates. Do not rely on this app for safety-critical decisions.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

<div align="center">

**TrafficSense AI: Know the traffic. Know the reason.** 🚦

</div>
