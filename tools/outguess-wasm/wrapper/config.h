/*
 * Hand-written stand-in for the config.h that outguess's `autogen.sh && ./configure` normally
 * generates from configure.ac (there is no config.h in the upstream tree — it's a build product).
 * Derived from configure.ac's checks (AC_CHECK_HEADERS / AC_CHECK_FUNCS), reasoned about against
 * Emscripten's libc rather than verified by actually running configure under emcc — confirm each
 * of these against a real build log before trusting them.
 *
 * Put this on the include path *before* vendor/outguess-src so `#include "config.h"` in arc.c,
 * iterator.c, jpg.c, md5.c, outguess.c, and pnm.c resolves here (see build.sh's -I order).
 */
#ifndef _OUTGUESS_WASM_CONFIG_H
#define _OUTGUESS_WASM_CONFIG_H

#define HAVE_FCNTL_H 1
#define HAVE_NETINET_IN_H 1   /* htonl/ntohl, used by outguess.c's -extract path */
#define HAVE_STDDEF_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRING_H 1
#define HAVE_STRINGS_H 1
#define HAVE_UNISTD_H 1

/* Emscripten's libc doesn't ship a Linux-glibc-style malloc.h; leave this undefined. */
/* #undef HAVE_MALLOC_H */

#define HAVE_MEMMOVE 1
#define HAVE_MEMSET 1
#define HAVE_SQRT 1
#define HAVE_STRCASECMP 1
#define HAVE_STRCHR 1
#define HAVE_STRERROR 1
#define HAVE_STRRCHR 1

/*
 * munmap: outguess.c only calls it inside munmap_file(), used by the CLI's do_embed() path (never
 * reached by wasm_outguess_extract's retrieve-only flow) — Emscripten's libc does export a munmap
 * stub, so leaving this defined should be harmless either way.
 */
#define HAVE_MUNMAP 1

/*
 * Neither MD5Update (BSD's libmd) nor warnx (BSD's err.h) exist in Emscripten's libc, so outguess
 * falls back to its own bundled md5.c/err.c implementations — both are already in build.sh's
 * OUTGUESS_FILES list. Leave these undefined.
 */
/* #undef HAVE_MD5UPDATE */
/* #undef WARNX */

#endif /* _OUTGUESS_WASM_CONFIG_H */
