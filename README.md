# The Belfry

A Batcomputer-styled cryptanalysis and digital-forensics workbench — 70+ analysis
tools, an image/audio steganography lab, a tactical map, and a realtime
**multiplayer evidence board** where several analysts pin, connect, and drag
evidence on a shared corkboard at the same time.

Built as a CTF and puzzle-solving companion, wrapped in an Arkham-inspired
tactical HUD.

> Runs fully offline and zero-config out of the box. Multiplayer is opt-in and
> requires **your own** Supabase project — see [Multiplayer setup](#multiplayer-setup-optional).

---

## Features

### Crypto Lab — 50 classical & modern ciphers
Caesar, Vigenère (+ autokey), Beaufort, Playfair, Hill, ADFGVX, Bifid, Enigma,
Nihilist, Four-square, Homophonic, One-time pad, Pigpen, Dancing Men, Cicada,
Gematria, plus modern AES, DES, Blowfish, and RC4. Most support both directions,
and many support keyless brute-force with automatic scoring.

### Encoding Deck — 18 encodings
Base32/58/62/64/85/100, hex, binary, ASCII, Morse, Braille, Baudot, Tap code,
Phone keypad, Pig Latin, Geek code, URL.

### Identify — "I have no idea what this is"
Paste unknown ciphertext and the identifier ranks likely candidates using
Shannon entropy, index of coincidence, cipher-family detection, frequency
analysis, and pattern matching — then routes you straight to the right tool.

### Image Forensics
LSB/jsteg extraction, steghide, OutGuess (compiled to WebAssembly from vendored
upstream C), stegdetect, chi-square steganalysis, C2PA provenance inspection,
barcode/QR scanning, and stereogram decoding.

### Audio Forensics
Spectrogram rendering to surface data hidden in the frequency domain, plus
waveform and channel analysis.

### File Analysis
Magic-byte identification, embedded-file carving, entropy mapping, and string
extraction.

### Signal Chain
A CyberChef-style pipeline — stack operations and feed each result into the
next, with live output at every stage.

### Tactical Map
A MapLibre GL surface with radar sweep, coordinate parsing in decimal degrees,
DMS, and DDM, and forward/reverse geocoding. Uses keyless open services (OpenFreeMap tiles, OSM
Nominatim) — no API keys, no accounts.

### Multiplayer Evidence Board
The centrepiece. A shared corkboard for pinning evidence, drawing red-string
connections between nodes, and working a case as a team:

- **Live sync** — nodes, edges, and case state replicate to every connected
  analyst via Supabase Realtime `postgres_changes`.
- **Smooth drag** — in-flight drag positions travel over an ephemeral
  `broadcast` channel (throttled) so you see teammates moving cards in real
  time, without writing a row per frame. Only the final position is persisted.
- **Presence** — see who is currently on the board.
- **Attribution sigils** — each analyst gets an identity colour and sigil, so
  every pinned item shows who added it.
- **Private evidence images** — images live in a private Storage bucket, and
  the board stores only an object path, resolved to a short-lived signed URL at
  render time.

Guests get the same board, stored locally in their own browser — it never
touches a network.

### Also
Three runtime themes (cyan / crimson / violet), a full sound-design layer, an
ambient telemetry background, and a searchable tool database.

---

## Quick start

```bash
git clone https://github.com/roninchris/thebelfry
cd thebelfry
npm install
npm run dev
```

Open <http://localhost:3000>.

That is the whole setup. With no `.env`, the app runs **guest-only**: every
tool works, and your evidence board is stored locally in your browser. No
account, no network, no configuration.

| Script | |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

---

## Multiplayer setup (optional)

The shared board needs a Supabase project. **Use your own** — this repo ships no
database credentials, and the maintainer's instance is private and not
available to forks. A free Supabase tier is plenty.

1. Create a project at [supabase.com](https://supabase.com).

2. **Disable signups** — Dashboard → Authentication → Providers → Email → turn
   off "Enable sign-ups". Accounts are provisioned by hand; this is the first
   line of defence.

3. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It
   creates the tables, the RLS policies, and the Realtime publication. It is
   idempotent — safe to re-run.

4. Create a **private** bucket named `evidence` (Dashboard → Storage → New
   bucket, Public **off**), then run [`supabase/storage.sql`](supabase/storage.sql).

5. Create your analyst accounts by hand (Authentication → Users → Add user),
   then map each one to a callsign in the `knights` table — see the seed block
   at the bottom of `schema.sql`.

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

- The `VITE_` values are compiled into the JavaScript bundle and are **public by
  design**. Anyone can read them via View Source. That is fine.
- The anon key is **not** the security boundary. The boundary is: signups
  disabled, Row Level Security granting the `anon` role *nothing*, and an
  authenticated user still getting nothing unless you added them to the
  `knights` table by hand.
- **Never** put a `service_role` key in a `VITE_` variable, or anywhere in
  `src/`. It bypasses RLS entirely.
- Guests never authenticate, and a guest session never constructs a
  network-capable storage backend at all — the separation is structural, not a
  check that could be forgotten at a call site.

---

## Tech stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Zustand · Motion ·
MapLibre GL · Recharts · Supabase (auth, Postgres, Realtime, Storage) ·
WebAssembly (OutGuess)

## Project layout

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
```

---

## License

MIT © 2026 roninchris — see [LICENSE](LICENSE).

The vendored OutGuess source under `tools/outguess-wasm/vendor/` is **not** MIT;
it remains under its original BSD-style and IJG terms, with upstream copyright
notices retained in each file. See the LICENSE file for details.

The Belfry is an unaffiliated fan project. Batman and associated marks are
trademarks of DC Comics; no affiliation or endorsement is implied, and no
DC-owned artwork is distributed here.
