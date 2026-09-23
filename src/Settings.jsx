import { useState } from "react";
import { Save, Settings as SettingsIcon } from "lucide-react";
import "./Settings.css";

function Settings() {
  const [companyName, setCompanyName] = useState("Big Collection BD");
  const [phone, setPhone] = useState("01747165308");
  const [website, setWebsite] = useState("bigcollectionbd.com");
  const [address, setAddress] = useState(
    "House-414, Barek Bhandari Road, Uttara Azampur Kachabazar, Dhaka-1230"
  );
  const [saved, setSaved] = useState(false);

  function handleSave(event) {
    event.preventDefault();

    localStorage.setItem(
      "businessSettings",
      JSON.stringify({
        companyName,
        phone,
        website,
        address,
      })
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your business information</p>
        </div>

        <SettingsIcon size={28} />
      </div>

      <form className="settings-form" onSubmit={handleSave}>
        <div className="settings-section">
          <h2>Business Information</h2>

          <label>Business Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />

          <label>Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <label>Website</label>
          <input
            type="text"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />

          <label>Address</label>
          <textarea
            rows="4"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>

        <button className="settings-save-button" type="submit">
          <Save size={18} />
          Save Settings
        </button>

        {saved && (
          <div className="settings-success">
            Settings saved successfully.
          </div>
        )}
      </form>
    </div>
  );
}

export default Settings;
