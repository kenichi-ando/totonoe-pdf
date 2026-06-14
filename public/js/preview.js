import { PDFDocument, pdfjsLib } from "./pdf-libs.js";
import { fileToBytes } from "./utils.js";

async function renderFirstPageToCanvas(bytes, canvas) {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const firstPage = await pdf.getPage(1);
  const baseViewport = firstPage.getViewport({ scale: 1 });
  const targetWidth = 220;
  const scale = targetWidth / baseViewport.width;
  const viewport = firstPage.getViewport({ scale });
  const ctx = canvas.getContext("2d");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await firstPage.render({ canvasContext: ctx, viewport }).promise;
}

export async function updateSinglePreview(inputEl, metaEl, canvasEl, label) {
  const file = inputEl.files?.[0];
  if (!file) {
    metaEl.textContent = "";
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    return;
  }

  const bytes = await fileToBytes(file);
  const pdf = await PDFDocument.load(bytes);
  metaEl.textContent = `${label}: ${file.name} (${pdf.getPageCount()} pages)`;
  await renderFirstPageToCanvas(bytes, canvasEl);
}
