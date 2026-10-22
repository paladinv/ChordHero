/** Read only the MusicXML root and container from an MXL ZIP, with bounded decompression. */
export async function extractMusicXml(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0)
    throw new Error("The compressed MusicXML archive is invalid.");
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  if (count > 1024)
    throw new Error("The archive contains too many files.");
  const entries = new Map<string, {
    offset: number;
    size: number;
    uncompressed: number;
    method: number;
  }>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("Invalid ZIP directory.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extra = view.getUint16(cursor + 30, true);
    const comment = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (flags & 1 || uncompressed > 20 * 1024 * 1024 || name.split("/").includes(".."))
      throw new Error("Encrypted, oversized, or unsafe ZIP entries are unsupported.");
    entries.set(name, { offset, size, uncompressed, method });
    cursor += 46 + nameLength + extra + comment;
  }
  async function read(name: string) {
    const entry = entries.get(name); if (!entry)
      throw new Error(`Missing archive entry: ${name}`); const at = entry.offset; if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50)
      throw new Error("Invalid ZIP entry."); const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true); if (start + entry.size > bytes.length)
      throw new Error("Truncated ZIP entry."); const compressed = bytes.slice(start, start + entry.size); let data: Uint8Array; if (entry.method === 0)
      data = compressed;
    else if (entry.method === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const result = await reader.read();
        if (result.done)
          break;
        total += result.value.byteLength;
        if (total > 20 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("The decompressed score is too large.");
        }
        chunks.push(result.value);
      }
      data = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    }
    else
      throw new Error("This ZIP compression method is unsupported."); if (data.length !== entry.uncompressed)
      throw new Error("The archive entry size is invalid."); return new TextDecoder().decode(data);
  }
  let root: string | undefined;
  if (entries.has("META-INF/container.xml")) {
    const container = new DOMParser().parseFromString(await read("META-INF/container.xml"), "application/xml");
    root = container.querySelector("rootfile")?.getAttribute("full-path") ?? undefined;
  }
  root ??= [...entries.keys()].find(name => /\.(musicxml|xml)$/i.test(name) && !name.startsWith("META-INF/"));
  if (!root)
    throw new Error("No MusicXML score found in the archive.");
  return read(root);
}
