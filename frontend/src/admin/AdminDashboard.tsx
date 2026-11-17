
import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  Building2,
  Database,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

import {
  getAdminUsers,
  updateAdminUserRole,
  type AdminUser,
} from "./adminApi";

import AdminWorkspaces from "./AdminWorkspaces";
import AdminDatasets from "./AdminDatasets";
import AdminSupportTickets from "./AdminSupportTickets";
import AdminSystemHealth from "./AdminSystemHealth";

import "./AdminDashboard.css";

// ------------------------------------------
// TYPES
// ------------------------------------------

interface AdminDashboardProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

type AdminRole = "USER" | "OWNER" | "ADMIN";

type AdminPage =
  | "Overview"
  | "Users"
  | "Workspaces"
  | "Datasets"
  | "Support Tickets"
  | "System Health";

// ------------------------------------------
// SIDEBAR MENU
// ------------------------------------------

const menuItems = [
  {
    label: "Overview" as AdminPage,
    icon: LayoutDashboard,
  },
  {
    label: "Users" as AdminPage,
    icon: Users,
  },
  {
    label: "Workspaces" as AdminPage,
    icon: Building2,
  },
  {
    label: "Datasets" as AdminPage,
    icon: Database,
  },
  {
    label: "Support Tickets" as AdminPage,
    icon: Ticket,
  },
  {
    label: "System Health" as AdminPage,
    icon: Activity,
  },
];

// ------------------------------------------
// ADMIN DASHBOARD
// ------------------------------------------

export default function AdminDashboard({
  user,
  onLogout,
}: AdminDashboardProps) {
  const [activePage, setActivePage] =
    useState<AdminPage>("Overview");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [savingUserId, setSavingUserId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ------------------------------------------
  // FETCH USERS
  // ------------------------------------------

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminUsers();
      setUsers(response.users);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve registered users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // ------------------------------------------
  // UPDATE USER ROLE
  // ------------------------------------------

  const handleRoleChange = async (
    selectedUser: AdminUser,
    newRole: AdminRole
  ) => {
    if (selectedUser.role === newRole) return;

    const confirmed = window.confirm(
      `Change ${selectedUser.name}'s role from ${selectedUser.role} to ${newRole}?`
    );

    if (!confirmed) return;

    setSavingUserId(selectedUser.id);
    setError("");
    setMessage("");

    try {
      const response = await updateAdminUserRole(
        selectedUser.id,
        newRole
      );

      setUsers((current) =>
        current.map((item) =>
          item.id === selectedUser.id
            ? response.user
            : item
        )
      );

      setMessage(
        `${selectedUser.name}'s role was updated successfully.`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update user role."
      );
    } finally {
      setSavingUserId(null);
    }
  };

  // ------------------------------------------
  // SEARCH USERS
  // ------------------------------------------

  const filteredUsers = users.filter((item) => {
    const query = search.trim().toLowerCase();

    return (
      item.name.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query) ||
      item.role.toLowerCase().includes(query)
    );
  });

  // ------------------------------------------
  // USER STATISTICS
  // ------------------------------------------

  const totalAdmins = users.filter(
    (item) => item.role === "ADMIN"
  ).length;

  const totalRegularUsers = users.filter(
    (item) => item.role === "USER"
  ).length;

  const totalOwners = users.filter(
    (item) => item.role === "OWNER"
  ).length;

  const stats = [
    {
      label: "Total Users",
      value: users.length,
      icon: Users,
    },
    {
      label: "Administrators",
      value: totalAdmins,
      icon: ShieldCheck,
    },
    {
      label: "Regular Users",
      value: totalRegularUsers,
      icon: Users,
    },
    {
      label: "Owner Roles",
      value: totalOwners,
      icon: Building2,
    },
  ];

  // ------------------------------------------
  // USERS TABLE
  // ------------------------------------------

  const renderUsersTable = (
    displayedUsers: AdminUser[],
    allowRoleEditing: boolean
  ) => (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Registered</th>

            {allowRoleEditing && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {displayedUsers.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>

              <td>{item.email}</td>

              <td>
                <span
                  className={`admin-user-role ${
                    item.role === "ADMIN"
                      ? "is-admin"
                      : ""
                  }`}
                >
                  {item.role}
                </span>
              </td>

              <td>
                {new Date(
                  item.createdAt
                ).toLocaleDateString()}
              </td>

              {allowRoleEditing && (
                <td>
                  <select
                    className="admin-role-select"
                    aria-label={`Change role for ${item.name}`}
                    value={item.role}
                    disabled={savingUserId !== null}
                    onChange={(event) =>
                      void handleRoleChange(
                        item,
                        event.target.value as AdminRole
                      )
                    }
                  >
                    <option value="USER">USER</option>
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
              )}
            </tr>
          ))}

          {displayedUsers.length === 0 && (
            <tr>
              <td colSpan={allowRoleEditing ? 5 : 4}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // ------------------------------------------
  // RENDER ACTIVE PAGE
  // ------------------------------------------

  const renderActivePage = () => {
    switch (activePage) {
      // OVERVIEW
      case "Overview":
        return (
          <>
            <section className="admin-stats">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    className="admin-stat-card"
                    key={stat.label}
                  >
                    <div className="admin-stat-top">
                      <span>{stat.label}</span>
                      <Icon size={20} />
                    </div>

                    <strong>
                      {loading ? "..." : stat.value}
                    </strong>
                  </div>
                );
              })}
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <h2>Recent Users</h2>
                <p>
                  Recently registered DataPulse accounts
                </p>
              </div>

              {loading ? (
                <p>Loading users...</p>
              ) : (
                renderUsersTable(
                  users.slice(0, 8),
                  false
                )
              )}
            </section>
          </>
        );

      // USER MANAGEMENT
      case "Users":
        return (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <h2>User Management</h2>
              <p>
                View registered accounts and manage
                access roles.
              </p>
            </div>

            <div className="admin-search">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search by name, email or role..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <p>
              Showing {filteredUsers.length} of{" "}
              {users.length} users
            </p>

            {loading ? (
              <p>Loading users...</p>
            ) : (
              renderUsersTable(
                filteredUsers,
                true
              )
            )}
          </section>
        );

      // WORKSPACE MANAGEMENT
      case "Workspaces":
        return <AdminWorkspaces />;

      // DATASET MANAGEMENT
      case "Datasets":
        return <AdminDatasets />;

      // SUPPORT TICKET MANAGEMENT
      case "Support Tickets":
        return <AdminSupportTickets />;

      // SYSTEM HEALTH MONITORING
      case "System Health":
        return <AdminSystemHealth />;

      default:
        return null;
    }
  };

  // ------------------------------------------
  // MAIN DASHBOARD
  // ------------------------------------------

  return (
    <div className="admin-layout">
      {/* SIDEBAR */}

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">
            DP
          </div>

          <div>
            <strong>DataPulse</strong>
            <small>ADMIN CONSOLE</small>
          </div>
        </div>

        <div className="admin-sidebar-heading">
          SYSTEM MANAGEMENT
        </div>

        <nav className="admin-navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                className={`admin-nav-item ${
                  activePage === item.label
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setActivePage(item.label);
                  setError("");
                  setMessage("");
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ADMIN PROFILE */}

        <div className="admin-sidebar-bottom">
          <div className="admin-profile">
            <div className="admin-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{user.name}</strong>
              <small>ADMINISTRATOR</small>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout"
            onClick={onLogout}
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span>
              Administration / {activePage}
            </span>

            <h1>
              {activePage === "Overview"
                ? "Admin Dashboard"
                : activePage}
            </h1>
          </div>

          <div className="admin-header-actions">
            <span className="admin-role-badge">
              <ShieldCheck size={15} />
              ADMIN
            </span>

            <button
              type="button"
              className="admin-refresh"
              onClick={() => void loadUsers()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh Users
            </button>
          </div>
        </header>

        {/* NOTIFICATIONS */}

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="admin-success" role="status">
            {message}
          </div>
        )}

        {/* ACTIVE PAGE */}

        {renderActivePage()}
      </main>
    </div>
  );
}
