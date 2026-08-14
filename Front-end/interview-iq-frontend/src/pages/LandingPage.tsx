import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBolt,
  FaBrain,
  FaChartLine,
  FaShieldAlt,
} from 'react-icons/fa';
import './LandingPage.scss';

const features = [
  {
    icon: <FaBrain />,
    title: 'AI Interviewer',
    text: 'Realistic mock interviews powered by intelligent follow-up questions.',
  },
  {
    icon: <FaBolt />,
    title: 'Instant Feedback',
    text: 'Get tactical recommendations right after every answer and response.',
  },
  {
    icon: <FaChartLine />,
    title: 'Progress Tracking',
    text: 'Monitor trends, confidence, and improvements over time with clarity.',
  },
  {
    icon: <FaShieldAlt />,
    title: 'Confidence Boost',
    text: 'Strengthen weak areas before the real interview with data-backed guidance.',
  },
];

const steps = [
  'Create your profile and choose your target role.',
  'Practice with an AI interviewer tailored to your track.',
  'Review smart feedback and improve your next attempt.',
];

const plans = [
  { name: 'Starter', price: '$0', note: 'Free trial', highlight: false },
  { name: 'Pro', price: '$29', note: 'Most popular', highlight: true },
  { name: 'Team', price: '$79', note: 'For hiring teams', highlight: false },
];

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <nav className="navbar">
        <Link to="/" className="logo">InterviewIQ AI</Link>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
        </div>

        <div className="nav-auth">
          <Link to="/login" className="login-btn">Log in</Link>
          <Link to="/dashboard" className="get-started-btn">Get Started</Link>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-content">
          <div className="ai-badge">🤖 AI-Powered Interview Practice</div>

          <h1>
            Practice Smarter.
            <br />
            Interview with <span>Confidence.</span>
          </h1>

          <p>
            InterviewIQ AI is your personal AI interviewer that helps you practice
            real technical interviews, get instant feedback, and track your progress.
          </p>

          <div className="hero-buttons">
            <Link to="/dashboard" className="primary-btn">
              Start Free Interview
              <FaArrowRight />
            </Link>
            <a href="#how-it-works" className="secondary-btn">
              ▷ See How It Works
            </a>
          </div>

          <div className="mini-stats">
            <div>
              <strong>12k+</strong>
              <span>Interviews</span>
            </div>
            <div>
              <strong>92%</strong>
              <span>Confidence boost</span>
            </div>
            <div>
              <strong>4.9/5</strong>
              <span>User rating</span>
            </div>
          </div>
        </div>

        <div className="hero-visual" aria-label="AI robot illustration area">
          <div className="orb" />
          <div className="mock-robot">🤖</div>
          <div className="floating-card">Live AI Feedback</div>
        </div>
      </main>

      <section className="features" id="features">
        <div className="section-heading">
          <span>Features</span>
          <h2>Everything you need to prep smarter</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <div className="feature-card" key={feature.title}>
              <div className="icon-wrapper">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="section-heading">
          <span>How it Works</span>
          <h2>Your interview prep in three simple steps</h2>
        </div>

        <div className="steps-grid">
          {steps.map((step, index) => (
            <div className="step-card" key={step}>
              <div className="step-number">0{index + 1}</div>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-heading">
          <span>Pricing</span>
          <h2>Choose a plan that fits your goals</h2>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <div key={plan.name} className={`price-card ${plan.highlight ? 'featured' : ''}`}>
              <h3>{plan.name}</h3>
              <div className="price-row">
                <span className="price">{plan.price}</span>
                <span className="month">/mo</span>
              </div>
              <p>{plan.note}</p>
              <button type="button">Choose plan</button>
            </div>
          ))}
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-content">
          <div>
            <span>About</span>
            <h2>Turn practice into confidence.</h2>
          </div>
          <p>
            We help candidates prepare with realistic interviews, actionable feedback,
            and measurable progress so they can walk into every conversation ready.
          </p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;