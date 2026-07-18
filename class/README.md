# FlowBoard (MVP)

A lightweight, single-file web app for teachers to save the sites they use in
class, arrange them into a **Flow** (a lesson's running order), and **Run**
that Flow step by step on class day.

No sign-up, no server, no database — everything is stored in the browser's
`localStorage`, per the MVP spec.

## Concepts

| Term  | Meaning |
|-------|---------|
| Link  | A saved site (name, URL, category, description) |
| Flow  | One lesson's plan: a list of Steps, plus Setup links |
| Setup | Links to open before class starts (logins, today's slides, etc.) |
| Step  | One point in the lesson, tied to a Link |
| Run   | The full-screen mode used to execute a Flow in front of the class |

## Files

- `index.html` — the entire app (HTML + CSS + JS in one file)

## Run it locally

Just open `index.html` in any modern browser. No build step, no dependencies
to install.

## Deploy to GitHub Pages

1. Create a new GitHub repo and push `index.html` to it (at the repo root,
   or inside a `/docs` folder — your choice).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch",
   pick your branch, and the folder (`/` or `/docs`).
4. Save. GitHub will give you a URL like
   `https://<username>.github.io/<repo>/` within a minute or two.

## Deploy to Netlify

1. Drag the folder containing `index.html` onto
   [app.netlify.com/drop](https://app.netlify.com/drop) — that's it, no
   config needed.
   - Or connect the GitHub repo in Netlify and set the publish directory to
     the folder containing `index.html` (build command: none).

## Run Mode: floating popup window

Clicking **Run** opens Run Mode in its own small pop-up window, docked to
the top-left of the screen (420px wide, full screen height), instead of
taking over the main FlowBoard tab. That way it stays visible on screen
while the sites you open for each step take over the main browser window.
Data (Links, Flows) is shared instantly between the two — they're the
same app, same origin, same `localStorage`.

- **Exit Run** in the pop-up asks for confirmation, then closes that
  pop-up window and leaves the main FlowBoard tab untouched.
- If the browser blocks the pop-up, FlowBoard automatically falls back to
  the old full-screen in-tab Run Mode so nothing breaks — you'll just be
  told to allow pop-ups for the floating window next time.

## Setup: Open All

On the Setup screen at the start of a Run, links can still be opened one
at a time — or click **Open All** to open every Setup link in its own new
tab in one click. (Shown only when a Flow has more than one Setup link.)

## Export a Flow to PDF

Click **Export PDF** on a Flow card or inside the Flow Builder. It
generates a document listing the Flow's Setup links and Steps in order,
with real clickable links, and downloads it as a `.pdf` file. Opening
that PDF in any PDF viewer lets you click straight through to each site —
handy as a printed or shared lesson plan, or as a fallback if FlowBoard
itself isn't open.

- Korean (and other non-Latin) text renders correctly in the PDF — the
  report is drawn with the Noto Sans KR web font and rasterized rather
  than relying on a PDF-builtin font that doesn't support Hangul.
- Multi-page Flows are paginated automatically.
- Requires internet access at export time (loads html2canvas/jsPDF from
  a CDN, and the Noto Sans KR font from Google Fonts).

## Data & privacy notes

- All Links and Flows are saved with `localStorage` **in the current
  browser only**. This survives closing the tab, closing the browser, and
  restarting the computer — it is **not** session-only.
- It is **not** safe against: clearing the browser's cache/site data,
  using a different browser, using a different device, or incognito mode
  (which discards `localStorage` when the window closes).
- To protect against that, use the **Export Backup** / **Import Backup**
  buttons in the sidebar:
  - **Export Backup** downloads a `flowboard-backup-YYYY-MM-DD.json` file
    containing every Link and Flow.
  - **Import Backup** reads that file back in, and lets you choose to
    **merge** it with what's already saved, or **replace** everything
    with the file's contents.
  - This is also how you move data to a new browser or device: export
    from the old one, import into the new one.
- There is no backend, no account system, and nothing is sent to a server
  — matches the MVP scope (no sign-up, no server, no DB, no collaboration).

## What's intentionally out of scope (per the spec)

Sign-up/accounts, a backend/database, real-time collaboration, comments,
student accounts, and general LMS features are all excluded — the whole
point of this MVP is "run a prepared sequence of sites in order," not
"manage a classroom."

## Natural next steps (not built, for later)

- Import from browser bookmarks (export bookmarks HTML → parse → pick
  which to add) — considered and left out for now; it's an onboarding
  convenience, not core to the MVP, and adds real parsing complexity
- Drag-and-drop step reordering (currently uses ↑ / ↓ buttons)
- Per-step timers or notes visible only during Run
- Keyboard shortcuts in Run Mode (e.g. arrow keys for next/previous step)
