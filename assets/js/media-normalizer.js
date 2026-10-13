const objectUrls = new WeakMap();
const rotationCache = new Map();
const RANGE_BYTES = 262144;

function cssSupportsExifOrientation() {
  return typeof CSS !== "undefined" && CSS.supports?.("image-orientation: from-image");
}

/**
 * Modern browsers orient JPEG/HEIF images from their metadata through CSS.
 * In older engines, use createImageBitmap's EXIF-aware decode and write an
 * oriented bitmap to a temporary object URL. If the format/decoder cannot be
 * normalized, leave the source untouched rather than guessing a rotation.
 */
export async function normalizeImageOrientation(image, source) {
  if (!image || !source) return;
  image.style.imageOrientation = "from-image";
  if (cssSupportsExifOrientation() || typeof createImageBitmap !== "function") return;

  try {
    const response = await fetch(source, { credentials: "same-origin", cache: "force-cache" });
    if (!response.ok) return;
    const blob = await response.blob();
    if (!/^image\/(jpeg|png|webp|avif|heic|heif|tiff)/i.test(blob.type || "image/jpeg")) return;
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) { bitmap.close?.(); return; }
    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const normalized = await new Promise(resolve => canvas.toBlob(resolve, blob.type || "image/jpeg", 0.94));
    if (!normalized || !image.isConnected) return;
    const url = URL.createObjectURL(normalized);
    const previous = objectUrls.get(image);
    objectUrls.set(image, url);
    image.addEventListener("load", () => {
      if (previous) URL.revokeObjectURL(previous);
    }, { once: true });
    image.src = url;
  } catch (_) {
    // Preserve the original source if this browser cannot decode/normalize it.
  }
}

function readU32(view, offset) {
  return offset >= 0 && offset + 4 <= view.byteLength ? view.getUint32(offset, false) : 0;
}

function boxAt(view, offset, end) {
  if (offset + 8 > end) return null;
  let size = readU32(view, offset);
  const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
  let header = 8;
  if (size === 1) {
    if (offset + 16 > end) return null;
    const high = readU32(view, offset + 8);
    const low = readU32(view, offset + 12);
    size = high * 4294967296 + low;
    header = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (!Number.isFinite(size) || size < header || offset + size > end) return null;
  return { type, start: offset, payload: offset + header, end: offset + size, size };
}

function childBoxes(view, parent, wanted) {
  const found = [];
  let offset = parent.payload;
  while (offset + 8 <= parent.end) {
    const box = boxAt(view, offset, parent.end);
    if (!box) break;
    if (!wanted || box.type === wanted) found.push(box);
    offset = box.end;
  }
  return found;
}

function findMoov(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 4; i + 4 <= view.byteLength; i++) {
    if (view.getUint8(i) !== 109 || view.getUint8(i + 1) !== 111 || view.getUint8(i + 2) !== 111 || view.getUint8(i + 3) !== 118) continue;
    const start = i - 4;
    const size32 = readU32(view, start);
    let size = size32;
    let header = 8;
    if (size32 === 1) {
      if (start + 16 > view.byteLength) continue;
      size = readU32(view, start + 8) * 4294967296 + readU32(view, start + 12);
      header = 16;
    }
    if (size >= header && start + size <= view.byteLength) return new DataView(bytes.buffer, bytes.byteOffset + start, size);
  }
  return null;
}

function parseTrackOrientation(moovView) {
  const moov = boxAt(moovView, 0, moovView.byteLength);
  if (!moov || moov.type !== "moov") return null;
  for (const trak of childBoxes(moovView, moov, "trak")) {
    const mdia = childBoxes(moovView, trak, "mdia")[0];
    if (!mdia) continue;
    const hdlr = childBoxes(moovView, mdia, "hdlr")[0];
    if (!hdlr || hdlr.payload + 12 > hdlr.end) continue;
    const handler = String.fromCharCode(moovView.getUint8(hdlr.payload + 8), moovView.getUint8(hdlr.payload + 9), moovView.getUint8(hdlr.payload + 10), moovView.getUint8(hdlr.payload + 11));
    if (handler !== "vide") continue;
    const tkhd = childBoxes(moovView, trak, "tkhd")[0];
    if (!tkhd || tkhd.payload + 4 > tkhd.end) continue;
    const version = moovView.getUint8(tkhd.payload);
    const matrix = tkhd.payload + (version === 1 ? 52 : 40);
    if (matrix + 44 > tkhd.end) continue;
    const a = moovView.getInt32(matrix, false) / 65536;
    const b = moovView.getInt32(matrix + 4, false) / 65536;
    const rawAngle = Math.atan2(b, a) * 180 / Math.PI;
    const angle = ((Math.round(rawAngle / 90) * 90) % 360 + 360) % 360;
    const displayWidth = moovView.getUint32(matrix + 36, false) / 65536;
    const displayHeight = moovView.getUint32(matrix + 40, false) / 65536;
    if (![0, 90, 180, 270].includes(angle)) return null;
    return { angle, displayRatio: displayWidth > 0 && displayHeight > 0 ? displayWidth / displayHeight : 0 };
  }
  return null;
}

async function getMp4Orientation(source) {
  if (!/\.(mp4|mov|m4v)(?:[?#].*)?$/i.test(source)) return null;
  if (rotationCache.has(source)) return rotationCache.get(source);
  const task = (async () => {
    try {
      const first = await fetch(source, { headers: { Range: `bytes=0-${RANGE_BYTES - 1}` }, cache: "force-cache" });
      if (first.status !== 206) return null;
      const firstBytes = new Uint8Array(await first.arrayBuffer());
      let moov = findMoov(firstBytes);
      if (!moov) {
        const contentRange = first.headers.get("content-range") || "";
        const total = Number(contentRange.split("/").pop());
        if (!Number.isFinite(total) || total <= firstBytes.length) return null;
        const start = Math.max(0, total - RANGE_BYTES);
        const tail = await fetch(source, { headers: { Range: `bytes=${start}-${total - 1}` }, cache: "force-cache" });
        if (tail.status !== 206) return null;
        moov = findMoov(new Uint8Array(await tail.arrayBuffer()));
      }
      return moov ? parseTrackOrientation(moov) : null;
    } catch (_) {
      return null;
    }
  })();
  rotationCache.set(source, task);
  return task;
}

function setFrameRatio(frame, ratio) {
  if (!frame || !Number.isFinite(ratio) || ratio <= 0) return;
  if (frame.classList.contains("video-preview") && frame.closest(".masonry-view")) {
    frame.style.aspectRatio = String(ratio);
    frame.style.height = "auto";
    return;
  }
  if (frame.classList.contains("video-frame")) {
    const parentWidth = frame.parentElement?.clientWidth || Math.min(window.innerWidth - 48, 1200);
    const parentHeight = frame.parentElement?.clientHeight || 0;
    const availableHeight = parentHeight > 300 ? parentHeight : window.innerHeight * 0.75;
    const maxHeight = Math.min(window.innerHeight * 0.75, availableHeight);
    const width = Math.max(1, Math.min(parentWidth, maxHeight * ratio));
    const height = Math.max(1, width / ratio);
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.aspectRatio = String(ratio);
  }
}

function addRotatedVideoControls(video, frame) {
  if (!frame || frame.parentElement?.querySelector(":scope > .video-orientation-controls")) return;
  const controls = document.createElement("div");
  controls.className = "video-orientation-controls";
  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "▶";
  play.setAttribute("aria-label", "Reproduzir vídeo");
  const seek = document.createElement("input");
  seek.type = "range";
  seek.min = "0";
  seek.max = "1000";
  seek.value = "0";
  seek.setAttribute("aria-label", "Posição do vídeo");
  const time = document.createElement("span");
  time.className = "video-orientation-time";
  time.textContent = "0:00 / 0:00";
  const formatTime = value => {
    if (!Number.isFinite(value)) return "0:00";
    const seconds = Math.max(0, Math.floor(value));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const update = () => {
    play.textContent = video.paused ? "▶" : "Ⅱ";
    play.setAttribute("aria-label", video.paused ? "Reproduzir vídeo" : "Pausar vídeo");
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    if (Number.isFinite(video.duration) && video.duration > 0 && document.activeElement !== seek) {
      seek.value = String(Math.round(video.currentTime / video.duration * 1000));
    }
  };
  play.addEventListener("click", () => video.paused ? video.play().catch(() => {}) : video.pause());
  seek.addEventListener("input", () => {
    if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Number(seek.value) / 1000 * video.duration;
  });
  for (const event of ["play", "pause", "timeupdate", "durationchange", "ended", "loadedmetadata"]) video.addEventListener(event, update);
  controls.append(play, seek, time);
  frame.insertAdjacentElement("afterend", controls);
  update();
}

function fitRotatedVideo(video, frame, angle, thumbnail) {
  if (!frame || ![90, 270].includes(angle)) return;
  video.classList.add("video-rotated");
  video.style.position = "absolute";
  video.style.top = "50%";
  video.style.left = "50%";
  video.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
  video.style.transformOrigin = "center center";
  video.style.objectFit = thumbnail ? "cover" : "contain";
  if (!thumbnail) {
    video.controls = false;
    addRotatedVideoControls(video, frame);
  }
  const fit = () => {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    video.style.width = `${rect.height}px`;
    video.style.height = `${rect.width}px`;
  };
  fit();
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    video.addEventListener("emptied", () => observer.disconnect(), { once: true });
  }
}

/**
 * Let the browser decode track rotation first. If an MP4/MOV track matrix says
 * it is rotated and the browser still exposes the encoded (unrotated) ratio,
 * rotate the rendered frame. Range requests are bounded; the video is never
 * downloaded in full just to inspect metadata.
 */
export function normalizeVideoElement(video, source, frame, { thumbnail = false } = {}) {
  if (!video) return;
  video.playsInline = true;
  video.style.objectFit = thumbnail ? "cover" : "contain";
  const updateDimensions = () => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width > 0 && height > 0 && !video.classList.contains("video-rotated")) {
      setFrameRatio(frame, width / height);
    }
  };
  video.addEventListener("loadedmetadata", updateDimensions);
  video.addEventListener("resize", updateDimensions);
  video.addEventListener("loadedmetadata", async () => {
    const metadata = await getMp4Orientation(source || video.currentSrc || video.src);
    if (!metadata || !metadata.angle) return;
    const intrinsicRatio = video.videoWidth / video.videoHeight;
    const targetRatio = metadata.displayRatio;
    if (!targetRatio || !Number.isFinite(intrinsicRatio)) return;
    const same = Math.abs(intrinsicRatio - targetRatio) < 0.08;
    const inverse = Math.abs(intrinsicRatio - 1 / targetRatio) < 0.08;
    // Avoid double rotation on engines that already honor the track matrix.
    if (same || !inverse) return;
    setFrameRatio(frame, targetRatio);
    fitRotatedVideo(video, frame, metadata.angle, thumbnail);
  }, { once: true });
}
