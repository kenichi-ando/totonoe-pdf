import { PDFDocument, degrees, pdfjsLib } from "./pdf-libs.js";
import { fileToBytes, getBaseNameWithoutPdf } from "./utils.js";
import { detectPxPerPoint, renderRegionToJpeg } from "./reencode.js";

// Split each spread into left/right (or top/bottom) halves.
// Returns the half-boxes in pdf-lib coordinates (bottom-up origin) plus a side label.
function computeHalves(width, height, direction, order) {
  let leftBox;
  let rightBox;

  if (width >= height) {
    const mid = width / 2;
    leftBox = { x: 0, y: 0, w: mid, h: height, side: "left" };
    rightBox = { x: mid, y: 0, w: width - mid, h: height, side: "right" };
  } else {
    const mid = height / 2;
    const bottomBox = { x: 0, y: 0, w: width, h: mid };
    const topBox = { x: 0, y: mid, w: width, h: height - mid };
    if (direction === "cw") {
      leftBox = { ...bottomBox, side: "left" };
      rightBox = { ...topBox, side: "right" };
    } else if (direction === "ccw") {
      leftBox = { ...topBox, side: "left" };
      rightBox = { ...bottomBox, side: "right" };
    } else {
      leftBox = { ...topBox, side: "left" };
      rightBox = { ...bottomBox, side: "right" };
    }
  }

  return order === "LR" ? [leftBox, rightBox] : [rightBox, leftBox];
}

// OFF path: copy each spread and narrow its crop/media box. Fast, lossless,
// but every half-page still carries the whole spread image.
async function splitByCrop(srcPdf, direction, order, rotateDeg) {
  const outPdf = await PDFDocument.create();
  const thumbnailTags = [];

  for (const srcIndex of srcPdf.getPageIndices()) {
    const [orig] = await outPdf.copyPages(srcPdf, [srcIndex]);
    const pair = computeHalves(orig.getWidth(), orig.getHeight(), direction, order);
    for (const box of pair) {
      const [half] = await outPdf.copyPages(srcPdf, [srcIndex]);
      half.setCropBox(box.x, box.y, box.w, box.h);
      half.setMediaBox(box.x, box.y, box.w, box.h);
      half.setRotation(degrees(rotateDeg));
      outPdf.addPage(half);
      thumbnailTags.push([`Src #${srcIndex + 1}`, box.side === "left" ? "Left" : "Right"]);
    }
  }

  return { outPdf, thumbnailTags };
}

// ON path: re-rasterize only each visible half at the source image's native
// resolution and re-embed as a single-layer JPEG. Halves the per-page image
// data and drops the Flate-over-DCT double compression that hangs some printers.
async function splitByReencode(bytes, direction, order, rotateDeg) {
  const pdfjsDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const outPdf = await PDFDocument.create();
  const thumbnailTags = [];

  for (let i = 0; i < pdfjsDoc.numPages; i += 1) {
    const srcIndex = i;
    const page = await pdfjsDoc.getPage(srcIndex + 1);
    const vp = page.getViewport({ scale: 1 });
    const pxPerPt = await detectPxPerPoint(page);
    const pair = computeHalves(vp.width, vp.height, direction, order);

    for (const box of pair) {
      const { jpeg, widthPt, heightPt } = await renderRegionToJpeg(
        page,
        vp.height,
        box,
        rotateDeg,
        pxPerPt,
      );
      const image = await outPdf.embedJpg(jpeg);
      const outPage = outPdf.addPage([widthPt, heightPt]);
      outPage.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
      thumbnailTags.push([`Src #${srcIndex + 1}`, box.side === "left" ? "Left" : "Right"]);
    }

    page.cleanup();
  }

  return { outPdf, thumbnailTags };
}

export async function runSplit(inputFile, options) {
  const { direction, order, reencode = false } = options;
  const rotateDeg = direction === "cw" ? 90 : direction === "ccw" ? 270 : 0;

  const bytes = await fileToBytes(inputFile);
  const srcPdf = await PDFDocument.load(bytes);
  const srcPageCount = srcPdf.getPageCount();

  const { outPdf, thumbnailTags } = reencode
    ? await splitByReencode(bytes, direction, order, rotateDeg)
    : await splitByCrop(srcPdf, direction, order, rotateDeg);

  const mode = reencode ? "再エンコード" : "クロップ";
  return {
    bytes: await outPdf.save(),
    filename: `${getBaseNameWithoutPdf(inputFile.name)} A4.pdf`,
    statusText: `入力: ${srcPageCount} ページ -> 出力: ${outPdf.getPageCount()} ページ (direction=${direction}, order=${order}, 軽量化=${mode})`,
    thumbnailTags,
  };
}
