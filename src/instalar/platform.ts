export function storeForDevice(userAgent: string, maxTouchPoints = 0): 'ios' | 'android' | null {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return null;
}
