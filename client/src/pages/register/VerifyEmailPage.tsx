import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiMail,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../api/apiClient";

import "./LoginPage.scss";

interface VerifyLocationState {
  email?: string;
}

interface VerifyResponse {
  success: boolean;
  message: string;
}

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

const VerifyEmailPage = () => {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const inputRefs =
    useRef<
      Array<HTMLInputElement | null>
    >([]);

  const state =
    location.state as
      | VerifyLocationState
      | null;

  const storedEmail =
    localStorage.getItem(
      "interviewiq_pending_verification_email"
    );

  const email =
    state?.email ||
    storedEmail ||
    "";

  const [
    code,
    setCode,
  ] = useState<string[]>(
    Array(CODE_LENGTH).fill("")
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    resendLoading,
    setResendLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    resendTimer,
    setResendTimer,
  ] = useState(
    RESEND_SECONDS
  );

  useEffect(() => {
    if (!email) {
      navigate(
        "/register",
        {
          replace: true,
        }
      );

      return;
    }

    localStorage.setItem(
      "interviewiq_pending_verification_email",
      email
    );
  }, [
    email,
    navigate,
  ]);

  useEffect(() => {
    if (
      resendTimer <= 0
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          setResendTimer(
            (previous) =>
              Math.max(
                0,
                previous - 1
              )
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [resendTimer]);

  const completeCode =
    useMemo(
      () =>
        code.join(""),
      [code]
    );

  const maskedEmail =
    useMemo(() => {
      if (!email) {
        return "";
      }

      const [
        username,
        domain,
      ] = email.split("@");

      if (
        !username ||
        !domain
      ) {
        return email;
      }

      if (
        username.length <= 2
      ) {
        return `${username[0] ?? ""}***@${domain}`;
      }

      return `${username.slice(
        0,
        2
      )}***@${domain}`;
    }, [email]);

  const handleCodeChange = (
    index: number,
    value: string
  ) => {
    const digit =
      value
        .replace(/\D/g, "")
        .slice(-1);

    const nextCode =
      [...code];

    nextCode[index] =
      digit;

    setCode(nextCode);

    setError("");
    setSuccess("");

    if (
      digit &&
      index <
        CODE_LENGTH - 1
    ) {
      inputRefs.current[
        index + 1
      ]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event:
      React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      event.key ===
        "Backspace" &&
      !code[index] &&
      index > 0
    ) {
      inputRefs.current[
        index - 1
      ]?.focus();
    }

    if (
      event.key ===
        "ArrowLeft" &&
      index > 0
    ) {
      inputRefs.current[
        index - 1
      ]?.focus();
    }

    if (
      event.key ===
        "ArrowRight" &&
      index <
        CODE_LENGTH - 1
    ) {
      inputRefs.current[
        index + 1
      ]?.focus();
    }
  };

  const handlePaste = (
    event:
      React.ClipboardEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    const pastedValue =
      event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(
          0,
          CODE_LENGTH
        );

    if (!pastedValue) {
      return;
    }

    const nextCode =
      Array(
        CODE_LENGTH
      ).fill("");

    pastedValue
      .split("")
      .forEach(
        (digit, index) => {
          nextCode[index] =
            digit;
        }
      );

    setCode(nextCode);

    const focusIndex =
      Math.min(
        pastedValue.length,
        CODE_LENGTH
      ) - 1;

    inputRefs.current[
      focusIndex
    ]?.focus();
  };

  const handleVerify =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setError("");
      setSuccess("");

      if (
        completeCode.length !==
        CODE_LENGTH
      ) {
        setError(
          "Please enter the complete 6-digit verification code."
        );

        return;
      }

      setLoading(true);

      try {
        const response =
          await apiClient.post<VerifyResponse>(
            "/auth/verify-email",
            {
              email,
              code:
                completeCode,
            }
          );

        setSuccess(
          response.data.message ||
            "Email verified successfully."
        );

        localStorage.removeItem(
          "interviewiq_pending_verification_email"
        );

        window.setTimeout(
          () => {
            navigate(
              "/login",
              {
                replace: true,

                state: {
                  verified:
                    true,

                  email,
                },
              }
            );
          },
          1200
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Verification failed."
          );
        } else {
          setError(
            "Verification failed."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  const handleResend =
    async () => {
      if (
        resendLoading ||
        resendTimer > 0
      ) {
        return;
      }

      setError("");
      setSuccess("");
      setResendLoading(true);

      try {
        const response =
          await apiClient.post<VerifyResponse>(
            "/auth/resend-verification",
            {
              email,
            }
          );

        setSuccess(
          response.data.message ||
            "A new verification code has been sent."
        );

        setCode(
          Array(
            CODE_LENGTH
          ).fill("")
        );

        setResendTimer(
          RESEND_SECONDS
        );

        window.setTimeout(
          () => {
            inputRefs.current[
              0
            ]?.focus();
          },
          50
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "A new verification code could not be sent."
          );
        } else {
          setError(
            "A new verification code could not be sent."
          );
        }
      } finally {
        setResendLoading(false);
      }
    };

  if (!email) {
    return null;
  }

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
              One last step.
            </h1>

            <p>
              Verify your email address
              to secure your account and
              start preparing for your
              next interview.
            </p>
          </div>

          <p className="auth-copyright">
            © 2026 InterviewIQ AI.
            All rights reserved.
          </p>
        </section>

        <section className="auth-form-side">
          <div className="auth-form-wrapper verify-form-wrapper">
            <Link
              to="/register"
              className="verify-back"
            >
              <FiArrowLeft />
              Back to register
            </Link>

            <div className="verify-email-icon">
              <FiMail />
            </div>

            <div className="auth-heading verify-heading">
              <span className="auth-eyebrow">
                Email verification
              </span>

              <h2>
                Check your inbox
              </h2>

              <p>
                We sent a 6-digit
                verification code to{" "}
                <strong>
                  {maskedEmail}
                </strong>
                .
              </p>
            </div>

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-success">
                <FiCheckCircle />

                <span>
                  {success}
                </span>
              </div>
            )}

            <form
              className="verify-form"
              onSubmit={
                handleVerify
              }
            >
              <div
                className="verification-code"
                onPaste={
                  handlePaste
                }
              >
                {code.map(
                  (
                    digit,
                    index
                  ) => (
                    <input
                      key={
                        index
                      }
                      ref={(
                        element
                      ) => {
                        inputRefs.current[
                          index
                        ] =
                          element;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={
                        index === 0
                          ? "one-time-code"
                          : "off"
                      }
                      maxLength={
                        1
                      }
                      value={
                        digit
                      }
                      onChange={(
                        event
                      ) =>
                        handleCodeChange(
                          index,
                          event.target
                            .value
                        )
                      }
                      onKeyDown={(
                        event
                      ) =>
                        handleKeyDown(
                          index,
                          event
                        )
                      }
                      aria-label={`Verification digit ${
                        index + 1
                      }`}
                    />
                  )
                )}
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={
                  loading ||
                  completeCode.length !==
                    CODE_LENGTH
                }
              >
                {loading
                  ? "Verifying..."
                  : "Verify email"}

                {!loading && (
                  <FiArrowRight />
                )}
              </button>
            </form>

            <div className="verify-resend">
              <span>
                Didn&apos;t receive
                the code?
              </span>

              <button
                type="button"
                disabled={
                  resendTimer > 0 ||
                  resendLoading
                }
                onClick={() =>
                  void handleResend()
                }
              >
                {resendLoading
                  ? "Sending..."
                  : resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : "Resend code"}
              </button>
            </div>

            <p className="verify-help">
              The verification code
              expires after 10 minutes.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default VerifyEmailPage;