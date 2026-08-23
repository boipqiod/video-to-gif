"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

const MAX_DURATION = 12;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00.0";
  const mins = Math.floor(seconds / 60);
  return `${mins}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

function outputDimensions(sourceWidth: number, sourceHeight: number, longEdge: number) {
  if (!sourceWidth || !sourceHeight) return { width: 0, height: 0 };
  const scale = Math.min(1, longEdge / Math.max(sourceWidth, sourceHeight));
  const even = (value: number) => Math.max(2, Math.round(value * scale / 2) * 2);
  return { width: even(sourceWidth), height: even(sourceHeight) };
}

function waitFor(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("We couldn't read this video.")); };
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
}

export default function Converter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [fps, setFps] = useState(12);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [longEdge, setLongEdge] = useState(720);
  const [quality, setQuality] = useState(128);
  const [gifUrl, setGifUrl] = useState("");
  const [gifSize, setGifSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setFile(nextFile);
    setVideoUrl(URL.createObjectURL(nextFile));
    setGifUrl("");
    setError("");
    setProgress(0);
  };

  const onLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    const total = video.duration;
    setDuration(total);
    setSourceWidth(video.videoWidth);
    setSourceHeight(video.videoHeight);
    setStart(0);
    setEnd(Math.min(total, 5));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    loadFile(event.dataTransfer.files[0]);
  };

  const createGif = async () => {
    const video = videoRef.current;
    if (!video || !file || end <= start) return;
    if (end - start > MAX_DURATION) {
      setError(`GIF clips can be up to ${MAX_DURATION} seconds long.`);
      return;
    }
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const { width: outputWidth, height: outputHeight } = outputDimensions(video.videoWidth, video.videoHeight, longEdge);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("GIF conversion isn't available in this browser.");

      const encoder = GIFEncoder();
      const totalFrames = Math.max(1, Math.ceil((end - start) * fps));
      const delay = Math.round(1000 / fps);
      for (let frame = 0; frame < totalFrames; frame += 1) {
        const time = Math.min(end, start + frame / fps);
        if (Math.abs(video.currentTime - time) > 0.001) {
          video.currentTime = time;
          await waitFor(video, "seeked");
        }
        context.drawImage(video, 0, 0, outputWidth, outputHeight);
        const rgba = context.getImageData(0, 0, outputWidth, outputHeight).data;
        const palette = quantize(rgba, quality, { format: "rgba4444", oneBitAlpha: false });
        const index = applyPalette(rgba, palette, "rgba4444");
        encoder.writeFrame(index, outputWidth, outputHeight, { palette, delay, repeat: frame === 0 ? 0 : undefined });
        setProgress(Math.round(((frame + 1) / totalFrames) * 100));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      encoder.finish();
      const blob = new Blob([encoder.bytes()], { type: "image/gif" });
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      setGifUrl(URL.createObjectURL(blob));
      setGifSize(blob.size);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong while creating your GIF.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setFile(null); setVideoUrl(""); setGifUrl(""); setDuration(0); setSourceWidth(0); setSourceHeight(0); setError(""); setProgress(0);
  };

  const output = outputDimensions(sourceWidth, sourceHeight, longEdge);
  const isPortrait = sourceHeight > sourceWidth;

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#/" aria-label="Simon's Tools home"><span className="brand-mark">S</span>Simon&apos;s Tools</a>
        <a className="back-link" href="#/">← All tools</a>
      </nav>
      <section className="hero" id="top">
        <div className="eyebrow">MEDIA TOOL / 01</div>
        <h1>Turn video<br />into a <em>GIF.</em></h1>
        <p>Pick the moment you want and turn it into a crisp, shareable GIF.<br />No uploads — everything happens right in your browser.</p>
      </section>
      <section className={`studio ${file ? "has-file" : ""}`}>
        {!file ? (
          <div className="dropzone" onDrop={onDrop} onDragOver={(e) => e.preventDefault()} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}>
            <div className="upload-icon">↑</div><h2>Drop your video here</h2><p>or click to browse your files</p><span>MP4 · MOV · WEBM · CLIPS UP TO 12 SEC</span><button type="button">Choose a video</button>
          </div>
        ) : (
          <div className="editor">
            <div className="preview-panel">
              <div className="panel-heading"><div><span className="step">01</span><h2>Preview</h2></div><button className="text-button" type="button" onClick={reset}>Change video</button></div>
              <div className="media-stage">
                <div className={`media-frame ${isPortrait ? "portrait" : "landscape"}`} style={sourceWidth && sourceHeight ? { aspectRatio: `${sourceWidth} / ${sourceHeight}` } : undefined}>{gifUrl ? (
                  <img src={gifUrl} alt="Finished GIF preview" />
                ) : <video ref={videoRef} src={videoUrl} controls playsInline muted onLoadedMetadata={onLoaded} />}</div>
              </div>
              <div className="file-row"><span className="file-name">{file.name}</span><span>{sourceWidth > 0 ? `${isPortrait ? "Portrait" : "Landscape"} · ${sourceWidth} × ${sourceHeight}` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span></div>
            </div>
            <div className="settings-panel">
              <div className="panel-heading"><div><span className="step">02</span><h2>GIF settings</h2></div></div>
              <div className="control-group"><label>Clip <span>{formatTime(start)} — {formatTime(end)}</span></label><div className="time-inputs"><input aria-label="Start time" type="number" min="0" max={end} step="0.1" value={start.toFixed(1)} onChange={(e) => setStart(Math.max(0, Math.min(Number(e.target.value), end - 0.1)))} /><span>to</span><input aria-label="End time" type="number" min={start} max={duration} step="0.1" value={end.toFixed(1)} onChange={(e) => setEnd(Math.min(duration, Math.max(Number(e.target.value), start + 0.1)))} /><span>sec</span></div><input className="range" aria-label="End time slider" type="range" min={Math.min(start + 0.1, duration)} max={duration || 1} step="0.1" value={end} onChange={(e) => setEnd(Number(e.target.value))} /></div>
              <div className="two-controls"><div className="control-group"><label htmlFor="fps">Frame rate</label><select id="fps" value={fps} onChange={(e) => setFps(Number(e.target.value))}><option value="8">8 FPS · Smaller</option><option value="12">12 FPS · Balanced</option><option value="16">16 FPS · Smoother</option></select></div><div className="control-group"><label htmlFor="size">Long edge <span>{output.width > 0 ? `${output.width} × ${output.height}` : "Original ratio"}</span></label><select id="size" value={longEdge} onChange={(e) => setLongEdge(Number(e.target.value))}><option value="480">480 px · Small</option><option value="720">720 px · Balanced</option><option value="960">960 px · Crisp</option></select></div></div>
              <div className="control-group"><label htmlFor="colors">Colors <span>{quality} colors</span></label><input id="colors" className="range" type="range" min="64" max="256" step="64" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></div>
              {error && <p className="error" role="alert">{error}</p>}{busy && <div className="progress"><span style={{ width: `${progress}%` }} /><b>{progress}%</b></div>}
              {gifUrl ? <div className="success-box"><div><strong>Your GIF is ready</strong><span>{(gifSize / 1024 / 1024).toFixed(1)} MB</span></div><a className="primary" href={gifUrl} download={`${file.name.replace(/\.[^.]+$/, "")}.gif`}>Download GIF ↓</a><button className="again" type="button" onClick={() => { URL.revokeObjectURL(gifUrl); setGifUrl(""); setProgress(0); }}>Adjust settings</button></div> : <button className="primary convert" type="button" onClick={createGif} disabled={busy || !duration}>{busy ? "Creating your GIF…" : "Create GIF  →"}</button>}
            </div>
          </div>
        )}
        <input ref={inputRef} className="hidden-input" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={(e: ChangeEvent<HTMLInputElement>) => loadFile(e.target.files?.[0])} />
      </section>
      <footer><span>FAST, POLISHED, AND PRIVATE.</span><span>SIMON&apos;S TOOLS / 2026</span></footer>
    </main>
  );
}
