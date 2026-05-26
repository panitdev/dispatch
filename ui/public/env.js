// Stub loaded by all deployments.
// For Docker: overwritten by docker-entrypoint.sh at container start.
// For Cloudflare Workers: SSR inline script in <head> sets the real values after this.
window.__ENV__ = window.__ENV__ || {};
