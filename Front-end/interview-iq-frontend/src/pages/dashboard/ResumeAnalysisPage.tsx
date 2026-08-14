import React from 'react';
import './DashboardPages.scss';

const ResumeAnalysisPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Resume Analysis</h1>
        </div>
      </div>

      <div className="panel">
        <h2>Resume match overview</h2>
        <p>Skills alignment: 91% • ATS score: 96 • Recommended improvements: 4</p>
      </div>
    </div>
  );
};

export default ResumeAnalysisPage;
