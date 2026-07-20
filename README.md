<div align="center">

<img src="docs/belfry_icon_readme.png" width="110" alt="The Belfry">

# The Belfry

**A Batcomputer-styled cryptanalysis and digital-forensics workbench.**

71 analysis modules · image & audio steganography · tactical map ·
a realtime **multiplayer evidence board**

[![License: MIT](https://img.shields.io/badge/License-MIT-00f3ff?style=flat-square)](LICENSE)
![React 19](https://img.shields.io/badge/React-19-70a2a8?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-70a2a8?style=flat-square)
![Vite 6](https://img.shields.io/badge/Vite-6-70a2a8?style=flat-square)
![WebAssembly](https://img.shields.io/badge/WebAssembly-OutGuess-70a2a8?style=flat-square)
![Runs offline](https://img.shields.io/badge/runs-offline%20%2F%20zero%20config-2fffa8?style=flat-square)

<img src="docs/loading.png" width="100%" alt="The Belfry boot sequence — a dot-matrix belfry mark resolving out of noise">

</div>

---

Drop in a file or paste something unreadable. The Belfry tells you what it is,
hands you the tool that cracks it, and lets you pin the result to a corkboard
your whole team is standing around — live.

Built as a CTF and puzzle-solving companion, wrapped in an Arkham-inspired
tactical HUD.

> **Zero-config.** Clone, `npm install`, `npm run dev`. Every tool works offline
> with no account and no network. Multiplayer is opt-in and uses **your own**
> Supabase project.

---

## The multiplayer evidence board

The centrepiece. A shared corkboard where several analysts pin evidence, draw
connections between clues, and work a case together in real time.

![The evidence board — note, photo, link and file cards connected by tracked links, each tagged with the sigil of the analyst who added it](docs/multiplayerboard.png)

Every card carries the **sigil of the analyst who pinned it**, so attribution is
visible at a glance. Cards can hold notes, photos, links, or carved data files.

Two channels do the work, and the split is the interesting part:

```mermaid
flowchart LR
    A["Analyst A"] -->|"drag in flight"| B["broadcast<br/>ephemeral · throttled"]
    A -->|"drop · add · link"| C["postgres_changes<br/>durable · RLS-gated"]
    B --> D["Analysts B · C · D"]
    C --> E[("Postgres")]
    E --> D
    F["presence"] --- D
```

- **Durable state** — nodes, links, and case status go through Postgres and
  replicate via `postgres_changes`. Realtime honours RLS, so a non-knight
  receives nothing.
- **In-flight drag** — dragging a card would otherwise write a row per frame.
  Positions travel over an ephemeral `broadcast` channel instead, throttled, and
  only the final position is persisted. Teammates see cards move smoothly; the
  database never sees the intermediate frames.
- **Presence** — who is currently on the board.
- **Private evidence images** — a multi-MB data URL exceeds Realtime's payload
  limit and comes back truncated. Images live in a private Storage bucket; the
  board stores only an object path and resolves it to a short-lived signed URL
  at render time.

**Guests get the same board**, stored in their own browser. A guest session never
constructs a network-capable backend at all — the separation is structural, not a
check that could be forgotten at a call site.

---

## Identify → crack

You rarely know what you're holding. Paste it in and the identifier ranks
candidates on Shannon entropy, index of coincidence, chi-squared per letter,
cipher-family detection, and pattern matching — then routes you to the tool that
solves it.

![Auto-crack sweeping all 71 decoders against an unknown stream and recovering the plaintext](docs/autocrack.png)

The ranking has opinions:

- **A claim must survive its own decode.** A cipher that scores well
  statistically but produces gibberish gets demoted — otherwise junk top-results
  mask the correct family classifier underneath.
- **Length-independent scoring.** Chi-squared is a sum over letters, so it grows
  with input length. Confidence uses chi *per letter* plus best-vs-runner-up
  separation, or a long sentence would score zero on a cipher it had already
  solved correctly.
- **Family fallback.** When the exact cipher is unclear, it still narrows to
  transposition / monoalphabetic / polyalphabetic — index of coincidence alone
  cannot separate those, but pairing it with chi-squared can.

<img src="docs/crypto.png" width="49%" align="top" alt="The Codex — plaintext encrypted to ciphertext"> <img src="docs/database.png" width="49%" align="top" alt="Tool database — all 71 modules with searchable metadata">

---

## The modules

### Encoding Deck

One buffer, demultiplexed into every encoding at once — hex, Base64, Base32,
binary, ASCII decimal, Morse and more, each on its own channel. The **source
signature** panel reads the live buffer and reports entropy, character-class
composition, alphabet fit, and which formats its shape matches.

![Encoding Deck — a buffer broken out into simultaneous hex, Base64, Base32, binary, decimal and Morse channels](docs/encoding.png)

### Image Forensics

LSB/jsteg extraction, steghide, **OutGuess compiled to WebAssembly** from
vendored upstream C, stegdetect, chi-square steganalysis, C2PA provenance, EXIF,
QR/barcode scanning, and autostereogram ("magic eye") depth reconstruction.
Everything runs **on device** — no upload.

![Image forensics — carrier signature entropy per channel, and an autostereogram depth map reconstructed from noise](docs/imageanalysis.png)

### File Analysis

Magic-byte identification, embedded-file carving, string extraction, and a hex
dump that decodes in place as the scan walks it. The entropy map applies
**finite-sample bias correction**, so a few hundred bytes don't read as
low-entropy purely because they cannot fill 256 bins.

![File analysis — hex sector map, declared vs detected structure, and byte-value entropy distribution](docs/fileanalysis.png)

### Audio Forensics

Waveform, spectrogram, and MIDI views to surface data hidden in the frequency
domain — the usual home of tones, SSTV, and spectrogram art.

![Audio forensics — time-domain waveform display with filter profile and playback controls](docs/soundwave.png)

### Tactical Map

MapLibre GL with a radar sweep, coordinate parsing (decimal degrees, DMS, DDM),
and forward/reverse geocoding. Keyless services only — OpenFreeMap tiles and OSM
Nominatim, so no API keys and no accounts.

**The map never requests your location.** It plots only what you type or relay
to it.

![Tactical map — a 3D vector city plane with sector sweep and target register](docs/map.png)

### Everything else

| | |
|---|---|
| **The Codex** | 52 ciphers — Caesar, Vigenère (+autokey), Beaufort, Playfair, Hill, ADFGVX, Bifid, Enigma, Nihilist, Four-square, Homophonic, One-time pad, Pigpen, Dancing Men, Cicada, Gematria, Elder Futhark, plus AES, DES, Blowfish, RC4. Most are bidirectional; many brute-force keylessly with scoring. |
| **Encoding Deck** | 17 encodings — Base32/58/62/64/85/100, hex, binary, ASCII, Morse, Braille, Baudot, Tap code, Phone keypad, Pig Latin, Geek code, URL. |
| **Signal Chain** | A CyberChef-style pipeline. Stack operations, feed each result into the next, and read the real output at every stage. |
| **Tool Database** | Searchable registry of all 71 modules with live parameter schemas. |
| **Dossier & Case Files** | Register cases, track threat level, and carry evidence between modules. |

### Themes

Three runtime themes, applied instantly and persisted per device.

![Display profile — Detective, WayneTech and Nightfall theme options](docs/themes.png)

Every colour in the app resolves through CSS custom properties, so a theme swap
retints the entire console — including canvas-drawn visuals, which read their
colours off the document rather than hardcoding them.

---

## Quick start

```bash
git clone https://github.com/roninchris/thebelfry
cd thebelfry
npm install
npm run dev
```

Open <http://localhost:3000>. That's the whole setup.

With no `.env`, the app runs **guest-only**: every tool works and your board is
stored locally in your browser. No account, no network, no configuration. That is
the correct setup for a fork or a public demo.

| Script | |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

---

## Multiplayer setup (optional)

The shared board needs a Supabase project. **Use your own** — this repo ships no
database credentials, and the maintainer's instance is private. A free tier is
plenty.

1. Create a project at [supabase.com](https://supabase.com).

2. **Disable signups** — Dashboard → Authentication → Providers → Email → turn
   off *Enable sign-ups*. Accounts are provisioned by hand; this is the first
   line of defence.

3. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It creates
   the tables, the RLS policies, and the Realtime publication. Idempotent — safe
   to re-run.

4. Create a **private** bucket named `evidence` (Storage → New bucket, Public
   **off**), then run [`supabase/storage.sql`](supabase/storage.sql).

5. Add your analyst accounts by hand (Authentication → Users → Add user), then
   map each to a callsign in the `knights` table — see the seed block at the
   bottom of `schema.sql`.

6. Point the app at your project:

   ```bash
   cp .env.example .env
   ```

   ```ini
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

### Security model

Worth stating plainly, because the anon key confuses people:

- The `VITE_` values are **compiled into the JavaScript bundle and are public by
  design**. Anyone can read them via View Source. That is fine.
- The anon key is **not** the security boundary. The boundary is: signups
  disabled, RLS granting the `anon` role *nothing*, and an authenticated user
  still getting nothing unless you added them to the `knights` table by hand.
- **Never** put a `service_role` key in a `VITE_` variable or anywhere in `src/`.
  It bypasses RLS entirely and would be readable by every visitor.
- Guests never authenticate, and their board never leaves their browser.

---

## Architecture

```mermaid
flowchart TD
    UI["features/ — one directory per module"] --> S["store/ — Zustand"]
    UI --> T["lib/tools/ — analysis engines"]
    T --> REG["registry.ts — 71 modules, live schemas"]
    S --> ST["lib/storage/ — storageFor(identity)"]
    ST -->|"guest"| L["LocalBoardStorage<br/>browser only"]
    ST -->|"knight"| SB["SupabaseBoardStorage<br/>Realtime + RLS"]
```

```
src/
  features/     one directory per module (crypto, map, detective-board, …)
  lib/
    tools/      the analysis engines — ciphers, encodings, stego, identify
    storage/    board backends: local vs Supabase, chosen by session identity
    geo/        coordinate parsing, geocoding, map style
  components/   shared UI and layout
  store/        Zustand app store
supabase/       schema.sql and storage.sql — run these in your own project
tools/          vendored OutGuess C source and its WASM build
docs/           README screenshots
```

**Tech stack** — React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Zustand ·
Motion · MapLibre GL · Recharts · Supabase (auth, Postgres, Realtime, Storage) ·
WebAssembly

Analysis runs **entirely in the browser**. Files are never uploaded; the only
network traffic is board sync and map tiles.

---

## Contributing

Issues and pull requests are welcome. Two house rules keep the UI coherent:

- **Never write a raw colour.** Everything resolves through the theme variables
  in `src/index.css`, or the runtime themes silently break.
- **Ambient visuals are per-module, not shared.** Each module gets its own idle
  state rather than reusing another's.

Run `npm run lint` before opening a PR.

---

## License

**MIT © 2026 roninchris** — see [LICENSE](LICENSE).

The vendored OutGuess source under `tools/outguess-wasm/vendor/` is **not** MIT.
It remains under its original BSD-style and IJG terms, with upstream copyright
notices retained in each file.

The Belfry is an unaffiliated fan project. Batman and associated marks are
trademarks of DC Comics; no affiliation or endorsement is implied, and no
DC-owned artwork is distributed in this repository.
