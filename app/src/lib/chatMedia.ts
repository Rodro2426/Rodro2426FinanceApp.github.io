// Photos and GIFs for trip chats.
// Photos are shrunk on the phone before sending: a small preview travels with the message, and the full photo
// (about 1600px, under ~700 KB) is stored separately and only downloaded when someone opens it.
// Firebase's free plan has no file storage, so both live in Firestore as compressed images.

export interface Shrunk { data: string; w: number; h: number }

async function bitmapOf(file: Blob): Promise<{ img: CanvasImageSource; w: number; h: number }> {
  try {
    const b = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { img: b, w: b.width, h: b.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      return { img, w: img.naturalWidth, h: img.naturalHeight };
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}

/** Longest side at most `side` px, JPEG, quality lowered until it fits in `maxChars` characters. */
export async function shrink(file: Blob, side: number, maxChars: number): Promise<Shrunk> {
  const { img, w, h } = await bitmapOf(file);
  let k = Math.min(1, side / Math.max(w, h));
  for (let round = 0; round < 6; round++) {
    const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.drawImage(img, 0, 0, cw, ch);
    for (const q of [0.82, 0.72, 0.62, 0.5]) {
      const data = c.toDataURL('image/jpeg', q);
      if (data.length <= maxChars) return { data, w: cw, h: ch };
    }
    k *= 0.75;
  }
  throw new Error("That photo couldn't be made small enough to send.");
}

export const FULL_MAX = 900_000, THUMB_MAX = 45_000, GIF_FILE_MAX = 420_000;

/** A photo ready to send: the full image and the small preview shown in the chat. */
export async function prepPhoto(file: File): Promise<{ full: Shrunk; thumb: Shrunk }> {
  const [full, thumb] = await Promise.all([shrink(file, 1600, FULL_MAX), shrink(file, 480, THUMB_MAX)]);
  return { full, thumb };
}

/** A small animated GIF file from the phone, sent as is so it keeps moving. */
export async function prepGifFile(file: File): Promise<Shrunk> {
  const data = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(file); });
  if (data.length > GIF_FILE_MAX) throw new Error('That GIF is too big to send (about 300 KB at most). Search GIFs instead.');
  const { w, h } = await bitmapOf(file);
  return { data, w, h };
}

/* ---------------- GIF search (GIPHY) ---------------- */
// A GIPHY key is free (developers.giphy.com). Put one here to turn GIF search on for everyone, or add your own in the GIF panel.
export const GIPHY_KEY = '';
export interface GifHit { id: string; url: string; w: number; h: number; preview: string; pw: number; ph: number; big: string }

export async function searchGifs(key: string, q: string): Promise<GifHit[]> {
  const base = 'https://api.giphy.com/v1/gifs/';
  const url = q.trim() ? `${base}search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q.trim())}&limit=30&rating=pg-13&lang=es` : `${base}trending?api_key=${encodeURIComponent(key)}&limit=30&rating=pg-13`;
  const r = await fetch(url);
  if (r.status === 401 || r.status === 403) throw new Error('GIPHY didn\'t accept that key.');
  if (r.status === 429) throw new Error('Too many GIF searches this hour. Try again in a bit.');
  if (!r.ok) throw new Error('GIF search is not available right now.');
  const j = await r.json() as { data: { id: string; images: Record<string, { url: string; width: string; height: string }> }[] };
  return j.data.map(g => {
    const fw = g.images.fixed_width, sm = g.images.fixed_height_small ?? fw, big = g.images.downsized ?? fw;
    return { id: g.id, url: fw.url, w: +fw.width, h: +fw.height, preview: sm.url, pw: +sm.width, ph: +sm.height, big: big.url };
  }).filter(g => g.url && g.w && g.h);
}

/** Size of a chat bubble image: at most 240 wide and 300 tall, keeping its shape. */
export function bubbleSize(w: number, h: number, maxW = 240, maxH = 300) {
  const k = Math.min(maxW / w, maxH / h, 1.6);
  return { width: Math.round(w * k), height: Math.round(h * k) };
}
