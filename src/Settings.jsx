import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  UserCheck,
  UserX,
  UserPlus,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Settings.css";

const BACKUP_TABLES = [
  "customers",
  "sales",
  "sale_items",
  "invoices",
  "invoice_items",
  "payments",
  "expenses",
];

function Settings() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");

  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profileUpdating, setProfileUpdating] = useState(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminCreating, setAdminCreating] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminError, setAdminError] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setProfilesLoading(true);
    setProfileError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, active, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Profile loading failed:", error);
      setProfileError(error.message || "Could not load users.");
      setProfiles([]);
    } else {
      setProfiles(data || []);
    }

    setProfilesLoading(false);
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();

    setAdminMessage("");
    setAdminError("");

    const name = adminName.trim();
    const email = adminEmail.trim().toLowerCase();
    const password = adminPassword;

    if (!name || !email || !password) {
      setAdminError("Name, email and password are required.");
      return;
    }

    if (password.length < 6) {
      setAdminError("Password must be at least 6 characters.");
      return;
    }

    const confirmed = window.confirm(
      `Create admin account for ${name} (${email})?`
    );

    if (!confirmed) return;

    setAdminCreating(true);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error(
          "Your login session has expired. Please login again."
        );
      }

      const functionUrl =
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const responseText = await response.text();

      let responseBody = {};

      try {
        responseBody = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        responseBody = {
          error: responseText || "Unknown server response.",
        };
      }

      if (!response.ok) {
        throw new Error(
          responseBody?.error ||
            `Create admin failed with status ${response.status}.`
        );
      }

      if (responseBody?.error) {
        throw new Error(responseBody.error);
      }

      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");

      setAdminMessage(
        `Admin account created successfully for ${name}.`
      );

      await loadProfiles();
    } catch (error) {
      console.error("Create admin failed:", error);
      setAdminError(
        error.message || "Could not create admin."
      );
    } finally {
      setAdminCreating(false);
    }
  }
  async function toggleProfileActive(profile) {
    if (profile.role === "owner") return;

    const nextActive = !profile.active;

    const confirmed = window.confirm(
      `${nextActive ? "Activate" : "Deactivate"} ${profile.name}?`
    );

    if (!confirmed) return;

    setProfileUpdating(profile.id);
    setProfileMessage("");
    setProfileError("");

    const { error } = await supabase
      .from("profiles")
      .update({ active: nextActive })
      .eq("id", profile.id);

    if (error) {
      console.error("Profile update failed:", error);
      setProfileError(error.message || "Could not update user.");
    } else {
      setProfiles((current) =>
        current.map((item) =>
          item.id === profile.id
            ? { ...item, active: nextActive }
            : item
        )
      );

      setProfileMessage(
        `${profile.name} is now ${
          nextActive ? "active" : "inactive"
        }.`
      );
    }

    setProfileUpdating(null);
  }

  async function handleBackup() {
    setBackupLoading(true);
    setBackupMessage("");
    setBackupError("");

    try {
      const backup = {
        app: "Big Collection BD",
        type: "business-data-backup",
        version: 1,
        created_at: new Date().toISOString(),
        tables: {},
      };

      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase
          .from(table)
          .select("*");

        if (error) {
          throw new Error(`${table}: ${error.message}`);
        }

        backup.tables[table] = data || [];
      }

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `big-collection-bd-backup-${date}.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setBackupMessage("Backup downloaded successfully.");
    } catch (error) {
      console.error("Backup failed:", error);
      setBackupError(error.message || "Backup failed.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setRestoreLoading(true);
    setBackupMessage("");
    setBackupError("");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (
        !backup ||
        backup.type !== "business-data-backup" ||
        !backup.tables
      ) {
        throw new Error("Invalid Big Collection BD backup file.");
      }

      const confirmed = window.confirm(
        "Restore this backup? Existing records with the same ID will be updated."
      );

      if (!confirmed) return;

      for (const table of BACKUP_TABLES) {
        const rows = Array.isArray(backup.tables[table])
          ? backup.tables[table]
          : [];

        if (rows.length === 0) continue;

        const { error } = await supabase
          .from(table)
          .upsert(rows, { onConflict: "id" });

        if (error) {
          throw new Error(`${table}: ${error.message}`);
        }
      }

      setBackupMessage("Backup restored successfully.");
    } catch (error) {
      console.error("Restore failed:", error);
      setBackupError(error.message || "Restore failed.");
    } finally {
      event.target.value = "";
      setRestoreLoading(false);
    }
  }

  return (
    <div className="settings-page">

      <div className="settings-section user-management-section">
        <h2>User Management</h2>

        <p className="backup-description">
          Create new admin accounts and manage existing users.
        </p>

        <form
          className="add-admin-form"
          onSubmit={handleCreateAdmin}
        >
          <div className="add-admin-grid">
            <div className="settings-field">
              <label htmlFor="admin-name">
                Admin Name
              </label>

              <input
                id="admin-name"
                type="text"
                value={adminName}
                onChange={(event) =>
                  setAdminName(event.target.value)
                }
                placeholder="Enter admin name"
                disabled={adminCreating}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="admin-email">
                Admin Email
              </label>

              <input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(event) =>
                  setAdminEmail(event.target.value)
                }
                placeholder="admin@example.com"
                disabled={adminCreating}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="admin-password">
                Temporary Password
              </label>

              <input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(event) =>
                  setAdminPassword(event.target.value)
                }
                placeholder="Minimum 6 characters"
                minLength={6}
                disabled={adminCreating}
              />
            </div>
          </div>

          <button
            type="submit"
            className="settings-save-button add-admin-button"
            disabled={adminCreating}
          >
            <UserPlus size={18} />
            {adminCreating
              ? "Creating Admin..."
              : "Create Admin"}
          </button>
        </form>

        {adminMessage && (
          <div className="settings-success">
            {adminMessage}
          </div>
        )}

        {adminError && (
          <div className="login-error">
            {adminError}
          </div>
        )}

        <div className="user-list-heading">
          <h3>Existing Users</h3>
        </div>

        {profilesLoading ? (
          <div className="user-management-loading">
            Loading users...
          </div>
        ) : profiles.length === 0 ? (
          <div className="user-management-empty">
            No users found.
          </div>
        ) : (
          <div className="user-table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div className="user-name">
                        {profile.name}
                      </div>
                    </td>

                    <td>
                      <span
                        className={
                          profile.role === "owner"
                            ? "user-role owner"
                            : "user-role admin"
                        }
                      >
                        {profile.role}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          profile.active
                            ? "user-status active"
                            : "user-status inactive"
                        }
                      >
                        {profile.active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      {profile.role === "owner" ? (
                        <span className="owner-protected">
                          Owner Protected
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={
                            profile.active
                              ? "user-action-button deactivate"
                              : "user-action-button activate"
                          }
                          onClick={() =>
                            toggleProfileActive(profile)
                          }
                          disabled={
                            profileUpdating === profile.id
                          }
                        >
                          {profile.active ? (
                            <>
                              <UserX size={16} />

                              {profileUpdating ===
                              profile.id
                                ? "Updating..."
                                : "Deactivate"}
                            </>
                          ) : (
                            <>
                              <UserCheck size={16} />

                              {profileUpdating ===
                              profile.id
                                ? "Updating..."
                                : "Activate"}
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {profileMessage && (
          <div className="settings-success">
            {profileMessage}
          </div>
        )}

        {profileError && (
          <div className="login-error">
            {profileError}
          </div>
        )}
      </div>

      <div className="settings-section backup-section">
        <h2>Data Backup</h2>

        <p className="backup-description">
          Backup and restore your business records. This backup
          includes customers, sales, invoices, payments and
          expenses.
        </p>

        <div className="backup-actions">
          <button
            type="button"
            className="settings-save-button"
            onClick={handleBackup}
            disabled={backupLoading || restoreLoading}
          >
            <Download size={18} />

            {backupLoading
              ? "Creating Backup..."
              : "Download Backup"}
          </button>

          <button
            type="button"
            className="settings-save-button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={backupLoading || restoreLoading}
          >
            <Upload size={18} />

            {restoreLoading
              ? "Restoring..."
              : "Restore Backup"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestore}
            style={{ display: "none" }}
          />
        </div>

        {backupMessage && (
          <div className="settings-success">
            {backupMessage}
          </div>
        )}

        {backupError && (
          <div className="login-error">
            {backupError}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;

