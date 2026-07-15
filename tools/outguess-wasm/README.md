# OutGuess WASM build

## Status: built and verified

A real Emscripten build of the reference OutGuess 0.2 C source, wired into the app as the primary
extractor at `src/lib/tools/image-stego/outguessWasm.ts` (with the pure-TS reimplementation in
`outguess.ts` kept as a fallback for environments where the wasm asset can't load).

Verified against the canonical Cicada 3301 sample — the same file boxentriq's own OutGuess
extractor uses (`boxentriq.com/samples/outguess-sample.jpg`, empty passphrase) — decoding to the
expected 535-byte plaintext (`"Here is a book code.  To find the book, and more information, go
to http://www.reddit.com/r/a2e7j6ic78h0j/..."`), byte-for-byte matching boxentriq's own
emcc-compiled `outguess.wasm` (confirmed via the literal strings embedded in their binary:
`OutGuess 0.2 Universal Stego (c) 1999-2001 Niels Provos`).

## Why this exists

The pure-TS port in `outguess.ts` was originally written as a from-scratch reimplementation of the
algorithm and, despite passing every isolated unit check (MD5/RC4 test vectors, coefficient counts),
didn't reproduce the real tool's output end-to-end. Two bugs were responsible — both now fixed in
both implementations, but the wasm build exists so the *actual reference C code* runs instead of a
reimplementation that could still diverge on cases the Cicada sample doesn't exercise (Golay ECC,
restart intervals, unusual subsampling, etc.):

1. **Coefficient order.** libjpeg's Huffman decoder de-zigzags coefficients *during* entropy decode
   — each decoded zigzag-order value is stored at its natural raster position — so OutGuess's own
   steg hook (`jdcoefct.c`'s `decompress_onepass`, reading `block[k]` directly) is already reading
   natural order, not zigzag order. `getOutguessCoefficients` in `../../src/lib/tools/image-stego/
   jsteg.ts` previously re-applied a zigzag remap on top of already-natural-order data.
2. **Default key.** `outguess.c`'s CLI declares `char *key = "Default key"` and only overwrites it if
   `-k` is given — an empty/omitted passphrase is NOT an empty key, it's this literal 11-byte string.
   Every file embedded without an explicit passphrase (the common case) needs this exact default.

No existing npm package covers this (`stegger` just shells out to a native Linux binary — unusable
in a browser). Vendoring boxentriq's own compiled `outguess.wasm`/glue JS was deliberately avoided:
it's their build artifact of unclear license/provenance for the JS wrapper, not something to
redistribute. Building fresh from the BSD-licensed upstream C source (this directory) is the clean
path, and it's a genuine build now, not just a scaffold.

## What's here

- `vendor/outguess-src/` — pristine upstream source (`resurrecting-open-source-projects/outguess`,
  `master` branch), including the full patched-libjpeg-6b (`jpeg-6b-steg/`) subtree, BSD-licensed
  (see `vendor/LICENSE`). Unmodified except for adding `jpeg-6b-steg/jconfig.h`, a copy of the
  `jconfig.vc` (MSVC) template, which turned out to need no changes to compile clean under emcc.
- `wrapper/outguess_wasm.c` — new code (not upstream) exposing one C function,
  `wasm_outguess_extract(path, key, keylen, &outLen)`, built by following `outguess.c`'s own
  `doretrieve` branch in `main()` exactly (including the easy-to-miss `tas = as` keystream snapshot
  taken *before* `steg_retrieve()` consumes `as` decoding the header — `decode_data()` on the
  payload needs the pre-header state, not the post-header one).
- `wrapper/config.h` — hand-written stand-in for the `config.h` that `./configure` normally
  generates from `configure.ac` (no autotools needed here — the actual `HAVE_*` requirements are a
  short, boring list, and Emscripten's libc satisfies all but two of them; `md5.c`/`err.c`, already
  vendored, supply the two it doesn't: `MD5Update` and `warnx`).
- `build.sh` — the emcc invocation: which upstream files to compile (library-only libjpeg files,
  excluding the `cjpeg`/`djpeg`/`jpegtran` CLI tools and their format readers/writers, which
  outguess's own `jpg.c` never calls), what to export, and MEMFS-based file I/O (the JS side writes
  the uploaded file to a virtual path with `FS.writeFile` before calling the exported function, so
  `jpg.c`'s `read_JPEG_file(FILE*)` works completely unchanged via a normal `fopen()`).

## Rebuilding

```sh
# 1. Install Emscripten (one-time, ~1GB download)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest && source ./emsdk_env.sh
cd -

# 2. Build
cd tools/outguess-wasm
./build.sh
# -> dist/outguess.js + dist/outguess.wasm

# 3. Deploy
cp dist/outguess.js dist/outguess.wasm ../../public/wasm/
```

`outguessWasm.ts` picks up `public/wasm/outguess.{js,wasm}` automatically — no other wiring needed
after a rebuild.

### Gotcha: don't `import()` the glue script directly

`public/wasm/outguess.js` lives in `public/`, so Vite serves it as-is. A plain
`import("/wasm/outguess.js")` works in a production build but throws in `vite dev` — Vite's dev
server refuses to run its module-transform pipeline on anything under `/public` ("should not be
imported from source code. It can only be referenced via HTML tags"). `outguessWasm.ts` works
around this by `fetch()`-ing the script as text and `import()`-ing it via a `blob:` URL instead,
then passing `locateFile: (path) => `/wasm/${path}`` when instantiating the module so the `.wasm`
binary itself resolves to the real path rather than the blob URL's location.

### Gotcha: `exit(1)` on bad input

`steg_retrieve()`/`decode_data()` inside `outguess.c` call `exit(1)` directly on malformed input
(wrong passphrase, no embedded payload, corrupt header) — unmodified upstream behavior, not
something introduced by this build. Emscripten turns that into a catchable thrown JS exception
(confirmed: a wrong passphrase throws cleanly rather than crashing the tab), but the module
instance's state afterward isn't guaranteed reusable — `outguessWasm.ts` instantiates a fresh module
per extraction call rather than trying to recover a shared one. This has been exercised directly:
a wrong-passphrase call followed immediately by a correct-passphrase call on the same page both
behave correctly.

## Not yet done

- **Only the no-ECC path is wired up.** `outguess -e` (Golay error-correction) embeds are common
  enough in the wild that this is worth adding — the flag is just `STEG_ERROR` threaded through
  `steg_retrieve`/`decode_data`, and `golay.c` is already vendored and in `build.sh`'s file list,
  just needs `init_golay()` called once at startup and the flag wired through the wrapper's
  signature (currently hardcoded to `0` in `outguess_wasm.c`).
- **Only JPEG covers.** OutGuess also supports PNM covers (`pnm.c`, already vendored and in
  `build.sh`). The wrapper only calls `jpg_handler` directly; swapping in `get_handler(path)`'s
  extension-based dispatch (see `outguess.c`'s `handlers[]` table) would cover both for free with a
  small wrapper signature change (pass the original filename, not just raw bytes).
