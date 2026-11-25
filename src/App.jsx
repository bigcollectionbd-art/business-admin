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
import MobileAppLock from "./MobileAppLock";
import Dashboard from "./Dashboard";
import Sales from "./Sales";
import Invoice from "./Invoice";
import Products from "./Products";
import Customers from "./Customers";
import SettingsPage from "./Settings";
import Reports from "./Reports";
import Expenses from "./Expenses";
import "./App.css";
import "./SiteBrandTheme.css";
import "./Invoice.css";
import "./MobileResponsive.css";

function InvoicePrintView() {
  let invoiceMarkup = "";

  try {
    invoiceMarkup = decodeURIComponent(window.location.hash.slice(1));
  } catch (error) {
    console.error("Could not read invoice print data:", error);
  }

  if (!invoiceMarkup) {
    return <div className="invoice-page">Invoice data could not be opened. Please return to the app and try again.</div>;
  }

  return (
    <div className="invoice-page ios-safari-print-page">
      <div className="invoice-actions no-print">
        <button className="print-button" onClick={() => window.print()}>
          Print Invoice
        </button>
      </div>
      <div
        className="invoice-paper ios-safari-print"
        dangerouslySetInnerHTML={{ __html: invoiceMarkup }}
      />
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [splashReady, setSplashReady] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setSplashReady(true), 2500);
    return () => window.clearTimeout(splashTimer);
  }, []);

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

  const isInvoicePrintView =
    new URLSearchParams(window.location.search).get("invoicePrint") === "1";

  if (isInvoicePrintView) {
    return <InvoicePrintView />;
  }

  if (checkingAuth || !splashReady) {
    return (
      <div className="startup-splash" role="status" aria-label="Big Collection BD loading">
        <div className="startup-splash-content">
          <div className="startup-bismillah" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
          <div className="startup-bismillah-meaning" lang="bn">পরম করুণাময়, অসীম দয়ালু আল্লাহর নামে।</div>
          <img className="startup-logo" src="/app-icon.svg" alt="Big Collection BD" />
          <div className="startup-brand">Big Collection BD</div>
          <div className="startup-caption">Management System</div>
          <div className="startup-loader" aria-hidden="true"><span /></div>
        </div>
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
      : page === "expenses"
      ? "Expenses"
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
      : page === "expenses"
      ? "Record and review business expenses"
      : "";

  return (
    <MobileAppLock>
    <div className="admin-app">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="logo">
          <img className="logo-icon" src="/app-icon.svg" alt="Big Collection BD logo" />

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
            type="button"
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
            type="button"
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
            type="button"
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
            type="button"
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
            type="button"
          >
            <Users size={20} />
            Customers
          </button>

          {["owner", "admin", "staff"].includes(userRole) && (
            <button
              className={page === "expenses" ? "nav-item active" : "nav-item"}
              onClick={() => handlePageChange("expenses")}
              type="button"
            >
              <Wallet size={20} />
              Expenses
            </button>
          )}

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
              type="button"
            >
              <Settings size={20} />
              Settings
            </button>
          )}
        </nav>

        <button
          className="nav-item"
          onClick={handleLogout}
          type="button"
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

      <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
        <button className={page === "dashboard" ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"} onClick={() => handlePageChange("dashboard")} type="button" aria-current={page === "dashboard" ? "page" : undefined}>
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>
        <button className={page === "sales" ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"} onClick={() => handlePageChange("sales")} type="button" aria-current={page === "sales" ? "page" : undefined}>
          <ShoppingCart size={20} />
          <span>Sales</span>
        </button>
        <button className={page === "invoice" ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"} onClick={() => handlePageChange("invoice")} type="button" aria-current={page === "invoice" ? "page" : undefined}>
          <FileText size={20} />
          <span>Invoices</span>
        </button>
        <button className={page === "products" ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"} onClick={() => handlePageChange("products")} type="button" aria-current={page === "products" ? "page" : undefined}>
          <Package size={20} />
          <span>Products</span>
        </button>
        <button className={page === "reports" ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"} onClick={() => handlePageChange("reports")} type="button" aria-current={page === "reports" ? "page" : undefined}>
          <BarChart3 size={20} />
          <span>Reports</span>
        </button>
      </nav>

      <main className="main-content">
        {page === "dashboard" && <Dashboard />}
        {page === "sales" && <Sales />}
        {page === "invoice" && <Invoice />}
        {page === "products" && <Products />}
        {page === "customers" && <Customers />}
        {page === "expenses" && ["owner", "admin", "staff"].includes(userRole) && <Expenses />}
        {page === "settings" && userRole === "owner" && <SettingsPage />}
        {page === "reports" && <Reports />}
      </main>
    </div>
    </MobileAppLock>
  );
}

export default App;







