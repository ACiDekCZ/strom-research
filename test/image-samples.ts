// Made-up pictures and documents for the tests of reading: a JPEG with an EXIF orientation, a PDF of scans (one JPEG a
// page, a page turned by /Rotate, objects in an object stream), a PDF of text — never a photo of a real research.

import zlib from "node:zlib";
import { encodeImage } from "../src/image/index.ts";
import type { RawImage } from "../src/image/image.ts";

/** A picture of w×h: its left half dark, its right half light (where it went is seen after any turn). */
export function halves(w: number, h: number): RawImage {
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.fill(x < w / 2 ? 20 : 235, (y * w + x) * 3, (y * w + x) * 3 + 3);
  return { width: w, height: h, channels: 3, data };
}

/** An EXIF APP1 segment with this orientation (big-endian TIFF, one entry). */
export function exifSegment(orient: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22, ...Buffer.from("Exif\0\0", "latin1"), ...Buffer.from("MM\0*", "latin1"),
    0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orient, 0, 0, 0, 0, 0, 0,
  ]);
}

/** A JPEG of the picture with an EXIF orientation right after its SOI. */
export function jpegWithOrientation(img: RawImage, orient: number): Uint8Array {
  const jpeg = encodeImage(img, "jpeg", 92);
  return Uint8Array.from([...jpeg.subarray(0, 2), ...exifSegment(orient), ...jpeg.subarray(2)]);
}

export interface PdfPage {
  /** A scan: the JPEG drawn over the whole page (its size the page's), else a page of text. */
  jpeg?: { bytes: Uint8Array; width: number; height: number };
  rotate?: number;
}

/**
 * A PDF of these pages. `objectStream`: the catalog, the page tree and the pages in a compressed object stream (as
 * PDF 1.5 writers do), the images and contents as streams of their own.
 */
export function makePdf(pages: PdfPage[], opts: { objectStream?: boolean } = {}): Uint8Array {
  const objs: (string | { dict: string; data: Uint8Array })[] = [];
  const add = (o: string | { dict: string; data: Uint8Array }) => objs.push(o) as number; // its number
  const catalog = add("");
  const tree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids: number[] = [];
  const pageDicts: [number, string][] = [];
  for (const p of pages) {
    const w = p.jpeg ? p.jpeg.width : 595;
    const h = p.jpeg ? p.jpeg.height : 842;
    let res: string;
    let content: string;
    if (p.jpeg) {
      const img = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${p.jpeg.width} /Height ${p.jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, data: p.jpeg.bytes });
      res = `<< /XObject << /Im0 ${img} 0 R >> >>`;
      content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    } else {
      res = `<< /Font << /F1 ${font} 0 R >> >>`;
      content = "BT /F1 36 Tf 72 700 Td (Testovaci stranka) Tj ET";
    }
    const c = add({ dict: "<< /Filter /FlateDecode", data: zlib.deflateSync(Buffer.from(content, "latin1")) });
    const page = add("");
    kids.push(page);
    pageDicts.push([page, `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${w} ${h}] /Resources ${res} /Contents ${c} 0 R${p.rotate ? ` /Rotate ${p.rotate}` : ""} >>`]);
  }
  const catalogDict = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  const treeDict = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const inStream: [number, string][] = [[catalog, catalogDict], [tree, treeDict], ...pageDicts];
  if (opts.objectStream) {
    const bodies = inStream.map(([, d]) => d + "\n");
    let at = 0;
    const header = inStream.map(([n], i) => {
      const s = `${n} ${at}`;
      at += Buffer.byteLength(bodies[i]!, "latin1");
      return s;
    }).join(" ") + "\n";
    const data = zlib.deflateSync(Buffer.from(header + bodies.join(""), "latin1"));
    add({ dict: `<< /Type /ObjStm /N ${inStream.length} /First ${Buffer.byteLength(header, "latin1")} /Filter /FlateDecode`, data });
    for (const [n] of inStream) objs[n - 1] = "";
  } else for (const [n, d] of inStream) objs[n - 1] = d;

  const parts: Buffer[] = [Buffer.from("%PDF-1.5\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets: number[] = [];
  let size = parts[0]!.length;
  objs.forEach((o, i) => {
    if (o === "") return; // in the object stream
    offsets[i] = size;
    const b =
      typeof o === "string"
        ? Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1")
        : Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o.dict} /Length ${o.data.length} >>\nstream\n`, "latin1"), Buffer.from(o.data), Buffer.from("\nendstream\nendobj\n", "latin1")]);
    parts.push(b);
    size += b.length;
  });
  // no cross-reference table for the objects in the stream: readers that need one rebuild it; strom reads none
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`, ...objs.map((_, i) => (offsets[i] !== undefined ? `${String(offsets[i]).padStart(10, "0")} 00000 n \n` : "0000000000 65535 f \n"))].join("");
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${size}\n%%EOF\n`, "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}
