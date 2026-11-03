/** Opens the file picker and resolves to a 200×200 center-cropped JPEG data URL. */
export function pickPhoto(): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return resolve(null);
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const S = 200, c = document.createElement('canvas');
          c.width = S; c.height = S;
          const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
          c.getContext('2d')!.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(null);
        img.src = String(rd.result);
      };
      rd.readAsDataURL(f);
    };
    input.click();
  });
}
