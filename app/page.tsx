"use client";

import { useMemo, useState } from "react";
import dashboardData from "./dashboard-data.json";

type Tab = "overview" | "creative" | "live";
type SortKey = "cost" | "revenue" | "roi" | "orders";
type LiveSortKey = "launchedAt" | "cost" | "revenue" | "roi" | "orders" | "views";
type LiveView = "leader" | "detail";
type CreativeRow = (typeof dashboardData.creative.creatives)[number];

const money = (n: number, short = false) => {
  if (short) {
    if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
    if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
    if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  }
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
};
const number = (n: number) => Math.round(n).toLocaleString("id-ID");
const pct = (n: number) => `${(n * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const roi = (n: number) => `${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })}x`;
const title = (value: string, max = 58) => value.length > max ? `${value.slice(0, max)}…` : value;
const cleanHostLabel = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b(live|campaign|host|official|shop|store)\b/gi, " ").replace(/\s+/g, " ").trim();
const hostEntityKey = (value: string) => {
  const cleaned = cleanHostLabel(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\b(beauty|official|shop|store)\b/g, " ").replace(/\s+/g, " ").trim();
  const first = cleaned.split(" ")[0] || "tanpa-host";
  return first.replace(/(.)\1+/g, "$1");
};
const liveSlot = (launchedAt: string) => { const hour = Number(launchedAt.slice(11, 13)); return hour < 10 ? "pagi" : hour < 14 ? "siang" : hour < 18 ? "sore" : "malam"; };
const liveDates = dashboardData.live.sessions.map((row) => row.day).filter(Boolean).sort();
const LIVE_MIN = liveDates[0] || "2026-02-01";
const LIVE_MAX = liveDates[liveDates.length - 1] || "2026-02-28";
const roiTone = (value: number) => value >= 10 ? "roi-good" : value >= 4 ? "roi-mid" : value > 0 ? "roi-bad" : "roi-none";
const creativeTier = (value: number) => value >= 6 ? "great" : value >= 4 ? "good" : value > 2 ? "mid" : "bad";
const creativeTierLabel = (value: number) => value >= 6 ? "Sangat bagus" : value >= 4 ? "Bagus" : value > 2 ? "Sedang" : "Buruk";
const tiktokVideoUrl = (row: CreativeRow) => {
  const account = row.account.replace(/^@/, "").trim();
  if (row.type.toLowerCase() !== "video" || !/^\d{10,}$/.test(row.videoId) || !account || account === "-") return null;
  return `https://www.tiktok.com/@${encodeURIComponent(account)}/video/${row.videoId}`;
};

function Kpi({ label, value, note, tone = "default" }: { label: string; value: string; note: string; tone?: string }) {
  return <article className={`kpi ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function Bars({ items, metric = "revenue" }: { items: Array<{ name: string; revenue: number; cost: number; roi: number }>; metric?: "revenue" | "roi" }) {
  const shown = items.slice(0, 6);
  const max = Math.max(1, ...shown.map((item) => item[metric]));
  return <div className="bars">
    {shown.map((item, index) => <div className="bar-row" key={item.name}>
      <div className="bar-label"><span className="rank">{String(index + 1).padStart(2, "0")}</span><span title={item.name}>{title(item.name, 22)}</span></div>
      <div className="bar-track"><i style={{ width: `${Math.max(2, item[metric] / max * 100)}%` }} /></div>
      <b>{metric === "roi" ? roi(item.roi) : money(item.revenue, true)}</b>
    </div>)}
  </div>;
}

function DataHealth() {
  return <section className="health-strip">
    <div><span className="pulse" /> <b>Data quality check</b></div>
    <p><b>Creative export mencapai batas 100.000 baris.</b> Angka creative adalah minimum yang terukur, bukan jaminan total lengkap. Livestream lengkap: 194 sesi.</p>
    <span className="status-pill">Perlu export terpisah per campaign</span>
  </section>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [campaign, setCampaign] = useState("all");
  const [query, setQuery] = useState("");
  const [onlySpend, setOnlySpend] = useState(true);
  const [sort, setSort] = useState<SortKey>("cost");
  const [selectedCreative, setSelectedCreative] = useState<CreativeRow | null>(null);
  const [liveFrom, setLiveFrom] = useState(LIVE_MIN);
  const [liveTo, setLiveTo] = useState(LIVE_MAX);
  const [liveHost, setLiveHost] = useState("all");
  const [liveSlots, setLiveSlots] = useState<string[]>([]);
  const [liveQuery, setLiveQuery] = useState("");
  const [liveView, setLiveView] = useState<LiveView>("leader");
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [liveSort, setLiveSort] = useState<LiveSortKey>("revenue");
  const [liveSortDesc, setLiveSortDesc] = useState(true);

  const creativeRows = useMemo(() => dashboardData.creative.creatives
    .filter((row) => campaign === "all" || row.campaign === campaign)
    .filter((row) => !onlySpend || row.cost > 0)
    .filter((row) => `${row.title} ${row.account} ${row.videoId}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b[sort] - a[sort]), [campaign, query, onlySpend, sort]);
  const selectedCreativeCampaigns = campaign === "all" ? dashboardData.creative.campaigns : dashboardData.creative.campaigns.filter((item) => item.name === campaign);
  const creativeSummary = selectedCreativeCampaigns.reduce((acc, item) => ({ cost: acc.cost + item.cost, revenue: acc.revenue + item.revenue, orders: acc.orders + item.orders, clicks: acc.clicks + item.clicks, impressions: acc.impressions + item.impressions }), { cost: 0, revenue: 0, orders: 0, clicks: 0, impressions: 0 });
  const creativeRoi = creativeSummary.cost ? creativeSummary.revenue / creativeSummary.cost : 0;
  const creativeTiers = creativeRows.reduce((acc, row) => { const tier = creativeTier(row.roi); acc[tier] += 1; return acc; }, { great: 0, good: 0, mid: 0, bad: 0 });
  const live = dashboardData.live.summary;
  const hostLabels = useMemo(() => {
    const labels = new Map<string, Map<string, number>>();
    dashboardData.live.sessions.forEach((row) => {
      const key = hostEntityKey(row.campaign);
      const label = cleanHostLabel(row.campaign);
      const variants = labels.get(key) ?? new Map<string, number>();
      variants.set(label, (variants.get(label) ?? 0) + 1);
      labels.set(key, variants);
    });
    return new Map([...labels].map(([key, variants]) => [key, [...variants].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]]));
  }, []);
  const filteredLiveSessions = useMemo(() => dashboardData.live.sessions
    .map((row) => ({ ...row, hostKey: hostEntityKey(row.campaign), host: hostLabels.get(hostEntityKey(row.campaign)) || cleanHostLabel(row.campaign), slot: liveSlot(row.launchedAt) }))
    .filter((row) => row.day >= liveFrom && row.day <= liveTo)
    .filter((row) => liveHost === "all" || row.hostKey === liveHost)
    .filter((row) => liveSlots.length === 0 || liveSlots.includes(row.slot))
    .filter((row) => `${row.name} ${row.campaign} ${row.campaignId} ${row.host}`.toLowerCase().includes(liveQuery.toLowerCase())), [hostLabels, liveFrom, liveTo, liveHost, liveSlots, liveQuery]);
  const liveLeaders = useMemo(() => {
    const grouped = new Map<string, { key: string; host: string; sessions: number; cost: number; revenue: number; orders: number; views: number; follows: number; roi: number }>();
    filteredLiveSessions.forEach((row) => {
      const item = grouped.get(row.hostKey) ?? { key: row.hostKey, host: row.host, sessions: 0, cost: 0, revenue: 0, orders: 0, views: 0, follows: 0, roi: 0 };
      item.sessions += 1; item.cost += row.cost; item.revenue += row.revenue; item.orders += row.orders; item.views += row.views; item.follows += row.follows;
      grouped.set(row.hostKey, item);
    });
    return [...grouped.values()].map((item) => ({ ...item, roi: item.cost ? item.revenue / item.cost : 0 })).sort((a, b) => {
      const av = a[liveSort === "launchedAt" ? "revenue" : liveSort]; const bv = b[liveSort === "launchedAt" ? "revenue" : liveSort]; return liveSortDesc ? bv - av : av - bv;
    });
  }, [filteredLiveSessions, liveSort, liveSortDesc]);
  const liveDetailRows = useMemo(() => filteredLiveSessions.filter((row) => !selectedHost || row.hostKey === selectedHost).sort((a, b) => {
    const av = liveSort === "launchedAt" ? a.launchedAt : a[liveSort]; const bv = liveSort === "launchedAt" ? b.launchedAt : b[liveSort];
    return liveSortDesc ? (bv > av ? 1 : bv < av ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0);
  }), [filteredLiveSessions, selectedHost, liveSort, liveSortDesc]);
  const liveAgg = filteredLiveSessions.reduce((acc, row) => ({ cost: acc.cost + row.cost, revenue: acc.revenue + row.revenue, orders: acc.orders + row.orders, views: acc.views + row.views, follows: acc.follows + row.follows }), { cost: 0, revenue: 0, orders: 0, views: 0, follows: 0 });
  const filteredLiveRoi = liveAgg.cost ? liveAgg.revenue / liveAgg.cost : 0;
  const filteredDaily = useMemo(() => {
    const days = new Map<string, { day: string; cost: number; revenue: number }>();
    filteredLiveSessions.forEach((row) => { const item = days.get(row.day) ?? { day: row.day, cost: 0, revenue: 0 }; item.cost += row.cost; item.revenue += row.revenue; days.set(row.day, item); });
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredLiveSessions]);
  const setLiveSortKey = (key: LiveSortKey) => { if (liveSort === key) setLiveSortDesc(!liveSortDesc); else { setLiveSort(key); setLiveSortDesc(true); } };
  const resetLiveFilters = () => { setLiveFrom(LIVE_MIN); setLiveTo(LIVE_MAX); setLiveHost("all"); setLiveSlots([]); setLiveQuery(""); setSelectedHost(null); setLiveView("leader"); };
  const openHost = (key: string) => { setSelectedHost(key); setLiveHost(key); setLiveView("detail"); setLiveSort("launchedAt"); setLiveSortDesc(true); };

  return <main>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span>GM</span></div><div><h1>GMV Max Command Center</h1><p>Creative video + livestream performance</p></div></div>
      <div className="period"><span>REPORTING PERIOD</span><b>01—28 FEB 2026</b></div>
    </header>

    <nav className="tabs" aria-label="Dashboard views">
      {(["overview", "creative", "live"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "active" : ""}>{item === "overview" ? "Overview" : item === "creative" ? "Creative Video" : "Livestream"}<span>{item === "creative" ? "100K" : item === "live" ? "194" : ""}</span></button>)}
    </nav>

    <DataHealth />

    {tab === "overview" && <>
      <section className="hero-grid">
        <article className="score-card">
          <div className="eyebrow">BLENDED PERFORMANCE</div>
          <div className="score-ring"><div><strong>{roi((dashboardData.creative.summary.revenue + live.revenue) / (dashboardData.creative.summary.cost + live.cost))}</strong><span>combined ROI</span></div></div>
          <div className="score-meta"><span>Total spend<b>{money(dashboardData.creative.summary.cost + live.cost, true)}</b></span><span>Gross revenue<b>{money(dashboardData.creative.summary.revenue + live.revenue, true)}</b></span></div>
        </article>
        <div className="kpi-grid overview-kpis">
          <Kpi label="Creative GMV" value={money(dashboardData.creative.summary.revenue, true)} note={`${number(dashboardData.creative.summary.orders)} orders`} tone="cyan" />
          <Kpi label="Live GMV" value={money(live.revenue, true)} note={`${number(live.rowCount)} sessions`} tone="pink" />
          <Kpi label="Creative ROI" value={roi(dashboardData.creative.summary.roi)} note={`${number(dashboardData.creative.summary.campaignCount)} campaigns`} />
          <Kpi label="Live ROI" value={roi(live.roi)} note={`${number(live.views)} views`} />
          <Kpi label="Creative Spend" value={money(dashboardData.creative.summary.cost, true)} note={`${number(dashboardData.creative.summary.videoRows)} video rows`} />
          <Kpi label="Live Spend" value={money(live.cost, true)} note={`${money(live.cost / live.orders)} per order`} />
        </div>
      </section>
      <section className="two-col">
        <article className="panel"><div className="panel-head"><div><span>CREATIVE CAMPAIGNS</span><h2>Revenue leaders</h2></div><button onClick={() => setTab("creative")}>Explore →</button></div><Bars items={dashboardData.creative.campaigns} /></article>
        <article className="panel"><div className="panel-head"><div><span>LIVE CAMPAIGNS</span><h2>Revenue leaders</h2></div><button onClick={() => setTab("live")}>Explore →</button></div><Bars items={dashboardData.live.campaigns} /></article>
      </section>
      <section className="insight-grid">
        <article><span className="insight-no">01</span><div><b>Creative concentration tinggi</b><p>Serum Copper 1 menyumbang {pct(dashboardData.creative.campaigns[0].revenue / dashboardData.creative.summary.revenue)} creative GMV. Pisahkan export per campaign untuk memastikan campaign kecil tidak terpotong limit.</p></div></article>
        <article><span className="insight-no">02</span><div><b>Live paling efisien</b><p>{dashboardData.live.campaigns[0].name} menghasilkan ROI {roi(dashboardData.live.campaigns[0].roi)}—tertinggi di antara campaign live Februari.</p></div></article>
        <article><span className="insight-no">03</span><div><b>Jangan gabungkan timeline</b><p>Waktu posting video bukan tanggal spend. Trend harian hanya dipakai untuk livestream karena setiap sesi punya launched time.</p></div></article>
      </section>
    </>}

    {tab === "creative" && <>
      <section className="section-heading"><div><span>CREATIVE VIDEO / PER CAMPAIGN</span><h2>Creative performance</h2><p>Satu baris = kombinasi campaign + product + video. Product card tetap dipisahkan dari video.</p></div><div className="snapshot">SNAPSHOT EXPORT <b>FEB 2026</b></div></section>
      <section className="controls">
        <label>Campaign<select value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">Semua campaign</option>{dashboardData.creative.campaigns.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label>Cari creative<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caption, account, video ID…" /></label>
        <label>Urutkan<select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}><option value="cost">Spend terbesar</option><option value="revenue">GMV terbesar</option><option value="roi">ROI terbesar</option><option value="orders">Order terbanyak</option></select></label>
        <button className={`toggle ${onlySpend ? "on" : ""}`} onClick={() => setOnlySpend(!onlySpend)}><i /> Hanya ada spend</button>
      </section>
      <section className="kpi-grid four">
        <Kpi label="Spend" value={money(creativeSummary.cost, true)} note={money(creativeSummary.cost)} />
        <Kpi label="Gross revenue" value={money(creativeSummary.revenue, true)} note={`${number(creativeSummary.orders)} orders`} tone="cyan" />
        <Kpi label="Blended ROI" value={roi(creativeRoi)} note="Revenue ÷ spend" />
        <Kpi label="CTR" value={pct(creativeSummary.impressions ? creativeSummary.clicks / creativeSummary.impressions : 0)} note={`${number(creativeSummary.clicks)} clicks`} />
      </section>
      <section className="creative-tier-grid" aria-label="Klasifikasi performa video">
        <article className="great"><span>Sangat bagus</span><strong>{number(creativeTiers.great)}</strong><small>ROI ≥ 6x</small></article>
        <article className="good"><span>Bagus</span><strong>{number(creativeTiers.good)}</strong><small>ROI 4–5,99x</small></article>
        <article className="mid"><span>Sedang</span><strong>{number(creativeTiers.mid)}</strong><small>ROI 2–3,99x</small></article>
        <article className="bad"><span>Buruk</span><strong>{number(creativeTiers.bad)}</strong><small>ROI ≤ 2x</small></article>
      </section>
      <section className="panel campaign-picker"><div className="panel-head"><div><span>CAMPAIGN OVERVIEW</span><h2>Pilih campaign untuk membuka video di dalamnya</h2></div><button onClick={() => setCampaign("all")}>Semua campaign</button></div><div className="campaign-card-grid">{dashboardData.creative.campaigns.map((item) => <button key={item.name} className={campaign === item.name ? "active" : ""} onClick={() => { setCampaign(item.name); setQuery(""); }}><span>{item.name}</span><strong>{money(item.revenue, true)}</strong><small>{number(item.creatives)} creative · ROI {roi(item.roi)}</small><i><b style={{ width: `${Math.max(2, item.revenue / Math.max(1, ...dashboardData.creative.campaigns.map((entry) => entry.revenue)) * 100)}%` }} /></i></button>)}</div></section>
      <section className="two-col creative-panels">
        <article className="panel"><div className="panel-head"><div><span>CAMPAIGN MIX</span><h2>Revenue by campaign</h2></div></div><Bars items={dashboardData.creative.campaigns.filter((item) => item.cost > 0)} /></article>
        <article className="panel compact"><div className="panel-head"><div><span>DELIVERY STATUS</span><h2>100K rows composition</h2></div></div><div className="status-list">{dashboardData.creative.statuses.map((item) => <div key={item.name}><span><i className={item.name === "Delivering" ? "green" : ""} />{item.name}</span><b>{number(item.count)}</b></div>)}</div></article>
      </section>
      <section className="panel table-panel"><div className="panel-head"><div><span>VIDEO ID OVERVIEW</span><h2>{number(creativeRows.length)} video sesuai filter</h2></div><small>Klik baris untuk detail · 100 teratas</small></div><div className="table-wrap"><table className="creative-detail-table"><thead><tr><th>Video ID / creative</th><th>Akun</th><th>Campaign</th><th>Spend</th><th>GMV</th><th>Orders</th><th>ROI</th><th>CTR</th><th>Aksi</th></tr></thead><tbody>{creativeRows.slice(0, 100).map((row) => { const url = tiktokVideoUrl(row); return <tr key={`${row.campaignId}-${row.productId}-${row.videoId}`} onClick={() => setSelectedCreative(row)}><td><b className="video-id">{row.videoId}</b><span title={row.title}>{title(row.title, 52)}</span></td><td><b>{row.account}</b><span>{row.type} · {row.status}</span></td><td>{row.campaign}</td><td>{money(row.cost)}</td><td>{money(row.revenue)}</td><td>{number(row.orders)}</td><td><strong className={`creative-tier ${creativeTier(row.roi)}`}>{roi(row.roi)} · {creativeTierLabel(row.roi)}</strong></td><td>{pct(row.ctr)}</td><td>{url ? <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Cek video ↗</a> : <button onClick={(event) => { event.stopPropagation(); setSelectedCreative(row); }}>Detail</button>}</td></tr> })}</tbody></table></div></section>
    </>}

    {tab === "live" && <>
      <section className="section-heading"><div><span>LIVESTREAM DATA</span><h2>Live host performance</h2><p>Nama campaign yang mirip otomatis digabung menjadi satu host. Klik host untuk membuka semua sesi campaign-nya.</p></div><div className="snapshot">{number(filteredLiveSessions.length)} SESSIONS <b>{number(liveLeaders.length)} HOSTS</b></div></section>
      <section className="live-filters" aria-label="Filter livestream">
        <label>Dari tanggal<input type="date" value={liveFrom} min={LIVE_MIN} max={liveTo} onChange={(e) => setLiveFrom(e.target.value)} /></label>
        <label>Sampai<input type="date" value={liveTo} min={liveFrom} max={LIVE_MAX} onChange={(e) => setLiveTo(e.target.value)} /></label>
        <label>Host / akun<select value={liveHost} onChange={(e) => { setLiveHost(e.target.value); setSelectedHost(e.target.value === "all" ? null : e.target.value); }}><option value="all">Semua host</option>{[...hostLabels].sort((a, b) => a[1].localeCompare(b[1])).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <fieldset><legend>Sesi</legend><div className="slot-chips">{["pagi", "siang", "sore", "malam"].map((slot) => <button key={slot} className={liveSlots.includes(slot) ? "on" : ""} onClick={() => setLiveSlots(liveSlots.includes(slot) ? liveSlots.filter((item) => item !== slot) : [...liveSlots, slot])}>{slot}</button>)}</div></fieldset>
        <label className="live-search">Cari campaign<input value={liveQuery} onChange={(e) => setLiveQuery(e.target.value)} placeholder="Nama live / campaign / ID…" /></label>
        <button className="reset-live" onClick={resetLiveFilters}>Reset filter</button>
      </section>
      <div className="live-result-count">{number(filteredLiveSessions.length)} sesi sesuai filter · {number(liveLeaders.length)} host hasil penggabungan</div>
      <section className="kpi-grid six">
        <Kpi label="Gross revenue" value={money(liveAgg.revenue, true)} note={money(liveAgg.revenue)} tone="cyan" />
        <Kpi label="Spend" value={money(liveAgg.cost, true)} note={money(liveAgg.cost)} />
        <Kpi label="Blended ROI" value={roi(filteredLiveRoi)} note="GMV ÷ spend" tone={roiTone(filteredLiveRoi)} />
        <Kpi label="SKU orders" value={number(liveAgg.orders)} note={liveAgg.orders ? `CPO ${money(liveAgg.cost / liveAgg.orders)}` : "CPO —"} />
        <Kpi label="Live views" value={number(liveAgg.views)} note={liveAgg.views ? `Cost/view ${money(liveAgg.cost / liveAgg.views)}` : "Cost/view —"} />
        <Kpi label="Live follows" value={number(liveAgg.follows)} note={`${number(filteredLiveSessions.length)} sesi live`} />
      </section>
      <section className="two-col live-charts">
        <article className="panel"><div className="panel-head"><div><span>DAILY PULSE</span><h2>Cost vs gross revenue</h2></div><div className="chart-legend"><i className="cost" />Cost <i />GMV</div></div><div className="daily-combo">{filteredDaily.map((day) => { const max = Math.max(1, ...filteredDaily.map((item) => item.revenue)); return <div key={day.day} title={`${day.day} · GMV ${money(day.revenue)} · Cost ${money(day.cost)}`}><span className="gmv-bar" style={{ height: `${Math.max(2, day.revenue / max * 100)}%` }} /><span className="cost-mark" style={{ bottom: `${Math.max(1, day.cost / max * 100)}%` }} /><small>{day.day.slice(8)}</small></div> })}</div></article>
        <article className="panel"><div className="panel-head"><div><span>TOP HOST BY GMV</span><h2>Leaderboard terfilter</h2></div><small>klik untuk detail</small></div><div className="host-bars">{liveLeaders.slice(0, 10).map((item, index) => { const max = Math.max(1, ...liveLeaders.map((host) => host.revenue)); return <button key={item.key} onClick={() => openHost(item.key)}><span>{index + 1}. {item.host}</span><i><b style={{ width: `${Math.max(2, item.revenue / max * 100)}%` }} /></i><strong>{money(item.revenue, true)}</strong></button> })}</div></article>
      </section>
      <section className="panel live-table-panel">
        <div className="live-table-tabs"><button className={liveView === "leader" ? "active" : ""} onClick={() => { setLiveView("leader"); setSelectedHost(null); if (liveHost !== "all") setLiveHost("all"); }}>Leaderboard Host</button><button className={liveView === "detail" ? "active" : ""} onClick={() => setLiveView("detail")}>Detail Campaign</button><div className="roi-legend"><span><i className="good" />ROI ≥ 10</span><span><i className="mid" />ROI 4–9,99</span><span><i className="bad" />ROI &lt; 4</span></div></div>
        {liveView === "leader" ? <div className="table-wrap"><table className="live-table"><thead><tr><th>Host</th><th>Sesi</th><th><button onClick={() => setLiveSortKey("cost")}>Cost {liveSort === "cost" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("revenue")}>Gross revenue {liveSort === "revenue" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("roi")}>ROI {liveSort === "roi" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("orders")}>Orders {liveSort === "orders" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>CPO</th><th><button onClick={() => setLiveSortKey("views")}>Views {liveSort === "views" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>Follows</th></tr></thead><tbody>{liveLeaders.map((row) => <tr key={row.key} className="host-row" onClick={() => openHost(row.key)}><td><b>{row.host}</b><span>{row.key} · klik untuk detail ›</span></td><td>{number(row.sessions)}</td><td>{money(row.cost)}</td><td><div className="revenue-cell"><span>{money(row.revenue)}</span><i><b style={{ width: `${Math.max(2, row.revenue / Math.max(1, ...liveLeaders.map((item) => item.revenue)) * 100)}%` }} /></i></div></td><td><strong className={`roi-badge ${roiTone(row.roi)}`}>{roi(row.roi)}</strong></td><td>{number(row.orders)}</td><td>{row.orders ? money(row.cost / row.orders) : "—"}</td><td>{number(row.views)}</td><td>{number(row.follows)}</td></tr>)}</tbody></table></div>
        : <><div className="detail-context">{selectedHost ? <>Menampilkan semua campaign untuk <b>{hostLabels.get(selectedHost)}</b><button onClick={() => { setSelectedHost(null); setLiveHost("all"); }}>Lihat semua sesi</button></> : <>Semua detail campaign sesuai filter</>}</div><div className="table-wrap"><table className="live-table detail-table"><thead><tr><th><button onClick={() => setLiveSortKey("launchedAt")}>Tanggal {liveSort === "launchedAt" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>Campaign</th><th>Sesi</th><th><button onClick={() => setLiveSortKey("cost")}>Cost {liveSort === "cost" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("revenue")}>Gross revenue {liveSort === "revenue" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("roi")}>ROI {liveSort === "roi" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>Orders</th><th>Views</th><th>Follows</th></tr></thead><tbody>{liveDetailRows.map((row) => <tr key={`${row.campaignId}-${row.launchedAt}-${row.name}`}><td>{new Date(row.launchedAt.replace(" ", "T")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}<span>{row.launchedAt.slice(11, 16)}</span></td><td><b title={row.name}>{title(row.name, 46)}</b><span>{row.campaign} · {row.campaignId}</span></td><td><em>{row.slot}</em></td><td>{money(row.cost)}</td><td>{money(row.revenue)}</td><td><strong className={`roi-badge ${roiTone(row.roi)}`}>{roi(row.roi)}</strong></td><td>{number(row.orders)}</td><td>{number(row.views)}</td><td>{number(row.follows)}</td></tr>)}</tbody></table></div></>}
      </section>
      <p className="live-note">ROI dihitung ulang dari Gross Revenue (Current Shop) ÷ Cost. Kolom durasi tidak ditampilkan karena tidak tersedia di export Februari. Penggabungan host mengabaikan kata umum seperti “live”, “beauty”, “official”, perbedaan kapital, tanda baca, dan huruf berulang.</p>
    </>}

    {selectedCreative && <div className="creative-modal-backdrop" role="presentation" onClick={() => setSelectedCreative(null)}><section className="creative-modal" role="dialog" aria-modal="true" aria-labelledby="creative-modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-top"><div><span>VIDEO PERFORMANCE DETAIL</span><h2 id="creative-modal-title">{selectedCreative.videoId}</h2></div><button aria-label="Tutup detail video" onClick={() => setSelectedCreative(null)}>×</button></div><p className="modal-caption">{selectedCreative.title}</p><div className="modal-tags"><span>{selectedCreative.campaign}</span><span>{selectedCreative.account}</span><span>{selectedCreative.type}</span><span>{selectedCreative.status}</span></div><div className="modal-kpis"><article><span>Spend</span><b>{money(selectedCreative.cost)}</b></article><article><span>Gross revenue</span><b>{money(selectedCreative.revenue)}</b></article><article><span>Orders</span><b>{number(selectedCreative.orders)}</b></article><article><span>ROI</span><b className={`creative-tier ${creativeTier(selectedCreative.roi)}`}>{roi(selectedCreative.roi)}</b></article><article><span>CTR</span><b>{pct(selectedCreative.ctr)}</b></article><article><span>CVR</span><b>{pct(selectedCreative.cvr)}</b></article></div><div className="video-funnel"><div><span>2s view</span><i><b style={{ width: `${Math.min(100, selectedCreative.view2 * 100)}%` }} /></i><strong>{pct(selectedCreative.view2)}</strong></div><div><span>6s view</span><i><b style={{ width: `${Math.min(100, selectedCreative.view6 * 100)}%` }} /></i><strong>{pct(selectedCreative.view6)}</strong></div><div><span>25%</span><i><b style={{ width: `${Math.min(100, selectedCreative.view25 * 100)}%` }} /></i><strong>{pct(selectedCreative.view25)}</strong></div><div><span>50%</span><i><b style={{ width: `${Math.min(100, selectedCreative.view50 * 100)}%` }} /></i><strong>{pct(selectedCreative.view50)}</strong></div><div><span>100%</span><i><b style={{ width: `${Math.min(100, selectedCreative.view100 * 100)}%` }} /></i><strong>{pct(selectedCreative.view100)}</strong></div></div><div className="modal-meta"><span>Posted <b>{selectedCreative.postedAt}</b></span><span>Authorization <b>{selectedCreative.authorization}</b></span><span>Campaign ID <b>{selectedCreative.campaignId}</b></span><span>Product ID <b>{selectedCreative.productId}</b></span></div>{tiktokVideoUrl(selectedCreative) ? <a className="open-tiktok" href={tiktokVideoUrl(selectedCreative)!} target="_blank" rel="noreferrer">Buka video di TikTok ↗</a> : <p className="video-unavailable">URL TikTok tidak tersedia untuk product card atau baris tanpa Video ID/account yang valid.</p>}</section></div>}
    <footer><span>GMV MAX · FEBRUARY TEST DATA</span><p>Source: TikTok Shop Ads exports provided by user. Metrics recalculated from source rows.</p></footer>
  </main>;
}
