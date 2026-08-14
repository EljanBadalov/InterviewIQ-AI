import React from 'react';
import './DashboardPages.scss';

const HistoryPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>History & Progress</h1>
        </div>
      </div>

      <div className="panel">
        <h2>Recent sessions</h2>
        <p>React Tech Interview • 7 days ago • Score 84%</p>
      </div>
    </div>
  );
};

export default HistoryPage;
