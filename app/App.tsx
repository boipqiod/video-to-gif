import { useEffect, useMemo, useState } from "react";
import Converter from "./Converter";

type Category = "전체" | "영상" | "이미지" | "문서" | "텍스트";

const tools = [
  { id: "video-to-gif", name: "Video to GIF", description: "영상의 원하는 구간을 가벼운 GIF로", category: "영상" as Category, mark: "GIF", tone: "lime", ready: true },
  { id: "image-compressor", name: "이미지 압축", description: "화질은 지키고 파일 용량은 작게", category: "이미지" as Category, mark: "ZIP", tone: "blue", ready: false },
  { id: "image-resizer", name: "이미지 크기 조절", description: "픽셀과 비율을 원하는 크기로", category: "이미지" as Category, mark: "↗", tone: "orange", ready: false },
  { id: "format-converter", name: "이미지 형식 변환", description: "PNG, JPG, WebP를 서로 변환", category: "이미지" as Category, mark: "WEBP", tone: "pink", ready: false },
  { id: "pdf-maker", name: "이미지를 PDF로", description: "여러 이미지를 하나의 PDF 파일로", category: "문서" as Category, mark: "PDF", tone: "yellow", ready: false },
  { id: "qr-maker", name: "QR 코드 만들기", description: "링크와 텍스트를 바로 QR 코드로", category: "텍스트" as Category, mark: "QR", tone: "violet", ready: false },
];

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, ""));
  useEffect(() => {
    const update = () => setRoute(window.location.hash.replace(/^#\/?/, ""));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

function Dashboard() {
  const [category, setCategory] = useState<Category>("전체");
  const [query, setQuery] = useState("");
  const categories: Category[] = ["전체", "영상", "이미지", "문서", "텍스트"];
  const visibleTools = useMemo(() => tools.filter((tool) => {
    const matchesCategory = category === "전체" || tool.category === category;
    const needle = query.trim().toLowerCase();
    return matchesCategory && (!needle || `${tool.name} ${tool.description}`.toLowerCase().includes(needle));
  }), [category, query]);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand dashboard-brand" href="#/" aria-label="Simon's Tools 홈"><span className="brand-mark">S</span><span>Simon&apos;s<br />Tools</span></a>
        <nav className="category-nav" aria-label="도구 카테고리">
          <span className="nav-label">TOOLBOX</span>
          {categories.map((item) => <button key={item} className={category === item ? "active" : ""} type="button" onClick={() => setCategory(item)}><span>{item === "전체" ? "⌂" : item === "영상" ? "▶" : item === "이미지" ? "▧" : item === "문서" ? "▤" : "T"}</span>{item}</button>)}
        </nav>
        <p className="local-note"><span className="status-dot" /><strong>100% Local</strong><br />파일은 기기 안에서만 처리돼요.</p>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="topbar-kicker">PERSONAL WEB TOOLBOX</span><strong>유용한 것들만, 한곳에.</strong></div>
          <label className="tool-search"><span>⌕</span><input type="search" placeholder="도구 검색" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="도구 검색" /></label>
        </header>

        <div className="dashboard-hero">
          <div><span className="dashboard-date">SIMON&apos;S PICKS · 2026</span><h1>필요할 때<br />꺼내 쓰는 <em>도구들.</em></h1><p>설치도, 회원가입도 없이. 파일을 올리면<br />내 브라우저 안에서 바로 처리합니다.</p></div>
          <div className="hero-stamp"><span>01</span><strong>READY<br />TO USE</strong></div>
        </div>

        <div className="tools-heading"><div><h2>{category === "전체" ? "모든 도구" : `${category} 도구`}</h2><span>{visibleTools.length.toString().padStart(2, "0")} TOOLS</span></div><p>새 도구는 하나씩 계속 추가됩니다.</p></div>
        <div className="tool-grid">
          {visibleTools.map((tool) => tool.ready ? (
            <a className="tool-card ready" href={`#/${tool.id}`} key={tool.id}>
              <div className={`tool-mark ${tool.tone}`}>{tool.mark}</div><div className="tool-meta"><span>{tool.category} · 사용 가능</span><h3>{tool.name}</h3><p>{tool.description}</p></div><span className="card-arrow">↗</span>
            </a>
          ) : (
            <div className="tool-card" key={tool.id} aria-disabled="true">
              <div className={`tool-mark ${tool.tone}`}>{tool.mark}</div><div className="tool-meta"><span>{tool.category} · 준비 중</span><h3>{tool.name}</h3><p>{tool.description}</p></div><span className="soon-badge">SOON</span>
            </div>
          ))}
        </div>
        {visibleTools.length === 0 && <div className="empty-tools">찾는 도구가 아직 없어요.</div>}
        <footer className="dashboard-footer"><span>SIMON&apos;S TOOLS</span><span>SMALL TOOLS, BIG HELP.</span></footer>
      </section>
    </main>
  );
}

export default function App() {
  const route = useHashRoute();
  return route === "video-to-gif" ? <Converter /> : <Dashboard />;
}
