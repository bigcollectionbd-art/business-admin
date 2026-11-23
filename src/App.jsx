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
import Customers from "./Customers";
import SettingsPage from "./Settings";
import Reports from "./Reports";
import "./App.css";
import "./MobileResponsive.css";

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) {
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.warn("Profile lookup failed:", error.message);
        setUserRole(null);
        return;
      }

      if (!profile) {
        setUserRole(null);
        return;
      }

      if (profile.active === false) {
        await supabase.auth.signOut();
        setSession(null);
        setUserRole(null);
        return;
      }

      setUserRole(profile.role || null);
    }

    loadProfile();
  }, [session]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function handlePageChange(nextPage) {
    setPage(nextPage);
    if (window.matchMedia("(max-width: 700px)").matches) {
      setMenuOpen(false);
    }
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

  const pageTitle =
    page === "dashboard"
      ? "Dashboard"
      : page === "sales"
      ? "Sales"
      : page === "invoice"
      ? "Invoice"
      : page === "products"
      ? "Products"
      : page === "customers"
      ? "Customers"
      : "";

  const pageSubtitle =
    page === "dashboard"
      ? "Welcome to your business admin panel"
      : page === "sales"
      ? "Create a new sale"
      : page === "invoice"
      ? "View and print invoice"
      : page === "products"
      ? "Manage product stock and inventory"
      : page === "customers"
      ? "Manage your customers"
      : "";

  return (
    <div className="admin-app">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="logo">
          <div className="logo-icon">B</div>

          <div>
            <strong>Big Collection BD</strong>
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
            onClick={() => handlePageChange("dashboard")}
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
            onClick={() => handlePageChange("sales")}
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
            onClick={() => handlePageChange("invoice")}
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
            onClick={() => handlePageChange("products")}
          >
            <Package size={20} />
            Products
          </button>

          <button
            className={
              page === "customers"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => handlePageChange("customers")}
          >
            <Users size={20} />
            Customers
          </button>

          <button className="nav-item">
            <Wallet size={20} />
            Expenses
          </button>

          <button
            className={
              page === "reports"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => handlePageChange("reports")}
            type="button"
          >
            <BarChart3 size={20} />
            Reports
          </button>

          {userRole === "owner" && (
            <button
              className={
                page === "settings"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => handlePageChange("settings")}
            >
              <Settings size={20} />
              Settings
            </button>
          )}
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

      {menuOpen && (
        <button
          className="mobile-menu-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation menu"
          type="button"
        />
      )}

      <button
        className="menu-button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
        type="button"
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <main className="main-content">
        {page === "dashboard" && <Dashboard />}
        {page === "sales" && <Sales />}
        {page === "invoice" && <Invoice />}
        {page === "products" && <Products />}
        {page === "customers" && <Customers />}
        {page === "settings" && userRole === "owner" && <SettingsPage />}
        {page === "reports" && <Reports />}
      </main>
    </div>
  );
}

export default App;







