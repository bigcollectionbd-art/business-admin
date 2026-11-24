import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { Activity, RefreshCw } from "lucide-react";
import "./PathaoActivityReport.css";

export default function PathaoActivityReport() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const { data, error: queryError } = await supabase
      .from("pathao_status_history")
      .select("id,invoice_no,consignment_id,order_status,order_status_slug,event_at,event_time_source")
      .gte("event_at", from.toISOString())
      .order("event_at", { ascending: false })
      .limit(500);
    if (queryError) {
      setError("Pathao activity report লোড করা যায়নি।");
      setEvents([]);
    } else setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const daily = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-CA");
      days.push({ key, label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), count: events.filter(e => new Date(e.event_at).toLocaleDateString("en-CA") === key).length });
    }
    return days;
  }, [events]);

  const max = Math.max(1, ...daily.map(d => d.count));

  return <section className="pathao-activity-report">
    <div className="pathao-activity-head">
      <div><span>PATHAO ACTIVITY</span><h3><Activity size={18}/> Pathao Last 7 Days</h3><p>গত ৭ দিনে রেকর্ড হওয়া পার্সেল Status পরিবর্তন</p></div>
      <button type="button" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <p className="pathao-activity-error">{error}</p>}
    <div className="pathao-activity-chart">{daily.map(d => <div className="pathao-activity-day" key={d.key}><b>{d.count}</b><div className="pathao-activity-track"><i style={{height:`${d.count / max * 100}%`}}/></div><small>{d.label}</small></div>)}</div>
    <div className="pathao-activity-summary"><strong>{loading ? "—" : events.length}</strong><span>মোট Status Update</span><span>·</span><span>শুধু সংরক্ষিত বাস্তব update</span></div>
    {loading ? <p className="pathao-activity-empty">Loading Pathao activity…</p> : events.length === 0 ? <p className="pathao-activity-empty">গত ৭ দিনে কোনো Status update রেকর্ড হয়নি।</p> : <div className="pathao-activity-table-wrap"><table><thead><tr><th>সময়</th><th>Invoice</th><th>Consignment</th><th>Pathao Status</th><th>সময় ধরন</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td>{new Date(e.event_at).toLocaleString("en-GB")}</td><td>{e.invoice_no}</td><td>{e.consignment_id || "—"}</td><td>{e.order_status || e.order_status_slug || "—"}</td><td>{e.event_time_source === "pathao_reported" ? "Pathao reported" : e.event_time_source === "initial_snapshot" ? "Initial snapshot" : "System observed"}</td></tr>)}</tbody></table></div>}
  </section>;
}
