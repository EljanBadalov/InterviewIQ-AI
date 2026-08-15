import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiCheckCircle,
  FiKey,
  FiLock,
  FiMail,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiUser,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";
import "./SettingsPage.scss";

interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatar?: string;
  authProvider: "local" | "google";
  createdAt?: string;
  updatedAt?: string;
}

interface ProfileResponse {
  success: boolean;
  data: ProfileData;
}

interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data: {
    user: ProfileData;
  };
}

interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

interface StoredUser {
  id?: string;
  _id?: string;
  fullName?: string;
  email?: string;
  role?: string;
  avatar?: string;
  authProvider?: "local" | "google";
}

const formatMemberSince = (
  dateValue?: string
): string => {
  if (!dateValue) {
    return "Not available";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  ).format(date);
};

const settingsPage = () => {
  const [profile, setProfile] =
    useState<ProfileData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    profileSaving,
    setProfileSaving,
  ] = useState(false);

  const [
    passwordSaving,
    setPasswordSaving,
  ] = useState(false);

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    profileMessage,
    setProfileMessage,
  ] = useState("");

  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState("");

  const [
    profileError,
    setProfileError,
  ] = useState("");

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const loadProfile =
    async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await apiClient.get<ProfileResponse>(
            "/auth/profile"
          );

        const user =
          response.data.data;

        setProfile(user);
        setFullName(user.fullName);
        setEmail(user.email);
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Profile could not be loaded."
          );
        } else {
          setError(
            "Profile could not be loaded."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadProfile();
  }, []);

  const initials =
    useMemo(() => {
      if (!profile?.fullName) {
        return "U";
      }

      const parts =
        profile.fullName
          .trim()
          .split(/\s+/)
          .filter(Boolean);

      if (parts.length === 0) {
        return "U";
      }

      if (parts.length === 1) {
        return (
          parts[0]
            ?.charAt(0)
            .toUpperCase() || "U"
        );
      }

      const first =
        parts[0]
          ?.charAt(0)
          .toUpperCase() || "";

      const last =
        parts[
          parts.length - 1
        ]
          ?.charAt(0)
          .toUpperCase() || "";

      return `${first}${last}`;
    }, [profile]);

  const profileChanged =
    useMemo(() => {
      if (!profile) {
        return false;
      }

      return (
        fullName.trim() !==
          profile.fullName ||
        email.trim().toLowerCase() !==
          profile.email.toLowerCase()
      );
    }, [
      fullName,
      email,
      profile,
    ]);

  const isGoogleOnly =
    profile?.authProvider ===
    "google";

  const saveProfile =
    async () => {
      if (
        !profile ||
        profileSaving
      ) {
        return;
      }

      const trimmedName =
        fullName.trim();

      const trimmedEmail =
        email
          .trim()
          .toLowerCase();

      setProfileMessage("");
      setProfileError("");

      if (
        trimmedName.length < 2
      ) {
        setProfileError(
          "Full name must be at least 2 characters long."
        );
        return;
      }

      if (!trimmedEmail) {
        setProfileError(
          "Email is required."
        );
        return;
      }

      setProfileSaving(true);

      try {
        const response =
          await apiClient.put<UpdateProfileResponse>(
            "/auth/profile",
            {
              fullName:
                trimmedName,
              email:
                trimmedEmail,
            }
          );

        const updatedUser =
          response.data.data.user;

        setProfile(
          updatedUser
        );

        setFullName(
          updatedUser.fullName
        );

        setEmail(
          updatedUser.email
        );

        const storedValue =
          localStorage.getItem(
            "interviewiq_user"
          );

        let storedUser:
          StoredUser = {};

        if (storedValue) {
          try {
            storedUser =
              JSON.parse(
                storedValue
              ) as StoredUser;
          } catch {
            storedUser = {};
          }
        }

        const nextStoredUser: StoredUser =
          {
            ...storedUser,
            id:
              updatedUser.id ??
              storedUser.id,
            fullName:
              updatedUser.fullName,
            email:
              updatedUser.email,
            role:
              updatedUser.role,
            avatar:
              updatedUser.avatar,
            authProvider:
              updatedUser.authProvider,
          };

        localStorage.setItem(
          "interviewiq_user",
          JSON.stringify(
            nextStoredUser
          )
        );

        setProfileMessage(
          response.data.message ||
            "Profile updated successfully."
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setProfileError(
            err.response?.data
              ?.message ||
              "Profile could not be updated."
          );
        } else {
          setProfileError(
            "Profile could not be updated."
          );
        }
      } finally {
        setProfileSaving(false);
      }
    };

  const changePassword =
    async () => {
      if (
        passwordSaving ||
        isGoogleOnly
      ) {
        return;
      }

      setPasswordMessage("");
      setPasswordError("");

      if (!currentPassword) {
        setPasswordError(
          "Current password is required."
        );
        return;
      }

      if (
        newPassword.length < 6
      ) {
        setPasswordError(
          "New password must be at least 6 characters long."
        );
        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setPasswordError(
          "New passwords do not match."
        );
        return;
      }

      if (
        currentPassword ===
        newPassword
      ) {
        setPasswordError(
          "New password must be different from your current password."
        );
        return;
      }

      setPasswordSaving(true);

      try {
        const response =
          await apiClient.put<ChangePasswordResponse>(
            "/auth/password",
            {
              currentPassword,
              newPassword,
              confirmPassword,
            }
          );

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        setPasswordMessage(
          response.data.message ||
            "Password changed successfully."
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setPasswordError(
            err.response?.data
              ?.message ||
              "Password could not be changed."
          );
        } else {
          setPasswordError(
            "Password could not be changed."
          );
        }
      } finally {
        setPasswordSaving(false);
      }
    };

  return (
    <main className="settings-page">
      <section className="settings-header">
        <div>
          <span className="settings-eyebrow">
            ACCOUNT
          </span>

          <h1>Settings</h1>

          <p>
            Manage your personal information,
            account details, and security.
          </p>
        </div>
      </section>

      {error && (
        <div className="settings-error">
          <div className="settings-error__icon">
            <FiAlertCircle />
          </div>

          <div>
            <strong>
              Unable to load settings
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadProfile()
            }
          >
            <FiRefreshCw />
            Retry
          </button>
        </div>
      )}

      <section className="settings-profile-banner">
        <div className="settings-avatar">
          {loading ? (
            <span className="settings-skeleton settings-skeleton--avatar" />
          ) : profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.fullName}
            />
          ) : (
            <span>
              {initials}
            </span>
          )}
        </div>

        <div className="settings-profile-banner__copy">
          <span>
            PROFILE
          </span>

          {loading ? (
            <>
              <span className="settings-skeleton settings-skeleton--profile-name" />
              <span className="settings-skeleton settings-skeleton--profile-email" />
            </>
          ) : (
            <>
              <h2>
                {profile?.fullName}
              </h2>

              <p>
                {profile?.email}
              </p>
            </>
          )}
        </div>

        <div className="settings-provider-badge">
          <FiShield />

          {loading ? (
            <span className="settings-skeleton settings-skeleton--provider" />
          ) : (
            <span>
              {profile?.authProvider ===
              "google"
                ? "Google Account"
                : "Local Account"}
            </span>
          )}
        </div>
      </section>

      <section className="settings-grid">
        <article className="settings-card settings-card--profile">
          <div className="settings-card__header">
            <div className="settings-card__icon">
              <FiUser />
            </div>

            <div>
              <span>
                PROFILE
              </span>

              <h2>
                Personal Information
              </h2>

              <p>
                Update the name and email
                connected to your account.
              </p>
            </div>
          </div>

          <div className="settings-card__body">
            <div className="settings-field">
              <label htmlFor="settings-full-name">
                Full Name
              </label>

              <div className="settings-input">
                <FiUser />

                {loading ? (
                  <span className="settings-skeleton settings-skeleton--input" />
                ) : (
                  <input
                    id="settings-full-name"
                    type="text"
                    value={fullName}
                    onChange={(
                      event
                    ) => {
                      setFullName(
                        event.target
                          .value
                      );

                      setProfileError(
                        ""
                      );

                      setProfileMessage(
                        ""
                      );
                    }}
                    placeholder="Your full name"
                    maxLength={60}
                  />
                )}
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="settings-email">
                Email Address
              </label>

              <div className="settings-input">
                <FiMail />

                {loading ? (
                  <span className="settings-skeleton settings-skeleton--input" />
                ) : (
                  <input
                    id="settings-email"
                    type="email"
                    value={email}
                    onChange={(
                      event
                    ) => {
                      setEmail(
                        event.target
                          .value
                      );

                      setProfileError(
                        ""
                      );

                      setProfileMessage(
                        ""
                      );
                    }}
                    placeholder="you@example.com"
                  />
                )}
              </div>

              <small>
                This email is used to sign in
                to your InterviewIQ account.
              </small>
            </div>

            {profileError && (
              <div className="settings-inline-message settings-inline-message--error">
                <FiAlertCircle />
                <span>
                  {profileError}
                </span>
              </div>
            )}

            {profileMessage && (
              <div className="settings-inline-message settings-inline-message--success">
                <FiCheckCircle />
                <span>
                  {profileMessage}
                </span>
              </div>
            )}

            <div className="settings-actions">
              <button
                type="button"
                className="settings-primary-btn"
                disabled={
                  loading ||
                  profileSaving ||
                  !profileChanged
                }
                onClick={() =>
                  void saveProfile()
                }
              >
                {profileSaving ? (
                  <>
                    <span className="settings-button-loader" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </article>

        <article className="settings-card settings-card--account">
          <div className="settings-card__header">
            <div className="settings-card__icon">
              <FiShield />
            </div>

            <div>
              <span>
                ACCOUNT
              </span>

              <h2>
                Account Information
              </h2>

              <p>
                Basic information about
                your InterviewIQ account.
              </p>
            </div>
          </div>

          <div className="settings-account-list">
            <div className="settings-account-item">
              <span>
                Account type
              </span>

              {loading ? (
                <span className="settings-skeleton settings-skeleton--account-value" />
              ) : (
                <strong>
                  {profile?.authProvider ===
                  "google"
                    ? "Google"
                    : "Email & Password"}
                </strong>
              )}
            </div>

            <div className="settings-account-item">
              <span>
                Member since
              </span>

              {loading ? (
                <span className="settings-skeleton settings-skeleton--account-value" />
              ) : (
                <strong>
                  {formatMemberSince(
                    profile?.createdAt
                  )}
                </strong>
              )}
            </div>

            <div className="settings-account-item">
              <span>
                Account role
              </span>

              {loading ? (
                <span className="settings-skeleton settings-skeleton--account-value" />
              ) : (
                <strong>
                  {profile?.role
                    ? profile.role
                        .charAt(0)
                        .toUpperCase() +
                      profile.role.slice(
                        1
                      )
                    : "User"}
                </strong>
              )}
            </div>

            <div className="settings-account-item">
              <span>
                Account status
              </span>

              {loading ? (
                <span className="settings-skeleton settings-skeleton--account-value" />
              ) : (
                <strong className="settings-account-status">
                  Active
                </strong>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="settings-card settings-card--security">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <FiLock />
          </div>

          <div>
            <span>
              SECURITY
            </span>

            <h2>
              Change Password
            </h2>

            <p>
              Keep your account secure by using
              a strong and unique password.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="settings-password-grid">
            <span className="settings-skeleton settings-skeleton--password-field" />
            <span className="settings-skeleton settings-skeleton--password-field" />
            <span className="settings-skeleton settings-skeleton--password-field" />
          </div>
        ) : isGoogleOnly ? (
          <div className="settings-google-security">
            <div>
              <FiKey />
            </div>

            <section>
              <span>
                GOOGLE ACCOUNT
              </span>

              <h3>
                Password is managed by Google
              </h3>

              <p>
                This account signs in with Google,
                so there is no local InterviewIQ
                password to change.
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="settings-password-grid">
              <div className="settings-field">
                <label htmlFor="current-password">
                  Current Password
                </label>

                <div className="settings-input">
                  <FiLock />

                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(
                      event
                    ) => {
                      setCurrentPassword(
                        event.target
                          .value
                      );

                      setPasswordError(
                        ""
                      );

                      setPasswordMessage(
                        ""
                      );
                    }}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="settings-field">
                <label htmlFor="new-password">
                  New Password
                </label>

                <div className="settings-input">
                  <FiKey />

                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(
                      event
                    ) => {
                      setNewPassword(
                        event.target
                          .value
                      );

                      setPasswordError(
                        ""
                      );

                      setPasswordMessage(
                        ""
                      );
                    }}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="settings-field">
                <label htmlFor="confirm-password">
                  Confirm New Password
                </label>

                <div className="settings-input">
                  <FiKey />

                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(
                      event
                    ) => {
                      setConfirmPassword(
                        event.target
                          .value
                      );

                      setPasswordError(
                        ""
                      );

                      setPasswordMessage(
                        ""
                      );
                    }}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="settings-inline-message settings-inline-message--error settings-security-message">
                <FiAlertCircle />

                <span>
                  {passwordError}
                </span>
              </div>
            )}

            {passwordMessage && (
              <div className="settings-inline-message settings-inline-message--success settings-security-message">
                <FiCheckCircle />

                <span>
                  {passwordMessage}
                </span>
              </div>
            )}

            <div className="settings-security-footer">
              <div>
                <FiShield />

                <span>
                  Use at least 6 characters
                  and avoid reusing old passwords.
                </span>
              </div>

              <button
                type="button"
                className="settings-primary-btn"
                disabled={
                  passwordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                onClick={() =>
                  void changePassword()
                }
              >
                {passwordSaving ? (
                  <>
                    <span className="settings-button-loader" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FiKey />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default settingsPage;