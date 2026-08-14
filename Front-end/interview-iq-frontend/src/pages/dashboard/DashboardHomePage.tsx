import React from 'react';
import './DashboardPages.scss';

const DashboardHomePage: React.FC = () => {
  return (
    <div className="dashboard-page dashboard-home">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Welcome back, İsmayıl!</h1>
        </div>
        <button type="button" className="primary-action">+ New Interview</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <span>Practice Score</span>
          <strong>88%</strong>
          <small>+12% this week</small>
        </div>
        <div className="stat-card">
          <span>Interviews Done</span>
          <strong>14</strong>
          <small>2 upcoming</small>
        </div>
        <div className="stat-card">
          <span>Average Time</span>
          <strong>27m</strong>
          <small>Faster than last week</small>
        </div>
        <div className="stat-card">
          <span>Resume Match</span>
          <strong>91%</strong>
          <small>High alignment</small>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel large-panel">
          <h2>Interview Momentum</h2>
          <div className="chart-bars" aria-label="Interview performance chart">
            <span style={{ height: '35%' }} />
            <span style={{ height: '50%' }} />
            <span style={{ height: '62%' }} />
            <span style={{ height: '48%' }} />
            <span style={{ height: '78%' }} />
            <span style={{ height: '92%' }} />
            <span style={{ height: '100%' }} />
          </div>
        </div>

        <div className="panel">
          <h2>Quick Tasks</h2>
          <ul className="task-list">
            <li>Finish Frontend mock interview</li>
            <li>Review resume analysis</li>
            <li>Bookmark 3 system design questions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardHomePage;
