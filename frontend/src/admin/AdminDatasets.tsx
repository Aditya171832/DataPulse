
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  HardDrive,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  getAdminDatasets,
  type AdminDataset,
} from "./adminApi";

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
};

export default function AdminDatasets() {
  const [datasets, setDatasets] = useState<AdminDataset[]>([]);
  const [search, setSearch] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ------------------------------------------
  // FETCH DATASETS
  // ------------------------------------------

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminDatasets();
      setDatasets(response.datasets);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to retrieve datasets."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  // ------------------------------------------
  // FILTER OPTIONS
  // ------------------------------------------

  const workspaceOptions = useMemo(() => {
    const names = datasets.map(
      (dataset) => dataset.workspace?.name ?? "Unassigned"
    );

    return [...new Set(names)].sort();
  }, [datasets]);

  const statusOptions = useMemo(() => {
    return [
      ...new Set(datasets.map((dataset) => dataset.status)),
    ].sort();
  }, [datasets]);

  // ------------------------------------------
  // SEARCH AND FILTER
  // ------------------------------------------

  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return datasets.filter((dataset) => {
      const workspaceName =
        dataset.workspace?.name ?? "Unassigned";

      const matchesSearch =
        dataset.name.toLowerCase().includes(query) ||
        dataset.originalName.toLowerCase().includes(query) ||
        dataset.owner.name.toLowerCase().includes(query) ||
        dataset.owner.email.toLowerCase().includes(query) ||
        workspaceName.toLowerCase().includes(query);

      const matchesWorkspace =
        workspaceFilter === "ALL" ||
        workspaceName === workspaceFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        dataset.status === statusFilter;

      return matchesSearch && matchesWorkspace && matchesStatus;
    });
  }, [datasets, search, workspaceFilter, statusFilter]);

  // ------------------------------------------
  // STATISTICS
  // ------------------------------------------

  const totalStorage = datasets.reduce(
    (sum, dataset) => sum + dataset.fileSize,
    0
  );

  const processedCount = datasets.filter((dataset) =>
    ["CLEANED", "ETL_COMPLETED", "SPARK_COMPLETED"].includes(
      dataset.status
    )
  ).length;

  const csvCount = datasets.filter(
    (dataset) => dataset.fileType.toUpperCase() === "CSV"
  ).length;

  const stats = [
    {
      label: "Total Datasets",
      value: datasets.length.toString(),
      icon: Database,
    },
    {
      label: "Total Storage",
      value: formatBytes(totalStorage),
      icon: HardDrive,
    },
    {
      label: "Processed Datasets",
      value: processedCount.toString(),
      icon: CheckCircle2,
    },
    {
      label: "CSV Datasets",
      value: csvCount.toString(),
      icon: FileSpreadsheet,
    },
  ];

  // ------------------------------------------
  // COMPONENT
  // ------------------------------------------

  return (
    <>
      {/* DATASET STATISTICS */}

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

      {/* DATASET MANAGEMENT */}

      <section className="admin-panel">
        <div className="admin-workspace-heading">
          <div>
            <h2>Dataset Management</h2>
            <p>
              Monitor datasets uploaded and processed across all
              DataPulse workspaces.
            </p>
          </div>

          <button
            className="admin-refresh"
            onClick={() => void loadDatasets()}
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

        {/* SEARCH AND FILTERS */}

        <div className="admin-dataset-filters">
          <div className="admin-search">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search datasets, owners or workspaces..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            className="admin-role-select"
            aria-label="Filter by workspace"
            value={workspaceFilter}
            onChange={(event) =>
              setWorkspaceFilter(event.target.value)
            }
          >
            <option value="ALL">All Workspaces</option>

            {workspaceOptions.map((workspace) => (
              <option key={workspace} value={workspace}>
                {workspace}
              </option>
            ))}
          </select>

          <select
            className="admin-role-select"
            aria-label="Filter by processing status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="ALL">All Statuses</option>

            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <p>
          Showing {filteredDatasets.length} of{" "}
          {datasets.length} datasets
        </p>

        {/* DATASET TABLE */}

        {loading ? (
          <p>Loading datasets...</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Owner</th>
                  <th>Workspace</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>

              <tbody>
                {filteredDatasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td>
                      <strong>{dataset.name}</strong>
                      <small>{dataset.originalName}</small>
                    </td>

                    <td>
                      <div>{dataset.owner.name}</div>
                      <small>{dataset.owner.email}</small>
                    </td>

                    <td>
                      {dataset.workspace?.name ?? "Unassigned"}
                    </td>

                    <td>
                      {dataset.fileType.toUpperCase()}
                    </td>

                    <td>
                      {formatBytes(dataset.fileSize)}
                    </td>

                    <td>
                      <span className="admin-user-role">
                        {dataset.status.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td>
                      {new Date(
                        dataset.createdAt
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {filteredDatasets.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      No matching datasets found.
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
