/**
 * Resolves a `public/` asset path against the deployment's base URL.
 *
 * Files in `public/` are written throughout this codebase as root-absolute
 * paths (`/sounds/CLICK_TAB.mp3`). That is correct when the app is served from
 * the root of a domain, which is how it runs in dev and on Netlify. It breaks
 * on GitHub Pages, where a project site is served from a sub-path
 * (`/thebelfry/`) — every one of those paths would resolve against the domain
 * root and 404, taking every sound and sigil with it.
 *
 * Vite rewrites asset URLs it can see at build time (imports, and references
 * inside index.html), but it cannot rewrite a path that only exists as a string
 * in a map or a JSX `src`. Those have to go through here.
 *
 * `import.meta.env.BASE_URL` is whatever `base` was set to at build time, and
 * always carries a trailing slash.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
