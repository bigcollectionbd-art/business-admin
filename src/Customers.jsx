import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { supabase } from "./supabase";
import "./Customers.css";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, address, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Customers load failed: " + error.message);
    } else {
      setCustomers(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function saveCustomer(event) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Customer name is required.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .select()
      .single();

    if (error) {
      alert("Customer save failed: " + error.message);
      setSaving(false);
      return;
    }

    setCustomers((current) => [data, ...current]);

    setName("");
    setPhone("");
    setAddress("");
    setShowForm(false);
    setSaving(false);
  }

  const filteredCustomers = customers.filter((customer) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return true;

    return (
      customer.name?.toLowerCase().includes(keyword) ||
      customer.phone?.toLowerCase().includes(keyword) ||
      customer.address?.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="customers-page">
      <div className="customers-toolbar">
        <div className="customers-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search customer name or phone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <button
          className="add-customer-button"
          onClick={() => setShowForm(true)}
        >
          <UserPlus size={18} />
          Add Customer
        </button>
      </div>

      {showForm && (
        <div className="customer-form-box">
          <div className="customer-form-header">
            <h2>Add Customer</h2>

            <button
              type="button"
              className="customer-close-button"
              onClick={() => setShowForm(false)}
            >
              ×
            </button>
          </div>

          <form onSubmit={saveCustomer}>
            <label>Customer Name *</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />

            <label>Phone Number</label>
            <input
              type="text"
              placeholder="Enter phone number"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />

            <label>Address</label>
            <textarea
              rows="3"
              placeholder="Enter customer address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />

            <div className="customer-form-actions">
              <button
                type="button"
                className="customer-cancel-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="customer-save-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="customers-table-box">
        <div className="customers-table-header">
          <div>
            <h2>Customers</h2>
            <p>{filteredCustomers.length} customer(s)</p>
          </div>

          <Users size={24} />
        </div>

        {loading ? (
          <div className="customers-empty">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="customers-empty">
            No customers found.
          </div>
        ) : (
          <div className="customers-table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer, index) => (
                  <tr key={customer.id}>
                    <td>{index + 1}</td>
                    <td className="customer-name-cell">
                      {customer.name}
                    </td>
                    <td>{customer.phone || "—"}</td>
                    <td>{customer.address || "—"}</td>
                    <td>
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Customers;
