import React from "react";
import {
  Outlet,
  NavLink,
  Link,
  useNavigate,
} from "react-router-dom";

import {
  FiHome,
  FiBriefcase,
  FiFileText,
  FiPieChart,
  FiBookmark,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";

import { clearAuthSession } from "../utils/authStorage";

import "./DashboardLayout.scss";

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();

  const storedUser = localStorage.getItem(
    "interviewiq_user"
  );

  const user = storedUser
    ? JSON.parse(storedUser)
    : null;

  const fullName =
    user?.fullName || "InterviewIQ User";

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part: string) =>
        part[0]?.toUpperCase()
    )
    .join("");

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-main">
          <Link
            to="/dashboard"
            className="sidebar-logo"
          >
            <div className="logo-icon">
              IQ
            </div>

            <h2>
              Interview<span>IQ</span>
            </h2>
          </Link>

          <nav
            className="sidebar-nav"
            aria-label="Sidebar navigation"
          >
            <div className="nav-title">
              MENU
            </div>

            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `nav-item ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FiHome />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/dashboard/mock-interview"
              className={({ isActive }) =>
                `nav-item ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FiBriefcase />
              <span>Mock Interview</span>
            </NavLink>

            <NavLink
              to="/dashboard/resume-analysis"
              className={({ isActive }) =>
                `nav-item ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FiFileText />
              <span>Resume Analysis</span>
            </NavLink>

            <NavLink
              to="/dashboard/history"
              className={({ isActive }) =>
                `nav-item ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FiPieChart />
              <span>History & Progress</span>
            </NavLink>

            <NavLink
              to="/dashboard/bookmarks"
              className={({ isActive }) =>
                `nav-item ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FiBookmark />
              <span>Bookmarks</span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-tools">
            <NavLink
              to="/dashboard/settings"
              className={({ isActive }) =>
                `nav-item ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FiSettings />
              <span>Settings</span>
            </NavLink>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">
              {initials || "IQ"}
            </div>

            <div className="user-details">
              <strong>{fullName}</strong>

              <span>
                {user?.email ||
                  "Signed in user"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="nav-item logout-btn"
            onClick={handleLogout}
          >
            <FiLogOut />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;