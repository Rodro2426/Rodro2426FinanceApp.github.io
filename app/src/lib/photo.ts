import { requestCrop } from '../ui/Cropper';

/**
 * Opens the file picker, then the move-and-scale editor. Resolves to the edited
 * 400×400 image as a data URL, or null if cancelled.
 */
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
        // Shrink very large photos first so editing stays smooth and storage small.
        const img = new Image();
        img.onload = () => {
          const MAX = 1600, k = Math.min(1, MAX / Math.max(img.width, img.height));
          let src = String(rd.result);
          if (k < 1) {
            const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
            src = c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
          }
          requestCrop(src).then(resolve);
        };
        img.onerror = () => resolve(null);
        img.src = String(rd.result);
      };
      rd.readAsDataURL(f);
    };
    input.click();
  });
}
