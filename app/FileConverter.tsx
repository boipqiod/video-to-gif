import { ChangeEvent, DragEvent, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

type OutputFormat = "jpeg" | "png" | "webp" | "pdf";

type ConvertedFile = {
  name: string;
  blob: Blob;
  url: string;
  width?: number;
  height?: number;
};

type RasterPage = {
  canvas: HTMLCanvasElement;
  name: string;
};

const acceptedExtensions = ["pdf", "heic", "heif", "jpg", "jpeg", "png", "webp"];

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function outputExtension(format: OutputFormat) {
  return format === "jpeg" ? "jpg" : format;
}

function outputMime(format: Exclude<OutputFormat, "pdf">) {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("This image could not be encoded.")),
    type,
    quality,
  ));
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function canvasWithBackground(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0);
  return canvas;
}

async function imageToCanvas(file: File) {
  const isHeicFile = ["heic", "heif"].includes(extension(file.name)) || /hei[cf]/i.test(file.type);
  let bitmap: ImageBitmap;
  if (isHeicFile) {
    const { heicTo } = await import("heic-to/csp");
    bitmap = await heicTo({ blob: file, type: "bitmap" });
  } else {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is not available in this browser.");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function pdfToCanvases(file: File, scale: number, onPage: (page: number, total: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: RasterPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    onPage(pageNumber, pdfDocument.numPages);
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = documentOwnerCanvas(Math.round(viewport.width), Math.round(viewport.height));
    await page.render({ canvas, viewport, background: "#ffffff" }).promise;
    pages.push({ canvas, name: `${baseName(file.name)}-page-${String(pageNumber).padStart(3, "0")}` });
    page.cleanup();
  }
  await pdfDocument.cleanup();
  return pages;
}

function documentOwnerCanvas(width: number, height: number) {
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export default function FileConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState(1);
  const [pdfScale, setPdfScale] = useState(2);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const clearResults = () => {
    results.forEach((result) => URL.revokeObjectURL(result.url));
    setResults([]);
  };

  const loadFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => acceptedExtensions.includes(extension(file.name)));
    if (!valid.length) {
      setError("Choose PDF, HEIC, HEIF, JPG, PNG, or WebP files.");
      return;
    }
    clearResults();
    setFiles(valid);
    setError(valid.length === incoming.length ? "" : "Some unsupported files were skipped.");
    setProgress(0);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    loadFiles(Array.from(event.dataTransfer.files));
  };

  const convert = async () => {
    if (!files.length) return;
    clearResults();
    setBusy(true);
    setError("");
    setProgress(0);
    setStatus("Preparing files…");

    try {
      const rasters: RasterPage[] = [];
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex];
        setStatus(`Reading ${file.name}`);
        if (extension(file.name) === "pdf") {
          const pages = await pdfToCanvases(file, pdfScale, (page, total) => setStatus(`Rendering ${file.name} · page ${page} of ${total}`));
          rasters.push(...pages);
        } else {
          rasters.push({ canvas: await imageToCanvas(file), name: baseName(file.name) });
        }
        setProgress(Math.round(((fileIndex + 1) / files.length) * 55));
      }

      if (format === "pdf") {
        setStatus("Building PDF…");
        const { jsPDF } = await import("jspdf");
        const first = rasters[0];
        const firstOrientation = first.canvas.width >= first.canvas.height ? "landscape" : "portrait";
        const pdf = new jsPDF({ orientation: firstOrientation, unit: "px", format: [first.canvas.width, first.canvas.height], hotfixes: ["px_scaling"], compress: true });
        for (let index = 0; index < rasters.length; index += 1) {
          const { canvas } = rasters[index];
          if (index > 0) pdf.addPage([canvas.width, canvas.height], canvas.width >= canvas.height ? "landscape" : "portrait");
          const flattened = canvasWithBackground(canvas);
          pdf.addImage(flattened, "JPEG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
          setProgress(55 + Math.round(((index + 1) / rasters.length) * 45));
        }
        const blob = pdf.output("blob");
        const name = files.length === 1 ? `${baseName(files[0].name)}.pdf` : "simons-tools-converted.pdf";
        setResults([{ name, blob, url: URL.createObjectURL(blob) }]);
      } else {
        const mime = outputMime(format);
        const converted: ConvertedFile[] = [];
        for (let index = 0; index < rasters.length; index += 1) {
          setStatus(`Encoding image ${index + 1} of ${rasters.length}`);
          const source = format === "jpeg" ? canvasWithBackground(rasters[index].canvas) : rasters[index].canvas;
          const blob = await canvasToBlob(source, mime, quality);
          converted.push({
            name: `${rasters[index].name}.${outputExtension(format)}`,
            blob,
            url: URL.createObjectURL(blob),
            width: source.width,
            height: source.height,
          });
          setProgress(55 + Math.round(((index + 1) / rasters.length) * 45));
        }
        setResults(converted);
      }
      setStatus("Done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversion failed. Try another file.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = async () => {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].name);
      return;
    }
    setStatus("Packing ZIP…");
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    results.forEach((result) => zip.file(result.name, result.blob));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    downloadBlob(blob, "simons-tools-converted.zip");
    setStatus("Done");
  };

  const reset = () => {
    clearResults();
    setFiles([]);
    setError("");
    setStatus("");
    setProgress(0);
  };

  return (
    <main className="file-converter">
      <nav className="nav">
        <a className="brand" href="#/" aria-label="Simon's Tools home"><span className="brand-mark">S</span>Simon&apos;s Tools</a>
        <a className="back-link" href="#/">← All tools</a>
      </nav>
      <section className="hero converter-hero" id="top">
        <div className="eyebrow">FILE TOOL / 02</div>
        <h1>Convert nearly<br /><em>anything.</em></h1>
        <p>PDF and iPhone photos included. Keep the original dimensions and aspect ratio,<br />then export as JPG, PNG, WebP, or PDF — entirely in your browser.</p>
      </section>

      <section className="studio file-studio">
        {!files.length ? (
          <div className="dropzone" onDrop={onDrop} onDragOver={(event) => event.preventDefault()} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()}>
            <div className="upload-icon">↗</div><h2>Drop files here</h2><p>Mix photos and PDFs, or click to browse</p><span>PDF · HEIC · HEIF · JPG · PNG · WEBP</span><button type="button">Choose files</button>
          </div>
        ) : (
          <div className="file-workspace">
            <section className="file-settings">
              <div className="panel-heading"><div><span className="step">01</span><h2>Files & output</h2></div><button className="text-button" type="button" onClick={reset}>Start over</button></div>
              <div className="selected-files">
                {files.map((file) => <div className="selected-file" key={`${file.name}-${file.lastModified}`}><span className="file-type">{extension(file.name).toUpperCase()}</span><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div></div>)}
              </div>
              <button className="add-files" type="button" onClick={() => inputRef.current?.click()}>+ Replace files</button>
              <div className="format-picker" role="group" aria-label="Output format">
                <span>Output format</span>
                <div>{(["jpeg", "png", "webp", "pdf"] as OutputFormat[]).map((item) => <button type="button" className={format === item ? "active" : ""} onClick={() => setFormat(item)} key={item}>{item === "jpeg" ? "JPG" : item.toUpperCase()}</button>)}</div>
              </div>
              {format !== "png" && format !== "pdf" && <div className="control-group"><label htmlFor="file-quality">Quality <span>{Math.round(quality * 100)}%</span></label><input id="file-quality" className="range" type="range" min="0.8" max="1" step="0.01" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></div>}
              {files.some((file) => extension(file.name) === "pdf") && <div className="control-group"><label htmlFor="pdf-resolution">PDF resolution</label><select id="pdf-resolution" value={pdfScale} onChange={(event) => setPdfScale(Number(event.target.value))}><option value="1.5">Standard · 1.5×</option><option value="2">High · 2×</option><option value="3">Ultra · 3×</option></select></div>}
              <p className="preserve-note">Photos keep their original pixel dimensions and aspect ratio. PDF pages are rendered at the resolution selected above.</p>
              {error && <p className="error" role="alert">{error}</p>}
              {busy && <div className="progress file-progress"><span style={{ width: `${progress}%` }} /><b>{progress}% · {status}</b></div>}
              <button className="primary convert" type="button" disabled={busy} onClick={convert}>{busy ? "Converting…" : `Convert to ${format === "jpeg" ? "JPG" : format.toUpperCase()}  →`}</button>
            </section>

            <section className="file-results">
              <div className="panel-heading"><div><span className="step">02</span><h2>Converted files</h2></div>{results.length > 0 && <span className="result-count">{results.length} FILE{results.length === 1 ? "" : "S"}</span>}</div>
              {!results.length ? <div className="result-placeholder"><span>↘</span><strong>Your converted files will appear here.</strong><p>Nothing is uploaded. The entire conversion stays on this device.</p></div> : <>
                <div className="result-grid">{results.map((result) => <article className="result-card" key={result.url}>{format === "pdf" ? <div className="pdf-preview">PDF</div> : <img src={result.url} alt="Converted file preview" />}<div><strong>{result.name}</strong><span>{result.width ? `${result.width} × ${result.height} · ` : ""}{(result.blob.size / 1024 / 1024).toFixed(2)} MB</span></div><a href={result.url} download={result.name} aria-label={`Download ${result.name}`}>↓</a></article>)}</div>
                <button className="primary download-all" type="button" onClick={downloadAll}>{results.length > 1 ? "Download all as ZIP" : "Download file"} ↓</button>
              </>}
            </section>
          </div>
        )}
        <input ref={inputRef} className="hidden-input" type="file" multiple accept=".pdf,.heic,.heif,.jpg,.jpeg,.png,.webp,application/pdf,image/heic,image/heif,image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => loadFiles(Array.from(event.target.files ?? []))} />
      </section>
      <footer><span>ORIGINAL SIZE. YOUR FORMAT. YOUR DEVICE.</span><span>SIMON&apos;S TOOLS / 2026</span></footer>
    </main>
  );
}
