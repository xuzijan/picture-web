import JSZip from 'jszip';

type Image = { id: string; name: string; src: string };
export async function downloadZip(images: Image[], connected: boolean, signal: AbortSignal, onProgress: (message: string) => void): Promise<Blob> {
  const zip = new JSZip();
  let cursor = 0;
  let completed = 0;
  const names = new Set<string>();
  const entries = images.map((image, index) => {
    const original = image.name.replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || `image-${index + 1}`;
    let name = original;
    let suffix = 1;
    while (names.has(name)) { const dot = original.lastIndexOf('.'); name = dot > 0 ? `${original.slice(0, dot)} (${suffix++})${original.slice(dot)}` : `${original} (${suffix++})`; }
    names.add(name);
    return { image, name };
  });
  onProgress(`下载图片 0/${images.length}`);
  await Promise.all(Array.from({ length: Math.min(4, images.length) }, async () => {
    while (cursor < entries.length) {
      signal.throwIfAborted();
      const { image, name } = entries[cursor++];
      const response = await fetch(connected ? `/api/download?id=${encodeURIComponent(image.id)}` : image.src, { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
      if (!response.ok) throw new Error(`下载 ${image.name} 失败（${response.status}），请重试`);
      zip.file(name, await response.arrayBuffer());
      onProgress(`下载图片 ${++completed}/${images.length}`);
    }
  }));
  signal.throwIfAborted();
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (metadata) => {
    signal.throwIfAborted();
    onProgress(`正在打包 ${Math.floor(metadata.percent)}%`);
  });
}
