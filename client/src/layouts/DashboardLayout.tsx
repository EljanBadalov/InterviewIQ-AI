import React, {
  useEffect,
  useState,
} from "react";

import {
  Outlet,
  NavLink,
  Link,
  useLocation,
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
  FiMenu,
  FiX,
} from "react-icons/fi";

import {
  clearAuthSession,
} from "../utils/authStorage";

import "./DashboardLayout.scss";

const DashboardLayout: React.FC = () => {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] =
    useState(false);

  const storedUser =
    localStorage.getItem(
      "interviewiq_user"
    );

  let user: {
    fullName?: string;
    email?: string;
  } | null = null;

  try {
    user =
      storedUser
        ? JSON.parse(
            storedUser
          )
        : null;
  } catch {
    user = null;
  }

  const fullName =
    user?.fullName ||
    "InterviewIQ User";

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (
          part: string
        ) =>
          part[0]?.toUpperCase()
      )
      .join("");

  useEffect(
    () => {
      setMobileMenuOpen(
        false
      );
    },
    [location.pathname]
  );

  useEffect(
    () => {
      if (
        mobileMenuOpen
      ) {
        document.body.style.overflow =
          "hidden";
      } else {
        document.body.style.overflow =
          "";
      }

      return () => {
        document.body.style.overflow =
          "";
      };
    },
    [mobileMenuOpen]
  );

  const handleLogout =
    () => {
      setMobileMenuOpen(
        false
      );

      clearAuthSession();

      navigate(
        "/login"
      );
    };

  const closeMobileMenu =
    () => {
      setMobileMenuOpen(
        false
      );
    };

  return (
    <div className="dashboard-layout">
      <header className="mobile-dashboard-header">
        <Link
          to="/dashboard"
          className="mobile-header-logo"
          onClick={
            closeMobileMenu
          }
        >
          <div className="mobile-logo-icon">
            IQ
          </div>

          <h2>
            Interview
            <span>
              IQ
            </span>
          </h2>
        </Link>

        <button
          type="button"
          className="mobile-menu-button"
          onClick={() =>
            setMobileMenuOpen(
              true
            )
          }
          aria-label="Open navigation menu"
          aria-expanded={
            mobileMenuOpen
          }
        >
          <FiMenu />
        </button>
      </header>

      <div
        className={`mobile-sidebar-overlay ${
          mobileMenuOpen
            ? "visible"
            : ""
        }`}
        onClick={
          closeMobileMenu
        }
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${
          mobileMenuOpen
            ? "mobile-open"
            : ""
        }`}
      >
        <div className="sidebar-main">
          <div className="sidebar-logo-row">
            <Link
              to="/dashboard"
              className="sidebar-logo"
              onClick={
                closeMobileMenu
              }
            >
              <div className="logo-icon">
                IQ
              </div>

              <h2>
                Interview
                <span>
                  IQ
                </span>
              </h2>
            </Link>

            <button
              type="button"
              className="mobile-sidebar-close"
              onClick={
                closeMobileMenu
              }
              aria-label="Close navigation menu"
            >
              <FiX />
            </button>
          </div>

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
              onClick={
                closeMobileMenu
              }
              className={({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <FiHome />

              <span>
                Dashboard
              </span>
            </NavLink>

            <NavLink
              to="/dashboard/mock-interview"
              onClick={
                closeMobileMenu
              }
              className={({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <FiBriefcase />

              <span>
                Mock Interview
              </span>
            </NavLink>

            <NavLink
              to="/dashboard/resume-analysis"
              onClick={
                closeMobileMenu
              }
              className={({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <FiFileText />

              <span>
                Resume Analysis
              </span>
            </NavLink>

            <NavLink
              to="/dashboard/history"
              onClick={
                closeMobileMenu
              }
              className={({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <FiPieChart />

              <span>
                History & Progress
              </span>
            </NavLink>

            <NavLink
              to="/dashboard/bookmarks"
              onClick={
                closeMobileMenu
              }
              className={({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <FiBookmark />

              <span>
                Bookmarks
              </span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-tools">
            <NavLink
              to="/dashboard/settings"
              onClick={
                closeMobileMenu
              }
              className={({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <FiSettings />

              <span>
                Settings
              </span>
            </NavLink>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">
              {initials ||
                "IQ"}
            </div>

            <div className="user-details">
              <strong>
                {fullName}
              </strong>

              <span>
                {user?.email ||
                  "Signed in user"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="nav-item logout-btn"
            onClick={
              handleLogout
            }
          >
            <FiLogOut />

            <span>
              Logout
            </span>
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