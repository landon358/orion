# ORION UI

ORION: Orchestrated Reasoning & Intelligent Operations Network (formerly LEO).

The web app for talking to ORION, a local Qwen 3.5 9B agent running on a home PC (RTX 2070, 8 GB). This repo is **only the interface**. ORION's persona, tools, and server live on the ORION machine.

It's a static site with no build step and no dependencies, deployed to GitHub Pages. It installs to the iPhone or Android home screen as an app.

## What's here

| File | What it does |
|---|---|
| `index.html` | App shell. Desktop (900px and up): full-screen network, a top bar with map tools, a timeline and legend on the left, a detail panel on the right, and a floating dock (live stats, ask field, chips) with the conversation peeking above it. Phone: the network is the header, the conversation is the page, and details open as a bottom sheet |
| `css/app.css` | Near-black, flat and quiet: dark panels with hairline edges and small radii, no dot grid and no glows. The wordmark stands alone in the top bar (centred on phones). The composer is a flat well; its gold edge light only runs round it while ORION works. The phone layout is a quick-use version: logo, orbit and voice line, a short note, ask. Gold, cream and off-white only; coral for anything that needs you. Geist for UI, Geist Mono for data. Apple-style materials and motion |
| `js/graph.js` | The network. ORION is the hub; each tool is joined to him by a tapered beam of light, with its skills and recent calls around it. A tool in use flares, its beam brightens, and light runs out (request) and back (result). Drag to pan, wheel or pinch to zoom. Also exports `drawHub` for the flow view |
| `js/lab.js` | Colour lab for trying palettes on the live UI: add `?lab` to the URL. Presets plus an accent wheel and a background wheel; it recolours every gold (canvases included) with one filter, so it's for choosing, not shipping. Copy palette gives the hexes |
| `js/orbit.js` | ORION on desktop and phone, drawn flat on a canvas: a gold disc inside thick concentric bands, one per tool. No gradients, glow or orbiting. A tool in use turns its band solid gold; when ORION talks (voice level, or reply text streaming in via `talk()`) one soft ripple runs out through the bands; thinking makes the disc breathe. Hover a band for its name (tooltip); tap a band or the disc for the detail panel. On desktop it's centred on the ORION page and shrinks into a column on the left while chatting. The old network (`graph.js`) is still loaded but hidden and paused |
| `js/business.js` | The business page (`#/business`): Ciel's KPIs with deltas and sparklines, revenue per day with a crosshair, orders per day, the store funnel, campaign cost per sale, top products and latest orders, scoped by a 7/14/30-day range |
| `js/logo.js` | The ORION wordmark: clean geometric letters, each drawn as three fine gold threads that part and cross. `node tools/make_logo.mjs` writes `icons/orion-logo.svg` and `icons/orion-logo-dark.svg` |
| `js/intro.js` | The opening: gold threads draw ORION; as the full name unfolds ("Orchestrated Reasoning & Intelligent Operations Network") each thread letter turns solid. On wide screens it unfolds along one line; on phones the capitals slide into a stacked column, one word per line. Then the words fade and the five capitals fly to their places in the top-bar logo, turning back into threads as they land. Once per browser session; tap the logo or add `?intro` to replay; click or any key skips |
| `js/leo-client.js` | **The one seam to ORION.** `RealLeoClient` speaks [ORION-PROTOCOL.md](ORION-PROTOCOL.md) over a WebSocket once a server is set; otherwise `MockLeoClient`, a fake always-on agent, runs the demo |
| `js/app.js` | Chat feed, hands-free voice, approvals dropdown (with undo), swipe-up sheet (Activity / Tasks / Ciel / Vitals), push-style banners |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app setup |

### Pages

- `#/` ORION: the network, his status cards in the dock, and a plain-text "Hello sir, while you were gone…" summary on the right.
- `#/chat` Conversation: sending a message from anywhere opens it. The network pours into a column of tools on the left, the light swings upright behind it, your words fly from the composer into the feed, and the reply gets the full width. Escape or "‹ ORION" goes back.
- `#/business` Ciel's numbers (sample data until ORION's Shopify and Meta tools are connected).

## Run locally

```bash
python3 -m http.server 8840
```

Then open http://localhost:8840.

## Demo mode

Until a server is connected, everything is fake. The demo shows:

- **Chat.** Keywords route to different behaviour: "ads/sales" → Ciel check, "research" → web search, "plan" → tasks, "GPU" → vitals.
- **Background work.** Every 20 to 40 seconds the mock ORION runs a job by itself (orders, ads, research, file cleanup). Some of those jobs end with an approval and a banner.
- **Voice.** The demo uses the browser's speech recognition and voice as stand-ins. When those aren't available, it plays a scripted conversation instead. In production, the mic audio streams to ORION, Whisper transcribes it, and Kokoro speaks the reply.

## Connecting the real ORION

The UI is done; ORION's side is one WebSocket server. **[ORION-PROTOCOL.md](ORION-PROTOCOL.md)** is the full brief: transport (wss over Tailscale), the token handshake, every command and event, and an acceptance checklist. `tools/orion-server-example.mjs` is a working stand-in server with no dependencies:

```bash
ORION_TOKEN=dev-token node tools/orion-server-example.mjs
```

Then open http://localhost:8840/?server=ws://localhost:8765&token=dev-token

To point a phone or browser at the real ORION, open the live site once with `?server=wss://<machine>.<tailnet>.ts.net&token=<TOKEN>`. It's saved in that browser. `?demo` goes back to demo data.

## Deploy

Live at **https://landon358.github.io/orion/** (GitHub Pages, from `main`, repo root). Push to `main` and it redeploys. When you change files, bump `VERSION` in `sw.js` so installed copies update.
