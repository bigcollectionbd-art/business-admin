import "./Reports.css";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ShoppingCart,
  Wallet,
  CreditCard,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import { supabase } from "./supabase";

function Reports() {
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("30");

  async function loadReports() {
    setLoading(true);

    try {
      const [salesResult, itemsResult] = await Promise.all([
        supabase
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
            customer_id
          `)
          .order("sale_date", { ascending: false }),

        supabase
          .from("sale_items")
          .select(`
            id,
            sale_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          `)
          .order("id", { ascending: false }),
      ]);

      if (salesResult.error) {
        console.error("Sales report error:", salesResult.error);
        alert(`Could not load sales reports: ${salesResult.error.message}`);
        return;
      }

      if (itemsResult.error) {
        console.error("Sale items report error:", itemsResult.error);
        alert(`Could not load product reports: ${itemsResult.error.message}`);
        return;
      }

      setSales(salesResult.data || []);
      setSaleItems(itemsResult.data || []);
    } catch (error) {
      console.error("Reports error:", error);
      alert(`Could not load reports: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const filteredSales = useMemo(() => {
    if (filter === "all") {
      return sales;
    }

    const days = Number(filter);
    const fromDate = new Date();

    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - (days - 1));

    return sales.filter((sale) => {
      if (!sale.sale_date) {
        return false;
      }

      return new Date(sale.sale_date) >= fromDate;
    });
  }, [sales, filter]);

  const filteredSaleIds = useMemo(
    () => new Set(filteredSales.map((sale) => sale.id)),
    [filteredSales]
  );

  const filteredItems = useMemo(
    () =>
      saleItems.filter((item) =>
        filteredSaleIds.has(item.sale_id)
      ),
    [saleItems, filteredSaleIds]
  );

  const summary = useMemo(() => {
    return filteredSales.reduce(
      (result, sale) => {
        result.total += Number(sale.total || 0);
        result.paid += Number(sale.paid || 0);
        result.due += Number(sale.due || 0);
        result.orders += 1;
        return result;
      },
      {
        total: 0,
        paid: 0,
        due: 0,
        orders: 0,
      }
    );
  }, [filteredSales]);

  const paymentSummary = useMemo(() => {
    const result = {};

    filteredSales.forEach((sale) => {
      const method = sale.payment_method || "Unknown";

      if (!result[method]) {
        result[method] = {
          count: 0,
          paid: 0,
          due: 0,
        };
      }

      result[method].count += 1;
      result[method].paid += Number(sale.paid || 0);
      result[method].due += Number(sale.due || 0);
    });

    return Object.entries(result)
      .sort((a, b) => b[1].amount - a[1].amount);
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const result = {};

    filteredItems.forEach((item) => {
      const name = item.product_name || "Unknown Product";

      if (!result[name]) {
        result[name] = {
          quantity: 0,
          amount: 0,
        };
      }

      result[name].quantity += Number(item.quantity || 0);
      result[name].amount += Number(item.total || 0);
    });

    return Object.entries(result)
      .map(([name, data]) => ({
        name,
        ...data,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredItems]);

  const dailySales = useMemo(() => {
    const result = {};

    filteredSales.forEach((sale) => {
      if (!sale.sale_date) {
        return;
      }

      const date = new Date(sale.sale_date);
      const key = date.toISOString().slice(0, 10);

      if (!result[key]) {
        result[key] = 0;
      }

      result[key] += Number(sale.total || 0);
    });

    return Object.entries(result)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14);
  }, [filteredSales]);

  const maxDailySale = Math.max(
    ...dailySales.map(([, amount]) => amount),
    1
  );

  const recentSales = filteredSales.slice(0, 8);

  function formatMoney(value) {
    return `BDT ${Number(value || 0).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value) {
    if (!value) {
      return "N/A";
    }

    return new Date(value).toLocaleDateString("en-BD", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getFilterLabel() {
    if (filter === "1") return "Today";
    if (filter === "7") return "Last 7 Days";
    if (filter === "30") return "Last 30 Days";
    return "All Time";
  }

  return (
    <div className="reports-page">
      <div className="reports-toolbar">
        <div>
          <h2>Reports</h2>
          <p>{getFilterLabel()} business overview</p>
        </div>

        <div className="reports-actions">
          <div className="report-filter">
            <CalendarDays size={17} />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="1">Today</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <button
            className="refresh-report"
            onClick={loadReports}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="reports-loading">
          Loading reports...
        </div>
      ) : (
        <>
          <div className="report-stats">
            <div className="report-stat-card">
              <div className="report-stat-icon">
                <BarChart3 size={22} />
              </div>
              <div>
                <span>Total Sales</span>
                <strong>{formatMoney(summary.total)}</strong>
              </div>
            </div>

            <div className="report-stat-card">
              <div className="report-stat-icon">
                <ShoppingCart size={22} />
              </div>
              <div>
                <span>Total Orders</span>
                <strong>{summary.orders}</strong>
              </div>
            </div>

            <div className="report-stat-card">
              <div className="report-stat-icon">
                <Wallet size={22} />
              </div>
              <div>
                <span>Paid Amount</span>
                <strong>{formatMoney(summary.paid)}</strong>
              </div>
            </div>

            <div className="report-stat-card">
              <div className="report-stat-icon">
                <CreditCard size={22} />
              </div>
              <div>
                <span>Due Amount</span>
                <strong>{formatMoney(summary.due)}</strong>
              </div>
            </div>
          </div>

          <div className="reports-grid">
            <div className="report-card sales-chart-card">
              <div className="report-card-header">
                <div>
                  <h3>Sales Overview</h3>
                  <p>Daily sales for the selected period</p>
                </div>
              </div>

              {dailySales.length === 0 ? (
                <div className="report-empty">
                  No sales found for this period.
                </div>
              ) : (
                <div className="sales-chart">
                  {dailySales.map(([date, amount]) => (
                    <div className="chart-column" key={date}>
                      <div className="chart-value">
                        {amount >= 1000
                          ? `${(amount / 1000).toFixed(1)}k`
                          : amount.toFixed(0)}
                      </div>

                      <div className="chart-bar-area">
                        <div
                          className="chart-bar"
                          style={{
                            height: `${Math.max(
                              (amount / maxDailySale) * 100,
                              5
                            )}%`,
                          }}
                        />
                      </div>

                      <span>
                        {new Date(date).toLocaleDateString("en-BD", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-card">
              <div className="report-card-header">
                <div>
                  <h3>Payment Methods</h3>
                  <p>Paid amount by payment method</p>
                </div>
              </div>

              {paymentSummary.length === 0 ? (
                <div className="report-empty">
                  No payment data found.
                </div>
              ) : (
                <div className="payment-list">
                  {paymentSummary.map(([method, data]) => (
                    <div className="payment-row" key={method}>
                      <div>
                        <strong>{method}</strong>
                        <span>{data.count} order(s)</span>
                      </div>

                      <div>
                        <div>
                          <span>Collected</span>
                          <strong>{formatMoney(data.paid)}</strong>
                        </div>

                        <div>
                          <span>Due</span>
                          <strong>{formatMoney(data.due)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-card">
              <div className="report-card-header">
                <div>
                  <h3>Top Selling Products</h3>
                  <p>Products sold by quantity</p>
                </div>
              </div>

              {topProducts.length === 0 ? (
                <div className="report-empty">
                  No product sales found.
                </div>
              ) : (
                <div className="top-products">
                  {topProducts.map((product, index) => (
                    <div className="top-product-row" key={product.name}>
                      <div className="product-rank">
                        {index + 1}
                      </div>

                      <div className="top-product-info">
                        <strong>{product.name}</strong>
                        <span>
                          {product.quantity} unit(s) sold
                        </span>
                      </div>

                      <strong>
                        {formatMoney(product.amount)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-card recent-sales-card">
              <div className="report-card-header">
                <div>
                  <h3>Recent Sales</h3>
                  <p>Latest transactions</p>
                </div>
              </div>

              {recentSales.length === 0 ? (
                <div className="report-empty">
                  No sales found.
                </div>
              ) : (
                <div className="recent-sales-table-wrap">
                  <table className="recent-sales-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Payment</th>
                        <th>Total</th>
                        <th>Due</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale.id}>
                          <td>
                            <strong>{sale.invoice_no}</strong>
                          </td>
                          <td>{formatDate(sale.sale_date)}</td>
                          <td>
                            {sale.payment_method || "N/A"}
                          </td>
                          <td>{formatMoney(sale.total)}</td>
                          <td>
                            <span
                              className={
                                Number(sale.due || 0) > 0
                                  ? "due-badge"
                                  : "paid-badge"
                              }
                            >
                              {Number(sale.due || 0) > 0
                                ? formatMoney(sale.due)
                                : "Paid"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;


