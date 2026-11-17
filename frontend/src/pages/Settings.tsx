
import { useEffect, useState, type FormEvent } from "react";
import {
  UserRound,
  LockKeyhole,
  ShieldCheck,
  CalendarDays,
  Mail,
  Save,
  Eye,
  EyeOff,
  Settings2,
} from "lucide-react";
import axios from "axios";

import {
  getAccountProfile,
  updateAccountProfile,
  changeAccountPassword,
  type AccountUser,
} from "../api";

import "./Settings.css";

interface SettingsPageProps {
  onProfileUpdated: (user: AccountUser) => void;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string }
      | undefined;

    return data?.message || "Request failed. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

export default function SettingsPage({
  onProfileUpdated,
}: SettingsPageProps) {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [name, setName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loadError, setLoadError] = useState("");

  const [compactMode, setCompactMode] = useState(
    () => localStorage.getItem("datapulse_compact_mode") === "true"
  );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await getAccountProfile();

        if (!active) return;

        setAccount(response.user);
        setName(response.user.name);
      } catch (error) {
        if (active) setLoadError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (name.trim().length < 2) {
      setProfileError("Name must contain at least 2 characters.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await updateAccountProfile(name.trim());

      setAccount(response.user);
      setName(response.user.name);

      localStorage.setItem(
        "datapulse_user",
        JSON.stringify({
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
        })
      );

      onProfileUpdated(response.user);
      setProfileMessage(response.message);
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const response = await changeAccountPassword(
        currentPassword,
        newPassword
      );

      setPasswordMessage(response.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(getErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  }

  function handleCompactMode(value: boolean) {
    setCompactMode(value);
    localStorage.setItem("datapulse_compact_mode", String(value));
  }

  return (
    <div className={`settings-page ${compactMode ? "settings-compact" : ""}`}>
      <div className="settings-heading">
        <div>
          <div className="settings-eyebrow">
            <Settings2 size={15} />
            ACCOUNT PREFERENCES
          </div>
          <h1>Settings</h1>
          <p>Manage your profile, security and account preferences.</p>
        </div>
      </div>

      {loading ? (
        <div className="settings-panel">Loading account information...</div>
      ) : loadError ? (
        <div className="settings-alert settings-error">{loadError}</div>
      ) : (
        <div className="settings-layout">
          <section className="settings-panel">
            <div className="settings-panel-heading">
              <div className="settings-icon"><UserRound size={20} /></div>
              <div>
                <h2>My Profile</h2>
                <p>Update the name displayed in your workspace.</p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="settings-form">
              <label htmlFor="settings-name">Full name</label>
              <input
                id="settings-name"
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                required
              />

              <label htmlFor="settings-email">Email address</label>
              <input
                id="settings-email"
                value={account?.email ?? ""}
                readOnly
                aria-label="Email address"
              />
              <p className="settings-hint">
                Your email is linked to your account and workspace invitations.
              </p>

              {profileError && (
                <div className="settings-alert settings-error">{profileError}</div>
              )}
              {profileMessage && (
                <div className="settings-alert settings-success">
                  {profileMessage}
                </div>
              )}

              <button
                type="submit"
                className="settings-button"
                disabled={savingProfile || !name.trim()}
              >
                <Save size={16} />
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-heading">
              <div className="settings-icon"><LockKeyhole size={20} /></div>
              <div>
                <h2>Password & Security</h2>
                <p>Keep your DataPulse account protected.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="settings-form">
              <label htmlFor="settings-current-password">Current password</label>
              <input
                id="settings-current-password"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />

              <label htmlFor="settings-new-password">New password</label>
              <input
                id="settings-new-password"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />

              <label htmlFor="settings-confirm-password">
                Confirm new password
              </label>
              <input
                id="settings-confirm-password"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="settings-toggle"
                onClick={() => setShowPasswords((value) => !value)}
              >
                {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPasswords ? "Hide passwords" : "Show passwords"}
              </button>

              {passwordError && (
                <div className="settings-alert settings-error">
                  {passwordError}
                </div>
              )}
              {passwordMessage && (
                <div className="settings-alert settings-success">
                  {passwordMessage}
                </div>
              )}

              <button
                type="submit"
                className="settings-button"
                disabled={savingPassword}
              >
                <ShieldCheck size={16} />
                {savingPassword ? "Updating..." : "Change Password"}
              </button>
            </form>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-heading">
              <div className="settings-icon"><Mail size={20} /></div>
              <div>
                <h2>Account Information</h2>
                <p>Your DataPulse account details.</p>
              </div>
            </div>

            <div className="settings-details">
              <div><span>Account name</span><strong>{account?.name}</strong></div>
              <div><span>Email</span><strong>{account?.email}</strong></div>
              <div><span>Role</span><strong>{account?.role}</strong></div>
              <div>
                <span><CalendarDays size={14} /> Member since</span>
                <strong>
                  {account?.createdAt
                    ? new Date(account.createdAt).toLocaleDateString()
                    : "—"}
                </strong>
              </div>
            </div>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-heading">
              <div className="settings-icon"><Settings2 size={20} /></div>
              <div>
                <h2>Appearance Preferences</h2>
                <p>Customize the Settings page layout.</p>
              </div>
            </div>

            <label className="settings-preference">
              <div>
                <strong>Compact Settings Layout</strong>
                <p>Reduce spacing between Settings sections.</p>
              </div>
              <input
                type="checkbox"
                checked={compactMode}
                onChange={(event) => handleCompactMode(event.target.checked)}
              />
            </label>
            <p className="settings-hint">
              This preference is saved locally in your browser.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
