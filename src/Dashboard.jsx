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
import "./DashboardBrandTheme.css";
import PathaoLivePanel from "./PathaoLivePanel";

const MOBILE_BUSINESS_QUOTES = [
  "সফল ব্যবসা একদিনে তৈরি হয় না, প্রতিদিনের সঠিক সিদ্ধান্তে তৈরি হয়।",
  "গ্রাহকের বিশ্বাসই একটি ব্যবসার সবচেয়ে বড় সম্পদ।",
  "লাভের আগে মানুষের আস্থা অর্জন করুন, সাফল্য তার পথ খুঁজে নেবে।",
  "ছোট ছোট উন্নতিই একদিন বড় সাফল্য এনে দেয়।",
  "সততা দিয়ে শুরু হওয়া ব্যবসার ভিত্তি হয় সবচেয়ে মজবুত।",
  "গ্রাহকের কথা মন দিয়ে শুনুন, সেখানেই উন্নতির সুযোগ লুকিয়ে থাকে।",
  "প্রতিটি অর্ডার শুধু বিক্রি নয়, বিশ্বাস গড়ার একটি সুযোগ।",
  "সময়মতো সঠিক সিদ্ধান্ত ব্যবসাকে এগিয়ে নিয়ে যায়।",
  "ভালো পণ্য গ্রাহক আনে, ভালো সেবা গ্রাহক ধরে রাখে।",
  "ব্যবসায় ধৈর্য রাখুন, ধারাবাহিক পরিশ্রম কখনো বৃথা যায় না।",
  "প্রতিশ্রুতি রক্ষা করাই দীর্ঘমেয়াদি সম্পর্কের মূল ভিত্তি।",
  "ভুল থেকে শিক্ষা নিন, থেমে না থেকে সামনে এগিয়ে যান।",
  "গ্রাহকের সন্তুষ্টিই সফল ব্যবসার আসল পরিচয়।",
  "প্রতিদিন একটু ভালো সেবা দেওয়ার চেষ্টা করুন।",
  "সঠিক হিসাব ও পরিকল্পনা ব্যবসাকে নিরাপদ রাখে।",
  "বিশ্বাস তৈরি করতে সময় লাগে, হারাতে লাগে মাত্র এক মুহূর্ত।",
  "ব্যবসায় বড় হওয়ার আগে মানসিকতায় বড় হতে হয়।",
  "সমস্যাকে বাধা নয়, উন্নতির নতুন সুযোগ হিসেবে দেখুন।",
  "কথার চেয়ে কাজে প্রমাণ দিন, গ্রাহক সেটিই মনে রাখবে।",
  "সফল উদ্যোক্তা প্রতিদিন শেখেন এবং নিজেকে উন্নত করেন।",
  "গ্রাহকের সময়ের মূল্য দিন, নিজের ব্যবসার মূল্য বাড়বে।",
  "ন্যায্য মূল্য ও ভালো ব্যবহার—দুটিই গ্রাহকের মনে থাকে।",
  "আজকের যত্নশীল সেবাই আগামী দিনের সুপারিশ তৈরি করে।",
  "পরিকল্পনা আপনাকে দিক দেখায়, পরিশ্রম আপনাকে লক্ষ্যে পৌঁছায়।",
  "ব্যবসার প্রতিটি দিন নতুন কিছু শেখার সুযোগ।",
  "বিশ্বাসযোগ্যতা এমন সম্পদ, যা বিজ্ঞাপনের চেয়েও শক্তিশালী।",
  "বিক্রয় বাড়ানোর আগে গ্রাহকের প্রয়োজন বুঝতে শিখুন।",
  "ধারাবাহিকতা প্রতিভার চেয়েও অনেক সময় বেশি কার্যকর।",
  "সৎ পথে ধীরে এগোনো, ভুল পথে দ্রুত যাওয়ার চেয়ে ভালো।",
  "গ্রাহকের অভিযোগকে উন্নতির পরামর্শ হিসেবে গ্রহণ করুন।",
  "একটি ভালো অভিজ্ঞতা একজন গ্রাহককে বারবার ফিরিয়ে আনে।",
  "ব্যবসায় প্রতিযোগিতার চেয়ে নিজের মান উন্নত করায় মন দিন।",
  "সঠিক পণ্য, সঠিক তথ্য ও আন্তরিক সেবা—সাফল্যের তিন ভিত্তি।",
  "প্রতিদিনের ছোট শৃঙ্খলাই বড় ব্যবসায়িক অভ্যাস গড়ে তোলে।",
  "কাস্টমারকে সম্মান দিন, সম্পর্ক নিজেই শক্তিশালী হবে।",
  "সুযোগের অপেক্ষা নয়, প্রস্তুতির মাধ্যমে সুযোগ তৈরি করুন।",
  "অর্থ উপার্জন লক্ষ্য হতে পারে, কিন্তু আস্থা অর্জন পরিচয়।",
  "যে ব্যবসা গ্রাহকের সুবিধাকে গুরুত্ব দেয়, সে ব্যবসা এগিয়ে যায়।",
  "নিজের কাজের মান বাড়ান, সাফল্য ধীরে ধীরে দৃশ্যমান হবে।",
  "কঠিন সময়ে ধৈর্য ও স্বচ্ছতাই ব্যবসার শক্তি।",
  "প্রতিটি পণ্যের সঙ্গে নিজের প্রতিষ্ঠানের সুনামও পৌঁছে যায়।",
  "অতিরিক্ত প্রতিশ্রুতি নয়, দেওয়া প্রতিশ্রুতির সঠিক বাস্তবায়ন জরুরি।",
  "শেখা বন্ধ হলে উন্নতিও থেমে যায়।",
  "গ্রাহকের আস্থা অর্জন করুন, তারা আপনার ব্যবসার পরিচয় ছড়িয়ে দেবেন।",
  "সঠিক সিদ্ধান্তের জন্য তথ্য জানুন, আবেগের বশে ব্যবসা চালাবেন না।",
  "ব্যবসায় সাফল্য আসে লক্ষ্য, সততা ও নিয়মিত প্রচেষ্টার সমন্বয়ে।",
  "আজকের পরিশ্রমই আগামী দিনের স্থিতিশীলতার ভিত্তি।",
  "প্রতিটি গ্রাহক গুরুত্বপূর্ণ—ছোট অর্ডার বলে কাউকে ছোট ভাববেন না।",
  "মান বজায় রেখে ব্যবসা বাড়ান, তবেই সুনাম টিকে থাকবে।",
  "নিজের অগ্রগতি মাপুন গতকালের নিজের সঙ্গে, অন্যের সঙ্গে নয়।"
];

const MOBILE_QUOTE_STORAGE_KEY = "bcb_mobile_business_quote_v1";
const MOBILE_QUOTE_INTERVAL = 24 * 60 * 60 * 1000;

function getMobileBusinessQuote() {
  const now = Date.now();

  try {
    const saved = JSON.parse(localStorage.getItem(MOBILE_QUOTE_STORAGE_KEY) || "null");
    if (
      saved &&
      Number.isInteger(saved.index) &&
      saved.index >= 0 &&
      saved.index < MOBILE_BUSINESS_QUOTES.length &&
      Number.isFinite(saved.shownAt) &&
      now - saved.shownAt < MOBILE_QUOTE_INTERVAL &&
      now >= saved.shownAt
    ) {
      return MOBILE_BUSINESS_QUOTES[saved.index];
    }

    const nextIndex = saved && Number.isInteger(saved.index)
      ? (saved.index + 1) % MOBILE_BUSINESS_QUOTES.length
      : 0;

    localStorage.setItem(
      MOBILE_QUOTE_STORAGE_KEY,
      JSON.stringify({ index: nextIndex, shownAt: now })
    );

    return MOBILE_BUSINESS_QUOTES[nextIndex];
  } catch (error) {
    return MOBILE_BUSINESS_QUOTES[
      Math.floor(now / MOBILE_QUOTE_INTERVAL) % MOBILE_BUSINESS_QUOTES.length
    ];
  }
}

function Dashboard() {
  const [mobileBusinessQuote] = useState(() => getMobileBusinessQuote());
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
    "#f47b20",
    "#17324d",
    "#f9a45d",
    "#d97706",
    "#c65b42",
    "#8b9aaa",
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

      <div className="dashboard-mobile-brand-note">
        <div className="dashboard-mobile-brand-name">Big Collection BD</div>
        <p>“{mobileBusinessQuote}”</p>
      </div>

      <PathaoLivePanel />

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
                      stopColor="#f47b20"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="#f47b20"
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
                  stroke="#f47b20"
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

