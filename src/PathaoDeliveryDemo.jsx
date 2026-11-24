import { PackageCheck, Truck, Clock3, CirclePause, RotateCcw, RefreshCw } from "lucide-react";
import "./PathaoDeliveryDemo.css";

const demoRows = [
  { day: "আজ", booking: 12, pickup: 9, delivered: 5, hold: 1, returned: 0 },
  { day: "গতকাল", booking: 10, pickup: 10, delivered: 8, hold: 0, returned: 1 },
  { day: "২ দিন আগে", booking: 8, pickup: 7, delivered: 6, hold: 1, returned: 0 },
  { day: "৩ দিন আগে", booking: 11, pickup: 11, delivered: 9, hold: 0, returned: 1 },
  { day: "৪ দিন আগে", booking: 6, pickup: 6, delivered: 5, hold: 0, returned: 0 },
  { day: "৫ দিন আগে", booking: 9, pickup: 8, delivered: 7, hold: 1, returned: 0 },
  { day: "৬ দিন আগে", booking: 7, pickup: 7, delivered: 6, hold: 0, returned: 1 },
];

const demoIssues = [
  { invoice: "BCB-DEMO-1041", status: "On Hold", type: "hold" },
  { invoice: "BCB-DEMO-1038", status: "Return", type: "return" },
  { invoice: "BCB-DEMO-1032", status: "On Hold", type: "hold" },
];

function Stat({ icon: Icon, label, value, tone }) {
  return <div className={`pathao-demo-stat ${tone || ""}`}>
    <span className="pathao-demo-stat-icon"><Icon size={19} /></span>
    <div><strong>{value}</strong><span>{label}</span></div>
  </div>;
}

export default function PathaoDeliveryDemo({ mode = "dashboard" }) {
  if (mode === "dashboard") {
    return <section className="pathao-demo-panel">
      <div className="pathao-demo-heading">
        <div><h2>Pathao Delivery — Live Status</h2><p>ড্যাশবোর্ডে শুধু বর্তমান পার্সেল স্ট্যাটাস</p></div>
        <span className="pathao-demo-tag"><RefreshCw size={13}/> Demo Preview</span>
      </div>
      <div className="pathao-demo-stats">
        <Stat icon={Clock3} label="Booking Pending Pickup" value="3" tone="amber" />
        <Stat icon={PackageCheck} label="Picked Up" value="4" />
        <Stat icon={Truck} label="In Transit" value="7" tone="blue" />
        <Stat icon={CirclePause} label="On Hold" value="2" tone="amber" />
        <Stat icon={RotateCcw} label="Returned" value="1" tone="red" />
        <Stat icon={PackageCheck} label="Delivered" value="5" tone="green" />
      </div>
      <p className="pathao-demo-note">এগুলো নমুনা সংখ্যা—Pathao থেকে Live ডেটা নয়।</p>
    </section>;
  }

  return <section className="pathao-demo-panel pathao-demo-report">
    <div className="pathao-demo-heading">
      <div><h2>Pathao — Last 7 Days Report</h2><p>প্রতিদিনের বুকিং, Pickup, Delivered, Hold ও Return</p></div>
      <span className="pathao-demo-tag">Demo Preview</span>
    </div>
    <div className="pathao-demo-table-wrap">
      <table className="pathao-demo-table">
        <thead><tr><th>দিন</th><th>Booking</th><th>Pickup</th><th>Delivered</th><th>Hold</th><th>Return</th></tr></thead>
        <tbody>{demoRows.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.booking}</td><td>{row.pickup}</td><td>{row.delivered}</td><td>{row.hold}</td><td>{row.returned}</td></tr>)}</tbody>
        <tfoot><tr><th>৭ দিনের মোট</th><th>63</th><th>58</th><th>46</th><th>3</th><th>3</th></tr></tfoot>
      </table>
    </div>
    <div className="pathao-demo-issues">
      <h3>Hold & Return পার্সেল — নমুনা তালিকা</h3>
      {demoIssues.map(item => <div className="pathao-demo-issue" key={item.invoice}><strong>{item.invoice}</strong><span className={item.type}>{item.status}</span></div>)}
    </div>
    <p className="pathao-demo-note">সব সংখ্যা ও Invoice নমুনা। প্রকৃত ৭ দিনের রিপোর্টের জন্য প্রতিটি Status পরিবর্তনের তারিখ সংরক্ষণ করতে হবে।</p>
  </section>;
}
