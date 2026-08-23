import { useEffect, useMemo, useState } from "react";
import Converter from "./Converter";

type Category = "All" | "Video" | "Image" | "Document" | "Text";

const tools = [
  { id: "video-to-gif", name: "Video to GIF", description: "Turn the best part of any video into a lightweight GIF", category: "Video" as Category, mark: "GIF", tone: "lime", ready: true },
  { id: "image-compressor", name: "Image Compressor", description: "Shrink file size while keeping your images crisp", category: "Image" as Category, mark: "ZIP", tone: "blue", ready: false },
  { id: "image-resizer", name: "Image Resizer", description: "Resize pixels and proportions in a few clicks", category: "Image" as Category, mark: "↗", tone: "orange", ready: false },
  { id: "format-converter", name: "Format Converter", description: "Convert between PNG, JPG, and WebP", category: "Image" as Category, mark: "WEBP", tone: "pink", ready: false },
  { id: "pdf-maker", name: "Images to PDF", description: "Combine multiple images into a single PDF", category: "Document" as Category, mark: "PDF", tone: "yellow", ready: false },
  { id: "qr-maker", name: "QR Code Maker", description: "Turn any link or text into a QR code", category: "Text" as Category, mark: "QR", tone: "violet", ready: false },
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
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const categories: Category[] = ["All", "Video", "Image", "Document", "Text"];
  const visibleTools = useMemo(() => tools.filter((tool) => {
    const matchesCategory = category === "All" || tool.category === category;
    const needle = query.trim().toLowerCase();
    return matchesCategory && (!needle || `${tool.name} ${tool.description}`.toLowerCase().includes(needle));
  }), [category, query]);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand dashboard-brand" href="#/" aria-label="Simon's Tools home"><span className="brand-mark">S</span><span>Simon&apos;s<br />Tools</span></a>
        <nav className="category-nav" aria-label="Tool categories">
          <span className="nav-label">TOOLBOX</span>
          {categories.map((item) => <button key={item} className={category === item ? "active" : ""} type="button" onClick={() => setCategory(item)}><span>{item === "All" ? "⌂" : item === "Video" ? "▶" : item === "Image" ? "▧" : item === "Document" ? "▤" : "T"}</span>{item}</button>)}
        </nav>
        <p className="local-note"><span className="status-dot" /><strong>100% Local</strong><br />Your files never leave your device.</p>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="topbar-kicker">PERSONAL WEB TOOLBOX</span><strong>Just the useful stuff, all in one place.</strong></div>
          <label className="tool-search"><span>⌕</span><input type="search" placeholder="Search tools" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search tools" /></label>
        </header>

        <div className="dashboard-hero">
          <div><span className="dashboard-date">SIMON&apos;S PICKS · 2026</span><h1>Handy tools,<br /><em>right when</em> you need them.</h1><p>No installs. No sign-ups. Drop in your file<br />and everything happens right in your browser.</p></div>
          <div className="hero-stamp"><span>01</span><strong>READY<br />TO USE</strong></div>
        </div>

        <div className="tools-heading"><div><h2>{category === "All" ? "All tools" : `${category} tools`}</h2><span>{visibleTools.length.toString().padStart(2, "0")} TOOLS</span></div><p>More useful tools are on the way.</p></div>
        <div className="tool-grid">
          {visibleTools.map((tool) => tool.ready ? (
            <a className="tool-card ready" href={`#/${tool.id}`} key={tool.id}>
              <div className={`tool-mark ${tool.tone}`}>{tool.mark}</div><div className="tool-meta"><span>{tool.category} · READY</span><h3>{tool.name}</h3><p>{tool.description}</p></div><span className="card-arrow">↗</span>
            </a>
          ) : (
            <div className="tool-card" key={tool.id} aria-disabled="true">
              <div className={`tool-mark ${tool.tone}`}>{tool.mark}</div><div className="tool-meta"><span>{tool.category} · COMING SOON</span><h3>{tool.name}</h3><p>{tool.description}</p></div><span className="soon-badge">SOON</span>
            </div>
          ))}
        </div>
        {visibleTools.length === 0 && <div className="empty-tools">No tools found — yet.</div>}
        <footer className="dashboard-footer"><span>SIMON&apos;S TOOLS</span><span>SMALL TOOLS, BIG HELP.</span></footer>
      </section>
    </main>
  );
}

export default function App() {
  const route = useHashRoute();
  return route === "video-to-gif" ? <Converter /> : <Dashboard />;
}
