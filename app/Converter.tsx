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
    const failed = () => { cleanup(); reject(new Error("영상을 읽지 못했습니다.")); };
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
      setError("비디오 파일을 선택해주세요.");
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
      setError(`GIF 구간은 최대 ${MAX_DURATION}초까지 만들 수 있어요.`);
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
      if (!context) throw new Error("이 브라우저에서 변환을 시작할 수 없습니다.");

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
      setError(reason instanceof Error ? reason.message : "GIF 변환 중 문제가 생겼습니다.");
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
        <a className="brand" href="#top" aria-label="Looply 홈"><span className="brand-mark">L</span>Looply</a>
        <span className="privacy"><span className="status-dot" />파일은 기기 밖으로 나가지 않아요</span>
      </nav>
      <section className="hero" id="top">
        <div className="eyebrow">VIDEO → GIF, SIMPLIFIED</div>
        <h1>움직이는 순간을<br /><em>가볍게</em> 공유하세요.</h1>
        <p>영상의 필요한 부분만 골라 선명한 GIF로 바꿔보세요.<br />업로드 없이, 이 브라우저 안에서 바로 완성됩니다.</p>
      </section>
      <section className={`studio ${file ? "has-file" : ""}`}>
        {!file ? (
          <div className="dropzone" onDrop={onDrop} onDragOver={(e) => e.preventDefault()} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}>
            <div className="upload-icon">↑</div><h2>비디오를 여기에 놓으세요</h2><p>또는 클릭해서 파일 선택</p><span>MP4 · MOV · WEBM · 최대 12초 구간</span><button type="button">비디오 선택</button>
          </div>
        ) : (
          <div className="editor">
            <div className="preview-panel">
              <div className="panel-heading"><div><span className="step">01</span><h2>미리보기</h2></div><button className="text-button" type="button" onClick={reset}>다른 영상</button></div>
              <div className="media-stage">
                <div className={`media-frame ${isPortrait ? "portrait" : "landscape"}`} style={sourceWidth && sourceHeight ? { aspectRatio: `${sourceWidth} / ${sourceHeight}` } : undefined}>{gifUrl ? (
                  <img src={gifUrl} alt="완성된 GIF 미리보기" />
                ) : <video ref={videoRef} src={videoUrl} controls playsInline muted onLoadedMetadata={onLoaded} />}</div>
              </div>
              <div className="file-row"><span className="file-name">{file.name}</span><span>{sourceWidth > 0 ? `${isPortrait ? "세로" : "가로"} · ${sourceWidth} × ${sourceHeight}` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span></div>
            </div>
            <div className="settings-panel">
              <div className="panel-heading"><div><span className="step">02</span><h2>GIF 설정</h2></div></div>
              <div className="control-group"><label>구간 <span>{formatTime(start)} — {formatTime(end)}</span></label><div className="time-inputs"><input aria-label="시작 시간" type="number" min="0" max={end} step="0.1" value={start.toFixed(1)} onChange={(e) => setStart(Math.max(0, Math.min(Number(e.target.value), end - 0.1)))} /><span>부터</span><input aria-label="종료 시간" type="number" min={start} max={duration} step="0.1" value={end.toFixed(1)} onChange={(e) => setEnd(Math.min(duration, Math.max(Number(e.target.value), start + 0.1)))} /><span>까지</span></div><input className="range" aria-label="종료 시간 슬라이더" type="range" min={Math.min(start + 0.1, duration)} max={duration || 1} step="0.1" value={end} onChange={(e) => setEnd(Number(e.target.value))} /></div>
              <div className="two-controls"><div className="control-group"><label htmlFor="fps">프레임</label><select id="fps" value={fps} onChange={(e) => setFps(Number(e.target.value))}><option value="8">8 FPS · 작게</option><option value="12">12 FPS · 균형</option><option value="16">16 FPS · 부드럽게</option></select></div><div className="control-group"><label htmlFor="size">긴 변 크기 <span>{output.width > 0 ? `${output.width} × ${output.height}` : "원본 비율"}</span></label><select id="size" value={longEdge} onChange={(e) => setLongEdge(Number(e.target.value))}><option value="480">480 px · 작게</option><option value="720">720 px · 균형</option><option value="960">960 px · 선명하게</option></select></div></div>
              <div className="control-group"><label htmlFor="colors">색상 <span>{quality} colors</span></label><input id="colors" className="range" type="range" min="64" max="256" step="64" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></div>
              {error && <p className="error" role="alert">{error}</p>}{busy && <div className="progress"><span style={{ width: `${progress}%` }} /><b>{progress}%</b></div>}
              {gifUrl ? <div className="success-box"><div><strong>GIF가 완성됐어요</strong><span>{(gifSize / 1024 / 1024).toFixed(1)} MB</span></div><a className="primary" href={gifUrl} download={`${file.name.replace(/\.[^.]+$/, "")}.gif`}>GIF 다운로드 ↓</a><button className="again" type="button" onClick={() => { URL.revokeObjectURL(gifUrl); setGifUrl(""); setProgress(0); }}>설정 다시 바꾸기</button></div> : <button className="primary convert" type="button" onClick={createGif} disabled={busy || !duration}>{busy ? "GIF를 만들고 있어요…" : "GIF 만들기  →"}</button>}
            </div>
          </div>
        )}
        <input ref={inputRef} className="hidden-input" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={(e: ChangeEvent<HTMLInputElement>) => loadFile(e.target.files?.[0])} />
      </section>
      <footer><span>빠르게, 예쁘게, 그리고 안전하게.</span><span>LOOPLY / 2026</span></footer>
    </main>
  );
}
