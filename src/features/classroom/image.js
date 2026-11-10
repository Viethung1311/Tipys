/** Keep the original file; the smaller preview is optional on older browsers. */
export async function imagePreview(file) {
  if (
    !file.type.startsWith('image/') ||
    file.size < 150000 ||
    typeof createImageBitmap !== 'function'
  )
    return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
    return blob && blob.type === 'image/webp' && blob.size < file.size
      ? new File([blob], 'preview.webp', { type: 'image/webp' })
      : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
