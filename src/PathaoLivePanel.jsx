import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { PackageCheck, Truck, Clock3, PauseCircle, RotateCcw, CheckCircle2, RefreshCw, AlertCircle, X, XCircle } from "lucide-react";
import "./PathaoLivePanel.css";

const groups = [
  { key: "pending", title: "Pickup বাকি", desc: "বুকিং হয়েছে, এখনো সংগ্রহ হয়নি", icon: Clock3 },
  { key: "cancelled", title: "Pickup Cancelled", desc: "Pickup বাতিল হয়েছে—আলাদা করে দেখানো হচ্ছে", icon: XCircle },
  { key: "picked", title: "Pickup সম্পন্ন", desc: "Pathao পার্সেল সংগ্রহ করেছে", icon: PackageCheck },
  { key: "transit", title: "ডেলিভারির পথে", desc: "পার্সেল গন্তব্যের পথে", icon: Truck },
  { key: "hold", title: "Hold-এ আছে", desc: "ডেলিভারি সাময়িকভাবে আটকে আছে", icon: PauseCircle },
  { key: "returned", title: "ফেরত এসেছে", desc: "ফেরত প্রক্রিয়ায় বা ফেরত সম্পন্ন", icon: RotateCcw },
  { key: "delivered", title: "ডেলিভারি সম্পন্ন", desc: "কাস্টমারের কাছে পৌঁছেছে", icon: CheckCircle2 },
];

function classify(parcel) {
  const raw = [parcel.order_status_slug, parcel.order_status, parcel.booking_status]
    .filter(Boolean).join(" ").toLowerCase().replaceAll("_", " ");
  if (/return|returned/.test(raw)) return "returned";
  if (/cancel/.test(raw)) return "cancelled";
  if (/deliver/.test(raw)) return "delivered";
  if (/hold|exception|damage|lost/.test(raw)) return "hold";
  if (/transit|out for delivery|received at|hub|sorting|assigned for delivery/.test(raw)) return "transit";
  if (/pickup|picked up|collected/.test(raw) && !/pending|assigned for pickup|pickup pending/.test(raw)) return "picked";
  return "pending";
}

function fmt(value) {
  if (!value) return "তথ্য পাওয়া যায়নি";
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PathaoLivePanel() {
  const [parcels, setParcels] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [parcelResult, historyResult] = await Promise.all([
      supabase.from("pathao_parcels")
        .select("id,sale_id,invoice_no,consignment_id,booking_status,order_status,order_status_slug,booked_at,tracking_updated_at,created_at,updated_at")
        .not("consignment_id", "is", null)
        .order("booked_at", { ascending: false })
        .limit(500),
      supabase.from("pathao_status_history")
        .select("parcel_id,order_status,order_status_slug,event_at,event_time_source")
        .order("event_at", { ascending: false })
        .limit(2500),
    ]);
    if (parcelResult.error || historyResult.error) {
      setError("Pathao তথ্য লোড করা যায়নি। সংযোগ বা অনুমতি যাচাই করুন।");
      setParcels([]);
      setHistory([]);
    } else {
      const rows = parcelResult.data || [];
      const activeOrRecent = rows.filter((p) => {
        const booked = p.booked_at || p.created_at;
        return !booked || new Date(booked) >= since || !["delivered", "returned", "cancelled"].includes(classify(p));
      });
      setParcels(activeOrRecent);
      setHistory(historyResult.data || []);
      setLastSync(new Date());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("pathao-live-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "pathao_parcels" }, load)
      .subscribe();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, []);

  const counts = useMemo(() => Object.fromEntries(groups.map(g => [g.key, parcels.filter(p => classify(p) === g.key).length])), [parcels]);

  return <section className="pathao-live-panel">
    <div className="pathao-live-heading">
      <div><span className="pathao-eyebrow">DELIVERY CONTROL CENTER</span><h2>Pathao পার্সেল আপডেট</h2><p>গত ৩০ দিনের বুকিং এবং আগের সব চলমান পার্সেলের বর্তমান অবস্থা</p></div>
      <button className="pathao-refresh" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "pathao-spin" : ""}/> Refresh</button>
    </div>
    <div className="pathao-live-meta"><span><i/> বাস্তব ডেটা</span><span>সর্বশেষ পেজে Sync: {lastSync ? fmt(lastSync) : "—"}</span></div>
    {error && <div className="pathao-error"><AlertCircle size={17}/>{error}</div>}
    <div className="pathao-live-grid">
      {groups.map(g => { const Icon = g.icon; return <button type="button" key={g.key} className={"pathao-status-card pathao-" + g.key} onClick={() => setSelected({ group: g })}>
        <span className="pathao-card-icon"><Icon size={20}/></span><strong>{loading ? "—" : counts[g.key] ?? 0}</strong><b>{g.title}</b><small>{g.desc}</small><span className="pathao-card-action">পার্সেল দেখুন →</span>
      </button>; })}
    </div>
    <p className="pathao-live-footnote">সংখ্যা আপনার Management System-এ সংরক্ষিত Pathao পার্সেল থেকে নেওয়া। Pathao API Sync ব্যর্থ হলে Refresh সময় ও ত্রুটি যাচাই করুন।</p>
    {selected && <div className="pathao-modal-backdrop" onClick={() => setSelected(null)}>
      <div className="pathao-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="pathao-modal-head"><div><span className="pathao-eyebrow">PARCEL DETAILS</span><h3>{selected.group.title}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="বন্ধ করুন"><X size={20}/></button></div>
        <div className="pathao-parcel-list">
          {parcels.filter(p => classify(p) === selected.group.key).length ? parcels.filter(p => classify(p) === selected.group.key).map(p => {
            const hs = history.filter(h => h.parcel_id === p.id);
            const delivered = hs.find(h => h.event_time_source !== "initial_snapshot" && /deliver/i.test([h.order_status,h.order_status_slug].filter(Boolean).join(" ").replaceAll("_", " ")));
            const pickup = hs.find(h => h.event_time_source !== "initial_snapshot" && /picked up|pickup completed|collected/i.test([h.order_status,h.order_status_slug].filter(Boolean).join(" ").replaceAll("_", " ")));
            return <article className="pathao-parcel-row" key={p.id}><div className="pathao-parcel-title"><b>{p.invoice_no || "Invoice unavailable"}</b><span>{p.order_status || p.order_status_slug || p.booking_status || "Status unavailable"}</span></div><div>Consignment: {p.consignment_id || "—"}</div><div>Booking date: {fmt(p.booked_at || p.created_at)}</div><div>Pickup date: {pickup ? fmt(pickup.event_at) : "Pathao থেকে Pickup date পাওয়া যায়নি"}</div>{classify(p) === "delivered" && <div>Delivery status update: {delivered ? fmt(delivered.event_at) : "Pathao থেকে Delivery date পাওয়া যায়নি"}</div>}{(classify(p) === "hold" || classify(p) === "returned") && <div>Latest issue / return update: {hs.find(h => h.event_time_source !== "initial_snapshot") ? fmt(hs.find(h => h.event_time_source !== "initial_snapshot").event_at) : "তারিখ পাওয়া যায়নি"}</div>}<div>Last Pathao update: {fmt(p.tracking_updated_at)}</div><div className="pathao-history-timeline"><b>Status History</b>{hs.length ? hs.map((h, i) => <div key={h.id || i}><span>{h.order_status || h.order_status_slug || "Status"}</span><small>{h.event_time_source === "initial_snapshot" ? "তারিখ পাওয়া যায়নি" : fmt(h.event_at)} · {h.event_time_source === "pathao_reported" ? "Pathao reported" : h.event_time_source === "initial_snapshot" ? "Initial snapshot" : "System observed"}</small></div>) : <small>পুরোনো Status history সংরক্ষিত ছিল না; নতুন update থেকে history তৈরি হবে।</small>}</div></article>;
          }) : <div className="pathao-empty">এই Status-এ কোনো পার্সেল পাওয়া যায়নি।</div>}
        </div>
      </div>
    </div>}
  </section>;
}
