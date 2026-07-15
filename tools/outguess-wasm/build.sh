#!/usr/bin/env bash
# Compiles the vendored OutGuess 0.2 + patched libjpeg 6b sources to WebAssembly via Emscripten.
#
# Prerequisites:
#   1. Install emsdk: https://emscripten.org/docs/getting_started/downloads.html
#      git clone https://github.com/emscripten-core/emsdk.git && cd emsdk
#      ./emsdk install latest && ./emsdk activate latest && source ./emsdk_env.sh
#   2. Run this script from tools/outguess-wasm/: ./build.sh
#
# Verified working: decodes the canonical Cicada 3301 sample (boxentriq.com/samples/
# outguess-sample.jpg) to the expected 535-byte plaintext, byte-for-byte matching boxentriq's own
# emcc-compiled outguess.wasm. See README.md for the two subtle bugs that took real debugging to
# find (natural- vs zigzag-order DCT coefficients, and outguess's "Default key" CLI default).

set -euo pipefail
cd "$(dirname "$0")"

SRC=vendor/outguess-src
JPEG=$SRC/jpeg-6b-steg
OUT=dist

mkdir -p "$OUT"

# Plain libjpeg 6b *library* files only — excludes the standalone CLI tools (cjpeg.c, djpeg.c,
# jpegtran.c, rdjpgcom.c, wrjpgcom.c, ckconfig.c, ansi2knr.c, example.c) and the CLI's own image
# readers/writers (rdbmp/rdgif/rdppm/rdrle/rdtarga/rdcolmap/wrbmp/wrgif/wrppm/wrrle/wrtarga,
# cdjpeg.c, transupp.c) which outguess's own jpg.c never calls.
JPEG_LIB_FILES=(
  jcapimin.c jcapistd.c jccoefct.c jccolor.c jcdctmgr.c jchuff.c jcinit.c jcmainct.c
  jcmarker.c jcmaster.c jcomapi.c jcparam.c jcphuff.c jcprepct.c jcsample.c jctrans.c
  jdapimin.c jdapistd.c jdatadst.c jdatasrc.c jdcoefct.c jdcolor.c jddctmgr.c jdhuff.c
  jdinput.c jdmainct.c jdmarker.c jdmaster.c jdmerge.c jdphuff.c jdpostct.c jdsample.c
  jdtrans.c jerror.c jfdctflt.c jfdctfst.c jfdctint.c jidctflt.c jidctfst.c jidctint.c
  jidctred.c jmemmgr.c jmemnobs.c jquant1.c jquant2.c jutils.c
)

OUTGUESS_FILES=(arc.c iterator.c outguess.c jpg.c golay.c md5.c err.c pnm.c)

SOURCES=()
for f in "${JPEG_LIB_FILES[@]}"; do SOURCES+=("$JPEG/$f"); done
for f in "${OUTGUESS_FILES[@]}"; do SOURCES+=("$SRC/$f"); done
SOURCES+=(wrapper/outguess_wasm.c)

emcc \
  -O2 \
  -I wrapper \
  -I "$JPEG" \
  -I "$SRC" \
  "${SOURCES[@]}" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sEXPORT_NAME=OutguessModule \
  -sEXPORTED_FUNCTIONS='["_wasm_outguess_extract","_wasm_outguess_free","_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["FS","ccall","cwrap","stringToNewUTF8","HEAPU8","HEAP32"]' \
  -sALLOW_MEMORY_GROWTH=1 \
  -sENVIRONMENT=web,worker \
  -sINVOKE_RUN=0 \
  -sFORCE_FILESYSTEM=1 \
  -o "$OUT/outguess.js"

echo
echo "Built: $OUT/outguess.js + $OUT/outguess.wasm"
echo "Copy both into public/wasm/ and wire up src/lib/tools/image-stego/outguessWasm.ts"
