interface JpegComponent {
  h: number;
  v: number;
  quantizationIdx: number;
  huffmanTableDC?: any;
  huffmanTableAC?: any;
  blocksPerLine: number;
  blocksPerColumn: number;
  blocks: Int32Array[][];
  pred: number;
}

interface JpegFrame {
  extended: boolean;
  progressive: boolean;
  precision: number;
  scanLines: number;
  samplesPerLine: number;
  components: { [key: number]: JpegComponent };
  componentsOrder: number[];
  maxH: number;
  maxV: number;
  mcusPerLine: number;
  mcusPerColumn: number;
}

interface HuffmanNode {
  children: any[];
  index: number;
}

const dctZigZag = new Int32Array([
   0,
   1,  8,
  16,  9,  2,
   3, 10, 17, 24,
  32, 25, 18, 11,  4,
   5, 12, 19, 26, 33, 40,
  48, 41, 34, 27, 20, 13,  6,
   7, 14, 21, 28, 35, 42, 49, 56,
  57, 50, 43, 36, 29, 22, 15,
  23, 30, 37, 44, 51, 58,
  59, 52, 45, 38, 31,
  39, 46, 53, 60,
  61, 54, 47,
  55, 62,
  63
]);

function buildHuffmanTable(codeLengths: Uint8Array, values: Uint8Array): any[] {
  let k = 0;
  const code: HuffmanNode[] = [];
  let length = 16;
  while (length > 0 && !codeLengths[length - 1]) {
    length--;
  }
  code.push({ children: [], index: 0 });
  let p = code[0];
  let q: HuffmanNode;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < codeLengths[i]; j++) {
      p = code.pop()!;
      p.children[p.index] = values[k];
      while (p.index > 0) {
        if (code.length === 0) {
          throw new Error('Could not recreate Huffman Table');
        }
        p = code.pop()!;
      }
      p.index++;
      code.push(p);
      while (code.length <= i) {
        code.push(q = { children: [], index: 0 });
        p.children[p.index] = q.children;
        p = q;
      }
      k++;
    }
    if (i + 1 < length) {
      code.push(q = { children: [], index: 0 });
      p.children[p.index] = q.children;
      p = q;
    }
  }
  return code[0].children;
}

function decodeScan(
  data: Uint8Array,
  offset: number,
  frame: JpegFrame,
  components: JpegComponent[],
  resetInterval: number | undefined,
  spectralStart: number,
  spectralEnd: number,
  successivePrev: number,
  successive: number,
  opts: { tolerantDecoding?: boolean } = {}
): number {
  const mcusPerLine = frame.mcusPerLine;
  const progressive = frame.progressive;

  const startOffset = offset;
  let bitsData = 0;
  let bitsCount = 0;

  function readBit(): number {
    if (bitsCount > 0) {
      bitsCount--;
      return (bitsData >> bitsCount) & 1;
    }
    bitsData = data[offset++];
    if (bitsData === 0xFF) {
      const nextByte = data[offset++];
      if (nextByte) {
        throw new Error("unexpected marker: " + ((bitsData << 8) | nextByte).toString(16));
      }
    }
    bitsCount = 7;
    return bitsData >>> 7;
  }

  function decodeHuffman(tree: any): number | null {
    let node = tree;
    let bit: number;
    while (true) {
      bit = readBit();
      node = node[bit];
      if (typeof node === 'number') {
        return node;
      }
      if (typeof node !== 'object' || node === null) {
        throw new Error("invalid huffman sequence");
      }
    }
  }

  function receive(length: number): number {
    let n = 0;
    while (length > 0) {
      const bit = readBit();
      n = (n << 1) | bit;
      length--;
    }
    return n;
  }

  function receiveAndExtend(length: number): number {
    const n = receive(length);
    if (n >= 1 << (length - 1)) {
      return n;
    }
    return n + (-1 << length) + 1;
  }

  function decodeBaseline(component: JpegComponent, zz: Int32Array): void {
    const t = decodeHuffman(component.huffmanTableDC);
    if (t === null) return;
    const diff = t === 0 ? 0 : receiveAndExtend(t);
    zz[0] = (component.pred += diff);
    let k = 1;
    while (k < 64) {
      const rs = decodeHuffman(component.huffmanTableAC);
      if (rs === null) break;
      const s = rs & 15;
      const r = rs >> 4;
      if (s === 0) {
        if (r < 15) {
          break;
        }
        k += 16;
        continue;
      }
      k += r;
      const z = dctZigZag[k];
      zz[z] = receiveAndExtend(s);
      k++;
    }
  }

  function decodeDCFirst(component: JpegComponent, zz: Int32Array): void {
    const t = decodeHuffman(component.huffmanTableDC);
    if (t === null) return;
    const diff = t === 0 ? 0 : (receiveAndExtend(t) << successive);
    zz[0] = (component.pred += diff);
  }

  function decodeDCSuccessive(component: JpegComponent, zz: Int32Array): void {
    zz[0] |= readBit() << successive;
  }

  let eobrun = 0;

  function decodeACFirst(component: JpegComponent, zz: Int32Array): void {
    if (eobrun > 0) {
      eobrun--;
      return;
    }
    let k = spectralStart;
    const e = spectralEnd;
    while (k <= e) {
      const rs = decodeHuffman(component.huffmanTableAC);
      if (rs === null) break;
      const s = rs & 15;
      const r = rs >> 4;
      if (s === 0) {
        if (r < 15) {
          eobrun = receive(r) + (1 << r) - 1;
          break;
        }
        k += 16;
        continue;
      }
      k += r;
      const z = dctZigZag[k];
      zz[z] = receiveAndExtend(s) * (1 << successive);
      k++;
    }
  }

  let successiveACState = 0;
  let successiveACNextValue = 0;

  function decodeACSuccessive(component: JpegComponent, zz: Int32Array): void {
    let k = spectralStart;
    const e = spectralEnd;
    let r = 0;
    while (k <= e) {
      const z = dctZigZag[k];
      const direction = zz[z] < 0 ? -1 : 1;
      switch (successiveACState) {
        case 0: {
          const rs = decodeHuffman(component.huffmanTableAC);
          if (rs === null) break;
          const s = rs & 15;
          r = rs >> 4;
          if (s === 0) {
            if (r < 15) {
              eobrun = receive(r) + (1 << r);
              successiveACState = 4;
            } else {
              r = 16;
              successiveACState = 1;
            }
          } else {
            if (s !== 1) {
              throw new Error("invalid ACn encoding");
            }
            successiveACNextValue = receiveAndExtend(s);
            successiveACState = r ? 2 : 3;
          }
          continue;
        }
        case 1:
        case 2:
          if (zz[z]) {
            zz[z] += (readBit() << successive) * direction;
          } else {
            r--;
            if (r === 0) {
              successiveACState = successiveACState === 2 ? 3 : 0;
            }
          }
          break;
        case 3:
          if (zz[z]) {
            zz[z] += (readBit() << successive) * direction;
          } else {
            zz[z] = successiveACNextValue << successive;
            successiveACState = 0;
          }
          break;
        case 4:
          if (zz[z]) {
            zz[z] += (readBit() << successive) * direction;
          }
          break;
      }
      k++;
    }
    if (successiveACState === 4) {
      eobrun--;
      if (eobrun === 0) {
        successiveACState = 0;
      }
    }
  }

  function decodeMcu(component: JpegComponent, decodeFn: (component: JpegComponent, zz: Int32Array) => void, mcu: number, row: number, col: number): void {
    const mcuRow = (mcu / mcusPerLine) | 0;
    const mcuCol = mcu % mcusPerLine;
    const blockRow = mcuRow * component.v + row;
    const blockCol = mcuCol * component.h + col;
    if (component.blocks[blockRow] === undefined && opts.tolerantDecoding) {
      return;
    }
    decodeFn(component, component.blocks[blockRow][blockCol]);
  }

  function decodeBlock(component: JpegComponent, decodeFn: (component: JpegComponent, zz: Int32Array) => void, mcu: number): void {
    const blockRow = (mcu / component.blocksPerLine) | 0;
    const blockCol = mcu % component.blocksPerLine;
    if (component.blocks[blockRow] === undefined && opts.tolerantDecoding) {
      return;
    }
    decodeFn(component, component.blocks[blockRow][blockCol]);
  }

  const componentsLength = components.length;
  let component: JpegComponent;
  let decodeFn: (component: JpegComponent, zz: Int32Array) => void;

  if (progressive) {
    if (spectralStart === 0) {
      decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
    } else {
      decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
    }
  } else {
    decodeFn = decodeBaseline;
  }

  let mcu = 0;
  let marker: number;
  let mcuExpected: number;

  if (componentsLength === 1) {
    mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
  } else {
    mcuExpected = mcusPerLine * frame.mcusPerColumn;
  }
  if (!resetInterval) {
    resetInterval = mcuExpected;
  }

  let h: number, v: number;
  while (mcu < mcuExpected) {
    for (let i = 0; i < componentsLength; i++) {
      components[i].pred = 0;
    }
    eobrun = 0;

    if (componentsLength === 1) {
      component = components[0];
      for (let n = 0; n < resetInterval; n++) {
        decodeBlock(component, decodeFn, mcu);
        mcu++;
      }
    } else {
      for (let n = 0; n < resetInterval; n++) {
        for (let i = 0; i < componentsLength; i++) {
          component = components[i];
          h = component.h;
          v = component.v;
          for (let j = 0; j < v; j++) {
            for (let k = 0; k < h; k++) {
              decodeMcu(component, decodeFn, mcu, j, k);
            }
          }
        }
        mcu++;
        if (mcu === mcuExpected) {
          break;
        }
      }
    }

    if (mcu === mcuExpected) {
      do {
        if (data[offset] === 0xFF) {
          if (data[offset + 1] !== 0x00) {
            break;
          }
        }
        offset += 1;
      } while (offset < data.length - 2);
    }

    bitsCount = 0;
    marker = (data[offset] << 8) | data[offset + 1];
    if (marker < 0xFF00) {
      throw new Error("marker was not found");
    }

    if (marker >= 0xFFD0 && marker <= 0xFFD7) { // RSTx
      offset += 2;
    } else {
      break;
    }
  }

  return offset - startOffset;
}

function prepareComponents(frame: JpegFrame): void {
  let maxH = 1;
  let maxV = 1;
  let component: JpegComponent;
  let componentId: any;

  for (componentId in frame.components) {
    if (frame.components.hasOwnProperty(componentId)) {
      component = frame.components[componentId];
      if (maxH < component.h) maxH = component.h;
      if (maxV < component.v) maxV = component.v;
    }
  }

  const mcusPerLine = Math.ceil(frame.samplesPerLine / 8 / maxH);
  const mcusPerColumn = Math.ceil(frame.scanLines / 8 / maxV);

  for (componentId in frame.components) {
    if (frame.components.hasOwnProperty(componentId)) {
      component = frame.components[componentId];
      const blocksPerLine = Math.ceil(Math.ceil(frame.samplesPerLine / 8) * component.h / maxH);
      const blocksPerColumn = Math.ceil(Math.ceil(frame.scanLines / 8) * component.v / maxV);
      const blocksPerLineForMcu = mcusPerLine * component.h;
      const blocksPerColumnForMcu = mcusPerColumn * component.v;
      const blocks: Int32Array[][] = [];

      for (let i = 0; i < blocksPerColumnForMcu; i++) {
        const row: Int32Array[] = [];
        for (let j = 0; j < blocksPerLineForMcu; j++) {
          row.push(new Int32Array(64));
        }
        blocks.push(row);
      }
      component.blocksPerLine = blocksPerLine;
      component.blocksPerColumn = blocksPerColumn;
      component.blocks = blocks;
      component.pred = 0;
    }
  }

  frame.maxH = maxH;
  frame.maxV = maxV;
  frame.mcusPerLine = mcusPerLine;
  frame.mcusPerColumn = mcusPerColumn;
}

function parseJpeg(data: Uint8Array): JpegFrame {
  let offset = 0;

  function readUint16(): number {
    const value = (data[offset] << 8) | data[offset + 1];
    offset += 2;
    return value;
  }

  function readDataBlock(): Uint8Array {
    const blockLength = readUint16();
    const array = data.subarray(offset, offset + blockLength - 2);
    offset += array.length;
    return array;
  }

  const fileMarker = readUint16();
  if (fileMarker !== 0xFFD8) { // SOI
    throw new Error("SOI not found");
  }

  let nextMarker = readUint16();
  let frame: JpegFrame | null = null;
  const huffmanTablesAC: any[] = [];
  const huffmanTablesDC: any[] = [];
  let resetInterval: number | undefined;

  while (nextMarker !== 0xFFD9) { // EOI
    switch (nextMarker) {
      case 0xFF00:
        break;
      case 0xFFE0: // APP0
      case 0xFFE1:
      case 0xFFE2:
      case 0xFFE3:
      case 0xFFE4:
      case 0xFFE5:
      case 0xFFE6:
      case 0xFFE7:
      case 0xFFE8:
      case 0xFFE9:
      case 0xFFEA:
      case 0xFFEB:
      case 0xFFEC:
      case 0xFFED:
      case 0xFFEE:
      case 0xFFEF:
      case 0xFFFE: // COM
        readDataBlock(); // Skip application data
        break;

      case 0xFFDB: { // DQT
        const quantizationTablesLength = readUint16();
        const quantizationTablesEnd = quantizationTablesLength + offset - 2;
        while (offset < quantizationTablesEnd) {
          const quantizationTableSpec = data[offset++];
          if ((quantizationTableSpec >> 4) === 0) {
            offset += 64;
          } else {
            offset += 128;
          }
        }
        break;
      }

      case 0xFFC0: // SOF0
      case 0xFFC1: // SOF1
      case 0xFFC2: { // SOF2
        readUint16(); // skip data length
        frame = {
          extended: nextMarker === 0xFFC1,
          progressive: nextMarker === 0xFFC2,
          precision: data[offset++],
          scanLines: readUint16(),
          samplesPerLine: readUint16(),
          components: {},
          componentsOrder: [],
          maxH: 0,
          maxV: 0,
          mcusPerLine: 0,
          mcusPerColumn: 0,
        };

        const componentsCount = data[offset++];
        for (let i = 0; i < componentsCount; i++) {
          const componentId = data[offset];
          const h = data[offset + 1] >> 4;
          const v = data[offset + 1] & 15;
          const qId = data[offset + 2];

          if (h <= 0 || v <= 0) {
            throw new Error("Invalid sampling factor, expected values above 0");
          }

          frame.componentsOrder.push(componentId);
          frame.components[componentId] = {
            h,
            v,
            quantizationIdx: qId,
            blocksPerLine: 0,
            blocksPerColumn: 0,
            blocks: [],
            pred: 0,
          };
          offset += 3;
        }
        prepareComponents(frame);
        break;
      }

      case 0xFFC4: { // DHT
        const huffmanLength = readUint16();
        for (let i = 2; i < huffmanLength; ) {
          const huffmanTableSpec = data[offset++];
          const codeLengths = new Uint8Array(16);
          let codeLengthSum = 0;
          for (let j = 0; j < 16; j++, offset++) {
            codeLengths[j] = data[offset];
            codeLengthSum += codeLengths[j];
          }
          const huffmanValues = new Uint8Array(codeLengthSum);
          for (let j = 0; j < codeLengthSum; j++, offset++) {
            huffmanValues[j] = data[offset];
          }
          i += 17 + codeLengthSum;

          if ((huffmanTableSpec >> 4) === 0) {
            huffmanTablesDC[huffmanTableSpec & 15] = buildHuffmanTable(codeLengths, huffmanValues);
          } else {
            huffmanTablesAC[huffmanTableSpec & 15] = buildHuffmanTable(codeLengths, huffmanValues);
          }
        }
        break;
      }

      case 0xFFDD: // DRI
        readUint16(); // skip data length
        resetInterval = readUint16();
        break;

      case 0xFFDC: // Number of Lines marker
        readUint16(); // skip data length
        readUint16();
        break;

      case 0xFFDA: { // SOS
        if (!frame) {
          throw new Error("SOS marker found before SOF");
        }
        readUint16(); // skip scan length
        const selectorsCount = data[offset++];
        const components: JpegComponent[] = [];
        for (let i = 0; i < selectorsCount; i++) {
          const component = frame.components[data[offset++]];
          const tableSpec = data[offset++];
          component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
          component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
          components.push(component);
        }
        const spectralStart = data[offset++];
        const spectralEnd = data[offset++];
        const successiveApproximation = data[offset++];
        const processed = decodeScan(
          data,
          offset,
          frame,
          components,
          resetInterval,
          spectralStart,
          spectralEnd,
          successiveApproximation >> 4,
          successiveApproximation & 15
        );
        offset += processed;
        break;
      }

      case 0xFFFF: // Fill bytes
        if (data[offset] !== 0xFF) {
          offset--;
        }
        break;

      default:
        if (data[offset - 3] === 0xFF && data[offset - 2] >= 0xC0 && data[offset - 2] <= 0xFE) {
          offset -= 3;
          break;
        }
        throw new Error("unknown JPEG marker " + nextMarker.toString(16));
    }
    nextMarker = readUint16();
  }

  if (!frame) {
    throw new Error("No JPEG frame parsed");
  }
  return frame;
}

function packBits(bits: number[]): Uint8Array {
  const byteCount = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < bits.length; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - (i % 8); // MSB-first
    if (bits[i]) {
      bytes[byteIdx] |= (1 << bitIdx);
    }
  }
  return bytes;
}

function isPlausiblePayload(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;

  // 1. Common file signatures (magic bytes)
  const magicList = [
    [0x50, 0x4B, 0x03, 0x04], // ZIP / DOCX / JAR
    [0x89, 0x50, 0x4E, 0x47], // PNG
    [0xFF, 0xD8, 0xFF],       // JPEG
    [0x25, 0x50, 0x44, 0x46], // PDF
    [0x7F, 0x45, 0x4C, 0x46], // ELF
    [0x47, 0x49, 0x46, 0x38], // GIF
    [0x1F, 0x8B],             // GZIP
    [0x37, 0x7A, 0xBC, 0xAF], // 7z
    [0x42, 0x4D],             // BMP
    [0x52, 0x61, 0x72, 0x21], // RAR
  ];

  for (const magic of magicList) {
    if (bytes.length >= magic.length) {
      let match = true;
      for (let i = 0; i < magic.length; i++) {
        if (bytes[i] !== magic[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
  }

  // 2. Printable ASCII check for text payloads
  const checkLen = Math.min(bytes.length, 8);
  let printableCount = 0;
  for (let i = 0; i < checkLen; i++) {
    const c = bytes[i];
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) {
      printableCount++;
    }
  }

  if (checkLen >= 4 && printableCount >= checkLen - 1) {
    return true;
  }

  if (bytes.length >= 4) {
    let allPrintable = true;
    for (let i = 0; i < 4; i++) {
      const c = bytes[i];
      if (!(c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126))) {
        allPrintable = false;
        break;
      }
    }
    if (allPrintable) return true;
  }

  return false;
}

/**
 * Parses a JPEG and returns every DCT coefficient in the same scan-order traversal jsteg/outguess-style
 * tools use: component order, block row-major, then natural (non-zigzag) position 0..63 within each block.
 * Returns null if the file isn't a parseable baseline/progressive JPEG.
 */
export async function getJpegDctCoefficients(file: File): Promise<number[] | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    let frame: JpegFrame;
    try {
      frame = parseJpeg(data);
    } catch {
      return null;
    }

    const coefficients: number[] = [];
    for (let i = 0; i < frame.componentsOrder.length; i++) {
      const component = frame.components[frame.componentsOrder[i]];
      const blocks = component.blocks;
      if (!blocks || blocks.length === 0 || blocks[0].length === 0) continue;

      const blocksPerColumn = blocks.length;
      const blocksPerLine = blocks[0].length;

      // One whole 8x8 block (all 64 coefficients, natural/non-zigzag order) at a time, then the
      // next block in the row, then the next block-row — matching how JPEG tools (steghide's
      // JpegFile::read, jsteg, outguess) actually linearize DCT coefficients. An earlier version of
      // this loop interleaved partial rows across blocks (visiting 8 coefficients of every block in
      // a row-band before returning for the next 8), which doesn't correspond to any real tool's
      // traversal and silently misaligned every index-based extractor built on top of it.
      for (let blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
        for (let blockCol = 0; blockCol < blocksPerLine; blockCol++) {
          const block = blocks[blockRow][blockCol];
          for (let coeffIdx = 0; coeffIdx < 64; coeffIdx++) {
            coefficients.push(block[coeffIdx]);
          }
        }
      }
    }
    return coefficients.length > 0 ? coefficients : null;
  } catch {
    return null;
  }
}

/**
 * Returns DCT coefficients in the exact order OutGuess (libjpeg's jdcoefct decompress loop) sees
 * them: MCU-interleaved across components, in *natural* (non-zigzag) position 0..63 within each
 * 8x8 block. libjpeg's Huffman decoder de-zigzags coefficients as it decodes them — each decoded
 * (run, size) pair at zigzag scan position k is stored at `block[jpeg_natural_order[k]]` — so by
 * the time jdcoefct.c's decompress_onepass() reads `block[k]` in its steg hook, `k` is already a
 * natural raster index, not a zigzag one. This decoder's `decodeBaseline`/`decodeACFirst` etc.
 * mirror that exact behavior (`zz[dctZigZag[k]] = value`), so `component.blocks[...][...]` here is
 * likewise natural-order already — no re-zigzagging should be applied when reading it back out.
 *
 * Within one MCU, libjpeg walks each component's sampling block grid (v rows x h cols); the block at
 * within-MCU offset (yindex, xindex) maps to absolute block [mcuRow*v + yindex][mcuCol*h + xindex].
 * Padding blocks that the encoder added to fill an MCU past the true image edge are skipped (they
 * are the ones with blockRow >= blocksPerColumn or blockCol >= blocksPerLine), because libjpeg only
 * feeds real, non-dummy blocks through its steg hook. Getting this order wrong misaligns every
 * coefficient index and makes keyed extraction fail.
 *
 * Returns null if the file isn't a parseable baseline/progressive JPEG.
 */
export async function getOutguessCoefficients(file: File): Promise<number[] | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    let frame: JpegFrame;
    try {
      frame = parseJpeg(data);
    } catch {
      return null;
    }

    const coefficients: number[] = [];
    for (let mcuRow = 0; mcuRow < frame.mcusPerColumn; mcuRow++) {
      for (let mcuCol = 0; mcuCol < frame.mcusPerLine; mcuCol++) {
        for (let ci = 0; ci < frame.componentsOrder.length; ci++) {
          const component = frame.components[frame.componentsOrder[ci]];
          const blocks = component.blocks;
          if (!blocks || blocks.length === 0) continue;
          for (let yindex = 0; yindex < component.v; yindex++) {
            const blockRow = mcuRow * component.v + yindex;
            if (blockRow >= component.blocksPerColumn) continue;
            const row = blocks[blockRow];
            if (!row) continue;
            for (let xindex = 0; xindex < component.h; xindex++) {
              const blockCol = mcuCol * component.h + xindex;
              if (blockCol >= component.blocksPerLine) continue;
              const block = row[blockCol];
              if (!block) continue;
              for (let k = 0; k < 64; k++) {
                coefficients.push(block[k]);
              }
            }
          }
        }
      }
    }
    return coefficients.length > 0 ? coefficients : null;
  } catch {
    return null;
  }
}

/**
 * JSteg Steganography payload extractor.
 * Walks YCbCr 8x8 DCT blocks in scan order, collects LSBs of non-zero, non-one coefficients, and packs them into bytes.
 */
export async function extractJsteg(
  file: File
): Promise<{ bytes: Uint8Array; bitCount: number } | null> {
  try {
    const coefficients = await getJpegDctCoefficients(file);
    if (!coefficients) return null;

    const bits: number[] = [];
    for (const val of coefficients) {
      if (val !== 0 && val !== 1) {
        bits.push(val & 1);
      }
    }

    if (bits.length === 0) {
      return null;
    }

    const bytes = packBits(bits);

    if (!isPlausiblePayload(bytes)) {
      return null;
    }

    return {
      bytes,
      bitCount: bits.length,
    };
  } catch (error) {
    return null;
  }
}
