import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShoppingCart,
  CreditCard,
  CalendarDays,
} from "lucide-react";

import { supabase } from "./supabase";

function Dashboard() {
  const [todaySales, setTodaySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
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

      const { data: todayData, error: todayError } = await supabase
        .from("sales")
        .select("id, invoice_no, sale_date, total, due")
        .gte("sale_date", startOfToday.toISOString())
        .lt("sale_date", startOfTomorrow.toISOString())
        .order("sale_date", { ascending: false });

      if (todayError) {
        console.error("Today's sales error:", todayError);
        setTodaySales([]);
      } else {
        setTodaySales(todayData || []);
      }

      const { data: monthData, error: monthError } = await supabase
        .from("sales")
        .select("id, invoice_no, sale_date, total, due")
        .gte("sale_date", startOfMonth.toISOString())
        .lt("sale_date", startOfNextMonth.toISOString())
        .order("sale_date", { ascending: false });

      if (monthError) {
        console.error("Monthly sales error:", monthError);
        setMonthlySales([]);
      } else {
        setMonthlySales(monthData || []);
      }

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

  return (
    <section className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon sales-icon">
          <TrendingUp size={22} />
        </div>
        <div>
          <span>Today's Sales</span>
          <strong>
            BDT {loading ? "0.00" : todaysSales.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon order-icon">
          <ShoppingCart size={22} />
        </div>
        <div>
          <span>Today's Orders</span>
          <strong>{loading ? 0 : todaysOrders}</strong>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon due-icon">
          <CreditCard size={22} />
        </div>
        <div>
          <span>Today's Due</span>
          <strong>
            BDT {loading ? "0.00" : todaysDue.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon sales-icon">
          <CalendarDays size={22} />
        </div>
        <div>
          <span>Monthly Sales</span>
          <strong>
            BDT {loading ? "0.00" : monthlyTotalSales.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon order-icon">
          <ShoppingCart size={22} />
        </div>
        <div>
          <span>Monthly Orders</span>
          <strong>{loading ? 0 : monthlyOrders}</strong>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon due-icon">
          <CreditCard size={22} />
        </div>
        <div>
          <span>Monthly Due</span>
          <strong>
            BDT {loading ? "0.00" : monthlyDue.toFixed(2)}
          </strong>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;
