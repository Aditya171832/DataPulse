
import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  CheckCircle2,
  Clock3,
  Cloud,
  Database,
  RefreshCw,
  Server,
  WifiOff,
} from "lucide-react";

import {
  getAdminSystemHealth,
  type AdminHealthService,
  type AdminSystemHealthResponse,
} from "./adminApi";

import "./AdminDashboard.css";
import "./AdminSystemHealth.css";
// ------------------------------------------
// SERVICE DEFINITIONS
// ------------------------------------------

const serviceDefinitions = [
  {
    key: "backend",
    name: "Backend API",
    description: "Node.js / Express · Port 4000",
    icon: Server,
  },
  {
    key: "database",
    name: "PostgreSQL Database",
    description: "Prisma / PostgreSQL · Port 5433",
    icon: Database,
  },
  {
    key: "mlService",
    name: "Python ML Service",
    description: "FastAPI · Port 8000",
    icon: Activity,
  },
  {
    key: "s3",
    name: "AWS S3 Storage",
    description: "Cloud object storage · Mumbai region",
    icon: Cloud,
  },
] as const;

// ------------------------------------------
// FORMAT UPTIME
// ------------------------------------------

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return [
    days > 0 ? `${days}d` : null,
    `${hours}h`,
    `${minutes}m`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ------------------------------------------
// SERVICE CARD
// ------------------------------------------

function ServiceCard({
  name,
  description,
  service,
  icon: Icon,
}: {
  name: string;
  description: string;
  service: AdminHealthService;
  icon: typeof Server;
}) {
  const online = service.status === "ONLINE";

  return (
    <div className="admin-health-service">
      <div className="admin-health-service-top">
        <div className="admin-health-service-title">
          <Icon size={23} />

          <div>
            <h3>{name}</h3>
            <p>{description}</p>
          </div>
        </div>

        <span
          className={`admin-health-status ${
            online ? "online" : "offline"
          }`}
        >
          {online ? (
            <CheckCircle2 size={15} />
          ) : (
            <WifiOff size={15} />
          )}

          {service.status}
        </span>
      </div>

      <p className="admin-health-message">
        {service.message}
      </p>

      <div className="admin-health-response">
        <Clock3 size={15} />
        Response time: {service.responseTimeMs} ms
      </div>
    </div>
  );
}

// ------------------------------------------
// SYSTEM HEALTH PAGE
// ------------------------------------------

export default function AdminSystemHealth() {
  const [health, setHealth] =
    useState<AdminSystemHealthResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // ------------------------------------------
  // FETCH SYSTEM HEALTH
  // ------------------------------------------

  const loadHealth = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const response = await getAdminSystemHealth();
        setHealth(response);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to retrieve system health."
        );
        setHealth(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadHealth(true);
  }, [loadHealth]);

  // ------------------------------------------
  // COMPONENT
  // ------------------------------------------

  return (
    <section className="admin-panel">
      <div className="admin-workspace-heading">
        <div>
          <h2>System Health Monitoring</h2>

          <p>
            Monitor DataPulse backend, database,
            machine learning, and cloud services.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh"
          onClick={() => void loadHealth()}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} />
          {refreshing ? "Checking..." : "Refresh"}
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <p>Checking system services...</p>
      ) : health ? (
        <>
          {/* SYSTEM SUMMARY */}

          <div className="admin-health-overview">
            <div className="admin-health-summary">
              <span>Overall System Status</span>

              <h2
                className={
                  health.overallStatus === "HEALTHY"
                    ? "admin-health-good"
                    : "admin-health-bad"
                }
              >
                {health.overallStatus === "HEALTHY" ? (
                  <CheckCircle2 size={25} />
                ) : (
                  <WifiOff size={25} />
                )}

                {health.overallStatus}
              </h2>
            </div>

            <div className="admin-health-summary">
              <span>Online Services</span>

              <h2>
                {health.onlineServices} /{" "}
                {health.totalServices}
              </h2>
            </div>

            <div className="admin-health-summary">
              <span>Offline Services</span>

              <h2>{health.offlineServices}</h2>
            </div>

            <div className="admin-health-summary">
              <span>Backend Uptime</span>

              <h2>
                {formatUptime(health.uptimeSeconds)}
              </h2>
            </div>
          </div>

          {/* SERVICE CARDS */}

          <div className="admin-health-grid">
            {serviceDefinitions.map((definition) => {
              const service =
                health.services[definition.key];

              return (
                <ServiceCard
                  key={definition.key}
                  name={definition.name}
                  description={definition.description}
                  service={service}
                  icon={definition.icon}
                />
              );
            })}
          </div>

          {/* LAST UPDATED */}

          <p className="admin-health-updated">
            Last checked:{" "}
            {new Date(health.timestamp).toLocaleString()}
          </p>
        </>
      ) : (
        <p>No system health data available.</p>
      )}
    </section>
  );
}
