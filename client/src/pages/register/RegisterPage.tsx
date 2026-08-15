import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiUser,
} from "react-icons/fi";

import {
  GoogleLogin,
  type CredentialResponse,
} from "@react-oauth/google";

import axios from "axios";

import apiClient from "../../api/apiClient";
import { saveAuthSession } from "../../utils/authStorage";

import "./LoginPage.scss";

interface GoogleAuthResponse {
  data?: {
    token?: string;

    user?: {
      id?: string;
      _id?: string;
      fullName: string;
      email: string;
      role: string;
      avatar?: string;
      authProvider?: "local" | "google";
      isEmailVerified?: boolean;
    };
  };
}

interface RegisterResponse {
  success: boolean;
  message: string;

  data?: {
    email?: string;
    requiresVerification?: boolean;
  };
}

const RegisterPage = () => {
  const navigate = useNavigate();

  const googleButtonRef =
    useRef<HTMLDivElement>(null);

  const [
    googleButtonWidth,
    setGoogleButtonWidth,
  ] = useState(400);

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const updateGoogleButtonWidth = () => {
      if (googleButtonRef.current) {
        setGoogleButtonWidth(
          Math.min(
            400,
            googleButtonRef.current.offsetWidth
          )
        );
      }
    };

    updateGoogleButtonWidth();

    const resizeObserver =
      new ResizeObserver(
        updateGoogleButtonWidth
      );

    if (googleButtonRef.current) {
      resizeObserver.observe(
        googleButtonRef.current
      );
    }

    window.addEventListener(
      "resize",
      updateGoogleButtonWidth
    );

    return () => {
      resizeObserver.disconnect();

      window.removeEventListener(
        "resize",
        updateGoogleButtonWidth
      );
    };
  }, []);

  const completeGoogleAuthentication = (
    responseData: GoogleAuthResponse
  ) => {
    const token =
      responseData.data?.token;

    const user =
      responseData.data?.user;

    if (!token || !user) {
      throw new Error(
        "Authentication response is incomplete."
      );
    }

    saveAuthSession(token, user);

    navigate(
      "/dashboard",
      {
        replace: true,
      }
    );
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    const normalizedName =
      fullName.trim();

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (
      normalizedName.length < 2
    ) {
      setError(
        "Full name must be at least 2 characters long."
      );

      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters long."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );

      return;
    }

    setLoading(true);

    try {
      const response =
        await apiClient.post<RegisterResponse>(
          "/auth/register",
          {
            fullName:
              normalizedName,

            email:
              normalizedEmail,

            password,
          }
        );

      const verificationEmail =
        response.data.data?.email ||
        normalizedEmail;

      localStorage.setItem(
        "interviewiq_pending_verification_email",
        verificationEmail
      );

      navigate(
        "/verify-email",
        {
          replace: true,

          state: {
            email:
              verificationEmail,
          },
        }
      );
    } catch (err) {
      if (
        axios.isAxiosError(err)
      ) {
        setError(
          err.response?.data
            ?.message ||
            "Unable to create account."
        );
      } else if (
        err instanceof Error
      ) {
        setError(
          err.message
        );
      } else {
        setError(
          "Unable to create account."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess =
    async (
      credentialResponse:
        CredentialResponse
    ) => {
      if (
        !credentialResponse.credential
      ) {
        setError(
          "Google did not return a valid credential."
        );

        return;
      }

      setError("");
      setGoogleLoading(true);

      try {
        const response =
          await apiClient.post(
            "/auth/google",
            {
              credential:
                credentialResponse.credential,
            }
          );

        completeGoogleAuthentication(
          response.data
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Google authentication failed."
          );
        } else if (
          err instanceof Error
        ) {
          setError(
            err.message
          );
        } else {
          setError(
            "Google authentication failed."
          );
        }
      } finally {
        setGoogleLoading(false);
      }
    };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual">
          <Link
            to="/"
            className="auth-brand"
          >
            InterviewIQ
            <span>AI</span>
          </Link>

          <div className="auth-visual-content">
            <h1>
              Start preparing smarter.
            </h1>

            <p>
              Create your account and
              practice real interviews
              with instant AI feedback,
              resume analysis, and
              progress tracking.
            </p>
          </div>

          <p className="auth-copyright">
            © 2026 InterviewIQ AI.
            All rights reserved.
          </p>
        </section>

        <section className="auth-form-side">
          <div className="auth-form-wrapper register-form-wrapper">
            <div className="auth-top">
              <Link
                to="/"
                className="mobile-auth-brand"
              >
                InterviewIQ
                <span>AI</span>
              </Link>
            </div>

            <div className="auth-heading">
              <span className="auth-eyebrow">
                Get started
              </span>

              <h2>
                Create account
              </h2>

              <p>
                Create your free
                InterviewIQ account.
              </p>
            </div>

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            <div className="google-auth-area">
              <div
                className="google-button-wrapper"
                ref={googleButtonRef}
              >
                <GoogleLogin
                  onSuccess={
                    handleGoogleSuccess
                  }
                  onError={() => {
                    setError(
                      "Google authentication failed."
                    );
                  }}
                  type="standard"
                  theme="outline"
                  size="large"
                  text="signup_with"
                  shape="rectangular"
                  width={
                    googleButtonWidth
                  }
                />
              </div>

              {googleLoading && (
                <span className="google-loading">
                  Creating account
                  with Google...
                </span>
              )}
            </div>

            <div className="auth-divider">
              <span>
                or continue with email
              </span>
            </div>

            <form
              className="auth-form"
              onSubmit={
                handleSubmit
              }
            >
              <label className="auth-field">
                <span>
                  Full name
                </span>

                <div className="input-wrapper">
                  <FiUser />

                  <input
                    type="text"
                    value={fullName}
                    onChange={(
                      event
                    ) =>
                      setFullName(
                        event.target.value
                      )
                    }
                    placeholder="John Doe"
                    autoComplete="name"
                    required
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>
                  Email
                </span>

                <div className="input-wrapper">
                  <FiMail />

                  <input
                    type="email"
                    value={email}
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>
                  Password
                </span>

                <div className="input-wrapper">
                  <FiLock />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (previous) =>
                          !previous
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <FiEyeOff />
                    ) : (
                      <FiEye />
                    )}
                  </button>
                </div>
              </label>

              <label className="auth-field">
                <span>
                  Confirm password
                </span>

                <div className="input-wrapper">
                  <FiLock />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </label>

              <button
                type="submit"
                className="auth-submit"
                disabled={
                  loading ||
                  googleLoading
                }
              >
                {loading
                  ? "Sending verification code..."
                  : "Create account"}

                {!loading && (
                  <FiArrowRight />
                )}
              </button>
            </form>

            <p className="auth-switch">
              Already have an account?{" "}
              <Link to="/login">
                Log in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;