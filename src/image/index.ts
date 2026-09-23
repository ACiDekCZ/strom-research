// Reading and writing image files by their content, not their name.

import fs from "node:fs";
import type { RawImage } from "./image.ts";
import { decodeJpeg } from "./jpeg-decode.ts";
import { encodeJpeg } from "./jpeg-encode.ts";
import { decodePng, encodePng } from "./png.ts";

export type ImageFormat = "jpeg" | "png" | "tiff" | "gif" | "webp" | "heic" | "pdf" | "unknown";

export function formatOf(bytes: Uint8Array): ImageFormat {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8) return "jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if ((b(0) === 0x49 && b(1) === 0x49 && b(2) === 0x2a) || (b(0) === 0x4d && b(1) === 0x4d && b(3) === 0x2a)) return "tiff";
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return "gif";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45) return "webp";
  if (b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70 && [0x68, 0x6d].includes(b(8))) return "heic";
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "pdf";
  return "unknown";
}

export class ImageFormatError extends Error {}

/** Decode a JPEG or PNG; anything else gets a clear message about what to do. */
export function decodeImage(bytes: Uint8Array): RawImage {
  const f = formatOf(bytes);
  if (f === "jpeg") return decodeJpeg(bytes);
  if (f === "png") return decodePng(bytes);
  throw new ImageFormatError(
    f === "unknown" ? "not an image strom can read (JPEG or PNG)" : `${f.toUpperCase()} cannot be cropped by strom yet — only JPEG and PNG; convert the file (any image viewer can save it as JPEG)`,
  );
}

export function encodeImage(img: RawImage, format: "jpeg" | "png", quality = 88): Uint8Array {
  return format === "png" ? encodePng(img) : encodeJpeg(img, quality);
}

/** Width and height without decoding the whole image (JPEG SOF / PNG IHDR). */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const f = formatOf(bytes);
  if (f === "png") {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (f === "jpeg") {
    let p = 2;
    while (p + 9 < bytes.length) {
      if (bytes[p] !== 0xff) {
        p++;
        continue;
      }
      const m = bytes[p + 1]!;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: (bytes[p + 5]! << 8) | bytes[p + 6]!, width: (bytes[p + 7]! << 8) | bytes[p + 8]! };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        p += 2;
        continue;
      }
      p += 2 + ((bytes[p + 2]! << 8) | bytes[p + 3]!);
    }
  }
  return undefined;
}

/**
 * Width and height of an image file, read from its header without loading it: a JPEG is walked
 * segment by segment, so metadata of any size before the frame (EXIF, ICC, thumbnails) does not matter.
 */
export function imageSizeOfFile(file: string): { width: number; height: number } | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, "r");
    const at = (pos: number, n: number) => {
      const b = Buffer.alloc(n);
      return b.subarray(0, fs.readSync(fd!, b, 0, n, pos));
    };
    const head = at(0, 32);
    const f = formatOf(head);
    if (f === "png") return head.length >= 24 ? { width: head.readUInt32BE(16), height: head.readUInt32BE(20) } : undefined;
    if (f !== "jpeg") return undefined;
    const size = fs.fstatSync(fd).size;
    let pos = 2;
    for (let i = 0; i < 10_000 && pos + 4 <= size; i++) {
      const m = at(pos, 4);
      if (m[0] !== 0xff) return undefined;
      const marker = m[1]!;
      if (marker === 0xff) {
        pos++; // fill byte
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const sof = at(pos + 5, 4);
        return sof.length === 4 ? { height: sof.readUInt16BE(0), width: sof.readUInt16BE(2) } : undefined;
      }
      if (marker === 0xd9 || marker === 0xda) return undefined; // the image data came before any frame
      pos += 2 + m.readUInt16BE(2);
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
