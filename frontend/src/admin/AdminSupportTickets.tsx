
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Inbox,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";

import {
  getAdminSupportTickets,
  updateAdminSupportTicketStatus,
  type AdminSupportTicket,
  type AdminTicketStatus,
} from "./adminApi";

const statuses: AdminTicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const formatStatus = (status: string): string =>
  status.replaceAll("_", " ");

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ------------------------------------------
  // FETCH SUPPORT TICKETS
  // ------------------------------------------

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await getAdminSupportTickets();
      setTickets(response.tickets);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load support tickets."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // ------------------------------------------
  // FILTER OPTIONS
  // ------------------------------------------

  const priorityOptions = useMemo(() => {
    return [
      ...new Set(tickets.map((ticket) => ticket.priority)),
    ].sort();
  }, [tickets]);

  // ------------------------------------------
  // SEARCH AND FILTER
  // ------------------------------------------

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch = [
        ticket.subject,
        ticket.category,
        ticket.description,
        ticket.user.name,
        ticket.user.email,
        ticket.workspace.name,
      ].some((value) =>
        value.toLowerCase().includes(query)
      );

      const matchesStatus =
        statusFilter === "ALL" ||
        ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "ALL" ||
        ticket.priority === priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  // ------------------------------------------
  // SELECTED TICKET
  // ------------------------------------------

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedId) ?? null;

  // ------------------------------------------
  // UPDATE TICKET STATUS
  // ------------------------------------------

  const handleStatusChange = async (
    ticket: AdminSupportTicket,
    newStatus: AdminTicketStatus
  ) => {
    if (ticket.status === newStatus) return;

    const confirmed = window.confirm(
      `Change "${ticket.subject}" from ${formatStatus(
        ticket.status
      )} to ${formatStatus(newStatus)}?`
    );

    if (!confirmed) return;

    setSavingId(ticket.id);
    setError("");
    setMessage("");

    try {
      const response = await updateAdminSupportTicketStatus(
        ticket.id,
        newStatus
      );

      setTickets((current) =>
        current.map((item) =>
          item.id === ticket.id
            ? response.ticket
            : item
        )
      );

      setMessage(
        "Support ticket status updated successfully."
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update ticket status."
      );
    } finally {
      setSavingId(null);
    }
  };

  // ------------------------------------------
  // TICKET STATISTICS
  // ------------------------------------------

  const stats = [
    {
      label: "Total Tickets",
      value: tickets.length,
      icon: Ticket,
    },
    {
      label: "Open",
      value: tickets.filter(
        (ticket) => ticket.status === "OPEN"
      ).length,
      icon: Inbox,
    },
    {
      label: "In Progress",
      value: tickets.filter(
        (ticket) => ticket.status === "IN_PROGRESS"
      ).length,
      icon: Clock3,
    },
    {
      label: "Resolved",
      value: tickets.filter(
        (ticket) => ticket.status === "RESOLVED"
      ).length,
      icon: CheckCircle2,
    },
  ];

  // ------------------------------------------
  // COMPONENT
  // ------------------------------------------

  return (
    <>
      {/* SUPPORT TICKET STATISTICS */}

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

      {/* SUPPORT TICKET MANAGEMENT */}

      <section className="admin-panel">
        <div className="admin-workspace-heading">
          <div>
            <h2>Support Ticket Management</h2>

            <p>
              Review and manage support requests
              from all DataPulse workspaces.
            </p>
          </div>

          <button
            className="admin-refresh"
            onClick={() => void loadTickets()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* ERROR AND SUCCESS MESSAGES */}

        {error && (
          <div
            className="admin-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="admin-success"
            role="status"
          >
            {message}
          </div>
        )}

        {/* SEARCH AND FILTERS */}

        <div className="admin-dataset-filters">
          <div className="admin-search">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search tickets, users or workspaces..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            className="admin-role-select"
            aria-label="Filter by ticket status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="ALL">
              All Statuses
            </option>

            {statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {formatStatus(status)}
              </option>
            ))}
          </select>

          <select
            className="admin-role-select"
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value)
            }
          >
            <option value="ALL">
              All Priorities
            </option>

            {priorityOptions.map((priority) => (
              <option
                key={priority}
                value={priority}
              >
                {priority}
              </option>
            ))}
          </select>
        </div>

        <p>
          Showing {filteredTickets.length} of{" "}
          {tickets.length} tickets
        </p>

        {/* TICKET TABLE */}

        {loading ? (
          <p>Loading support tickets...</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Submitted By</th>
                  <th>Workspace</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>
                        {ticket.subject}
                      </strong>
                    </td>

                    <td>
                      <div>
                        {ticket.user.name}
                      </div>

                      <small>
                        {ticket.user.email}
                      </small>
                    </td>

                    <td>
                      {ticket.workspace.name}
                    </td>

                    <td>
                      {ticket.category}
                    </td>

                    <td>
                      <span className="admin-user-role">
                        {ticket.priority}
                      </span>
                    </td>

                    <td>
                      <select
                        className="admin-role-select"
                        aria-label={`Status for ${ticket.subject}`}
                        value={ticket.status}
                        disabled={savingId !== null}
                        onChange={(event) =>
                          void handleStatusChange(
                            ticket,
                            event.target.value as AdminTicketStatus
                          )
                        }
                      >
                        {statuses.map((status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      {new Date(
                        ticket.createdAt
                      ).toLocaleDateString()}
                    </td>

                    <td>
                      <button
                        className="admin-refresh"
                        onClick={() =>
                          setSelectedId(
                            selectedId === ticket.id
                              ? null
                              : ticket.id
                          )
                        }
                      >
                        {selectedId === ticket.id
                          ? "Hide"
                          : "View"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      No matching support tickets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SELECTED TICKET DETAILS */}

        {selectedTicket && (
          <div className="admin-ticket-details">
            <div className="admin-workspace-heading">
              <div>
                <h3>
                  {selectedTicket.subject}
                </h3>

                <p>
                  {selectedTicket.user.name} ·{" "}
                  {selectedTicket.workspace.name}
                </p>
              </div>

              <button
                className="admin-refresh"
                onClick={() =>
                  setSelectedId(null)
                }
              >
                Close
              </button>
            </div>

            <p>
              <strong>Category:</strong>{" "}
              {selectedTicket.category}
            </p>

            <p>
              <strong>Priority:</strong>{" "}
              {selectedTicket.priority}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {formatStatus(selectedTicket.status)}
            </p>

            <p>
              <strong>Submitted By:</strong>{" "}
              {selectedTicket.user.email}
            </p>

            <h4>Description</h4>

            <p className="admin-ticket-description">
              {selectedTicket.description}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
