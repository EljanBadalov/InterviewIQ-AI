import React from 'react';
import './DashboardPages.scss';

const BookmarksPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Saved</p>
          <h1>Bookmarks</h1>
        </div>
      </div>

      <div className="panel">
        <h2>Saved questions</h2>
        <p>Designing scalable systems • Closure problems • Behavioral prompts</p>
      </div>
    </div>
  );
};

export default BookmarksPage;
