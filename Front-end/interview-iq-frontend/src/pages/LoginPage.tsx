import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaGoogle, FaGithub } from 'react-icons/fa';
import './LoginPage.scss';

const LoginPage: React.FC = () => {
  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-visual">
          <div className="visual-badge">AI Interview Coach</div>
          <div className="robot">🤖</div>
          <h2>Practice with confidence.</h2>
          <p>
            Prepare for technical interviews with instant AI feedback, mock rounds,
            and live progress tracking.
          </p>
        </div>

        <div className="login-card">
          <div className="top-row">
            <Link to="/" className="brand">InterviewIQ AI</Link>
            <Link to="/" className="back-link">← Back</Link>
          </div>

          <div className="form-header">
            <h1>Welcome back</h1>
            <p>Sign in to continue your journey.</p>
          </div>

          <div className="social-buttons">
            <button type="button" className="social-btn google">
              <FaGoogle />
              Google
            </button>
            <button type="button" className="social-btn github">
              <FaGithub />
              GitHub
            </button>
          </div>

          <div className="divider">
            <span>or continue with email</span>
          </div>

          <form className="login-form">
            <label>
              Email
              <input type="email" placeholder="you@example.com" />
            </label>

            <label>
              Password
              <input type="password" placeholder="••••••••" />
            </label>

            <div className="form-row">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#">Forgot password?</a>
            </div>

            <button type="submit" className="submit-btn">
              Sign in
              <FaArrowRight />
            </button>
          </form>

          <p className="signup-text">
            Don’t have an account? <Link to="/dashboard">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
