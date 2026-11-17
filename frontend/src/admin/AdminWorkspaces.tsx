
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Database,
  RefreshCw,
  Search,
  Ticket,
  Users,
} from "lucide-react";

import {
  getAdminWorkspaces,
  type AdminWorkspace,
} from "./adminApi";

export default function AdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminWorkspaces();
      setWorkspaces(response.workspaces);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to retrieve workspaces."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const filteredWorkspaces = workspaces.filter((workspace) => {
    const query = search.trim().toLowerCase();

    return (
      workspace.name.toLowerCase().includes(query) ||
      workspace.owner.name.toLowerCase().includes(query) ||
      workspace.owner.email.toLowerCase().includes(query)
    );
  });

  const totalMembers = workspaces.reduce(
    (sum, workspace) => sum + workspace.memberCount,
    0
  );

  const totalDatasets = workspaces.reduce(
    (sum, workspace) => sum + workspace.datasetCount,
    0
  );

  const totalTickets = workspaces.reduce(
    (sum, workspace) => sum + workspace.supportTicketCount,
    0
  );

  const stats = [
    {
      label: "Total Workspaces",
      value: workspaces.length,
      icon: Building2,
    },
    {
      label: "Workspace Memberships",
      value: totalMembers,
      icon: Users,
    },
    {
      label: "Workspace Datasets",
      value: totalDatasets,
      icon: Database,
    },
    {
      label: "Support Tickets",
      value: totalTickets,
      icon: Ticket,
    },
  ];

  return (
    <>
      <section className="admin-stats">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="admin-stat-card" key={stat.label}>
              <div className="admin-stat-top">
                <span>{stat.label}</span>
                <Icon size={20} />
              </div>
              <strong>{loading ? "..." : stat.value}</strong>
            </div>
          );
        })}
      </section>

      <section className="admin-panel">
        <div className="admin-workspace-heading">
          <div>
            <h2>Workspace Management</h2>
            <p>
              Monitor all DataPulse workspaces, owners,
              members, datasets and support activity.
            </p>
          </div>

          <button
            className="admin-refresh"
            onClick={() => void loadWorkspaces()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        <div className="admin-search">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search workspaces or owners..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <p>
          Showing {filteredWorkspaces.length} of{" "}
          {workspaces.length} workspaces
        </p>

        {loading ? (
          <p>Loading workspaces...</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Datasets</th>
                  <th>Tickets</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {filteredWorkspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>
                      <strong>{workspace.name}</strong>
                    </td>

                    <td>
                      <div>{workspace.owner.name}</div>
                      <small>{workspace.owner.email}</small>
                    </td>

                    <td>{workspace.memberCount}</td>
                    <td>{workspace.datasetCount}</td>
                    <td>{workspace.supportTicketCount}</td>

                    <td>
                      {new Date(
                        workspace.createdAt
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {filteredWorkspaces.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      No matching workspaces found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
