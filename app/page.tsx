"use client";

import { useMemo, useRef, useState } from "react";
import dashboardData from "./dashboard-data.json";
import "./live-layout-fixes.css";

type Tab = "overview" | "creative" | "live";
type SortKey = "videoId" | "account" | "campaign" | "cost" | "revenue" | "roi" | "orders" | "cpo" | "ctr";
type LiveSortKey = "launchedAt" | "cost" | "revenue" | "roi" | "orders" | "views";
type LiveView = "leader" | "detail";
type ImportKind = "Creative"|"Livestream";
type CreativeRow = (typeof dashboardData.creative.creatives)[number] & { brand?: string; importId?: string; period?: string };
type LiveRow = (typeof dashboardData.live.sessions)[number] & { brand?: string; importId?: string; durationMinutes?: number; period?: string };
type ImportRecord = { id:string; brand:string; file:string; kind:ImportKind; period:string; rows:number; importedAt:string; builtin?:boolean };
const n = (value: unknown) => Number(String(value ?? 0).replace(/[^0-9.-]/g, "")) || 0;
const pick = (row: Record<string, unknown>, names: string[]) => { const key = Object.keys(row).find((k) => names.some((name) => k.toLowerCase().trim() === name.toLowerCase())); return key ? row[key] : ""; };

const money = (n: number, _short = false) => {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
};
const number = (n: number) => Math.round(n).toLocaleString("id-ID");
const pct = (n: number) => `${(n * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const roi = (n: number) => `${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })}x`;
const title = (value: string, max = 58) => value.length > max ? `${value.slice(0, max)}…` : value;
const monthLabel = (value:string) => value ? new Date(`${value}-01T00:00:00`).toLocaleDateString("id-ID",{month:"short",year:"numeric"}) : "Tanpa periode";
const periodInRange = (period:string|undefined, from:string, to:string) => {
  period=period||"2026-02";
  const first=`${period}-01`;
  const last=new Date(Number(period.slice(0,4)),Number(period.slice(5,7)),0).toISOString().slice(0,10);
  return (!from||last>=from)&&(!to||first<=to);
};
const HOST_MONTHS = "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des";
const cleanHostLabel = (value: string) => value
  .replace(/[_]+/g, " ")
  .replace(new RegExp(`\\b\\d{1,2}\\s*(?:${HOST_MONTHS})\\b`, "gi"), " ")
  .replace(/\b\d+\s*[-–]\s*\d+\s*(pagi|siang|sore|malam)?\b/gi," ")
  .replace(/\b\d+(?:[.:]\d+)?\s*(pagi|siang|sore|malam)\b/gi," ")
  .replace(new RegExp(`\\b(?:${HOST_MONTHS})\\b`, "gi"), " ")
  .replace(/\b\d{1,4}\b/g," ")
  .replace(/\b(live|campaign|host|beauty|official|shop|store|pagi|siang|sore|malam)\b/gi, " ")
  .replace(/[\s-]+/g, " ")
  .trim();
const displayHostLabel = (value:string) => cleanHostLabel(value).split(" ").map(word=>word.length<=3&&word===word.toUpperCase()?word:word.charAt(0).toUpperCase()+word.slice(1).toLowerCase()).join(" ")||"Tanpa Host";
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

function DateRangeFilter({from,to,onChange,min="2026-01-01",max="2026-12-31",label="Periode"}:{from:string;to:string;onChange:(from:string,to:string)=>void;min?:string;max?:string;label?:string}){
  const [open,setOpen]=useState(false);
  const [calendarMonth,setCalendarMonth]=useState((from||min).slice(0,7));
  const [dragStart,setDragStart]=useState<string|null>(null);
  const minDay=Math.floor(new Date(`${min}T00:00:00`).getTime()/86400000);
  const maxDay=Math.floor(new Date(`${max}T00:00:00`).getTime()/86400000);
  const iso=(day:number)=>new Date(day*86400000).toISOString().slice(0,10);
  const shiftMonth=(value:string,amount:number)=>{const date=new Date(`${value}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);return date.toISOString().slice(0,7)};
  const period=from&&to&&from.slice(0,7)===to.slice(0,7)&&from.endsWith("-01")?from.slice(0,7):"custom";
  const selectPeriod=(value:string)=>{
    if(value==="all") return onChange(min,max);
    if(value==="custom") return;
    const start=`${value}-01`;const end=new Date(Date.UTC(Number(value.slice(0,4)),Number(value.slice(5,7)),0)).toISOString().slice(0,10);setCalendarMonth(value);onChange(start,end);
  };
  const presets=[
    ["7 hari",7],["30 hari",30],["3 bulan",90],["6 bulan",180],["12 bulan",365]
  ] as const;
  const beginDrag=(date:string)=>{if(date<min||date>max)return;setDragStart(date);onChange(date,date)};
  const continueDrag=(date:string)=>{if(!dragStart||date<min||date>max)return;onChange(date<dragStart?date:dragStart,date<dragStart?dragStart:date)};
  const calendar=(month:string)=>{const first=new Date(`${month}-01T00:00:00Z`);const start=Math.floor(first.getTime()/86400000)-first.getUTCDay();const cells=Array.from({length:42},(_,index)=>iso(start+index));return <div className="calendar-month"><b>{first.toLocaleDateString("id-ID",{month:"long",year:"numeric",timeZone:"UTC"})}</b><div className="calendar-week">{["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map(date=>{const outside=date.slice(0,7)!==month;const disabled=date<min||date>max;const inRange=Boolean(from&&to&&date>=from&&date<=to);const edge=date===from||date===to;return <button type="button" key={date} disabled={disabled} className={`${outside?"outside ":""}${inRange?"in-range ":""}${edge?"range-edge":""}`} onMouseDown={(event)=>{event.preventDefault();beginDrag(date)}} onMouseEnter={()=>continueDrag(date)}>{Number(date.slice(8,10))}</button>})}</div></div>};
  return <div className="range-filter">
    <span>{label}</span>
    <div className="range-filter-row"><select value={period} onChange={e=>selectPeriod(e.target.value)}><option value="all">Semua periode</option>{Array.from({length:12},(_,i)=>{const value=`2026-${String(i+1).padStart(2,"0")}`;return <option value={value} key={value}>{monthLabel(value)}</option>})}<option value="custom">Custom</option></select><button type="button" onClick={()=>{const next=!open;setOpen(next);if(next)setCalendarMonth((from||min).slice(0,7))}}>▣ {from} — {to}</button></div>
    {open&&<div className="range-popover calendar-popover" onMouseUp={()=>setDragStart(null)} onMouseLeave={()=>setDragStart(null)}><div className="range-presets"><button onClick={()=>onChange(iso(maxDay),iso(maxDay))}>Hari ini</button>{presets.map(([name,days])=><button key={name} onClick={()=>onChange(iso(Math.max(minDay,maxDay-days+1)),iso(maxDay))}>{name}</button>)}</div><div className="range-calendar"><div className="calendar-nav"><button type="button" onClick={()=>setCalendarMonth(shiftMonth(calendarMonth,-1))}>‹</button><span>Klik lalu drag untuk memilih rentang</span><button type="button" onClick={()=>setCalendarMonth(shiftMonth(calendarMonth,1))}>›</button></div><div className="calendar-pair">{calendar(calendarMonth)}{calendar(shiftMonth(calendarMonth,1))}</div><div className="calendar-selection"><span>{from}</span><b>—</b><span>{to}</span><button className="range-apply" onClick={()=>setOpen(false)}>Terapkan periode</button></div></div></div>}
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
  const [sortDesc, setSortDesc] = useState(true);
  const [creativeFrom, setCreativeFrom] = useState("");
  const [creativeTo, setCreativeTo] = useState("");
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
  const [creativeSource, setCreativeSource] = useState<CreativeRow[]>(dashboardData.creative.creatives);
  const [liveSource, setLiveSource] = useState<LiveRow[]>(dashboardData.live.sessions);
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState("Data Februari bawaan sedang aktif.");
  const [importPeriod, setImportPeriod] = useState("2026-02");
  const [importKind, setImportKind] = useState<ImportKind>("Creative");
  const [overviewScope, setOverviewScope] = useState<"all" | "creative" | "live">("all");
  const [overviewCampaign, setOverviewCampaign] = useState("all");
  const [overviewFrom, setOverviewFrom] = useState("2026-02-01");
  const [overviewTo, setOverviewTo] = useState("2026-02-28");
  const [videoIdFilter, setVideoIdFilter] = useState("");
  const [brandName, setBrandName] = useState("Brand Februari");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [brandRecords, setBrandRecords] = useState(["Brand Februari"]);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<string|null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportRecord[]>([
    {id:"builtin-creative-feb26",brand:"Brand Februari",file:"Creative Februari 2026.xlsx",kind:"Creative",period:"2026-02",rows:100000,importedAt:"Data bawaan",builtin:true},
    {id:"builtin-live-feb26",brand:"Brand Februari",file:"Livestream Februari 2026.xlsx",kind:"Livestream",period:"2026-02",rows:194,importedAt:"Data bawaan",builtin:true}
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  const importExcel = async (file: File) => {
    try {
      setImportMessage(`Membaca ${file.name}…`);
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false, dense: true });
      const normalizeHeader=(value:unknown)=>String(value??"").replace(/^\uFEFF/,"").replace(/[_\s]+/g," ").trim().toLowerCase();
      const headerMatches=(row:unknown[])=>{const keys=row.map(normalizeHeader);const creative=keys.some(key=>["video id","post id","id video"].includes(key))&&keys.some(key=>["campaign name","nama kampanye","creative","video title","judul video"].includes(key));const live=keys.some(key=>["live name","livestream name","nama live"].includes(key))&&keys.some(key=>["launched time","launch time","live start time","waktu peluncuran"].includes(key));return creative||live};
      let grid:unknown[][]=[];
      let headerIndex=-1;
      for(const sheetName of workbook.SheetNames){const candidate=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{header:1,defval:"",raw:true});const candidateHeader=candidate.slice(0,100).findIndex(headerMatches);if(candidateHeader>=0){grid=candidate;headerIndex=candidateHeader;break}}
      if(headerIndex<0) throw new Error("Header TikTok tidak ditemukan. Pastikan file adalah export Creative atau Livestream asli.");
      const headerRow = (grid[headerIndex]??[]).map(x=>String(x).replace(/^\uFEFF/,"").trim());
      const normalizedHeaders=headerRow.map(normalizeHeader);
      const dataRows = grid.slice(headerIndex+1).filter(row=>row.some(cell=>cell!==""&&cell!==null));
      if (!dataRows.length) throw new Error("Sheet kosong");
      const has=(...names:string[])=>names.some(name=>normalizedHeaders.includes(normalizeHeader(name)));
      const take=(row:unknown[],names:string[])=>{const wanted=names.map(normalizeHeader);const index=normalizedHeaders.findIndex(key=>wanted.includes(key));return index>=0?row[index]:""};
      const targetBrand = selectedBrand === "all" ? brandName.trim() : selectedBrand;
      if (!targetBrand) throw new Error("Pilih brand terlebih dahulu");
      if (!importPeriod) throw new Error("Pilih periode bulan terlebih dahulu");
      const importId = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      if (has("Video ID","Post ID","ID Video") && has("Campaign name","Nama kampanye","Creative","Video title","Judul video")) {
        setImportKind("Creative");
        const mapped = dataRows.map((r) => { const cost = n(take(r,["Cost","Biaya"])); const revenue = n(take(r,["Gross revenue","Revenue","Pendapatan kotor","Penghasilan bruto (Toko saat ini)"])); return {
          brand:targetBrand, period:importPeriod, campaign:String(take(r,["Campaign name","Nama kampanye"])||file.name.match(/Campaign\s+([^.]*)/i)?.[1]||"Creative import"), campaignId:String(take(r,["Campaign ID","ID Campaign"])), productId:String(take(r,["Product ID","ID Produk"])), type:String(take(r,["Creative type","Type","Jenis materi iklan"])||"Video"), title:String(take(r,["Video title","Judul video","Video caption","Creative","Creative name","Title"])), videoId:String(take(r,["Video ID","Post ID","ID Video"])), account:String(take(r,["TikTok account","Account","Creator username","Akun TikTok"])), postedAt:String(take(r,["Time posted","Video post time","Posted time","Waktu posting"])), status:String(take(r,["Status"])), authorization:String(take(r,["Authorization type","Authorization status","Authorization","Jenis otorisasi","Status otorisasi"])), cost, revenue, orders:n(take(r,["SKU orders","Orders","Pesanan SKU","Pesanan SKU (Toko saat ini)"])), impressions:n(take(r,["Product ad impressions","Impressions","Tayangan iklan produk"])), clicks:n(take(r,["Product ad clicks","Clicks","Klik iklan produk"])), ctr:n(take(r,["Product ad click rate","CTR","Rasio klik iklan produk"])), cvr:n(take(r,["Ad conversion rate","CVR","Rasio konversi iklan"])), view2:n(take(r,["2-second ad video view rate","2-second video view rate"])), view6:n(take(r,["6-second ad video view rate","6-second video view rate"])), view25:n(take(r,["25% ad video view rate","Video views at 25%"])), view50:n(take(r,["50% ad video view rate","Video views at 50%"])), view75:n(take(r,["75% ad video view rate","Video views at 75%"])), view100:n(take(r,["100% ad video view rate","Video views at 100%"])), roi:cost?revenue/cost:0, importId
        } as CreativeRow; });
        const replaced=importHistory.filter(x=>x.brand===targetBrand&&x.kind==="Creative"&&(x.period===importPeriod||x.builtin));
        setCreativeSource(prev=>[...prev.filter(x=>{const owner=x.brand||"Brand Februari";return !replaced.some(record=>record.id===x.importId)&&!(owner===targetBrand&&!x.importId)}),...mapped]); setImportHistory(prev=>[{id:importId,brand:targetBrand,file:file.name,kind:"Creative",period:importPeriod,rows:dataRows.length,importedAt:new Date().toLocaleString("id-ID")},...prev.filter(x=>!(x.brand===targetBrand&&x.kind==="Creative"&&(x.period===importPeriod||x.builtin)))]); setImportMessage(`${dataRows.length.toLocaleString("id-ID")} baris creative ${monthLabel(importPeriod)} ${replaced.length?"menggantikan data lama":"ditambahkan"} ke ${targetBrand}.`); setImportOpen(false); setTab("overview");
      } else if (has("LIVE name","Livestream name","Nama LIVE") && has("Launched time","Launch time","LIVE start time","Waktu peluncuran")) {
        setImportKind("Livestream");
        const mapped = dataRows.map((r) => { const launchedAt=String(take(r,["Launched time","Launch time","LIVE start time","Waktu peluncuran"])); const cost=n(take(r,["Cost","Spend","Biaya"])); const revenue=n(take(r,["Gross revenue (Current Shop)","Gross revenue","Revenue","GMV","Penghasilan bruto (Toko saat ini)","Pendapatan kotor"])); return { brand:targetBrand, period:importPeriod, name:String(take(r,["LIVE name","Livestream name","Nama LIVE"])), launchedAt, day:launchedAt.slice(0,10), campaign:String(take(r,["Campaign name","LIVE campaign name","Nama kampanye"])), campaignId:String(take(r,["Campaign ID","LIVE campaign ID","ID Campaign"])), status:String(take(r,["Status","Delivery status","Status penayangan"])), cost, revenue, orders:n(take(r,["SKU orders (Current Shop)","SKU orders","Orders","Pesanan SKU (Toko saat ini)","Pesanan SKU"])), views:n(take(r,["LIVE views","Views","Livestream views","Tayangan LIVE"])), tenSecondViews:n(take(r,["10s views","10-second views","Tayangan LIVE 10 detik"])), follows:n(take(r,["LIVE follows","Follows","Pengikut saat LIVE"])), durationMinutes:n(take(r,["LIVE duration (min)","Duration (min)","Duration minutes","LIVE duration","Durasi LIVE (mnt)"])), roi:cost?revenue/cost:0, importId } as LiveRow; });
        const importedDays=mapped.map(row=>row.day).filter(Boolean).sort(); if(importedDays.length){setLiveFrom(importedDays[0]);setLiveTo(importedDays[importedDays.length-1])}
        const replaced=importHistory.filter(x=>x.brand===targetBrand&&x.kind==="Livestream"&&(x.period===importPeriod||x.builtin));
        setLiveSource(prev=>[...prev.filter(x=>{const owner=x.brand||"Brand Februari";return !replaced.some(record=>record.id===x.importId)&&!(owner===targetBrand&&!x.importId)}),...mapped]); setImportHistory(prev=>[{id:importId,brand:targetBrand,file:file.name,kind:"Livestream",period:importPeriod,rows:dataRows.length,importedAt:new Date().toLocaleString("id-ID")},...prev.filter(x=>!(x.brand===targetBrand&&x.kind==="Livestream"&&(x.period===importPeriod||x.builtin)))]); setImportMessage(`${dataRows.length.toLocaleString("id-ID")} sesi livestream ${monthLabel(importPeriod)} ${replaced.length?"menggantikan data lama":"ditambahkan"} ke ${targetBrand}.`); setImportOpen(false); setTab("overview");
      } else throw new Error(`Kolom belum dikenali. Ditemukan: ${headerRow.filter(Boolean).slice(0,8).join(", ")}`);
    } catch (error) { setImportMessage(`Import gagal: ${error instanceof Error ? error.message : "format file tidak dikenali"}`); }
  };

  const brands = brandRecords;
  const openImport = () => {
    if(selectedBrand==="all"&&brandRecords.length){setSelectedBrand(brandRecords[0]);setBrandName(brandRecords[0])}
    setImportMessage("Pilih brand, jenis data, dan periode laporan sebelum memilih file.");
    setImportOpen(true);
  };
  const brandCreative = useMemo(()=>creativeSource.filter(x=>{
    const owner=x.brand||"Brand Februari";
    if(selectedBrand!=="all"&&owner!==selectedBrand)return false;
    const hasRealImport=importHistory.some(record=>!record.builtin&&record.kind==="Creative"&&record.brand===owner);
    return Boolean(x.importId)||!hasRealImport;
  }),[creativeSource,selectedBrand,importHistory]);
  const brandLive = useMemo(()=>liveSource.filter(x=>{
    const owner=x.brand||"Brand Februari";
    if(selectedBrand!=="all"&&owner!==selectedBrand)return false;
    const hasRealImport=importHistory.some(record=>!record.builtin&&record.kind==="Livestream"&&record.brand===owner);
    return Boolean(x.importId)||!hasRealImport;
  }),[liveSource,selectedBrand,importHistory]);
  const liveBounds = useMemo(()=>{const days=brandLive.map(row=>row.day).filter(Boolean).sort();return {min:days[0]||LIVE_MIN,max:days[days.length-1]||LIVE_MAX}},[brandLive]);
  const creativeRows = useMemo(() => brandCreative
    .filter((row) => campaign === "all" || row.campaign === campaign)
    .filter((row) => periodInRange(row.period,creativeFrom,creativeTo))
    .filter((row) => !onlySpend || row.cost > 0)
    .filter((row) => `${row.title} ${row.account} ${row.videoId}`.toLowerCase().includes(query.toLowerCase()))
    .filter((row) => row.videoId.toLowerCase().includes(videoIdFilter.toLowerCase()))
    .sort((a, b) => { const value=(row:CreativeRow)=>sort==="cpo"?(row.orders?row.cost/row.orders:0):row[sort]; const av=value(a),bv=value(b); const result=typeof av==="string"?av.localeCompare(String(bv)):Number(av)-Number(bv); return sortDesc?-result:result }), [brandCreative, campaign, creativeFrom, creativeTo, query, videoIdFilter, onlySpend, sort, sortDesc]);
  const creativeCampaigns = useMemo(()=>{
    const builtinBrand=importHistory.find(x=>x.id==="builtin-creative-feb26")?.brand;
    const hasRealImport=selectedBrand!=="all"&&importHistory.some(x=>!x.builtin&&x.kind==="Creative"&&x.brand===selectedBrand);
    if(builtinBrand && selectedBrand===builtinBrand&&!hasRealImport) return dashboardData.creative.campaigns;
    const base = selectedBrand==="all" && builtinBrand ? dashboardData.creative.campaigns.map(x=>({...x})) : [];
    const grouped=new Map(base.map(x=>[x.name,x]));
    brandCreative.filter(x=>Boolean(x.brand)).forEach(row=>{const item=grouped.get(row.campaign)??{name:row.campaign,cost:0,revenue:0,orders:0,clicks:0,impressions:0,creatives:0,roi:0};item.cost+=row.cost;item.revenue+=row.revenue;item.orders+=row.orders;item.clicks+=row.clicks;item.impressions+=row.impressions;item.creatives+=1;item.roi=item.cost?item.revenue/item.cost:0;grouped.set(row.campaign,item)});
    return [...grouped.values()].sort((a,b)=>b.revenue-a.revenue);
  },[brandCreative,selectedBrand,importHistory]);
  const creativeSummary = creativeRows.reduce((acc, item) => ({ cost: acc.cost + item.cost, revenue: acc.revenue + item.revenue, orders: acc.orders + item.orders, clicks: acc.clicks + item.clicks, impressions: acc.impressions + item.impressions }), { cost: 0, revenue: 0, orders: 0, clicks: 0, impressions: 0 });
  const creativeRoi = creativeSummary.cost ? creativeSummary.revenue / creativeSummary.cost : 0;
  const filteredCreativeCampaigns = useMemo(()=>{const grouped=new Map<string,{name:string;cost:number;revenue:number;orders:number;roi:number}>();creativeRows.forEach(row=>{const item=grouped.get(row.campaign)??{name:row.campaign,cost:0,revenue:0,orders:0,roi:0};item.cost+=row.cost;item.revenue+=row.revenue;item.orders+=row.orders;item.roi=item.cost?item.revenue/item.cost:0;grouped.set(row.campaign,item)});return [...grouped.values()].sort((a,b)=>b.revenue-a.revenue)},[creativeRows]);
  const creativeDeliveryStatuses = useMemo(()=>{const grouped=new Map<string,number>();creativeRows.forEach(row=>grouped.set(row.status,(grouped.get(row.status)??0)+1));return [...grouped].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count)},[creativeRows]);
  const creativeTiers = creativeRows.reduce((acc, row) => { const tier = creativeTier(row.roi); acc[tier] += 1; return acc; }, { great: 0, good: 0, mid: 0, bad: 0 });
  const creativeTop5 = useMemo(()=>[...creativeRows].filter(x=>x.type.toLowerCase()==="video").sort((a,b)=>b.revenue-a.revenue).slice(0,5),[creativeRows]);
  const creativeBad5 = useMemo(()=>[...creativeRows].filter(x=>x.type.toLowerCase()==="video").sort((a,b)=>a.roi-b.roi||b.cost-a.cost).slice(0,5),[creativeRows]);
  const live = dashboardData.live.summary;
  const hostLabels = useMemo(() => {
    const labels = new Map<string, Map<string, number>>();
    brandLive.forEach((row) => {
      const key = hostEntityKey(row.campaign);
      const label = displayHostLabel(row.campaign);
      const variants = labels.get(key) ?? new Map<string, number>();
      variants.set(label, (variants.get(label) ?? 0) + 1);
      labels.set(key, variants);
    });
    return new Map([...labels].map(([key, variants]) => [key, [...variants].sort((a, b) => b[0].length - a[0].length || b[1] - a[1])[0][0]]));
  }, [brandLive]);
  const filteredLiveSessions = useMemo(() => brandLive
    .map((row) => ({ ...row, hostKey: hostEntityKey(row.campaign), host: hostLabels.get(hostEntityKey(row.campaign)) || cleanHostLabel(row.campaign), slot: liveSlot(row.launchedAt) }))
    .filter((row) => row.day >= liveFrom && row.day <= liveTo)
    .filter((row) => liveHost === "all" || row.hostKey === liveHost)
    .filter((row) => liveSlots.length === 0 || liveSlots.includes(row.slot))
    .filter((row) => `${row.name} ${row.campaign} ${row.campaignId} ${row.host}`.toLowerCase().includes(liveQuery.toLowerCase())), [brandLive, hostLabels, liveFrom, liveTo, liveHost, liveSlots, liveQuery]);
  const liveLeaders = useMemo(() => {
    const grouped = new Map<string, { key: string; host: string; sessions: number; cost: number; revenue: number; orders: number; views: number; follows: number; durationMinutes: number; durationRows: number; roi: number }>();
    filteredLiveSessions.forEach((row) => {
      const item = grouped.get(row.hostKey) ?? { key: row.hostKey, host: row.host, sessions: 0, cost: 0, revenue: 0, orders: 0, views: 0, follows: 0, durationMinutes: 0, durationRows: 0, roi: 0 };
      item.sessions += 1; item.cost += row.cost; item.revenue += row.revenue; item.orders += row.orders; item.views += row.views; item.follows += row.follows; item.durationMinutes += row.durationMinutes||0; if(row.durationMinutes) item.durationRows += 1;
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
  const liveAgg = filteredLiveSessions.reduce((acc, row) => ({ cost: acc.cost + row.cost, revenue: acc.revenue + row.revenue, orders: acc.orders + row.orders, views: acc.views + row.views, durationMinutes:acc.durationMinutes+(row.durationMinutes||0), durationRows:acc.durationRows+(row.durationMinutes?1:0) }), { cost: 0, revenue: 0, orders: 0, views: 0, durationMinutes:0, durationRows:0 });
  const filteredLiveRoi = liveAgg.cost ? liveAgg.revenue / liveAgg.cost : 0;
  const filteredTimeline = useMemo(() => {
    const span=(new Date(liveTo).getTime()-new Date(liveFrom).getTime())/86400000;
    const monthly=span>75;
    const groups = new Map<string, { key: string; label:string; cost: number; revenue: number }>();
    filteredLiveSessions.forEach((row) => { const key=monthly?row.day.slice(0,7):row.day;const label=monthly?new Date(`${key}-01T00:00:00`).toLocaleDateString("id-ID",{month:"short",year:"2-digit"}):new Date(`${key}T00:00:00`).toLocaleDateString("id-ID",{day:"2-digit",month:"short"});const item = groups.get(key) ?? { key,label,cost: 0, revenue: 0 }; item.cost += row.cost; item.revenue += row.revenue; groups.set(key, item); });
    return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredLiveSessions, liveFrom, liveTo]);
  const overviewCreativeRows = useMemo(() => brandCreative
    .filter((row) => overviewCampaign === "all" || row.campaign === overviewCampaign)
    .filter((row) => periodInRange(row.period,overviewFrom,overviewTo)), [brandCreative, overviewCampaign, overviewFrom, overviewTo]);
  const overviewVideos = useMemo(() => overviewCreativeRows.filter((row) => row.type.toLowerCase() === "video" && row.cost > 0), [overviewCreativeRows]);
  const overviewCreativeCampaigns = useMemo(()=>{const grouped=new Map<string,{name:string;cost:number;revenue:number;roi:number}>();overviewCreativeRows.forEach(row=>{const item=grouped.get(row.campaign)??{name:row.campaign,cost:0,revenue:0,roi:0};item.cost+=row.cost;item.revenue+=row.revenue;item.roi=item.cost?item.revenue/item.cost:0;grouped.set(row.campaign,item)});return [...grouped.values()].sort((a,b)=>b.revenue-a.revenue)},[overviewCreativeRows]);
  const topVideos = useMemo(() => [...overviewVideos].sort((a,b) => b.revenue-a.revenue).slice(0,10), [overviewVideos]);
  const roasDistribution = useMemo(()=>{
    const bins=[{label:"0–1",min:0,max:1,color:"#e55353",count:0},{label:"1–2",min:1,max:2,color:"#ef7d32",count:0},{label:"2–3",min:2,max:3,color:"#f0a534",count:0},{label:"3–4",min:3,max:4,color:"#e8b331",count:0},{label:"4–5",min:4,max:5,color:"#91c83e",count:0},{label:"5+",min:5,max:Infinity,color:"#4fb486",count:0}];
    overviewVideos.forEach(row=>{const bin=bins.find(x=>row.roi>=x.min&&row.roi<x.max);if(bin)bin.count++});return bins;
  },[overviewVideos]);
  const videoBuckets = useMemo(() => ({
    best:[...overviewVideos].filter((r)=>r.roi>=6).sort((a,b)=>b.revenue-a.revenue).slice(0,5),
    mid:[...overviewVideos].filter((r)=>r.roi>2&&r.roi<4).sort((a,b)=>b.revenue-a.revenue).slice(0,5),
    worst:[...overviewVideos].filter((r)=>r.roi<=2).sort((a,b)=>b.cost-a.cost).slice(0,5)
  }), [overviewVideos]);
  const heatmap = useMemo(() => {
    const cells = new Map<string,{day:number;hour:number;revenue:number;cost:number;sessions:number}>();
    filteredLiveSessions.forEach((row)=>{ const date=new Date(row.launchedAt.replace(" ","T")); const day=(date.getDay()+6)%7; const hour=date.getHours(); const key=`${day}-${hour}`; const cell=cells.get(key)??{day,hour,revenue:0,cost:0,sessions:0}; cell.revenue+=row.revenue;cell.cost+=row.cost;cell.sessions++;cells.set(key,cell); });
    const list=[...cells.values()]; const max=Math.max(1,...list.map(c=>c.revenue));
    const hours=Array.from({length:24},(_,hour)=>{ const rows=list.filter(c=>c.hour===hour); const revenue=rows.reduce((a,c)=>a+c.revenue,0); const cost=rows.reduce((a,c)=>a+c.cost,0); const sessions=rows.reduce((a,c)=>a+c.sessions,0); return {hour,revenue,cost,sessions,roi:cost?revenue/cost:0}; }).filter(x=>x.sessions).sort((a,b)=>b.revenue-a.revenue);
    return {cells:list,max,best:hours.slice(0,3)};
  },[filteredLiveSessions]);
  const overviewCreative = overviewCreativeRows.reduce((a,x)=>{a.cost+=x.cost;a.revenue+=x.revenue;a.orders+=x.orders;a.campaigns.add(x.campaign);return a},{cost:0,revenue:0,orders:0,campaigns:new Set<string>()});
  const overviewLiveRows = brandLive.filter(x=>x.day>=overviewFrom&&x.day<=overviewTo);
  const overviewLive = overviewLiveRows.reduce((a,x)=>({cost:a.cost+x.cost,revenue:a.revenue+x.revenue,orders:a.orders+x.orders,rowCount:a.rowCount+1,views:a.views+x.views}),{cost:0,revenue:0,orders:0,rowCount:0,views:0});
  const overviewLiveCampaigns = (()=>{const grouped=new Map<string,{name:string;cost:number;revenue:number;roi:number}>();overviewLiveRows.forEach(row=>{const name=cleanHostLabel(row.campaign);const item=grouped.get(name)??{name,cost:0,revenue:0,roi:0};item.cost+=row.cost;item.revenue+=row.revenue;item.roi=item.cost?item.revenue/item.cost:0;grouped.set(name,item)});return [...grouped.values()].sort((a,b)=>b.revenue-a.revenue)})();
  const overviewCost = (overviewScope !== "live" ? overviewCreative.cost : 0) + (overviewScope !== "creative" ? overviewLive.cost : 0);
  const overviewRevenue = (overviewScope !== "live" ? overviewCreative.revenue : 0) + (overviewScope !== "creative" ? overviewLive.revenue : 0);
  const overviewOrders = (overviewScope !== "live" ? overviewCreative.orders : 0) + (overviewScope !== "creative" ? overviewLive.orders : 0);
  const setLiveSortKey = (key: LiveSortKey) => { if (liveSort === key) setLiveSortDesc(!liveSortDesc); else { setLiveSort(key); setLiveSortDesc(true); } };
  const setCreativeSortKey = (key: SortKey) => { if(sort===key)setSortDesc(!sortDesc);else{setSort(key);setSortDesc(true)} };
  const resetLiveFilters = () => { setLiveFrom(liveBounds.min); setLiveTo(liveBounds.max); setLiveHost("all"); setLiveSlots([]); setLiveQuery(""); setSelectedHost(null); setLiveView("leader"); };
  const openHost = (key: string) => { setSelectedHost(key); setLiveHost(key); setLiveView("detail"); setLiveSort("launchedAt"); setLiveSortDesc(true); };
  const activeBrandEmpty = selectedBrand !== "all" && !creativeSource.some(x=>(x.brand||"Brand Februari")===selectedBrand) && !liveSource.some(x=>(x.brand||"Brand Februari")===selectedBrand);
  const saveBrand = () => {
    const next=brandName.trim(); if(!next) return;
    if(editingBrand){setBrandRecords(prev=>prev.map(x=>x===editingBrand?next:x));setCreativeSource(prev=>prev.map(x=>(x.brand||"Brand Februari")===editingBrand?{...x,brand:next}:x));setLiveSource(prev=>prev.map(x=>(x.brand||"Brand Februari")===editingBrand?{...x,brand:next}:x));setImportHistory(prev=>prev.map(x=>x.brand===editingBrand?{...x,brand:next}:x));setSelectedBrand(next)}
    else if(!brandRecords.includes(next)){setBrandRecords(prev=>[...prev,next]);setSelectedBrand(next)}
    setEditingBrand(null);setBrandModalOpen(false);setTab("overview");
  };
  const deleteImport = (record:ImportRecord) => {
    if(!window.confirm(`Hapus import ${record.file}? Data dari import ini akan dikeluarkan dari dashboard.`)) return;
    if(record.builtin){
      if(record.kind==="Creative") setCreativeSource(prev=>prev.filter(x=>Boolean(x.brand)));
      else setLiveSource(prev=>prev.filter(x=>Boolean(x.brand)));
    } else {setCreativeSource(prev=>prev.filter(x=>x.importId!==record.id));setLiveSource(prev=>prev.filter(x=>x.importId!==record.id))}
    setImportHistory(prev=>prev.filter(x=>x.id!==record.id));
  };

  return <main className="app-shell">
    <aside className="sidebar"><div className="side-brand"><span>GM</span><div><b>GMV Max</b><small>Performance Hub</small></div></div><label className="brand-select">Brand<select value={selectedBrand} onChange={(e)=>{setSelectedBrand(e.target.value);setBrandName(e.target.value==="all"?"":e.target.value);setCampaign("all");setOverviewCampaign("all")}}><option value="all">Semua brand</option>{brands.map(x=><option key={x}>{x}</option>)}</select></label><div className="brand-actions"><button onClick={()=>{setEditingBrand(null);setBrandName("");setBrandModalOpen(true)}}>＋ Tambah</button><button disabled={selectedBrand==="all"} onClick={()=>{setEditingBrand(selectedBrand);setBrandName(selectedBrand);setBrandModalOpen(true)}}>✎ Edit</button></div><nav><span>DASHBOARD</span><button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>▦ Overview</button><span>ANALISA</span><button className={tab==="creative"?"active":""} onClick={()=>setTab("creative")}>▷ Creative Video</button><button className={tab==="live"?"active":""} onClick={()=>setTab("live")}>◉ Livestream</button><span>INPUT</span><button onClick={openImport}>⇧ Import Data</button><button onClick={()=>setHistoryOpen(true)}>↶ Riwayat Import</button><button onClick={()=>window.print()}>↧ Export Laporan</button></nav><div className="side-foot">TikTok Shop Ads<br/><b>Snapshot analytics</b></div></aside>
    <div className="app-content">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span>GM</span></div><div><h1>GMV Max Command Center</h1><p>Creative video + livestream performance</p></div></div>
      <div className="top-actions"><button className="report-button" onClick={()=>window.print()}>Export ringkasan</button><button className="import-button" onClick={openImport}>Import Excel</button><div className="period"><span>REPORTING PERIOD</span><b>01—28 FEB 2026</b></div></div>
    </header>

    <nav className="tabs" aria-label="Dashboard views">
      {(["overview", "creative", "live"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "active" : ""}>{item === "overview" ? "Overview" : item === "creative" ? "Creative Video" : "Livestream"}<span>{item === "creative" ? "100K" : item === "live" ? "194" : ""}</span></button>)}
    </nav>

    {!activeBrandEmpty && <DataHealth />}
    {activeBrandEmpty && <section className="empty-brand"><div>□</div><h2>Belum ada data untuk {selectedBrand}</h2><p>Brand sudah dibuat. Import file creative atau livestream untuk mulai mengisi dashboard.</p><button onClick={()=>setImportOpen(true)}>Import data sekarang</button></section>}

    {!activeBrandEmpty && tab === "overview" && <>
      <section className="overview-filter"><div><b>Filter overview</b><span>Brand aktif: {selectedBrand==="all"?"Semua brand":selectedBrand}</span></div><DateRangeFilter from={overviewFrom} to={overviewTo} onChange={(from,to)=>{setOverviewFrom(from);setOverviewTo(to)}}/><label>Data<select value={overviewScope} onChange={(e)=>setOverviewScope(e.target.value as typeof overviewScope)}><option value="all">Creative + Live</option><option value="creative">Creative saja</option><option value="live">Live saja</option></select></label><label>Campaign<select value={overviewCampaign} onChange={(e)=>setOverviewCampaign(e.target.value)}><option value="all">Semua campaign</option>{creativeCampaigns.map(x=><option key={x.name}>{x.name}</option>)}</select></label><button onClick={()=>{setOverviewScope("all");setOverviewCampaign("all");setOverviewFrom("2026-01-01");setOverviewTo("2026-12-31")}}>Reset</button></section>
      <section className="hero-grid">
        <article className="score-card">
          <div className="eyebrow">BLENDED PERFORMANCE</div>
          <div className="score-ring"><div><strong>{roi(overviewCost ? overviewRevenue / overviewCost : 0)}</strong><span>filtered ROI</span></div></div>
          <div className="score-meta"><span>Total spend<b>{money(overviewCost, true)}</b></span><span>Gross revenue<b>{money(overviewRevenue, true)}</b></span><span>Total orders<b>{number(overviewOrders)}</b></span></div>
        </article>
        <div className="kpi-grid overview-kpis">
          {overviewScope !== "live" && <><Kpi label="Creative GMV" value={money(overviewCreative.revenue, true)} note={`${number(overviewCreative.orders)} orders · tanggal posting`} tone="cyan" /><Kpi label="Creative ROI" value={roi(overviewCreative.cost?overviewCreative.revenue/overviewCreative.cost:0)} note={`${number(overviewCreative.campaigns.size)} campaigns`} /><Kpi label="Creative Spend" value={money(overviewCreative.cost, true)} note={`CPO ${overviewCreative.orders?money(overviewCreative.cost/overviewCreative.orders):"—"}`} /></>}
          {overviewScope !== "creative" && <><Kpi label="Live GMV" value={money(overviewLive.revenue, true)} note={`${number(overviewLive.rowCount)} sessions`} tone="pink" /><Kpi label="Live ROI" value={roi(overviewLive.cost?overviewLive.revenue/overviewLive.cost:0)} note={`${number(overviewLive.views)} views`} /><Kpi label="Live Spend" value={money(overviewLive.cost, true)} note={`CPO ${overviewLive.orders?money(overviewLive.cost/overviewLive.orders):"—"}`} /></>}
        </div>
      </section>
      <section className="two-col">
        <article className="panel"><div className="panel-head"><div><span>CREATIVE CAMPAIGNS</span><h2>Revenue leaders · terfilter</h2></div><button onClick={() => setTab("creative")}>Explore →</button></div><Bars items={overviewCreativeCampaigns} /></article>
        <article className="panel"><div className="panel-head"><div><span>LIVE CAMPAIGNS</span><h2>Revenue leaders · terfilter</h2></div><button onClick={() => setTab("live")}>Explore →</button></div><Bars items={overviewLiveCampaigns} /></article>
      </section>
      <section className="panel top-video-panel"><div className="panel-head"><div><span>BEST VIDEO OVERVIEW</span><h2>Top 10 video berdasarkan GMV · ROI</h2></div><small>{topVideos.length} video</small></div><div className="top-video-grid">{topVideos.map((row,index)=><article key={`${row.videoId}-${row.campaignId}`} onClick={()=>setSelectedCreative(row)}><i>{String(index+1).padStart(2,"0")}</i><div><b>{title(row.title||row.videoId,48)}</b><span>{row.account} · {row.campaign}</span></div><strong className={`creative-tier ${creativeTier(row.roi)}`}>{roi(row.roi)}</strong><em>{money(row.revenue,true)}</em>{tiktokVideoUrl(row)&&<a href={tiktokVideoUrl(row)!} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Cek video ↗</a>}</article>)}</div></section>
      <section className="panel roas-panel"><div className="panel-head"><div><span>VIDEO PORTFOLIO</span><h2>ROAS Distribution</h2><p>{number(overviewVideos.length)} video detail tersedia</p></div></div><div className="roas-stack">{roasDistribution.map(bin=><i key={bin.label} style={{width:`${bin.count/Math.max(1,overviewVideos.length)*100}%`,background:bin.color}} title={`${bin.label}x · ${number(bin.count)} video`}>{bin.count>=Math.max(1,overviewVideos.length*.08)?number(bin.count):""}</i>)}</div><div className="roas-legend">{roasDistribution.map(bin=><span key={bin.label}><i style={{background:bin.color}}/>{bin.label}x <b>{number(bin.count)}</b></span>)}</div></section>
      <section className="video-bucket-grid">{([["Top bagus",videoBuckets.best,"great"],["Top sedang",videoBuckets.mid,"mid"],["Buruk terburuk",videoBuckets.worst,"bad"]] as const).map(([label,rows,tone])=><article className={`panel bucket ${tone}`} key={label}><div className="panel-head"><div><span>VIDEO CHECK</span><h2>{label}</h2></div></div>{rows.map((row,i)=><div className="bucket-row" key={`${row.videoId}-${i}`}><b>{i+1}.</b><button onClick={()=>setSelectedCreative(row)}><strong>{title(row.title||row.videoId,42)}</strong><span>{roi(row.roi)} · {money(row.revenue)}</span></button>{tiktokVideoUrl(row)&&<a href={tiktokVideoUrl(row)!} target="_blank" rel="noreferrer">Cek video</a>}</div>)}</article>)}</section>
      <section className="insight-grid">
        <article><span className="insight-no">01</span><div><b>Creative concentration tinggi</b><p>Serum Copper 1 menyumbang {pct(dashboardData.creative.campaigns[0].revenue / dashboardData.creative.summary.revenue)} creative GMV. Pisahkan export per campaign untuk memastikan campaign kecil tidak terpotong limit.</p></div></article>
        <article><span className="insight-no">02</span><div><b>Live paling efisien</b><p>{dashboardData.live.campaigns[0].name} menghasilkan ROI {roi(dashboardData.live.campaigns[0].roi)}—tertinggi di antara campaign live Februari.</p></div></article>
        <article><span className="insight-no">03</span><div><b>Jangan gabungkan timeline</b><p>Waktu posting video bukan tanggal spend. Trend harian hanya dipakai untuk livestream karena setiap sesi punya launched time.</p></div></article>
      </section>
    </>}

    {!activeBrandEmpty && tab === "creative" && <>
      <section className="section-heading"><div><span>CREATIVE VIDEO / PER CAMPAIGN</span><h2>Creative performance</h2><p>Satu baris = kombinasi campaign + product + video. Product card tetap dipisahkan dari video.</p></div><div className="snapshot">SNAPSHOT EXPORT <b>FEB 2026</b></div></section>
      <section className="controls">
        <DateRangeFilter label="Periode laporan" from={creativeFrom||"2026-01-01"} to={creativeTo||"2026-12-31"} onChange={(from,to)=>{setCreativeFrom(from);setCreativeTo(to)}}/>
        <label>Campaign<select value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">Semua campaign</option>{creativeCampaigns.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label>Cari creative<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caption, account, video ID…" /></label>
        <label>Urutkan<select value={sort} onChange={(e) => {setSort(e.target.value as SortKey);setSortDesc(true)}}><option value="cost">Spend terbesar</option><option value="revenue">GMV terbesar</option><option value="roi">ROI terbesar</option><option value="orders">Order terbanyak</option><option value="ctr">CTR terbesar</option></select></label>
        <button className={`toggle ${onlySpend ? "on" : ""}`} onClick={() => setOnlySpend(!onlySpend)}><i /> Hanya ada spend</button>
        <button className="reset-creative" onClick={()=>{setCreativeFrom("");setCreativeTo("");setCampaign("all");setQuery("");setVideoIdFilter("")}}>Reset</button>
      </section>
      <section className="kpi-grid five">
        <Kpi label="Spend" value={money(creativeSummary.cost, true)} note={money(creativeSummary.cost)} />
        <Kpi label="Gross revenue" value={money(creativeSummary.revenue, true)} note={`${number(creativeSummary.orders)} orders`} tone="cyan" />
        <Kpi label="Blended ROI" value={roi(creativeRoi)} note="Revenue ÷ spend" />
        <Kpi label="Cost per order" value={creativeSummary.orders?money(creativeSummary.cost/creativeSummary.orders):"—"} note="Spend ÷ orders" />
        <Kpi label="CTR" value={pct(creativeSummary.impressions ? creativeSummary.clicks / creativeSummary.impressions : 0)} note={`${number(creativeSummary.clicks)} clicks`} />
      </section>
      <section className="creative-tier-grid" aria-label="Klasifikasi performa video">
        <article className="great"><span>Sangat bagus</span><strong>{number(creativeTiers.great)}</strong><small>ROI ≥ 6x</small></article>
        <article className="good"><span>Bagus</span><strong>{number(creativeTiers.good)}</strong><small>ROI 4–5,99x</small></article>
        <article className="mid"><span>Sedang</span><strong>{number(creativeTiers.mid)}</strong><small>ROI 2–3,99x</small></article>
        <article className="bad"><span>Buruk</span><strong>{number(creativeTiers.bad)}</strong><small>ROI ≤ 2x</small></article>
      </section>
      <section className="panel campaign-picker"><div className="panel-head"><div><span>CAMPAIGN OVERVIEW</span><h2>Campaign sesuai seluruh filter aktif</h2></div><button onClick={() => setCampaign("all")}>Semua campaign</button></div><div className="campaign-card-grid">{filteredCreativeCampaigns.map((item) => <button key={item.name} className={campaign === item.name ? "active" : ""} onClick={() => { setCampaign(item.name); setQuery(""); }}><span>{item.name}</span><strong>{money(item.revenue, true)}</strong><small>{number(creativeRows.filter(row=>row.campaign===item.name).length)} creative · ROI {roi(item.roi)}</small><i><b style={{ width: `${Math.max(2, item.revenue / Math.max(1, ...filteredCreativeCampaigns.map((entry) => entry.revenue)) * 100)}%` }} /></i></button>)}</div></section>
      <section className="two-col creative-panels">
        <article className="panel"><div className="panel-head"><div><span>CAMPAIGN MIX</span><h2>Revenue by campaign · terfilter</h2></div></div><Bars items={filteredCreativeCampaigns.filter((item) => item.cost > 0)} /></article>
        <article className="panel compact"><div className="panel-head"><div><span>CAMPAIGN DELIVERY</span><h2>Delivery status dan komposisi</h2></div></div><div className="status-list">{creativeDeliveryStatuses.map((item) => <div key={item.name}><span><i className={item.name === "Delivering" ? "green" : ""} />{item.name}</span><b>{number(item.count)}</b></div>)}</div></article>
      </section>
      <section className="creative-performance-picks">{([["TOP 5 VIDEO","Performa terbaik berdasarkan GMV",creativeTop5,"great"],["5 BAD VIDEO PERFORMANCE","Prioritas evaluasi berdasarkan ROI",creativeBad5,"bad"]] as const).map(([eyebrow,heading,rows,tone])=><article className={`panel performance-pick ${tone}`} key={eyebrow}><div className="panel-head"><div><span>{eyebrow}</span><h2>{heading}</h2></div></div>{rows.map((row,i)=><button key={`${row.videoId}-${i}`} onClick={()=>setSelectedCreative(row)}><b>{i+1}</b><span><strong>{title(row.title||row.videoId,45)}</strong><small>{row.account} · {row.campaign}</small></span><em>{money(row.revenue,true)}<small>{roi(row.roi)}</small></em></button>)}</article>)}</section>
      <section className="panel table-panel">
        <div className="panel-head"><div><span>VIDEO ID OVERVIEW</span><h2>{number(creativeRows.length)} video sesuai filter</h2></div><label className="video-id-filter">Filter Video ID<input value={videoIdFilter} onChange={(e)=>setVideoIdFilter(e.target.value)} placeholder="Ketik Video ID…"/><button onClick={()=>setVideoIdFilter("")}>Reset</button></label><div className="roi-legend"><span><i className="good"/>ROI ≥ 6 sangat bagus</span><span><i className="mid"/>ROI 2–5,99 perlu cek</span><span><i className="bad"/>ROI ≤ 2 buruk</span></div></div>
        <div className="table-wrap"><table className="creative-detail-table"><thead><tr>{([["Video ID / creative","videoId"],["Akun","account"],["Campaign","campaign"],["Spend","cost"],["GMV","revenue"],["Orders","orders"],["CPO","cpo"],["ROI","roi"],["CTR","ctr"]] as const).map(([label,key])=><th key={key}><button className={sort===key?"sorted":""} onClick={()=>setCreativeSortKey(key)}>{label} {sort===key?(sortDesc?"↓":"↑"):"↕"}</button></th>)}<th>Aksi</th></tr></thead><tbody>{creativeRows.slice(0, 100).map((row) => { const url = tiktokVideoUrl(row); return <tr key={`${row.campaignId}-${row.productId}-${row.videoId}`} onClick={() => setSelectedCreative(row)}><td>{url?<a className="video-id" href={url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>{row.videoId}</a>:<button className="video-id-button" onClick={(event)=>{event.stopPropagation();setSelectedCreative(row)}}>{row.videoId}</button>}<span title={row.title}>{title(row.title, 52)}</span></td><td><b>{row.account}</b><span>{row.type} · {row.status}</span></td><td>{row.campaign}</td><td>{money(row.cost)}</td><td>{money(row.revenue)}</td><td>{number(row.orders)}</td><td>{row.orders?money(row.cost/row.orders):"—"}</td><td><strong className={`creative-tier ${creativeTier(row.roi)}`}>{roi(row.roi)} · {creativeTierLabel(row.roi)}</strong></td><td>{pct(row.ctr)}</td><td>{url ? <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Cek video ↗</a> : <button onClick={(event) => { event.stopPropagation(); setSelectedCreative(row); }}>Detail</button>}</td></tr> })}</tbody></table></div>
      </section>
    </>}

    {!activeBrandEmpty && tab === "live" && <>
      <section className="section-heading"><div><span>LIVESTREAM DATA</span><h2>Live host performance</h2><p>Nama campaign yang mirip otomatis digabung menjadi satu host. Klik host untuk membuka semua sesi campaign-nya.</p></div><div className="snapshot">{number(filteredLiveSessions.length)} SESSIONS <b>{number(liveLeaders.length)} HOSTS</b></div></section>
      <section className="live-filters" aria-label="Filter livestream">
        <DateRangeFilter label="Periode live" from={liveFrom} to={liveTo} min={liveBounds.min} max={liveBounds.max} onChange={(from,to)=>{setLiveFrom(from);setLiveTo(to)}}/>
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
        <Kpi label="Live sessions" value={number(filteredLiveSessions.length)} note={`${number(liveLeaders.length)} host aktif`} />
      </section>
      <section className="two-col live-charts">
        <article className="panel"><div className="panel-head"><div><span>PERFORMANCE PULSE</span><h2>Cost vs gross revenue</h2></div><div className="chart-legend"><i className="cost" />Cost <i />GMV</div></div><div className="daily-combo">{filteredTimeline.map((period) => { const max = Math.max(1, ...filteredTimeline.map((item) => item.revenue)); return <div key={period.key} title={`${period.label} · GMV ${money(period.revenue)} · Cost ${money(period.cost)}`}><span className="gmv-bar" style={{ height: `${Math.max(3, period.revenue / max * 100)}%` }} /><span className="cost-mark" style={{ bottom: `${Math.max(1, period.cost / max * 100)}%` }} /><small>{period.label}</small></div> })}</div></article>
        <article className="panel"><div className="panel-head"><div><span>TOP HOST BY GMV</span><h2>Leaderboard terfilter</h2></div><small>klik untuk detail</small></div><div className="host-bars">{liveLeaders.slice(0, 10).map((item, index) => { const max = Math.max(1, ...liveLeaders.map((host) => host.revenue)); return <button key={item.key} onClick={() => openHost(item.key)}><span>{index + 1}. {item.host}</span><i><b style={{ width: `${Math.max(2, item.revenue / max * 100)}%` }} /></i><strong>{money(item.revenue, true)}</strong></button> })}</div></article>
      </section>
      <section className="panel heatmap-panel"><div className="panel-head"><div><span>LIVE TIME HEATMAP</span><h2>Jam live paling produktif</h2><p>Warna = GMV, angka = ROI. Mengikuti seluruh filter live di atas.</p></div><div className="best-hours">{heatmap.best.map(x=><span key={x.hour}><b>{String(x.hour).padStart(2,"0")}:00</b>{money(x.revenue,true)} · {roi(x.roi)}</span>)}</div></div><div className="heatmap"><div className="heat-corner">Hari</div>{Array.from({length:24},(_,h)=><div className="heat-hour" key={h}>{String(h).padStart(2,"0")}</div>)}{["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((day,d)=><div className="heat-row" key={day}><b>{day}</b>{Array.from({length:24},(_,h)=>{const cell=heatmap.cells.find(x=>x.day===d&&x.hour===h);const intensity=cell?cell.revenue/heatmap.max:0;return <i key={h} style={{background:cell?`rgba(40,230,214,${.08+intensity*.82})`:undefined}} title={cell?`${day} ${String(h).padStart(2,"0")}:00 · ${cell.sessions} sesi · GMV ${money(cell.revenue)} · ROI ${roi(cell.cost?cell.revenue/cell.cost:0)}`:"Tidak ada sesi"}>{cell&&cell.cost?roi(cell.revenue/cell.cost).replace("x",""):""}</i>})}</div>)}</div></section>
      <section className="panel live-table-panel">
        <div className="live-table-tabs"><button className={liveView === "leader" ? "active" : ""} onClick={() => { setLiveView("leader"); setSelectedHost(null); if (liveHost !== "all") setLiveHost("all"); }}>Leaderboard Host</button><button className={liveView === "detail" ? "active" : ""} onClick={() => setLiveView("detail")}>Detail Campaign</button><div className="roi-legend"><span><i className="good" />ROI ≥ 10</span><span><i className="mid" />ROI 4–9,99</span><span><i className="bad" />ROI &lt; 4</span></div></div>
        {liveView === "leader" ? <div className="table-wrap"><table className="live-table"><thead><tr><th>Host</th><th>Sesi</th><th><button onClick={() => setLiveSortKey("cost")}>Cost {liveSort === "cost" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("revenue")}>Gross revenue {liveSort === "revenue" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("roi")}>ROI {liveSort === "roi" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("orders")}>Orders {liveSort === "orders" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>CPO</th><th><button onClick={() => setLiveSortKey("views")}>Views {liveSort === "views" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th></tr></thead><tbody>{liveLeaders.map((row) => <tr key={row.key} className="host-row" onClick={() => openHost(row.key)}><td><b>{row.host}</b><span>{row.key} · klik untuk detail ›</span></td><td>{number(row.sessions)}</td><td>{money(row.cost)}</td><td><div className="revenue-cell"><span>{money(row.revenue)}</span><i><b style={{ width: `${Math.max(2, row.revenue / Math.max(1, ...liveLeaders.map((item) => item.revenue)) * 100)}%` }} /></i></div></td><td><strong className={`roi-badge ${roiTone(row.roi)}`}>{roi(row.roi)}</strong></td><td>{number(row.orders)}</td><td>{row.orders ? money(row.cost / row.orders) : "—"}</td><td>{number(row.views)}</td></tr>)}</tbody></table></div>
        : <><div className="detail-context">{selectedHost ? <>Menampilkan semua campaign untuk <b>{hostLabels.get(selectedHost)}</b><button onClick={() => { setSelectedHost(null); setLiveHost("all"); }}>Lihat semua sesi</button></> : <>Semua detail campaign sesuai filter</>}</div><div className="table-wrap"><table className="live-table detail-table"><thead><tr><th><button onClick={() => setLiveSortKey("launchedAt")}>Tanggal {liveSort === "launchedAt" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>Campaign</th><th>Sesi</th><th><button onClick={() => setLiveSortKey("cost")}>Cost {liveSort === "cost" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("revenue")}>Gross revenue {liveSort === "revenue" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th><button onClick={() => setLiveSortKey("roi")}>ROI {liveSort === "roi" ? (liveSortDesc ? "↓" : "↑") : ""}</button></th><th>Orders</th><th>CPO</th><th>Views</th></tr></thead><tbody>{liveDetailRows.map((row) => <tr key={`${row.campaignId}-${row.launchedAt}-${row.name}`}><td>{new Date(row.launchedAt.replace(" ", "T")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}<span>{row.launchedAt.slice(11, 16)}</span></td><td><b title={row.name}>{title(row.name, 46)}</b><span>{row.campaign} · {row.campaignId}</span></td><td><em>{row.slot}</em></td><td>{money(row.cost)}</td><td>{money(row.revenue)}</td><td><strong className={`roi-badge ${roiTone(row.roi)}`}>{roi(row.roi)}</strong></td><td>{number(row.orders)}</td><td>{row.orders?money(row.cost/row.orders):"—"}</td><td>{number(row.views)}</td></tr>)}</tbody></table></div></>}
      </section>
      <p className="live-note">ROI dihitung ulang dari Gross Revenue (Current Shop) ÷ Cost. Penggabungan host mengabaikan kata umum seperti “live”, “beauty”, “official”, perbedaan kapital, tanda baca, dan huruf berulang.</p>
    </>}

    {selectedCreative && <div className="creative-modal-backdrop" role="presentation" onClick={() => setSelectedCreative(null)}><section className="creative-modal" role="dialog" aria-modal="true" aria-labelledby="creative-modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-top"><div><span>VIDEO PERFORMANCE DETAIL</span><h2 id="creative-modal-title">{selectedCreative.videoId}</h2></div><button aria-label="Tutup detail video" onClick={() => setSelectedCreative(null)}>×</button></div><p className="modal-caption">{selectedCreative.title}</p><div className="modal-tags"><span>{selectedCreative.campaign}</span><span>{selectedCreative.account}</span><span>{selectedCreative.type}</span><span>{selectedCreative.status}</span></div><div className="modal-kpis"><article><span>Spend</span><b>{money(selectedCreative.cost)}</b></article><article><span>Gross revenue</span><b>{money(selectedCreative.revenue)}</b></article><article><span>Orders</span><b>{number(selectedCreative.orders)}</b></article><article><span>ROI</span><b className={`creative-tier ${creativeTier(selectedCreative.roi)}`}>{roi(selectedCreative.roi)}</b></article><article><span>CTR</span><b>{pct(selectedCreative.ctr)}</b></article><article><span>CVR</span><b>{pct(selectedCreative.cvr)}</b></article></div><div className="video-funnel"><div><span>2s view</span><i><b style={{ width: `${Math.min(100, selectedCreative.view2 * 100)}%` }} /></i><strong>{pct(selectedCreative.view2)}</strong></div><div><span>6s view</span><i><b style={{ width: `${Math.min(100, selectedCreative.view6 * 100)}%` }} /></i><strong>{pct(selectedCreative.view6)}</strong></div><div><span>25%</span><i><b style={{ width: `${Math.min(100, selectedCreative.view25 * 100)}%` }} /></i><strong>{pct(selectedCreative.view25)}</strong></div><div><span>50%</span><i><b style={{ width: `${Math.min(100, selectedCreative.view50 * 100)}%` }} /></i><strong>{pct(selectedCreative.view50)}</strong></div><div><span>100%</span><i><b style={{ width: `${Math.min(100, selectedCreative.view100 * 100)}%` }} /></i><strong>{pct(selectedCreative.view100)}</strong></div></div><div className="modal-meta"><span>Posted <b>{selectedCreative.postedAt}</b></span><span>Authorization <b>{selectedCreative.authorization}</b></span><span>Campaign ID <b>{selectedCreative.campaignId}</b></span><span>Product ID <b>{selectedCreative.productId}</b></span></div>{tiktokVideoUrl(selectedCreative) ? <a className="open-tiktok" href={tiktokVideoUrl(selectedCreative)!} target="_blank" rel="noreferrer">Buka video di TikTok ↗</a> : <p className="video-unavailable">URL TikTok tidak tersedia untuk product card atau baris tanpa Video ID/account yang valid.</p>}</section></div>}
    {brandModalOpen && <div className="creative-modal-backdrop" onClick={()=>setBrandModalOpen(false)}><section className="brand-modal" onClick={(e)=>e.stopPropagation()}><div className="modal-top"><div><span>BRAND WORKSPACE</span><h2>{editingBrand?"Edit nama brand":"Buat brand baru"}</h2></div><button onClick={()=>setBrandModalOpen(false)}>×</button></div><p>Brand dibuat kosong terlebih dahulu. Setelah masuk ke dashboard brand, baru import file Excel.</p><label>Nama brand<input autoFocus value={brandName} onChange={(e)=>setBrandName(e.target.value)} placeholder="Contoh: Piyya Beauty"/></label><button className="save-brand" disabled={!brandName.trim()} onClick={saveBrand}>{editingBrand?"Simpan perubahan":"Buat brand"}</button></section></div>}
    {historyOpen && <div className="creative-modal-backdrop" onClick={()=>setHistoryOpen(false)}><section className="history-modal" onClick={(e)=>e.stopPropagation()}><div className="modal-top"><div><span>DATA MANAGEMENT</span><h2>Riwayat Import Bulanan</h2></div><button onClick={()=>setHistoryOpen(false)}>×</button></div><p>Setiap file tercatat berdasarkan brand, jenis data, dan bulan laporan. Menghapus riwayat juga menghapus data hasil import tersebut dari dashboard.</p><div className="history-list">{importHistory.filter(x=>selectedBrand==="all"||x.brand===selectedBrand).sort((a,b)=>b.period.localeCompare(a.period)).map(record=><article key={record.id}><div><b>{record.file}</b><span>{record.brand} · {record.kind} · <strong>{monthLabel(record.period)}</strong> · {number(record.rows)} baris</span><small>{record.importedAt}</small></div><button onClick={()=>deleteImport(record)}>Hapus</button></article>)}{importHistory.filter(x=>selectedBrand==="all"||x.brand===selectedBrand).length===0&&<div className="history-empty">Belum ada riwayat import.</div>}</div></section></div>}
    {importOpen && <div className="creative-modal-backdrop" onClick={()=>setImportOpen(false)}><section className="import-modal" onClick={(e)=>e.stopPropagation()}><div className="modal-top"><div><span>IMPORT DATA BULANAN</span><h2>Upload snapshot TikTok</h2></div><button onClick={()=>setImportOpen(false)}>×</button></div><div className="import-fields"><label className="brand-input">Brand<select value={selectedBrand} onChange={(e)=>{setSelectedBrand(e.target.value);setBrandName(e.target.value)}}><option value="all">Pilih brand…</option>{brands.map(x=><option key={x}>{x}</option>)}</select></label><label>Jenis data<select value={importKind} onChange={(e)=>setImportKind(e.target.value as ImportKind)}><option>Creative</option><option>Livestream</option></select></label><label>Periode laporan<input type="month" value={importPeriod} onChange={(e)=>setImportPeriod(e.target.value)}/></label></div><p>Pilih bulan sesuai periode export TikTok, lalu upload satu file {importKind.toLowerCase()} untuk bulan tersebut. Upload ulang pada brand, jenis, dan bulan yang sama otomatis menggantikan data lama agar tidak dobel.</p><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{const file=e.target.files?.[0];e.currentTarget.value="";if(file)importExcel(file)}}/><button className="choose-file" disabled={selectedBrand==="all"||!importPeriod} onClick={()=>fileRef.current?.click()}>{selectedBrand==="all"?"Pilih brand terlebih dahulu":`Pilih file ${importKind} · ${monthLabel(importPeriod)}`}</button><small>{importMessage}</small></section></div>}
    <footer><span>GMV MAX · FEBRUARY TEST DATA</span><p>Source: TikTok Shop Ads exports provided by user. Metrics recalculated from source rows.</p></footer>
    </div>
  </main>;
}
