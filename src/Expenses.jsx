import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "./supabase";
import "./Expenses.css";

const EMPTY_FORM = {
  title: "",
  category: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadExpenses() {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, title, category, amount, expense_date, notes, created_at")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Expenses load failed:", error);
      alert(`Could not load expenses: ${error.message}`);
      setExpenses([]);
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return expenses;
    return expenses.filter((item) =>
      [item.title, item.category, item.notes]
        .some((value) => String(value || "").toLowerCase().includes(keyword))
    );
  }, [expenses, search]);

  const total = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0), 0
  );

  function openNewForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, expense_date: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  }

  function openEditForm(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      category: item.category || "",
      amount: String(item.amount ?? ""),
      expense_date: item.expense_date || new Date().toISOString().slice(0, 10),
      notes: item.notes || "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveExpense(event) {
    event.preventDefault();
    if (saving) return;

    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0 || !form.expense_date) {
      alert("Enter an expense title, valid amount and date.");
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      amount,
      expense_date: form.expense_date,
      notes: form.notes.trim() || null,
    };

    const result = editingId
      ? await supabase.from("expenses").update(payload).eq("id", editingId)
      : await supabase.from("expenses").insert(payload);

    if (result.error) {
      console.error("Expense save failed:", result.error);
      alert(`Could not save expense: ${result.error.message}`);
      setSaving(false);
      return;
    }

    await loadExpenses();
    setSaving(false);
    closeForm();
  }

  async function deleteExpense(item) {
    if (!window.confirm(`Delete expense "${item.title}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", item.id);
    if (error) {
      console.error("Expense delete failed:", error);
      alert(`Could not delete expense: ${error.message}`);
      return;
    }
    setExpenses((current) => current.filter((row) => row.id !== item.id));
  }

  function money(value) {
    return `BDT ${Number(value || 0).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return (
    <div className="expenses-page">
      <div className="expenses-toolbar">
        <div>
          <h2>Expenses</h2>
          <p>Record and review business expenses</p>
        </div>
        <button className="expense-add-button" type="button" onClick={openNewForm}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className="expenses-summary">
        <span>Total expenses shown</span>
        <strong>{money(total)}</strong>
      </div>

      <div className="expenses-search">
        <Search size={18} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, category or notes..."
        />
      </div>

      {loading ? (
        <div className="expenses-empty">Loading expenses...</div>
      ) : filteredExpenses.length === 0 ? (
        <div className="expenses-empty">No expenses found.</div>
      ) : (
        <div className="expenses-table-wrap">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((item) => (
                <tr key={item.id}>
                  <td>{item.expense_date || "—"}</td>
                  <td className="expense-title-cell">{item.title}</td>
                  <td>{item.category || "—"}</td>
                  <td>{money(item.amount)}</td>
                  <td>{item.notes || "—"}</td>
                  <td>
                    <div className="expense-row-actions">
                      <button type="button" aria-label="Edit expense" onClick={() => openEditForm(item)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" aria-label="Delete expense" onClick={() => deleteExpense(item)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="expense-modal-backdrop">
          <form className="expense-modal" onSubmit={saveExpense}>
            <div className="expense-modal-header">
              <h3>{editingId ? "Edit Expense" : "Add Expense"}</h3>
              <button type="button" onClick={closeForm} aria-label="Close" disabled={saving}>
                <X size={20} />
              </button>
            </div>

            <label htmlFor="expense-title">Expense Title *</label>
            <input id="expense-title" name="title" value={form.title} onChange={updateField} required maxLength={160} />

            <label htmlFor="expense-category">Category</label>
            <input id="expense-category" name="category" value={form.category} onChange={updateField} placeholder="e.g. Delivery, Packaging, Ads" maxLength={100} />

            <label htmlFor="expense-amount">Amount (BDT) *</label>
            <input id="expense-amount" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} required />

            <label htmlFor="expense-date">Date *</label>
            <input id="expense-date" name="expense_date" type="date" value={form.expense_date} onChange={updateField} required />

            <label htmlFor="expense-notes">Notes</label>
            <textarea id="expense-notes" name="notes" rows={3} value={form.notes} onChange={updateField} maxLength={2000} />

            <div className="expense-modal-actions">
              <button type="button" className="expense-cancel-button" onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" className="expense-save-button" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Save Expense"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Expenses;
