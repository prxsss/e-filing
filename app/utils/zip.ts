type ZipFileInput = {
  name: string;
  data: Uint8Array;
};

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function dosNow(): { time: number; date: number } {
  const d = new Date();
  return {
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) >>> 0,
    date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) >>> 0,
  };
}

function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++)
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++)
    crc = (table[(crc ^ data[i]!) & 0xFF]!) ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined')
    throw new Error('CompressionStream is not supported in this browser');

  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const chunk = new Uint8Array(data);
  await writer.write(chunk);
  await writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export async function downloadFilesAsZip(files: ZipFileInput[], zipFilename: string): Promise<void> {
  if (!files.length)
    return;

  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of files) {
    const compressed = await deflateRaw(entry.data);
    const crc = crc32(entry.data);
    const nameBytes = encoder.encode(entry.name);
    const { time, date } = dosNow();

    const localHeader = new Uint8Array([
      0x50,
      0x4B,
      0x03,
      0x04,
      20,
      0,
      0,
      0x08,
      8,
      0,
      ...u16(time),
      ...u16(date),
      ...u32(crc),
      ...u32(compressed.length),
      ...u32(entry.data.length),
      ...u16(nameBytes.length),
      0,
      0,
      ...nameBytes,
    ]);

    const cdEntry = new Uint8Array([
      0x50,
      0x4B,
      0x01,
      0x02,
      20,
      0,
      20,
      0,
      0,
      0x08,
      8,
      0,
      ...u16(time),
      ...u16(date),
      ...u32(crc),
      ...u32(compressed.length),
      ...u32(entry.data.length),
      ...u16(nameBytes.length),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...u32(localOffset),
      ...nameBytes,
    ]);

    localParts.push(localHeader, compressed);
    centralDir.push(cdEntry);
    localOffset += localHeader.length + compressed.length;
  }

  const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([
    0x50,
    0x4B,
    0x05,
    0x06,
    0,
    0,
    0,
    0,
    ...u16(files.length),
    ...u16(files.length),
    ...u32(cdSize),
    ...u32(localOffset),
    0,
    0,
  ]);

  const allParts = [...localParts, ...centralDir, eocd];
  const totalSize = allParts.reduce((s, c) => s + c.length, 0);
  const zip = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    zip.set(part, pos);
    pos += part.length;
  }

  const blob = new Blob([zip], { type: 'application/zip' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = zipFilename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
