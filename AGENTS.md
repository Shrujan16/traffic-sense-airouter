<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Server functions live in `src/lib/*.functions.ts`; AI gateway code lives in `src/lib/ai/*.server.ts`. Never create `src/server/**` files imported by client code — the import-protection plugin blocks that path in the browser bundle.
- Leaflet components (`MapView`, `LocationPicker`) are loaded with `React.lazy` behind `<ClientOnly>`; never import them statically from a route, because Leaflet touches `window` at import time and breaks SSR.
- Incident photos go to the private `incident-images` bucket under `<userId>/…`; `incidents.image_url` stores the storage path and the UI shows it through signed URLs, because the workspace blocks public buckets.
- Vote counters and auto-clear status on `incidents` are maintained only by DB triggers fed by the `cast_vote` RPC; a trigger resets counter columns on ordinary owner updates so they can't be forged.
- Report submission inserts first with the rule-based estimate (`ruleBasedEstimate`), then overwrites it with the AI analysis, so the incident appears on the live map instantly and still has an explanation if AI fails.
- Overlays (dialogs, drawers, selects, menus) use `z-[1300]` so they sit above Leaflet controls (z 1000) and the sticky navbar (z 1100).
