"use client";

import { useMemo, useState } from "react";
import dashboardData from "./dashboard-data.json";

type Tab = "overview" | "creative" | "live";
type SortKey = "cost" | "revenue" | "roi" | "orders";

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

  const creativeRows = useMemo(() => dashboardData.creative.creatives
    .filter((row) => campaign === "all" || row.campaign === campaign)
    .filter((row) => !onlySpend || row.cost > 0)
    .filter((row) => `${row.title} ${row.account} ${row.videoId}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b[sort] - a[sort]), [campaign, query, onlySpend, sort]);
  const selectedCreativeCampaigns = campaign === "all" ? dashboardData.creative.campaigns : dashboardData.creative.campaigns.filter((item) => item.name === campaign);
  const creativeSummary = selectedCreativeCampaigns.reduce((acc, item) => ({ cost: acc.cost + item.cost, revenue: acc.revenue + item.revenue, orders: acc.orders + item.orders, clicks: acc.clicks + item.clicks, impressions: acc.impressions + item.impressions }), { cost: 0, revenue: 0, orders: 0, clicks: 0, impressions: 0 });
  const creativeRoi = creativeSummary.cost ? creativeSummary.revenue / creativeSummary.cost : 0;
  const live = dashboardData.live.summary;

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
      <section className="two-col creative-panels">
        <article className="panel"><div className="panel-head"><div><span>CAMPAIGN MIX</span><h2>Revenue by campaign</h2></div></div><Bars items={dashboardData.creative.campaigns.filter((item) => item.cost > 0)} /></article>
        <article className="panel compact"><div className="panel-head"><div><span>DELIVERY STATUS</span><h2>100K rows composition</h2></div></div><div className="status-list">{dashboardData.creative.statuses.map((item) => <div key={item.name}><span><i className={item.name === "Delivering" ? "green" : ""} />{item.name}</span><b>{number(item.count)}</b></div>)}</div></article>
      </section>
      <section className="panel table-panel"><div className="panel-head"><div><span>CREATIVE DETAIL</span><h2>{number(creativeRows.length)} records in view</h2></div><small>Menampilkan 100 teratas</small></div><div className="table-wrap"><table><thead><tr><th>Creative</th><th>Campaign</th><th>Status</th><th>Spend</th><th>GMV</th><th>Orders</th><th>ROI</th><th>CTR</th></tr></thead><tbody>{creativeRows.slice(0, 100).map((row) => <tr key={`${row.campaignId}-${row.productId}-${row.videoId}`}><td><b title={row.title}>{title(row.title)}</b><span>{row.account} · {row.type}</span></td><td>{row.campaign}</td><td><em className={row.status === "Delivering" ? "good" : ""}>{row.status}</em></td><td>{money(row.cost)}</td><td>{money(row.revenue)}</td><td>{number(row.orders)}</td><td><strong className={row.roi >= creativeRoi ? "positive" : ""}>{roi(row.roi)}</strong></td><td>{pct(row.ctr)}</td></tr>)}</tbody></table></div></section>
    </>}

    {tab === "live" && <>
      <section className="section-heading"><div><span>LIVESTREAM DATA</span><h2>Live campaign performance</h2><p>Revenue dan orders memakai current shop; ROI selalu dihitung ulang dari agregat.</p></div><div className="snapshot">194 SESSIONS <b>4 CAMPAIGNS</b></div></section>
      <section className="kpi-grid five">
        <Kpi label="Spend" value={money(live.cost, true)} note={money(live.cost)} />
        <Kpi label="Gross revenue" value={money(live.revenue, true)} note={`${number(live.orders)} orders`} tone="pink" />
        <Kpi label="Blended ROI" value={roi(live.roi)} note="Current shop" />
        <Kpi label="Live views" value={number(live.views)} note={`${money(live.cost / live.views)} per view`} />
        <Kpi label="Follows" value={number(live.follows)} note={`${pct(live.follows / live.views)} follow rate`} />
      </section>
      <section className="two-col">
        <article className="panel"><div className="panel-head"><div><span>DAILY PULSE</span><h2>GMV by day</h2></div></div><div className="daily-bars">{dashboardData.live.daily.map((day) => { const max = Math.max(...dashboardData.live.daily.map((item) => item.revenue)); return <div key={day.day} title={`${day.day}: ${money(day.revenue)}`}><i style={{ height: `${Math.max(3, day.revenue / max * 100)}%` }} /><span>{day.day.slice(8)}</span></div> })}</div></article>
        <article className="panel"><div className="panel-head"><div><span>CAMPAIGN EFFICIENCY</span><h2>ROI leaders</h2></div></div><Bars items={[...dashboardData.live.campaigns].sort((a, b) => b.roi - a.roi)} metric="roi" /></article>
      </section>
      <section className="panel table-panel"><div className="panel-head"><div><span>SESSION DETAIL</span><h2>Top sessions by GMV</h2></div><small>Semua 194 sesi</small></div><div className="table-wrap"><table><thead><tr><th>Live session</th><th>Campaign</th><th>Launched</th><th>Spend</th><th>GMV</th><th>Orders</th><th>Views</th><th>ROI</th></tr></thead><tbody>{dashboardData.live.sessions.map((row) => <tr key={`${row.campaignId}-${row.launchedAt}-${row.name}`}><td><b title={row.name}>{title(row.name, 42)}</b><span>{row.status}</span></td><td>{row.campaign}</td><td>{row.launchedAt.slice(0, 16)}</td><td>{money(row.cost)}</td><td>{money(row.revenue)}</td><td>{number(row.orders)}</td><td>{number(row.views)}</td><td><strong className={row.roi >= live.roi ? "positive" : ""}>{roi(row.roi)}</strong></td></tr>)}</tbody></table></div></section>
    </>}

    <footer><span>GMV MAX · FEBRUARY TEST DATA</span><p>Source: TikTok Shop Ads exports provided by user. Metrics recalculated from source rows.</p></footer>
  </main>;
}
