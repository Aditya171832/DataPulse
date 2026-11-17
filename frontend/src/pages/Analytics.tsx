
import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Database,
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type Dataset,
  profileDataset,
} from "../api";

import "./Analytics.css";

interface Props {
  datasets: Dataset[];
}

interface ColumnInfo {
  name: string;
  data_type: string;
  missing_values: number;
  unique_values: number;
}

interface ProfileData {
  success: boolean;
  filename: string;
  total_rows: number;
  total_columns: number;
  duplicate_rows: number;
  columns: ColumnInfo[];
  numeric_statistics: Record<
    string,
    {
      mean: number;
      min: number;
      max: number;
      median: number;
    }
  >;
  categorical_statistics: Record<
    string,
    {
      unique_values: number;
      top_values: Record<string, number>;
    }
  >;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
};

const AnalyticsPage = ({ datasets }: Props) => {
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const csvDatasets = useMemo(
    () =>
      datasets.filter((dataset) =>
        `${dataset.fileType} ${dataset.originalName}`
          .toLowerCase()
          .includes("csv")
      ),
    [datasets]
  );

  const totalStorage = datasets.reduce(
    (total, dataset) => total + (dataset.fileSize || 0),
    0
  );

  const processedCount = datasets.filter((dataset) =>
    ["CLEANED", "ETL_COMPLETED", "SPARK_COMPLETED"].includes(
      dataset.status.toUpperCase()
    )
  ).length;

  const fileTypeData = useMemo(() => {
    const counts: Record<string, number> = {};

    datasets.forEach((dataset) => {
      const type =
        dataset.fileType?.replace(".", "").toUpperCase() ||
        "UNKNOWN";

      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [datasets]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};

    datasets.forEach((dataset) => {
      const status = dataset.status || "UNKNOWN";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name: name.replaceAll("_", " "),
      value,
    }));
  }, [datasets]);

  const handleProfile = async () => {
    if (!selectedId) {
      setError("Please select a CSV dataset.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setProfile(null);

      const response = await profileDataset(selectedId);

      if (!response.success || !response.profile) {
        throw new Error("Profiling did not return valid results.");
      }

      setProfile(response.profile as ProfileData);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          err.message ||
          "Unable to profile this dataset."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analytics-page">
      <div className="analytics-heading">
        <div>
          <h1>Analytics</h1>
          <p>
            Explore your dataset storage, processing activity and
            data quality.
          </p>
        </div>

        <button
          className="analytics-refresh"
          onClick={() => window.location.reload()}
          title="Refresh analytics"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* KPI CARDS */}

      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon purple">
            <Database size={21} />
          </div>
          <div>
            <span>Total Datasets</span>
            <h2>{datasets.length}</h2>
            <small>Datasets in your workspace</small>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon blue">
            <HardDrive size={21} />
          </div>
          <div>
            <span>Total Storage</span>
            <h2>{formatBytes(totalStorage)}</h2>
            <small>Combined dataset file size</small>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon green">
            <FileSpreadsheet size={21} />
          </div>
          <div>
            <span>CSV Datasets</span>
            <h2>{csvDatasets.length}</h2>
            <small>Available for profiling</small>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon orange">
            <Activity size={21} />
          </div>
          <div>
            <span>Processed Datasets</span>
            <h2>{processedCount}</h2>
            <small>Cleaning, ETL or Spark completed</small>
          </div>
        </div>
      </div>

      {/* CHARTS */}

      <div className="analytics-chart-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>File Type Distribution</h3>
              <p>Dataset formats in your workspace</p>
            </div>
            <FileSpreadsheet size={19} />
          </div>

          {fileTypeData.length > 0 ? (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={55}
                    paddingAngle={4}
                  >
                    {fileTypeData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={[
                          "#8b7cf6",
                          "#36a2eb",
                          "#35c99a",
                          "#f2a65a",
                          "#e879a5",
                        ][index % 5]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-empty">
              No dataset information available.
            </div>
          )}
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Processing Status</h3>
              <p>Current status of your datasets</p>
            </div>
            <BarChart3 size={19} />
          </div>

          {statusData.length > 0 ? (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusData}
                  margin={{ top: 15, right: 10, left: -15, bottom: 35 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#28384b"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#aab7c8", fontSize: 10 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#aab7c8", fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Datasets"
                    fill="#8b7cf6"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-empty">
              No processing information available.
            </div>
          )}
        </section>
      </div>

      {/* RECENT DATASETS */}

      <section className="analytics-panel analytics-recent">
        <div className="analytics-panel-heading">
          <div>
            <h3>Recent Datasets</h3>
            <p>Your latest uploaded and processed files</p>
          </div>
          <Database size={19} />
        </div>

        {datasets.length > 0 ? (
          <div className="analytics-table-wrapper">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {datasets.slice(0, 8).map((dataset) => (
                  <tr key={dataset.id}>
                    <td>{dataset.originalName || dataset.name}</td>
                    <td>{dataset.fileType}</td>
                    <td>{formatBytes(dataset.fileSize)}</td>
                    <td>
                      <span className="analytics-status">
                        {dataset.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      {new Date(dataset.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="analytics-empty">
            Upload a dataset to see your activity here.
          </div>
        )}
      </section>

      {/* DATA PROFILING */}

      <section className="analytics-panel analytics-profiler">
        <div className="analytics-panel-heading">
          <div>
            <h3>Dataset Profiling</h3>
            <p>Run real-time data quality analysis on a CSV dataset</p>
          </div>
          <Search size={19} />
        </div>

        <div className="analytics-profile-controls">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Select a CSV dataset</option>
            {csvDatasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.originalName}
              </option>
            ))}
          </select>

          <button
            onClick={handleProfile}
            disabled={!selectedId || loading}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="analytics-spin" />
                Profiling...
              </>
            ) : (
              <>
                <BarChart3 size={16} />
                Run Profiling
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="analytics-error">
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        {profile && (
          <div className="analytics-profile-results">
            <h4>Profiling Results: {profile.filename}</h4>

            <div className="analytics-profile-stats">
              <div>
                <span>Total Rows</span>
                <strong>{profile.total_rows}</strong>
              </div>
              <div>
                <span>Total Columns</span>
                <strong>{profile.total_columns}</strong>
              </div>
              <div>
                <span>Duplicate Rows</span>
                <strong>{profile.duplicate_rows}</strong>
              </div>
              <div>
                <span>Missing Values</span>
                <strong>
                  {profile.columns.reduce(
                    (total, column) =>
                      total + column.missing_values,
                    0
                  )}
                </strong>
              </div>
            </div>

            <h4>Column Quality</h4>

            <div className="analytics-table-wrapper">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Data Type</th>
                    <th>Missing</th>
                    <th>Unique Values</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.map((column) => (
                    <tr key={column.name}>
                      <td>{column.name}</td>
                      <td>{column.data_type}</td>
                      <td>{column.missing_values}</td>
                      <td>{column.unique_values}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Object.keys(profile.numeric_statistics || {}).length > 0 && (
              <>
                <h4>Numeric Statistics</h4>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Mean</th>
                        <th>Minimum</th>
                        <th>Maximum</th>
                        <th>Median</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(profile.numeric_statistics).map(
                        ([name, stats]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{stats.mean.toFixed(2)}</td>
                            <td>{stats.min}</td>
                            <td>{stats.max}</td>
                            <td>{stats.median}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {Object.keys(profile.categorical_statistics || {}).length > 0 && (
              <>
                <h4>Categorical Statistics</h4>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Unique Values</th>
                        <th>Top Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(profile.categorical_statistics).map(
                        ([name, stats]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{stats.unique_values}</td>
                            <td>
                              {Object.entries(stats.top_values)
                                .map(([value, count]) => `${value} (${count})`)
                                .join(", ")}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {!profile && !error && !loading && (
          <div className="analytics-empty">
            Select a CSV file and run profiling to view its actual data
            quality metrics.
          </div>
        )}
      </section>
    </div>
  );
};

export default AnalyticsPage;
