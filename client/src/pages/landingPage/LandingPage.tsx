import { useState } from "react";
import {
  FiArrowRight,
  FiBarChart2,
  FiCheckCircle,
  FiMenu,
  FiMessageSquare,
  FiPlay,
  FiTarget,
  FiX,
  FiZap,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import heroImage from "../../assets/hero.png";
import "./LandingPage.scss";

const features = [
  {
    icon: <FiMessageSquare />,
    title: "Realistic Mock Interviews",
    text: "Practice technical and behavioral interviews with questions tailored to your level.",
  },
  {
    icon: <FiZap />,
    title: "Instant AI Feedback",
    text: "Receive detailed feedback, scoring, strengths, weaknesses, and an improved answer.",
  },
  {
    icon: <FiBarChart2 />,
    title: "Track Your Progress",
    text: "See your scores improve over time and identify the areas that need more practice.",
  },
  {
    icon: <FiTarget />,
    title: "Prepare With Purpose",
    text: "Choose your category, difficulty, and interview type before every practice session.",
  },
];

const steps = [
  {
    number: "01",
    title: "Choose your interview",
    text: "Select a category, difficulty level, and interview type that matches your goal.",
  },
  {
    number: "02",
    title: "Answer real questions",
    text: "Work through interview questions one by one in a focused interview environment.",
  },
  {
    number: "03",
    title: "Improve with AI",
    text: "Review your score, feedback, improved answers, and recommendations after each session.",
  },
];

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="landing-page">
      <div className="landing-glow landing-glow--one" />
      <div className="landing-glow landing-glow--two" />

      <header className="landing-header">
        <nav className={`landing-nav ${mobileMenuOpen ? "menu-open" : ""}`}>
          <Link to="/" className="brand" onClick={closeMobileMenu}>
            <div className="brand-mark">IQ</div>

            <span>
              Interview<span className="brand-accent">IQ</span>
            </span>
          </Link>

          <div className="nav-links">
            <a href="#">Home</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About</a>
          </div>

          <div className="nav-actions">
            <Link to="/login" className="nav-login">
              Log in
            </Link>

            <Link to="/register" className="nav-primary">
              Get started
              <FiArrowRight />
            </Link>
          </div>

          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>

          <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
            <div className="mobile-menu-links">
              <a href="#" onClick={closeMobileMenu}>
                Home
              </a>

              <a href="#features" onClick={closeMobileMenu}>
                Features
              </a>

              <a href="#how-it-works" onClick={closeMobileMenu}>
                How it works
              </a>

              <a href="#about" onClick={closeMobileMenu}>
                About
              </a>
            </div>

            <div className="mobile-menu-actions">
              <Link
                to="/login"
                className="mobile-login"
                onClick={closeMobileMenu}
              >
                Log in
              </Link>

              <Link
                to="/register"
                className="mobile-get-started"
                onClick={closeMobileMenu}
              >
                Get started
                <FiArrowRight />
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="badge-dot" />
              AI-powered interview preparation
            </div>

            <h1 className="header-text">
              Practice smarter.
              <br />
              Interview with
              <span className="gradient-text"> confidence.</span>
            </h1>

            <p className="hero-description">
              Prepare for your next interview with realistic mock sessions,
              instant AI feedback, resume analysis, and progress tracking — all
              in one place.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="hero-primary">
                Start free interview
                <FiArrowRight />
              </Link>

              <a href="#how-it-works" className="hero-secondary">
                <span className="play-icon">
                  <FiPlay />
                </span>

                <span className="hero-secondary-text">
                  See how it works
                </span>
              </a>
            </div>

            <div className="hero-trust">
              <div className="trust-avatars">
                <span>JS</span>
                <span>TS</span>
                <span>AI</span>
              </div>

              <div className="trust-copy">
                <strong>Built for ambitious candidates</strong>
                <span>Practice. Get feedback. Improve.</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-orbit visual-orbit--one" />
            <div className="visual-orbit visual-orbit--two" />

            <div className="hero-image-wrapper">
              <div className="image-glow" />

              <img
                src={heroImage}
                alt="InterviewIQ AI assistant"
                className="hero-image"
              />
            </div>

            <div className="floating-ui floating-ui--score">
              <div className="floating-icon success">
                <FiCheckCircle />
              </div>

              <div>
                <span>AI Evaluation</span>
                <strong>88 / 100</strong>
              </div>
            </div>

            <div className="floating-ui floating-ui--feedback">
              <div className="floating-icon">
                <FiZap />
              </div>

              <div>
                <span>Instant feedback</span>
                <strong>Ready in seconds</strong>
              </div>
            </div>

            <div className="code-chip code-chip--left">
              {"</>"}
            </div>

            <div className="code-chip code-chip--right">
              AI
            </div>
          </div>
        </section>

        <section className="product-strip">
          <div className="product-strip-inner">
            <div className="product-stat">
              <strong>AI</strong>
              <span>Answer evaluation</span>
            </div>

            <div className="strip-divider" />

            <div className="product-stat">
              <strong>0–100</strong>
              <span>Detailed scoring</span>
            </div>

            <div className="strip-divider" />

            <div className="product-stat">
              <strong>PDF</strong>
              <span>Resume analysis</span>
            </div>

            <div className="strip-divider" />

            <div className="product-stat">
              <strong>24/7</strong>
              <span>Practice anytime</span>
            </div>
          </div>
        </section>

        <section className="landing-section features-section" id="features">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                Everything you need
              </span>

              <h2>
                A smarter way to prepare
                <br />
                for your next interview.
              </h2>
            </div>

            <p>
              InterviewIQ combines mock interviews, AI evaluation, resume
              analysis, and progress insights into one focused experience.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-top">
                  <div className="feature-icon">
                    {feature.icon}
                  </div>

                  <span>0{index + 1}</span>
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.text}</p>

                <div className="feature-line" />
              </article>
            ))}
          </div>
        </section>

        <section
          className="landing-section how-section"
          id="how-it-works"
        >
          <div className="how-wrapper">
            <div className="how-intro">
              <span className="section-kicker">
                How it works
              </span>

              <h2>
                From practice to
                <span className="gradient-text"> progress.</span>
              </h2>

              <p>
                A simple interview workflow designed to help you understand
                your weaknesses and improve with every session.
              </p>

              <Link to="/login" className="text-link">
                Start practicing
                <FiArrowRight />
              </Link>
            </div>

            <div className="steps-list">
              {steps.map((step) => (
                <div className="step-item" key={step.number}>
                  <div className="step-number">
                    {step.number}
                  </div>

                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="landing-section about-section"
          id="about"
        >
          <div className="cta-card">
            <div className="cta-glow" />

            <div className="cta-content">
              <span className="section-kicker">
                Your next interview starts here
              </span>

              <h2>
                Build confidence before
                <br />
                the real interview.
              </h2>

              <p>
                Practice with InterviewIQ and turn every answer into an
                opportunity to improve.
              </p>
            </div>

            <Link to="/login" className="cta-button">
              Start practicing
              <FiArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="brand footer-brand">
          <div className="brand-mark">
            IQ
          </div>

          <span>
            Interview<span className="brand-accent">IQ</span>
          </span>
        </Link>

        <p>AI-powered interview preparation.</p>

        <span>© 2026 InterviewIQ AI</span>
      </footer>
    </div>
  );
};

export default LandingPage;