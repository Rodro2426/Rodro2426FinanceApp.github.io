// A bank's logo from its website: Google's site-icon service turns a domain into its icon. Only the domain is sent.
// shortcut: we save the icon's web address (Google doesn't allow copying the image into the app), so it needs internet the
// first time a phone shows it; upgrade to a stored copy if a CORS-friendly logo service with the same quality turns up.

/** "https://www.Davivienda.com/personas" → "davivienda.com"; null if it doesn't look like a website. */
export function siteHost(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const host = new URL(t.includes('://') ? t : `https://${t}`).hostname.toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch { return null; }
}

export const logoUrl = (host: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;

/** The logo's address, or null if the site has none (Google then sends back a tiny globe). */
export function findLogo(text: string): Promise<string | null> {
  const host = siteHost(text);
  if (!host) return Promise.resolve(null);
  const url = logoUrl(host);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth >= 32 ? url : null);
    img.onerror = () => res(null);
    img.src = url;
  });
}
