import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  Cloud,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDatasets, type Dataset } from "./api";
import Login from "./Login";
import DatasetsPage from "./pages/Datasets";
import DataToolsPage from "./pages/DataTools";
import AnalyticsPage from "./pages/Analytics";
import TeamPage from "./pages/Team";
import SettingsPage from "./pages/Settings";
import HelpSupportPage from "./pages/HelpSupport";
import AIAssistant from "./pages/AIAssistant";
import "./App.css";
import AdminDashboard from "./admin/AdminDashboard";

interface AppUser {
  id?: string;
  name: string;
  email: string;
  role: string;
}

const departmentData = [
  { name: "IT", value: 4 },
  { name: "HR", value: 3 },
  { name: "Finance", value: 3 },
];

const salaryData = [
  { name: "Rahul", salary: 38000 },
  { name: "Priya", salary: 42000 },
  { name: "Aditya", salary: 45000 },
  { name: "Sneha", salary: 48000 },
  { name: "Amit", salary: 500000 },
];

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Datasets", icon: Database },
  { label: "Data Profiling", icon: FileSpreadsheet },
  { label: "Data Cleaning", icon: Sparkles },
  { label: "ETL Pipeline", icon: Zap },
  { label: "AI Insights", icon: Activity },
  { label: "AI Assistant", icon: Sparkles },
];

const tools = [
  { label: "Analytics", icon: BarChart3 },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings },
];

type ToolPage =
  | "Data Profiling"
  | "Data Cleaning"
  | "ETL Pipeline"
  | "AI Insights";

function getSavedUser(): AppUser | null {
  const saved = localStorage.getItem("datapulse_user");

  if (!saved) return null;

  try {
    return JSON.parse(saved) as AppUser;
  } catch {
    localStorage.removeItem("datapulse_user");
    return null;
  }
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "DP"
  );
}

function readableStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function App() {
  const [activePage, setActivePage] = useState("Overview");

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("datapulse_token")
  );

  const [user, setUser] = useState<AppUser | null>(getSavedUser);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState("");

  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    setDatasetsError("");

    try {
      const response = await getDatasets();
      setDatasets(response.datasets || []);
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number;
          data?: { message?: string };
        };
        message?: string;
      };

      if (err.response?.status === 401) {
        localStorage.removeItem("datapulse_token");
        localStorage.removeItem("datapulse_user");
        localStorage.removeItem("datapulse_workspace_id");

        setToken(null);
        setUser(null);
        setDatasets([]);
        setDatasetsError(
          "Your session expired. Please sign in again."
        );
      } else {
        setDatasetsError(
          err.response?.data?.message ||
            err.message ||
            "Could not load datasets from the backend."
        );
      }
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && user?.role !== "ADMIN") {
      void loadDatasets();
    }
  }, [token, user?.role, loadDatasets]);

  const handleLogin = (
    newToken: string,
    newUser: AppUser
  ) => {
    setToken(newToken);
    setUser(newUser);
    setActivePage("Overview");
  };

  const handleLogout = () => {
    localStorage.removeItem("datapulse_token");
    localStorage.removeItem("datapulse_user");
    localStorage.removeItem("datapulse_workspace_id");

    setToken(null);
    setUser(null);
    setDatasets([]);
    setDatasetsError("");
    setActivePage("Overview");
  };

  const handleProfileUpdated = (updatedUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  }) => {
    setUser(updatedUser);
    localStorage.setItem("datapulse_user", JSON.stringify(updatedUser));
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  if (user?.role === "ADMIN") {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  const displayName = user?.name || "Workspace User";
  const initials = getInitials(displayName);
  const recentDatasets = datasets.slice(0, 2);

  const isToolPage = (
    page: string
  ): page is ToolPage => {
    return [
      "Data Profiling",
      "Data Cleaning",
      "ETL Pipeline",
      "AI Insights",
    ].includes(page);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={23} />
          </div>

          <div>
            <h1>DataNexus</h1>
            <span>DATA INTELLIGENCE</span>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">DP</div>

          <div className="workspace-info">
            <strong>My Workspace</strong>
            <span>Connected account</span>
          </div>

          <ChevronDown size={16} />
        </div>

        <div className="nav-section">
          <p className="nav-heading">WORKSPACE</p>

          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => setActivePage(item.label)}
              >
                <Icon size={18} />

                <span>{item.label}</span>

                {(item.label === "AI Insights" || item.label === "AI Assistant") && (
                  <span className="nav-new">AI</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="nav-section tools-section">
          <p className="nav-heading">PREFERENCES</p>

          {tools.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => setActivePage(item.label)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <div className="storage-card">
            <div className="storage-title">
              <Cloud size={17} />
              <span>Storage usage</span>
            </div>

            <div className="storage-value">
              <strong>0.8 GB</strong>
              <span>of 5 GB</span>
            </div>

            <div className="storage-track">
              <div className="storage-progress" />
            </div>

            <p>16% of your storage used</p>
          </div>

          <button
            className="nav-item help-item"
            onClick={() => setActivePage("Help")}
          >
            <CircleHelp size={18} />
            <span>Help &amp; Support</span>
          </button>

          <div className="user-profile">
            <div className="user-avatar">{initials}</div>

            <div className="user-info">
              <strong>{displayName}</strong>
              <span>{user?.role || "User"}</span>
            </div>

            <button
              className="logout-button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input placeholder="Search anything..." />
              <kbd>Ctrl K</kbd>
            </div>

            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            <div className="top-avatar">{initials}</div>
          </div>
        </header>

        {/* DATASETS PAGE */}

        {activePage === "Datasets" ? (
          <DatasetsPage
            datasets={datasets}
            loading={datasetsLoading}
            error={datasetsError}
            onRetry={() => void loadDatasets()}
          />

        /* ANALYTICS PAGE */

        ) : activePage === "Analytics" ? (
          <AnalyticsPage datasets={datasets} />

        /* TEAM MANAGEMENT PAGE */

        ) : activePage === "Team" ? (
          <TeamPage onWorkspaceChange={() => void loadDatasets()} />

        /* ACCOUNT SETTINGS PAGE */

        ) : activePage === "Settings" ? (
          <SettingsPage onProfileUpdated={handleProfileUpdated} />

        /* HELP & SUPPORT PAGE */

        ) : activePage === "Help" ? (
          <HelpSupportPage />

        /* AI DATA ASSISTANT PAGE */

        ) : activePage === "AI Assistant" ? (
          <AIAssistant
            key={localStorage.getItem("datapulse_workspace_id") || "default-workspace"}
            datasets={datasets}
            loading={datasetsLoading}
            error={datasetsError}
            onRetry={() => void loadDatasets()}
          />

        /* FOUR DATA PROCESSING PAGES */

        ) : isToolPage(activePage) ? (
          <DataToolsPage
            page={activePage}
            datasets={datasets}
            onDatasetCreated={() => void loadDatasets()}
          />

        /* OTHER PLACEHOLDER PAGES */

        ) : activePage !== "Overview" ? (
          <div className="page-content">
            <section
              className="panel"
              style={{ padding: "32px" }}
            >
              <h2>{activePage}</h2>

              <p>
                This section is being developed. Your DataPulse
                workspace is ready for the next feature.
              </p>
            </section>
          </div>

        /* OVERVIEW DASHBOARD */

        ) : (
          <div className="page-content">
            <section className="welcome-row">
              <div>
                <div className="eyebrow">
                  <span className="live-dot" />
                  DATA PLATFORM OVERVIEW
                </div>

                <h2>
                  Good morning, {displayName.split(" ")[0]}!
                </h2>

                <p>
                  Monitor your data, discover insights and manage
                  your pipelines.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => setActivePage("Datasets")}
              >
                <Upload size={17} />
                Explore datasets
              </button>
            </section>

            {datasetsError && (
              <div className="backend-error" role="alert">
                <AlertTriangle size={16} />

                <span>{datasetsError}</span>

                <button onClick={() => void loadDatasets()}>
                  Retry
                </button>
              </div>
            )}

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon teal">
                    <Database size={20} />
                  </div>

                  <span className="stat-label">
                    TOTAL DATASETS
                  </span>
                </div>

                <div className="stat-number">
                  {datasetsLoading ? "..." : datasets.length}
                </div>

                <div className="stat-foot">
                  <span className="stat-neutral">
                    From your account
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon blue">
                    <FileSpreadsheet size={20} />
                  </div>

                  <span className="stat-label">
                    TOTAL ROWS
                  </span>
                </div>

                <div className="stat-number">10</div>

                <div className="stat-foot">
                  <span className="stat-neutral">
                    Selected sample dataset
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon purple">
                    <BarChart3 size={20} />
                  </div>

                  <span className="stat-label">
                    TOTAL COLUMNS
                  </span>
                </div>

                <div className="stat-number">4</div>

                <div className="stat-foot">
                  <span className="stat-neutral">
                    2 numeric · 2 categorical
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon orange">
                    <AlertTriangle size={20} />
                  </div>

                  <span className="stat-label">
                    ANOMALIES FOUND
                  </span>
                </div>

                <div className="stat-number">1</div>

                <div className="stat-foot">
                  <span className="stat-warning">
                    Detected by Isolation Forest
                  </span>
                </div>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel salary-panel">
                <div className="panel-header">
                  <div>
                    <h3>Salary distribution</h3>
                    <p>Employee salary comparison</p>
                  </div>

                  <span className="chart-tag">SAMPLE DATA</span>
                </div>

                <div className="chart-summary">
                  <div>
                    <span>Average salary</span>
                    <strong>{"\u20B9"}89,000</strong>
                  </div>

                  <div>
                    <span>Median salary</span>
                    <strong>{"\u20B9"}44,500</strong>
                  </div>
                </div>

                <div className="salary-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salaryData}
                      margin={{
                        top: 12,
                        right: 8,
                        left: -12,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#263747"
                      />

                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#91a2b5", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{ fill: "#91a2b5", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `${value / 1000}k`
                        }
                      />

                      <Tooltip
                        cursor={{
                          fill: "rgba(45, 212, 191, 0.06)",
                        }}
                        contentStyle={{
                          background: "#142334",
                          border: "1px solid #294052",
                          borderRadius: "10px",
                          color: "#f1f5f9",
                        }}
                        formatter={(value) => [
                          `\u20B9${Number(value).toLocaleString("en-IN")}`,
                          "Salary",
                        ]}
                      />

                      <Bar
                        dataKey="salary"
                        fill="#2dd4bf"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={44}
                      >
                        {salaryData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "Amit"
                                ? "#fb923c"
                                : "#2dd4bf"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-note">
                  <span className="legend-dot teal-dot" />
                  <span>Employee salary</span>
                  <span className="legend-dot orange-dot" />
                  <span>Detected outlier</span>
                </div>
              </div>

              <div className="panel department-panel">
                <div className="panel-header">
                  <div>
                    <h3>Department overview</h3>
                    <p>Employee distribution by department</p>
                  </div>

                  <button
                    className="more-button"
                    aria-label="Department options"
                  >
                    ...
                  </button>
                </div>

                <div className="department-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={91}
                        paddingAngle={5}
                        stroke="none"
                      >
                        <Cell fill="#2dd4bf" />
                        <Cell fill="#60a5fa" />
                        <Cell fill="#a78bfa" />
                      </Pie>

                      <Tooltip
                        contentStyle={{
                          background: "#142334",
                          border: "1px solid #294052",
                          borderRadius: "10px",
                          color: "#f1f5f9",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="donut-center">
                    <strong>10</strong>
                    <span>Employees</span>
                  </div>
                </div>

                <div className="department-legend">
                  {departmentData.map((item, index) => (
                    <div
                      className="department-legend-item"
                      key={item.name}
                    >
                      <span className={`legend-square color-${index}`} />
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                      <small>{item.value * 10}%</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel dataset-panel">
                <div className="panel-header">
                  <div>
                    <h3>Recent datasets</h3>
                    <p>Your latest data activity</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setActivePage("Datasets")}
                  >
                    View all
                  </button>
                </div>

                <div className="dataset-table">
                  <div className="table-row table-heading">
                    <span>DATASET NAME</span>
                    <span>TYPE</span>
                    <span>STATUS</span>
                    <span>SIZE</span>
                  </div>

                  {datasetsLoading && (
                    <div className="dataset-empty">
                      Loading your datasets...
                    </div>
                  )}

                  {!datasetsLoading &&
                    recentDatasets.length === 0 && (
                      <div className="dataset-empty">
                        {datasetsError
                          ? "Dataset list is unavailable."
                          : "No datasets uploaded yet."}
                      </div>
                    )}

                  {!datasetsLoading &&
                    recentDatasets.map((dataset) => (
                      <div className="table-row" key={dataset.id}>
                        <div className="dataset-name">
                          <div className="file-icon">
                            <FileSpreadsheet size={17} />
                          </div>

                          <div>
                            <strong>
                              {dataset.originalName || dataset.name}
                            </strong>

                            <small>
                              {new Date(
                                dataset.createdAt
                              ).toLocaleString()}
                            </small>
                          </div>
                        </div>

                        <span className="file-type">
                          {dataset.fileType.toUpperCase()}
                        </span>

                        <span>
                          <span
                            className={`status-pill ${
                              [
                                "CLEANED",
                                "ETL_COMPLETED",
                                "SPARK_COMPLETED",
                              ].includes(dataset.status)
                                ? "success"
                                : ""
                            }`}
                          >
                            {[
                              "CLEANED",
                              "ETL_COMPLETED",
                              "SPARK_COMPLETED",
                            ].includes(dataset.status) && (
                              <ShieldCheck size={12} />
                            )}

                            {readableStatus(dataset.status)}
                          </span>
                        </span>

                        <strong className="row-count">
                          {dataset.fileSize
                            ? `${(
                                dataset.fileSize / 1024
                              ).toFixed(1)} KB`
                            : "—"}
                        </strong>
                      </div>
                    ))}
                </div>
              </div>

              <div className="panel insight-panel">
                <div className="panel-header">
                  <div>
                    <h3>AI insights</h3>
                    <p>Automated data observations</p>
                  </div>

                  <div className="ai-icon">
                    <Sparkles size={17} />
                  </div>
                </div>

                <div className="insight-item">
                  <div className="insight-symbol warning-symbol">
                    <AlertTriangle size={17} />
                  </div>

                  <div>
                    <strong>Unusual salary detected</strong>
                    <p>
                      Amit's salary of {"\u20B9"}5,00,000 was
                      flagged as an anomaly in the sample data.
                    </p>
                  </div>
                </div>

                <div className="insight-item">
                  <div className="insight-symbol trend-symbol">
                    <TrendingUp size={17} />
                  </div>

                  <div>
                    <strong>IT is the largest department</strong>
                    <p>
                      IT accounts for 40% of employees in this
                      sample dataset.
                    </p>
                  </div>
                </div>

                <div className="insight-footer">
                  <ShieldCheck size={15} />
                  <span>
                    Sample insights · Isolation Forest and Pandas
                  </span>
                </div>
              </div>
            </section>

            <footer className="page-footer">
              <span>
                DataPulse · Intelligent Data Engineering Platform
              </span>

              <span>
                Dataset list connected to backend · Charts use sample data
              </span>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
