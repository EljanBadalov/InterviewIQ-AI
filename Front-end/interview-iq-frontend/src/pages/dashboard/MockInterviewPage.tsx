import React from 'react';
import './DashboardPages.scss';

const MockInterviewPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Practice</p>
          <h1>Mock Interview</h1>
        </div>
      </div>

      <div className="panel">
        <h2>Upcoming session</h2>
        <p>Frontend role • System design • 45 minutes</p>
      </div>
    </div>
  );
};

export default MockInterviewPage;
