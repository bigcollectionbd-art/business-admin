import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Package,
  AlertTriangle,
} from "lucide-react";

import { supabase } from "./supabase";

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoadingSales(true);

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(
            "id, name, sku, selling_price, stock_qty, image_url"
          )
          .limit(100);

      if (productError) {
        console.error("Products error:", productError);
      } else {
        setProducts(productData || []);
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { data: salesData, error: salesError } =
        await supabase
          .from("sales")
          .select(
            "id, invoice_no, sale_date, total, due"
          )
          .gte(
            "sale_date",
            startOfToday.toISOString()
          )
          .order("sale_date", {
            ascending: false,
          });

      if (salesError) {
        console.error("Sales error:", salesError);
        setSales([]);
      } else {
        setSales(salesData || []);
      }

      setLoadingSales(false);
    }

    loadDashboardData();
  }, []);

  const lowStockProducts = products.filter(
    (product) => Number(product.stock_qty || 0) <= 5
  );

  const todaysSales = sales.reduce(
    (sum, sale) =>
      sum + Number(sale.total || 0),
    0
  );

  const todaysOrders = sales.length;

  const totalDue = sales.reduce(
    (sum, sale) =>
      sum + Number(sale.due || 0),
    0
  );

  return (
    <>

      <section className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon sales-icon">
            <TrendingUp size={22} />
          </div>

          <div>
            <span>Today's Sales</span>
            <strong>
              BDT {loadingSales ? "0.00" : todaysSales.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon order-icon">
            <ShoppingCart size={22} />
          </div>

          <div>
            <span>Today's Orders</span>
            <strong>
              {loadingSales ? 0 : todaysOrders}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon due-icon">
            <CreditCard size={22} />
          </div>

          <div>
            <span>Total Due</span>
            <strong>
              BDT {loadingSales ? "0.00" : totalDue.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon product-icon">
            <Package size={22} />
          </div>

          <div>
            <span>Total Products</span>
            <strong>{products.length}</strong>
          </div>
        </div>

      </section>

      <section className="dashboard-grid">

        <div className="panel">

          <div className="panel-header">
            <div>
              <h2>Products</h2>
              <p>WooCommerce synced products</p>
            </div>

            <span className="count-badge">
              {products.length}
            </span>
          </div>

          <div className="product-list">

            {products.length === 0 ? (
              <div className="empty-state">
                <Package size={35} />
                <p>Loading products...</p>
              </div>
            ) : (
              products.slice(0, 8).map((product) => (
                <div
                  className="product-row"
                  key={product.id}
                >

                  <div className="product-image">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                      />
                    ) : (
                      <Package size={24} />
                    )}
                  </div>

                  <div className="product-info">
                    <strong>{product.name}</strong>

                    <span>
                      SKU: {product.sku || "N/A"}
                    </span>
                  </div>

                  <div className="product-price">
                    BDT{" "}
                    {Number(
                      product.selling_price || 0
                    ).toFixed(2)}
                  </div>

                  <div className="product-stock">
                    Stock: {product.stock_qty || 0}
                  </div>

                </div>
              ))
            )}

          </div>
        </div>

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>Low Stock</h2>
              <p>Products that need attention</p>
            </div>

            <AlertTriangle size={22} />

          </div>

          {lowStockProducts.length === 0 ? (
            <div className="empty-state">
              <Package size={35} />
              <p>No low stock products</p>
            </div>
          ) : (
            <div className="low-stock-list">

              {lowStockProducts
                .slice(0, 6)
                .map((product) => (
                  <div
                    className="low-stock-item"
                    key={product.id}
                  >
                    <strong>
                      {product.name}
                    </strong>

                    <span>
                      Stock: {product.stock_qty || 0}
                    </span>
                  </div>
                ))}

            </div>
          )}

        </div>

      </section>

    </>
  );
}

export default Dashboard;
