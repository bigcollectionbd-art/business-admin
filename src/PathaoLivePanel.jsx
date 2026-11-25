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
  { key: "assigned", title: "ডেলিভারির জন্য অ্যাসাইন", desc: "রাইডার/ডেলিভারি হাবে আছে—এখনো Delivered নয়", icon: Truck },
  { key: "delivered", title: "ডেলিভারি সম্পন্ন", desc: "কাস্টমারের কাছে পৌঁছেছে", icon: CheckCircle2 },
  { key: "returned", title: "ফেরত এসেছে", desc: "ফেরত প্রক্রিয়ায় বা ফেরত সম্পন্ন", icon: RotateCcw },
];

function classify(parcel) {
  const raw = [parcel.order_status_slug, parcel.order_status, parcel.booking_status]
    .filter(Boolean).join(" ").toLowerCase().replaceAll("_", " ");
  if (/return|returned/.test(raw)) return "returned";
  if (/cancel/.test(raw)) return "cancelled";
  if (/\b(delivered|delivery completed|successfully delivered)\b/.test(raw)) return "delivered";
  if (/ready for delivery|assigned for delivery|out for delivery|delivery assigned/.test(raw)) return "assigned";
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
  const [saleItems, setSaleItems] = useState([]);
  const [activeParcel, setActiveParcel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      async function fetchEveryPage(table, columns, orderColumn) {
        const all = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error: pageError } = await supabase
            .from(table)
            .select(columns)
            .order(orderColumn, { ascending: false })
            .range(from, from + pageSize - 1);
          if (pageError) throw pageError;
          const page = data || [];
          all.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }
        return all;
      }

      const [allParcels, allHistory] = await Promise.all([
        (async () => {
          const all = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error: pageError } = await supabase
              .from("pathao_parcels")
              .select("id,sale_id,invoice_no,recipient_name,recipient_phone,consignment_id,booking_status,order_status,order_status_slug,booked_at,tracking_updated_at,created_at,updated_at")
              .not("consignment_id", "is", null)
              .order("booked_at", { ascending: false })
              .range(from, from + pageSize - 1);
            if (pageError) throw pageError;
            const page = data || [];
            all.push(...page);
            if (page.length < pageSize) break;
            from += pageSize;
          }
          return all;
        })(),
        fetchEveryPage("pathao_status_history", "id,parcel_id,order_status,order_status_slug,event_at,event_time_source", "event_at"),
      ]);

      const saleIds = [...new Set(allParcels.map(p => p.sale_id).filter(Boolean))];
      let items = [];
      if (saleIds.length) {
        const { data: itemData, error: itemError } = await supabase.from("sale_items").select("id,sale_id,product_name,quantity,unit_price,total").in("sale_id", saleIds);
        if (itemError) throw itemError;
        items = itemData || [];
      }

      const activeOrRecent = allParcels.filter((p) => {
        const booked = p.booked_at || p.created_at;
        return !booked || new Date(booked) >= since || !["delivered", "returned", "cancelled"].includes(classify(p));
      });
      setParcels(activeOrRecent);
      setHistory(allHistory);
      setSaleItems(items);
      setLastSync(new Date());
    } catch (loadError) {
      console.error("Pathao dashboard load error:", loadError);
      setError("Pathao তথ্য লোড করা যায়নি। সংযোগ বা অনুমতি যাচাই করুন।");
      setParcels([]);
      setHistory([]);
      setSaleItems([]);
    } finally {
      setLoading(false);
    }
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

  const closeDetails = () => { setSelected(null); setActiveParcel(null); };

  function renderParcelDetails(p) {
    const hs = history.filter(h => h.parcel_id === p.id);
    const items = saleItems.filter(item => item.sale_id === p.sale_id);
    const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const delivered = hs.find(h => h.event_time_source !== "initial_snapshot" && /\b(delivered|delivery completed|successfully delivered)\b/i.test([h.order_status,h.order_status_slug].filter(Boolean).join(" ").replaceAll("_", " ")));
    const pickup = hs.find(h => h.event_time_source !== "initial_snapshot" && /picked|pickup complete|pickup done|collected/i.test([h.order_status,h.order_status_slug].filter(Boolean).join(" ").replaceAll("_", " ")));
    return <div className="pathao-full-details">
      <section className="pathao-detail-section">
        <h4>Customer & Parcel Details</h4>
        <div className="pathao-detail-grid">
          <div><small>Customer Name</small><strong>{p.recipient_name || "তথ্য পাওয়া যায়নি"}</strong></div>
          <div><small>Mobile Number</small><strong>{p.recipient_phone || "তথ্য পাওয়া যায়নি"}</strong></div>
          <div><small>Consignment ID</small><strong>{p.consignment_id || "—"}</strong></div>
          <div><small>Current Status</small><strong>{p.order_status || p.order_status_slug || p.booking_status || "—"}</strong></div>
          <div><small>Booking Date</small><strong>{fmt(p.booked_at || p.created_at)}</strong></div>
          <div><small>Pickup Date</small><strong>{pickup ? fmt(pickup.event_at) : "Pathao থেকে Pickup date পাওয়া যায়নি"}</strong></div>
          {classify(p) === "delivered" && <div><small>Delivery Date</small><strong>{delivered ? fmt(delivered.event_at) : "Pathao থেকে Delivery date পাওয়া যায়নি"}</strong></div>}
          <div><small>Last Pathao Update</small><strong>{fmt(p.tracking_updated_at)}</strong></div>
        </div>
      </section>
      <section className="pathao-detail-section">
        <div className="pathao-products-heading"><h4>অর্ডার করা প্রোডাক্ট</h4><b>মোট Quantity: {totalQty || "—"}</b></div>
        {items.length ? <div className="pathao-product-list">{items.map(item => <article className="pathao-product-item" key={item.id}>
          <strong>{item.product_name || "Product name পাওয়া যায়নি"}</strong>
          <div><span>Quantity: <b>{Number(item.quantity || 0).toLocaleString("en-BD")}</b></span><span>Unit Price: ৳{Number(item.unit_price || 0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2})}</span><b>৳{Number(item.total || 0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>
        </article>)}</div> : <p className="pathao-no-products">এই Invoice-এর প্রোডাক্টের তথ্য পাওয়া যায়নি।</p>}
      </section>
      <section className="pathao-detail-section pathao-history-timeline">
        <h4>Status History</h4>
        {hs.length ? hs.map((h,i) => <div key={h.id || i}><span>{h.order_status || h.order_status_slug || "Status"}</span><small>{h.event_time_source === "initial_snapshot" ? "তারিখ পাওয়া যায়নি" : fmt(h.event_at)} · {h.event_time_source === "pathao_reported" ? "Pathao reported" : h.event_time_source === "initial_snapshot" ? "Initial snapshot" : "System observed"}</small></div>) : <small>কোনো Status History পাওয়া যায়নি।</small>}
      </section>
    </div>;
  }

  return <section className="pathao-live-panel">
    <div className="pathao-live-heading">
      <div><span className="pathao-eyebrow">PATHAO DELIVERY CENTER</span></div>
      <button className="pathao-refresh" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "pathao-spin" : ""}/> Refresh</button>
    </div>
    <div className="pathao-live-meta"><span>সর্বশেষ ডেটা লোড: {lastSync ? fmt(lastSync) : "—"}</span></div>
    {error && <div className="pathao-error"><AlertCircle size={17}/>{error}</div>}
    <div className="pathao-live-grid">
      {groups.map(g => { const Icon = g.icon; return <button type="button" key={g.key} className={"pathao-status-card pathao-" + g.key} onClick={() => { setSelected({ group: g }); setActiveParcel(null); }}>
        <span className="pathao-card-icon"><Icon size={20}/></span><strong>{loading || error ? "—" : counts[g.key] ?? 0}</strong><b>{g.title}</b><small>{g.desc}</small><span className="pathao-card-action">পার্সেল দেখুন →</span>
      </button>; })}
    </div>
    <p className="pathao-live-footnote">সংখ্যা আপনার Management System-এ সংরক্ষিত Pathao পার্সেল থেকে নেওয়া।</p>
    {selected && <div className="pathao-modal-backdrop" onClick={closeDetails}>
      <div className="pathao-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="pathao-modal-head">
          <div><span className="pathao-eyebrow">{activeParcel ? "PARCEL DETAILS" : "PARCEL LIST"}</span><h3>{activeParcel ? activeParcel.invoice_no : selected.group.title}</h3></div>
          <div className="pathao-modal-actions">
            {activeParcel && <button type="button" className="pathao-back-button" onClick={() => setActiveParcel(null)}>← Back</button>}
            <button type="button" onClick={closeDetails} aria-label="বন্ধ করুন"><X size={20}/></button>
          </div>
        </div>
        {!activeParcel ? <div className="pathao-parcel-list">
          {parcels.filter(p => classify(p) === selected.group.key).length ? parcels.filter(p => classify(p) === selected.group.key).map(p => <button type="button" className="pathao-invoice-row" key={p.id} onClick={() => setActiveParcel(p)}>
            <strong>{p.invoice_no || "Invoice unavailable"}</strong><span>সম্পূর্ণ ডিটেইলস দেখুন →</span>
          </button>) : <div className="pathao-empty">এই Status-এ কোনো পার্সেল পাওয়া যায়নি।</div>}
        </div> : renderParcelDetails(activeParcel)}
      </div>
    </div>}
  </section>;
}
