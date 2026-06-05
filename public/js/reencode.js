import { pdfjsLib } from "./pdf-libs.js";

// Re-rasterize only the visible region of a page at the source image's native
// resolution, then re-encode as a single-layer JPEG. This drops the "whole
// spread carried on every half-page" overhead that makes some printers hang,
// without resampling (1 output pixel == 1 source pixel).

const JPEG_QUALITY = 0.92;
const FALLBACK_PX_PER_POINT = 2;

function getImageObj(page, objId) {
  return new Promise((resolve) => {
    try {
      page.objs.get(objId, resolve);
    } catch {
      resolve(null);
    }
  });
}

// Pixels-per-point of the highest-resolution image on the page. Assumes the
// image spans the page width (true for full-bleed scans), which is what this
// tool targets.
export async function detectPxPerPoint(page) {
  const opList = await page.getOperatorList();
  const vp = page.getViewport({ scale: 1 });
  let maxPxPerPt = 0;

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    if (opList.fnArray[i] !== pdfjsLib.OPS.paintImageXObject) {
      continue;
    }
    const objId = opList.argsArray[i][0];
    const img = await getImageObj(page, objId);
    if (img?.width) {
      maxPxPerPt = Math.max(maxPxPerPt, img.width / vp.width);
    }
  }

  return maxPxPerPt || FALLBACK_PX_PER_POINT;
}

function canvasToJpegBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("JPEG encode failed"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

// box: { x, y, w, h } in PDF points, bottom-up origin (pdf-lib convention).
// rotateDeg: 0 | 90 | 180 | 270, clockwise (matches pdf-lib setRotation).
// Returns { jpeg, widthPt, heightPt } where the size already accounts for rotation.
export async function renderRegionToJpeg(page, pageHeightPt, box, rotateDeg, pxPerPt) {
  // Top-left of the region in unrotated device pixels (canvas y grows downward).
  const cx0 = box.x * pxPerPt;
  const cy0 = (pageHeightPt - (box.y + box.h)) * pxPerPt;
  const rw = Math.max(1, Math.round(box.w * pxPerPt));
  const rh = Math.max(1, Math.round(box.h * pxPerPt));

  // Render the full page through a small canvas offset so only the region is painted.
  const regionViewport = page.getViewport({ scale: pxPerPt, offsetX: -cx0, offsetY: -cy0 });
  const regionCanvas = document.createElement("canvas");
  regionCanvas.width = rw;
  regionCanvas.height = rh;
  await page.render({
    canvasContext: regionCanvas.getContext("2d"),
    viewport: regionViewport,
  }).promise;

  let outCanvas = regionCanvas;
  if (rotateDeg === 90 || rotateDeg === 270) {
    outCanvas = document.createElement("canvas");
    outCanvas.width = rh;
    outCanvas.height = rw;
    const ctx = outCanvas.getContext("2d");
    if (rotateDeg === 90) {
      ctx.translate(rh, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, rw);
      ctx.rotate(-Math.PI / 2);
    }
    ctx.drawImage(regionCanvas, 0, 0);
    releaseCanvas(regionCanvas);
  } else if (rotateDeg === 180) {
    outCanvas = document.createElement("canvas");
    outCanvas.width = rw;
    outCanvas.height = rh;
    const ctx = outCanvas.getContext("2d");
    ctx.translate(rw, rh);
    ctx.rotate(Math.PI);
    ctx.drawImage(regionCanvas, 0, 0);
    releaseCanvas(regionCanvas);
  }

  const jpeg = await canvasToJpegBytes(outCanvas);
  releaseCanvas(outCanvas);

  const swap = rotateDeg === 90 || rotateDeg === 270;
  return {
    jpeg,
    widthPt: swap ? box.h : box.w,
    heightPt: swap ? box.w : box.h,
  };
}
