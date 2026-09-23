import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import * as XLSX from "xlsx";
import { supabase } from "./supabase";
import "./Invoice.css";

const FACEBOOK_PAGE_URL = "https://www.facebook.com/Bigcollectionbd";

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function money(value) {
  return "BDT " + Number(value || 0).toFixed(2);
}

function Invoice() {
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_no,
        customer_id,
        sale_date,
        subtotal,
        discount,
        total,
        payment_method,
        customers (
          id,
          name,
          phone,
          address
        )
      `)
      .order("sale_date", { ascending: false });

    if (error) {
      console.error("Invoices error:", error);
      setLoading(false);
      return;
    }

    setSales(data || []);
    setLoading(false);
  }

  async function openInvoice(sale) {
    setDetailLoading(true);
    setSelectedSale(sale);
    setItems([]);

    const { data, error } = await supabase
      .from("sale_items")
      .select(`
        id,
        product_name,
        quantity,
        unit_price,
        total
      `)
      .eq("sale_id", sale.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Invoice items error:", error);
    } else {
      setItems(data || []);
    }

    setDetailLoading(false);
  }

  async function exportExcel() {
    if (exporting) return;

    setExporting(true);

    try {
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
          id,
          invoice_no,
          sale_date,
          subtotal,
          discount,
          total,
          paid,
          due,
          payment_method,
          status,
          notes,
          customers (
            name,
            phone,
            email,
            address
          )
        `)
        .order("sale_date", { ascending: false });

      if (salesError) {
        throw new Error(salesError.message);
      }

      const saleIds = (salesData || []).map((sale) => sale.id);

      let itemsData = [];

      if (saleIds.length > 0) {
        const { data, error: itemsError } = await supabase
          .from("sale_items")
          .select(`
            sale_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total,
            created_at
          `)
          .in("sale_id", saleIds)
          .order("created_at", { ascending: true });

        if (itemsError) {
          throw new Error(itemsError.message);
        }

        itemsData = data || [];
      }

      const { data: customersData, error: customersError } =
        await supabase
          .from("customers")
          .select(`
            id,
            name,
            phone,
            email,
            address,
            created_at
          `)
          .order("created_at", { ascending: false });

      if (customersError) {
        throw new Error(customersError.message);
      }

      const { data: paymentsData, error: paymentsError } =
        await supabase
          .from("payments")
          .select(`
            id,
            sale_id,
            customer_id,
            amount,
            payment_method,
            payment_date,
            notes,
            created_at
          `)
          .order("payment_date", { ascending: false });

      if (paymentsError) {
        throw new Error(paymentsError.message);
      }

      const { data: expensesData, error: expensesError } =
        await supabase
          .from("expenses")
          .select(`
            id,
            title,
            category,
            amount,
            expense_date,
            notes,
            created_at
          `)
          .order("expense_date", { ascending: false });

      if (expensesError) {
        throw new Error(expensesError.message);
      }

      const salesRows = (salesData || []).map((sale) => ({
        "Invoice No": sale.invoice_no || "",
        "Date": formatDate(sale.sale_date),
        "Customer Name": sale.customers?.name || "Walk-in Customer",
        "Phone": sale.customers?.phone || "",
        "Email": sale.customers?.email || "",
        "Address": sale.customers?.address || "",
        "Subtotal": Number(sale.subtotal || 0),
        "Discount": Number(sale.discount || 0),
        "Grand Total": Number(sale.total || 0),
        "Paid": Number(sale.paid || 0),
        "Due": Number(sale.due || 0),
        "Payment Method": sale.payment_method || "",
        "Status": sale.status || "",
        "Notes": sale.notes || "",
      }));

      const itemRows = itemsData.map((item) => {
        const sale = (salesData || []).find(
          (saleItem) => saleItem.id === item.sale_id
        );

        return {
          "Invoice No": sale?.invoice_no || "",
          "Invoice Date": sale ? formatDate(sale.sale_date) : "",
          "Product Name": item.product_name || "",
          Quantity: Number(item.quantity || 0),
          "Unit Price": Number(item.unit_price || 0),
          "Total Price": Number(item.total || 0),
        };
      });

      const customerRows = (customersData || []).map((customer) => ({
        "Customer Name": customer.name || "",
        Phone: customer.phone || "",
        Email: customer.email || "",
        Address: customer.address || "",
        "Created Date": formatDate(customer.created_at),
      }));

      const paymentRows = (paymentsData || []).map((payment) => ({
        "Payment Date": formatDate(payment.payment_date),
        "Invoice ID": payment.sale_id || "",
        "Customer ID": payment.customer_id || "",
        Amount: Number(payment.amount || 0),
        "Payment Method": payment.payment_method || "",
        Notes: payment.notes || "",
      }));

      const expenseRows = (expensesData || []).map((expense) => ({
        "Expense Date": expense.expense_date || "",
        Title: expense.title || "",
        Category: expense.category || "",
        Amount: Number(expense.amount || 0),
        Notes: expense.notes || "",
      }));

      const workbook = XLSX.utils.book_new();

      const salesSheet = XLSX.utils.json_to_sheet(salesRows);
      const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
      const customersSheet = XLSX.utils.json_to_sheet(customerRows);
      const paymentsSheet = XLSX.utils.json_to_sheet(paymentRows);
      const expensesSheet = XLSX.utils.json_to_sheet(expenseRows);

      XLSX.utils.book_append_sheet(workbook, salesSheet, "Sales History");
      XLSX.utils.book_append_sheet(workbook, itemsSheet, "Sale Items");
      XLSX.utils.book_append_sheet(workbook, customersSheet, "Customers");
      XLSX.utils.book_append_sheet(workbook, paymentsSheet, "Payments");
      XLSX.utils.book_append_sheet(workbook, expensesSheet, "Expenses");

      XLSX.writeFile(
        workbook,
        `Big-Collection-BD-Backup-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
    } catch (error) {
      console.error("Excel export error:", error);
      alert("Excel export failed: " + error.message);
    } finally {
      setExporting(false);
    }
  }

  function closeInvoice() {
    setSelectedSale(null);
    setItems([]);
  }

  if (loading) {
    return (
      <div className="invoice-page">
        <div className="invoice-list-card">
          Loading invoices...
        </div>
      </div>
    );
  }

  if (selectedSale) {
    const customer = selectedSale.customers;

    return (
      <div className="invoice-page">
        <div className="invoice-actions no-print">
          <button
            className="secondary-button"
            onClick={closeInvoice}
          >
            ← Back to Invoices
          </button>

          <button
            className="print-button"
            onClick={() => window.print()}
          >
            Print Invoice
          </button>
        </div>

        {detailLoading ? (
          <div className="invoice-list-card">
            Loading invoice...
          </div>
        ) : (
          <div className="invoice-paper">
            <div className="invoice-header">
              <div className="company-area">
                <div className="company-name">
                  Big Collection BD
                </div>

                <div className="company-tagline">
                  Buy More Save More
                </div>

                <div className="company-info">
                  <div>
                    Phone : +8801747165308 , +8801789845647 (Basar)
                  </div>

                  <div>
                    Address : F#A-2, 2nd Floor, House-414, Barek
                    Bhandari Road, Uttara Azampur, Kachabazar, Dhaka -1230
                  </div>

                  <div>
                    🌐 bigcollectionbd.com
                  </div>
                </div>
              </div>

              <div className="qr-section">
                <QRCodeCanvas
                  value={FACEBOOK_PAGE_URL}
                  size={105}
                  level="M"
                  includeMargin={true}
                />

                <div className="qr-caption">
                  Scan to Follow us on Facebook
                </div>
              </div>
            </div>

            <div className="invoice-info-grid">
              <div className="invoice-to">
                <div className="box-title">
                  INVOICE TO
                </div>

                <div className="info-line">
                  <strong>Customer Name :</strong>
                  <span>
                    {customer?.name || "Walk-in Customer"}
                  </span>
                </div>

                <div className="info-line">
                  <strong>Phone Number :</strong>
                  <span>
                    {customer?.phone || "-"}
                  </span>
                </div>

                <div className="info-line">
                  <strong>Address :</strong>
                  <span>
                    {customer?.address || "-"}
                  </span>
                </div>
              </div>

              <div className="invoice-information">
                <div className="box-title">
                  INVOICE INFORMATION
                </div>

                <div className="info-line">
                  <strong>Invoice No :</strong>
                  <span>
                    {selectedSale.invoice_no}
                  </span>
                </div>

                <div className="info-line">
                  <strong>Invoice Date :</strong>
                  <span>
                    {formatDate(selectedSale.sale_date)}
                  </span>
                </div>
              </div>

              <div className="payment-method">
                <div className="box-title">
                  PAYMENT METHOD
                </div>

                <div className="payment-option">
                  □ Bkash / Nagad / Rocket
                </div>

                <div className="payment-option">
                  □ Bank Transfer
                </div>

                <div className="payment-option">
                  □ Cash on Delivery
                </div>

                <div className="selected-payment">
                  Selected : {selectedSale.payment_method || "cash"}
                </div>
              </div>
            </div>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th className="sl-column">SL</th>
                  <th>Item Description</th>
                  <th className="qty-column">Quantity</th>
                  <th className="price-column">Unit Price</th>
                  <th className="price-column">Total Price</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="center">
                      {index + 1}
                    </td>

                    <td>
                      {item.product_name}
                    </td>

                    <td className="center">
                      {Number(item.quantity || 0)}
                    </td>

                    <td className="right">
                      {money(item.unit_price)}
                    </td>

                    <td className="right">
                      {money(item.total)}
                    </td>
                  </tr>
                ))}

                {Array.from({
                  length: Math.max(0, 5 - items.length),
                }).map((_, index) => (
                  <tr key={`empty-${index}`}>
                    <td className="center">
                      {items.length + index + 1}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary-section">
              <div className="summary-row">
                <span>Sub Total</span>
                <strong>
                  {money(selectedSale.subtotal)}
                </strong>
              </div>

              <div className="summary-row">
                <span>Discount</span>
                <strong>
                  {money(selectedSale.discount)}
                </strong>
              </div>

              <div className="summary-row grand-total">
                <span>GRAND TOTAL</span>
                <strong>
                  {money(selectedSale.total)}
                </strong>
              </div>
            </div>

            <div className="invoice-bottom">
              <div className="terms-section">
                <div className="terms-title">
                  Terms & Conditions
                </div>

                <div className="term">
                  1. পণ্য গ্রহণের সময় চেক করে বুঝে নিন।
                </div>

                <div className="term">
                  2. শুধুমাত্র ম্যানুফ্যাকচারিং ত্রুটির ক্ষেত্রে ৩ দিনের মধ্যে এক্সচেঞ্জ প্রযোজ্য।
                </div>

                <div className="term">
                  3. ডেলিভারি চার্জ ফেরতযোগ্য নয়।
                </div>

                <div className="term">
                  4. এক্সচেঞ্জের জন্য ইনভয়েস সংরক্ষণ করতে হবে।
                </div>
              </div>

              <div className="signature-section">
                <div className="signature-line"></div>

                <div className="signature-title">
                  Authorized Signature
                </div>
              </div>
            </div>

            <div className="invoice-footer">
              <div className="thanks">
                🛒 Thanks for choosing Big Collection BD 🛒
              </div>

              <div className="review-message">
                আপনাদের একটি রিভিউ আমাদের অনুপ্রেরণা দেয়,অনুগ্রহ করে
                আপনার একটি রিভিউ আমাদের ইনবক্সে পাঠান
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="invoice-page">
      <div className="invoice-list-card">
        <div className="invoice-list-header">
          <div>
            <h2>Invoices</h2>
            <p>
              View and print your sales invoices
            </p>
          </div>

          <div className="invoice-header-actions">
            <button
              className="export-excel-button no-print"
              onClick={exportExcel}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>

            <div className="invoice-count">
              {sales.length} Invoice{sales.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="invoice-empty">
            No invoices found.
          </div>
        ) : (
          <div className="invoice-list-table">
            <div className="invoice-list-row invoice-list-heading">
              <div>Invoice No</div>
              <div>Date</div>
              <div>Customer Name</div>
              <div>Phone</div>
              <div>Address</div>
              <div>Total</div>
              <div>Action</div>
            </div>

            {sales.map((sale) => {
              const customer = sale.customers;

              return (
                <div
                  className="invoice-list-row"
                  key={sale.id}
                  onClick={() => openInvoice(sale)}
                >
                  <div className="invoice-number">
                    {sale.invoice_no}
                  </div>

                  <div>
                    {formatDate(sale.sale_date)}
                  </div>

                  <div>
                    {customer?.name || "Walk-in Customer"}
                  </div>

                  <div>
                    {customer?.phone || "-"}
                  </div>

                  <div className="address-cell">
                    {customer?.address || "-"}
                  </div>

                  <div className="invoice-total">
                    {money(sale.total)}
                  </div>

                  <div>
                    <button
                      className="view-invoice-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openInvoice(sale);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Invoice;
