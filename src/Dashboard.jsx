import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShoppingCart,
  CreditCard,
  CalendarDays,
  BarChart3,
  WalletCards,
  FileText,
  Package,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { supabase } from "./supabase";

function Dashboard() {
  const [todaySales, setTodaySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);

      const now = new Date();

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );

      const startOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        0,
        0
      );

      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [
        todayResult,
        monthResult,
        recentResult,
        stockResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id, invoice_no, sale_date, total, due")
          .gte("sale_date", startOfToday.toISOString())
          .lt("sale_date", startOfTomorrow.toISOString())
          .order("sale_date", { ascending: false }),

        supabase
          .from("sales")
          .select(
            "id, invoice_no, sale_date, total, due, paid, payment_method, status, customer_id"
          )
          .gte("sale_date", startOfMonth.toISOString())
          .lt("sale_date", startOfNextMonth.toISOString())
          .order("sale_date", { ascending: false }),

        supabase
          .from("sales")
          .select(
            "id, invoice_no, sale_date, total, due, paid, payment_method, status, customer_id"
          )
          .order("sale_date", { ascending: false })
          .limit(5),

        supabase
          .from("products")
          .select("id, name, sku, stock_qty, selling_price, image_url")
          .lte("stock_qty", 5)
          .order("stock_qty", { ascending: true })
          .limit(5),
      ]);

      if (todayResult.error) {
        console.error("Today's sales error:", todayResult.error);
        setTodaySales([]);
      } else {
        setTodaySales(todayResult.data || []);
      }

      if (monthResult.error) {
        console.error("Monthly sales error:", monthResult.error);
        setMonthlySales([]);
      } else {
        setMonthlySales(monthResult.data || []);
      }

      if (stockResult.error) {
        console.error("Low stock error:", stockResult.error);
        setLowStockProducts([]);
      } else {
        setLowStockProducts(stockResult.data || []);
      }

      let recentData = recentResult.data || [];

      if (recentResult.error) {
        console.error("Recent sales error:", recentResult.error);
        recentData = [];
      }

      const customerIds = [
        ...new Set(
          recentData
            .map((sale) => sale.customer_id)
            .filter(Boolean)
        ),
      ];

      let customerMap = {};

      if (customerIds.length > 0) {
        const { data: customers, error: customersError } =
          await supabase
            .from("customers")
            .select("id, name")
            .in("id", customerIds);

        if (customersError) {
          console.error(
            "Customer lookup error:",
            customersError
          );
        } else {
          customerMap = Object.fromEntries(
            (customers || []).map((customer) => [
              customer.id,
              customer.name,
            ])
          );
        }
      }

      setRecentSales(
        recentData.map((sale) => ({
          ...sale,
          customerName:
            customerMap[sale.customer_id] ||
            "Walk-in Customer",
        }))
      );

      setLoading(false);
    }

    loadDashboardData();
  }, []);

  const todaysSales = todaySales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const todaysOrders = todaySales.length;

  const todaysDue = todaySales.reduce(
    (sum, sale) => sum + Number(sale.due || 0),
    0
  );

  const monthlyTotalSales = monthlySales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const monthlyOrders = monthlySales.length;

  const monthlyDue = monthlySales.reduce(
    (sum, sale) => sum + Number(sale.due || 0),
    0
  );

  const salesOverview = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const total = monthlySales
      .filter((sale) => {
        const saleDate = new Date(sale.sale_date);

        return (
          saleDate >= date &&
          saleDate < nextDate
        );
      })
      .reduce(
        (sum, sale) => sum + Number(sale.total || 0),
        0
      );

    salesOverview.push({
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      sales: total,
    });
  }

  const paymentTotals = {};

  monthlySales.forEach((sale) => {
    const method = sale.payment_method || "Cash";

    paymentTotals[method] =
      (paymentTotals[method] || 0) +
      Number(sale.total || 0);
  });

  const paymentData = Object.entries(paymentTotals)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const paymentColors = [
    "#2563eb",
    "#10b981",
    "#8b5cf6",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];

  function formatMoney(value) {
    return `BDT ${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function paymentLabel(value) {
    if (!value) return "Cash";

    return value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  return (
    <section className="dashboard-modern">

      <div className="stats-grid">
        <div className="stat-card modern-stat">
          <div className="stat-top">
            <span>Today's Sales</span>
            <div className="stat-icon sales-icon">
              <TrendingUp size={18} />
            </div>
          </div>

          <strong>
            {loading ? "BDT 0.00" : formatMoney(todaysSales)}
          </strong>

          <small>Sales generated today</small>
        </div>

        <div className="stat-card modern-stat">
          <div className="stat-top">
            <span>Today's Orders</span>
            <div className="stat-icon order-icon">
              <ShoppingCart size={18} />
            </div>
          </div>

          <strong>{loading ? 0 : todaysOrders}</strong>

          <small>Orders received today</small>
        </div>

        <div className="stat-card modern-stat">
          <div className="stat-top">
            <span>Today's Due</span>
            <div className="stat-icon due-icon">
              <CreditCard size={18} />
            </div>
          </div>

          <strong>
            {loading ? "BDT 0.00" : formatMoney(todaysDue)}
          </strong>

          <small>Outstanding today</small>
        </div>

        <div className="stat-card modern-stat">
          <div className="stat-top">
            <span>Monthly Sales</span>
            <div className="stat-icon product-icon">
              <CalendarDays size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? "BDT 0.00"
              : formatMoney(monthlyTotalSales)}
          </strong>

          <small>Current month sales</small>
        </div>
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-chart-card">
          <div className="chart-header">
            <div className="chart-title-row">
              <div className="dashboard-section-icon">
                <BarChart3 size={18} />
              </div>

              <div>
                <h2>Sales Overview</h2>
                <p>Last 7 days sales summary</p>
              </div>
            </div>

            <div className="chart-total">
              {formatMoney(monthlyTotalSales)}
            </div>
          </div>

          <div className="sales-chart">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesOverview}>
                <defs>
                  <linearGradient
                    id="dashboardSalesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#2563eb"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="#2563eb"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#edf1f7"
                />

                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#7b8798",
                    fontSize: 11,
                  }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#7b8798",
                    fontSize: 11,
                  }}
                />

                <Tooltip
                  formatter={(value) => [
                    formatMoney(value),
                    "Sales",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#dashboardSalesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-chart-card payment-card">
          <div className="chart-header">
            <div className="chart-title-row">
              <div className="dashboard-section-icon">
                <WalletCards size={18} />
              </div>

              <div>
                <h2>Sales by Payment Method</h2>
                <p>Current month payment breakdown</p>
              </div>
            </div>
          </div>

          {paymentData.length > 0 ? (
            <div className="payment-chart">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {paymentData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={
                          paymentColors[
                            index % paymentColors.length
                          ]
                        }
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => [
                      formatMoney(value),
                      "Sales",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="payment-list">
                {paymentData.map((item, index) => {
                  const percentage =
                    monthlyTotalSales > 0
                      ? (item.value / monthlyTotalSales) *
                        100
                      : 0;

                  return (
                    <div
                      className="payment-row"
                      key={item.name}
                    >
                      <div className="payment-name">
                        <span
                          className="payment-dot"
                          style={{
                            background:
                              paymentColors[
                                index %
                                  paymentColors.length
                              ],
                          }}
                        />
                        <span>
                          {paymentLabel(item.name)}
                        </span>
                      </div>

                      <div className="payment-value">
                        <strong>
                          {percentage.toFixed(1)}%
                        </strong>
                        <small>
                          {formatMoney(item.value)}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="dashboard-empty">
              No payment data available.
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-bottom-grid">
        <div className="dashboard-table-card">
          <div className="table-card-header">
            <div className="chart-title-row">
              <div className="dashboard-section-icon">
                <FileText size={18} />
              </div>

              <div>
                <h2>Recent Sales</h2>
                <p>Latest transactions</p>
              </div>
            </div>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentSales.length > 0 ? (
                  recentSales.map((sale, index) => (
                    <tr key={sale.id}>
                      <td>{index + 1}</td>

                      <td>
                        <strong>
                          {sale.customerName}
                        </strong>
                      </td>

                      <td>
                        {formatDate(sale.sale_date)}
                      </td>

                      <td>
                        {formatMoney(sale.total)}
                      </td>

                      <td>
                        {paymentLabel(
                          sale.payment_method
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            sale.status === "completed"
                              ? "status-badge paid"
                              : "status-badge"
                          }
                        >
                          {sale.status || "Completed"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="dashboard-no-data"
                    >
                      No sales found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-table-card">
          <div className="table-card-header">
            <div className="chart-title-row">
              <div className="dashboard-section-icon">
                <Package size={18} />
              </div>

              <div>
                <h2>Low Stock Products</h2>
                <p>Products with 5 or fewer stock</p>
              </div>
            </div>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table stock-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Stock Qty</th>
                </tr>
              </thead>

              <tbody>
                {lowStockProducts.length > 0 ? (
                  lowStockProducts.map((product, index) => (
                    <tr key={product.id}>
                      <td>{index + 1}</td>

                      <td>
                        <div className="stock-product">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                            />
                          ) : (
                            <div className="stock-placeholder">
                              <Package size={15} />
                            </div>
                          )}

                          <strong>{product.name}</strong>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            Number(product.stock_qty) <= 2
                              ? "stock-badge danger"
                              : "stock-badge warning"
                          }
                        >
                          {Number(product.stock_qty || 0)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      className="dashboard-no-data"
                    >
                      No low stock products.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;

