import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import {
  FiHome,
  FiBriefcase,
  FiFileText,
  FiPieChart,
  FiBookmark,
  FiSettings,
  FiLogOut,
  FiBell,
} from 'react-icons/fi';
import './DashboardLayout.scss';

const DashboardLayout: React.FC = () => {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo">
          <div className="logo-icon">IQ</div>
          <h2>
            Interview<span>IQ</span> AI
          </h2>
        </Link>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          <div className="nav-title">MENU</div>

          <NavLink to="/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiHome />
            Dashboard
          </NavLink>

          <NavLink to="/dashboard/mock-interview" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiBriefcase />
            Mock Interview
          </NavLink>

          <NavLink to="/dashboard/resume-analysis" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiFileText />
            Resume Analysis
          </NavLink>

          <NavLink to="/dashboard/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiPieChart />
            History & Progress
          </NavLink>

          <NavLink to="/dashboard/bookmarks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiBookmark />
            Bookmarks
          </NavLink>
        </nav>

        <div className="sidebar-nav lower-nav">
          <NavLink to="/dashboard/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiSettings />
            Settings
          </NavLink>

          <button type="button" className="nav-item logout-btn">
            <FiLogOut />
            Logout
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-spacer" aria-hidden="true" />

          <div className="header-profile">
            <button type="button" className="notification-btn" aria-label="Notifications">
              <FiBell />
              <span className="badge" aria-hidden="true" />
            </button>

            <div className="user-info">
              <div className="avatar">İD</div>
              <span className="user-name">İsmayıl Daşdəmirli</span>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
