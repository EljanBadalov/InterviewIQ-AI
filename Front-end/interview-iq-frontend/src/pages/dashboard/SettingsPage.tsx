import React from 'react';
import './DashboardPages.scss';

const SettingsPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="panel">
        <h2>Profile settings</h2>
        <p>Role preferences, notifications, and account management</p>
      </div>
    </div>
  );
};

export default SettingsPage;
