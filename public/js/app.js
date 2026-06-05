import { updateSinglePreview } from "./preview.js";
import { createResultSetter } from "./result.js";
import { runMerge } from "./merge.js";
import { runSplit } from "./split.js";
import { initTabs } from "./tabs.js";

const tabMerge = document.getElementById("tabMerge");
const tabSplit = document.getElementById("tabSplit");
const mergeSection = document.getElementById("mergeSection");
const splitSection = document.getElementById("splitSection");

const frontInput = document.getElementById("frontFile");
const backInput = document.getElementById("backFile");
const splitInput = document.getElementById("splitInput");
const frontMeta = document.getElementById("frontMeta");
const backMeta = document.getElementById("backMeta");
const splitMeta = document.getElementById("splitMeta");
const frontCanvas = document.getElementById("frontCanvas");
const backCanvas = document.getElementById("backCanvas");
const splitCanvas = document.getElementById("splitCanvas");
const runMergeBtn = document.getElementById("runMergeBtn");
const runSplitBtn = document.getElementById("runSplitBtn");
const frontOrderSelect = document.getElementById("frontOrderSelect");
const backOrderSelect = document.getElementById("backOrderSelect");
const directionSelect = document.getElementById("directionSelect");
const orderSelect = document.getElementById("orderSelect");
const reencodeCheckbox = document.getElementById("reencodeCheckbox");
const statusEl = document.getElementById("status");
const downloadLink = document.getElementById("downloadLink");
const resultThumbnails = document.getElementById("resultThumbnails");
const resultPreview = document.getElementById("resultPreview");

initTabs({ tabMerge, tabSplit, mergeSection, splitSection, initialMode: "split" });
const setResult = createResultSetter(downloadLink, resultPreview, resultThumbnails);

frontInput.addEventListener("change", async () => {
  try {
    await updateSinglePreview(frontInput, frontMeta, frontCanvas, "Front");
  } catch (e) {
    frontMeta.textContent = `Front preview error: ${e.message}`;
  }
});

backInput.addEventListener("change", async () => {
  try {
    await updateSinglePreview(backInput, backMeta, backCanvas, "Back");
  } catch (e) {
    backMeta.textContent = `Back preview error: ${e.message}`;
  }
});

splitInput.addEventListener("change", async () => {
  try {
    await updateSinglePreview(splitInput, splitMeta, splitCanvas, "Split Input");
  } catch (e) {
    splitMeta.textContent = `Split preview error: ${e.message}`;
  }
});

runMergeBtn.addEventListener("click", async () => {
  const frontFile = frontInput.files?.[0];
  const backFile = backInput.files?.[0];
  if (!frontFile || !backFile) {
    statusEl.textContent = "Front と Back の両方のPDFを選択してください。";
    return;
  }

  try {
    statusEl.textContent = "結合中...";
    const result = await runMerge(frontFile, backFile, {
      frontOrder: frontOrderSelect.value,
      backOrder: backOrderSelect.value,
    });
    await setResult(result.bytes, result.filename, result.thumbnailTags);
    statusEl.textContent = result.statusText;
  } catch (e) {
    statusEl.textContent = `結合エラー: ${e.message}`;
  }
});

runSplitBtn.addEventListener("click", async () => {
  const inputFile = splitInput.files?.[0];
  if (!inputFile) {
    statusEl.textContent = "分割対象のPDFを選択してください。";
    return;
  }

  const direction = directionSelect.value;
  const order = orderSelect.value;
  const reencode = reencodeCheckbox.checked;

  try {
    statusEl.textContent = reencode
      ? "分割中...（軽量化のため少し時間がかかります）"
      : "分割中...";
    const result = await runSplit(inputFile, { direction, order, reencode });
    await setResult(result.bytes, result.filename, result.thumbnailTags);
    statusEl.textContent = result.statusText;
  } catch (e) {
    statusEl.textContent = `分割エラー: ${e.message}`;
  }
});
