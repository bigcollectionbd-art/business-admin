import { useState } from "react";
import { PackageCheck, Truck, Clock3, CirclePause, RotateCcw, RefreshCw, X, ChevronRight } from "lucide-react";
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

const demoParcels = {
  pending: [
    { invoice: "BCB-DEMO-1041", consignment: "DEMO-PTH-001", status: "Pending Pickup", updated: "আজ, ১০:১৫ AM" },
    { invoice: "BCB-DEMO-1042", consignment: "DEMO-PTH-002", status: "Pending Pickup", updated: "আজ, ১১:২০ AM" },
    { invoice: "BCB-DEMO-1043", consignment: "DEMO-PTH-003", status: "Pending Pickup", updated: "আজ, ১২:০৫ PM" },
  ],
  picked: [
    { invoice: "BCB-DEMO-1044", consignment: "DEMO-PTH-004", status: "Picked Up", updated: "আজ, ১২:৩০ PM" },
    { invoice: "BCB-DEMO-1045", consignment: "DEMO-PTH-005", status: "Picked Up", updated: "আজ, ১:১০ PM" },
  ],
  transit: [
    { invoice: "BCB-DEMO-1035", consignment: "DEMO-PTH-006", status: "In Transit", updated: "আজ, ৯:৪০ AM" },
    { invoice: "BCB-DEMO-1036", consignment: "DEMO-PTH-007", status: "In Transit", updated: "আজ, ১০:২৫ AM" },
    { invoice: "BCB-DEMO-1037", consignment: "DEMO-PTH-008", status: "In Transit", updated: "আজ, ১১:৪৫ AM" },
  ],
  hold: [
    { invoice: "BCB-DEMO-1032", consignment: "DEMO-PTH-009", status: "On Hold", updated: "আজ, ৮:৪০ AM" },
    { invoice: "BCB-DEMO-1040", consignment: "DEMO-PTH-010", status: "On Hold", updated: "আজ, ১২:২০ PM" },
  ],
  returned: [
    { invoice: "BCB-DEMO-1038", consignment: "DEMO-PTH-011", status: "Return", updated: "গতকাল, ৫:১৫ PM" },
  ],
  delivered: [
    { invoice: "BCB-DEMO-1028", consignment: "DEMO-PTH-012", status: "Delivered", updated: "আজ, ৯:০৫ AM" },
    { invoice: "BCB-DEMO-1029", consignment: "DEMO-PTH-013", status: "Delivered", updated: "আজ, ১০:৫০ AM" },
  ],
};

const statusCards = [
  { key: "pending", icon: Clock3, label: "Pickup বাকি", value: "3", tone: "amber", hint: "বুকিং হয়েছে, এখনো সংগ্রহ হয়নি" },
  { key: "picked", icon: PackageCheck, label: "Pickup সম্পন্ন", value: "4", tone: "navy", hint: "Pathao পার্সেল সংগ্রহ করেছে" },
  { key: "transit", icon: Truck, label: "ডেলিভারির পথে", value: "7", tone: "blue", hint: "পার্সেল গন্তব্যের পথে আছে" },
  { key: "hold", icon: CirclePause, label: "Hold-এ আছে", value: "2", tone: "amber", hint: "ডেলিভারি সাময়িকভাবে আটকে আছে" },
  { key: "returned", icon: RotateCcw, label: "ফেরত এসেছে", value: "1", tone: "red", hint: "পার্সেল প্রেরকের কাছে ফেরত" },
  { key: "delivered", icon: PackageCheck, label: "ডেলিভারি সম্পন্ন", value: "5", tone: "green", hint: "কাস্টমার পার্সেল পেয়েছেন" },
];

function Stat({ item, onClick }) {
  const Icon = item.icon;
  return <button type="button" className={`pathao-demo-stat ${item.tone}`} onClick={onClick}>
    <span className="pathao-demo-stat-icon"><Icon size={20} /></span>
    <span className="pathao-demo-stat-copy"><strong>{item.value}</strong><span>{item.label}</span><small>{item.hint}</small></span>
    <ChevronRight className="pathao-demo-stat-arrow" size={17} />
  </button>;
}

export default function PathaoDeliveryDemo({ mode = "dashboard" }) {
  const [selectedStatus, setSelectedStatus] = useState(null);

  if (mode === "dashboard") {
    return <section className="pathao-demo-panel pathao-demo-dashboard">
      <div className="pathao-demo-heading">
        <div><div className="pathao-demo-eyebrow">PATHAO DELIVERY CENTER</div><h2>Pathao পার্সেল আপডেট</h2><p>আপনার সব পার্সেলের বর্তমান অবস্থা এক জায়গায়</p></div>
        <span className="pathao-demo-tag"><RefreshCw size={13}/> Demo Preview</span>
      </div>
      <div className="pathao-demo-stats">
        {statusCards.map(item => <Stat key={item.key} item={item} onClick={() => setSelectedStatus(item.key)} />)}
      </div>
      <div className="pathao-demo-footer"><span><span className="pathao-demo-live-dot" /> পার্সেলের বর্তমান অবস্থা</span><span>বিস্তারিত দেখতে যেকোনো কার্ডে ক্লিক করুন</span></div>
      <p className="pathao-demo-note">এটি নমুনা ডেটার Demo; এখনো Pathao-এর Live তথ্য নয়।</p>
      {selectedStatus && <div className="pathao-demo-modal-backdrop" onClick={() => setSelectedStatus(null)}>
        <div className="pathao-demo-modal" role="dialog" aria-modal="true" aria-label="Parcel details" onClick={event => event.stopPropagation()}>
          <div className="pathao-demo-modal-head">
            <div><span>PATHAO PARCEL DETAILS</span><h3>{statusCards.find(item => item.key === selectedStatus)?.label}</h3><p>{demoParcels[selectedStatus].length}টি নমুনা পার্সেল</p></div>
            <button type="button" className="pathao-demo-close" onClick={() => setSelectedStatus(null)} aria-label="Close"><X size={19}/></button>
          </div>
          <div className="pathao-demo-parcel-list">
            {demoParcels[selectedStatus].map(parcel => <div className="pathao-demo-parcel" key={parcel.invoice}>
              <div className="pathao-demo-parcel-top"><strong>{parcel.invoice}</strong><span className={`pathao-demo-status-pill ${selectedStatus}`}>{parcel.status}</span></div>
              <div className="pathao-demo-parcel-meta"><span>Consignment: <b>{parcel.consignment}</b></span><span>Updated: {parcel.updated}</span></div>
            </div>)}
          </div>
          <p className="pathao-demo-modal-note">এগুলো নমুনা তথ্য। Live সংস্করণে এখানে আপনার আসল Invoice ও Consignment ID দেখানো হবে।</p>
        </div>
      </div>}
    </section>;
  }

  const demoIssues = [
    { invoice: "BCB-DEMO-1041", status: "On Hold", type: "hold" },
    { invoice: "BCB-DEMO-1038", status: "Return", type: "return" },
    { invoice: "BCB-DEMO-1032", status: "On Hold", type: "hold" },
  ];

  return <section className="pathao-demo-panel pathao-demo-report">
    <div className="pathao-demo-heading">
      <div><h2>Pathao — Last 7 Days Report</h2><p>প্রতিদিনের বুকিং, Pickup, Delivered, Hold ও Return</p></div>
      <span className="pathao-demo-tag">ডেমো প্রিভিউ</span>
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
