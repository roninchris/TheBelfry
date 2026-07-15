/*
 * Emscripten wrapper exposing OutGuess 0.2's extraction path as a small C API, so the JS/TS side
 * can call a single function instead of driving outguess's CLI (main() in outguess.c parses argv
 * and calls exit() on error, which we don't want in a library build).
 *
 * Build approach (see ../build.sh):
 *   - Compiled together with the unmodified upstream sources in ../vendor/outguess-src (arc.c,
 *     iterator.c, outguess.c, jpg.c, golay.c, md5.c, err.c) and the plain libjpeg 6b library object
 *     files from ../vendor/outguess-src/jpeg-6b-steg (NOT the cjpeg/djpeg/jpegtran CLI files).
 *   - outguess.c's own main() is left in the link (harmless — it's simply never called; we don't
 *     pass -sINVOKE_RUN, and the file's `main` symbol isn't in EXPORTED_FUNCTIONS).
 *   - Input file bytes are written to Emscripten's MEMFS by the JS side (FS.writeFile) before
 *     calling wasm_outguess_extract(), so jpg.c's read_JPEG_file(FILE*) works completely unchanged
 *     via a normal fopen() — no need to patch libjpeg's file I/O for in-memory buffers.
 *
 * Verified against the canonical Cicada 3301 sample (boxentriq.com/samples/outguess-sample.jpg,
 * empty passphrase): decodes to the expected 535-byte "Here is a book code..." plaintext,
 * bit-for-bit matching boxentriq's own emcc-compiled outguess.wasm.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>

#include "outguess.h"
#include "arc.h"
#include "iterator.h"
#include "pnm.h"
#include "jpg.h"

/* jpg.c's format handler (declared `extern handler jpg_handler;` in jpg.h). */

/*
 * Extracts an OutGuess payload from the JPEG at `inputPath` (write it there via FS.writeFile first)
 * using `key`/`keylen`. Callers must pass outguess's own CLI default key, the literal bytes
 * "Default key" (11 bytes, no NUL), when the user hasn't supplied a passphrase — outguess.c's
 * main() declares `char *key = "Default key"` and only overwrites it if `-k` is given, so an
 * empty/no passphrase is NOT the same as an empty key. Getting this wrong silently produces
 * "implausible header" failures even on valid files (this cost real debugging time — verified via
 * a working extraction only once "Default key" was tried in place of "").
 *
 * On success, *outLen is set and the return value is a malloc'd buffer the caller must free with
 * wasm_outguess_free(). Returns NULL on unreadable-JPEG failure.
 *
 * IMPORTANT — steg_retrieve()/decode_data() inside outguess.c call exit(1) directly on malformed
 * input (wrong passphrase, no embedded payload, corrupt header) rather than returning an error —
 * this is upstream, unmodified behavior, not something introduced here. Emscripten turns exit()
 * into a thrown JS `ExitStatus` exception that unwinds out of the ccall boundary (confirmed safe to
 * catch in JS), but the module instance's internal state after that point is not guaranteed usable
 * for a second call. Callers MUST instantiate a fresh module per extraction attempt rather than
 * reusing one across calls — see outguessWasm.ts.
 */
unsigned char *wasm_outguess_extract(const char *inputPath, const unsigned char *key, int keylen, int *outLen) {
	FILE *fin = fopen(inputPath, "rb");
	if (!fin) {
		*outLen = 0;
		return NULL;
	}

	image *img = jpg_handler.read(fin);
	fclose(fin);
	if (!img) {
		*outLen = 0;
		return NULL;
	}

	bitmap bmap;
	jpg_handler.get_bitmap(&bmap, img, STEG_RETRIEVE);

	struct arc4_stream as, tas;
	iterator iter;
	int len = 0;

	arc4_initkey(&as, "Encryption", (u_char *)key, keylen);
	/*
	 * outguess.c's main() takes this snapshot right after arc4_initkey, before steg_retrieve()
	 * consumes keystream bytes from `as` to decode the 4-byte header — decode_data() below must
	 * start from the pre-header state (`tas`), not the state `as` is left in after steg_retrieve.
	 */
	tas = as;
	iterator_init(&iter, &bmap, (u_char *)key, keylen);

	char *encdata = steg_retrieve(&len, &bmap, &iter, &as, 0 /* flags: no ECC by default */);
	if (!encdata) {
		*outLen = 0;
		return NULL;
	}

	int declen = len;
	unsigned char *data = decode_data((u_char *)encdata, &declen, &tas, 0);
	free(encdata);

	*outLen = declen;
	return data;
}

void wasm_outguess_free(void *ptr) {
	free(ptr);
}
