import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Users,
  Wallet,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";

import { supabase } from "./supabase";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Sales from "./Sales";
import Invoice from "./Invoice";
import Products from "./Products";
import "./App.css";

function App() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);
      setCheckingAuth(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <div className="admin-app">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="logo">
          <div className="logo-icon">B</div>
          <div>
            <strong>Business Admin</strong>
            <span>Management System</span>
          </div>
        </div>

        <nav>
          <button
            className={
              page === "dashboard"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setPage("dashboard")}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>

          <button
            className={
              page === "sales"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setPage("sales")}
          >
            <ShoppingCart size={20} />
            Sales
          </button>

          <button
            className={
              page === "invoice"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setPage("invoice")}
          >
            <FileText size={20} />
            Invoices
          </button>

          <button
            className={
              page === "products"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setPage("products")}
          >
            <Package size={20} />
            Products
          </button>

          <button className="nav-item">
            <Users size={20} />
            Customers
          </button>

          <button className="nav-item">
            <Wallet size={20} />
            Expenses
          </button>

          <button className="nav-item">
            <BarChart3 size={20} />
            Reports
          </button>

          <button className="nav-item">
            <Settings size={20} />
            Settings
          </button>
        </nav>

        <button
          className="nav-item"
          onClick={handleLogout}
          style={{
            marginTop: "auto",
          }}
        >
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X size={22} />
            ) : (
              <Menu size={22} />
            )}
          </button>

          <div>
            <h1>
              {page === "dashboard"
                ? "Dashboard"
                : page === "sales"
                ? "Sales"
                : page === "invoice"
                ? "Invoice"
                : page === "products"
                ? "Products"
                : "Dashboard"}
            </h1>

            <p>
              {page === "dashboard"
                ? "Welcome to your business admin panel"
                : page === "sales"
                ? "Create a new sale"
                : page === "invoice"
                ? "View and print invoice"
                : page === "products"
                ? "Manage product stock and inventory"
                : ""}
            </p>
          </div>
        </header>

        {page === "dashboard" && <Dashboard />}
        {page === "sales" && <Sales />}
        {page === "invoice" && <Invoice />}
        {page === "products" && <Products />}
      </main>
    </div>
  );
}

export default App;
