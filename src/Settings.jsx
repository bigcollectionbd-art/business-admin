import { useState } from "react";
import { Save } from "lucide-react";
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
      <form className="settings-form" onSubmit={handleSave}>
        <div className="settings-section">
          <h2>Business Information</h2>

          <div className="settings-field">
            <label htmlFor="companyName">Business Name</label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              rows="4"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
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
