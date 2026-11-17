
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import {
  getWorkspaces,
  createWorkspace,
  getWorkspaceMembers,
  getWorkspaceInvitations,
  createWorkspaceInvitation,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceInvitation,
} from "../api";

import "./Team.css";

interface TeamProps {
  onWorkspaceChange?: () => void;
}

function errorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    err.response?.data?.message ||
    err.message ||
    "Something went wrong."
  );
}

export default function Team({
  onWorkspaceChange,
}: TeamProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState(
    localStorage.getItem("datapulse_workspace_id") || ""
  );

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<
    WorkspaceInvitation[]
  >([]);

  const [newWorkspace, setNewWorkspace] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [acceptToken, setAcceptToken] = useState(
    () => new URLSearchParams(window.location.search).get("invite") || ""
  );

  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedWorkspace = workspaces.find(
    (workspace) => workspace.id === workspaceId
  );

  const isOwner = selectedWorkspace?.role === "OWNER";

  const loadWorkspaces = useCallback(async () => {
    const result = await getWorkspaces();
    setWorkspaces(result.workspaces);

    const saved = localStorage.getItem(
      "datapulse_workspace_id"
    );

    const valid = result.workspaces.some(
      (workspace) => workspace.id === saved
    );

    const nextId = valid
      ? saved!
      : result.workspaces[0]?.id || "";

    setWorkspaceId(nextId);

    if (nextId) {
      localStorage.setItem(
        "datapulse_workspace_id",
        nextId
      );
    } else {
      localStorage.removeItem("datapulse_workspace_id");
    }

    if (nextId !== saved) {
      onWorkspaceChange?.();
    }
  }, [onWorkspaceChange]);

  const loadTeam = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      setInvitations([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const memberResult = await getWorkspaceMembers(
        workspaceId
      );
      setMembers(memberResult.members);

      const workspace = workspaces.find(
        (item) => item.id === workspaceId
      );

      if (workspace?.role === "OWNER") {
        const invitationResult =
          await getWorkspaceInvitations(workspaceId);
        setInvitations(invitationResult.invitations);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspaces]);

  useEffect(() => {
    void loadWorkspaces().catch((err) => {
      setError(errorMessage(err));
    });
  }, [loadWorkspaces]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  function switchWorkspace(id: string) {
    localStorage.setItem("datapulse_workspace_id", id);
    setWorkspaceId(id);
    setInviteLink("");
    setMessage("");
    onWorkspaceChange?.();
  }

  async function handleCreateWorkspace(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!newWorkspace.trim()) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await createWorkspace(
        newWorkspace.trim()
      );

      setNewWorkspace("");
      await loadWorkspaces();

      if (result.workspace?.id) {
        switchWorkspace(result.workspace.id);
      }

      setMessage("Workspace created successfully.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!workspaceId || !inviteEmail.trim()) return;

    setBusy(true);
    setError("");
    setMessage("");
    setInviteLink("");

    try {
      const result = await createWorkspaceInvitation(
        workspaceId,
        inviteEmail.trim()
      );

      const url = new URL(window.location.href);
      url.searchParams.set("invite", result.token);

      setInviteLink(url.toString());
      setInviteEmail("");
      setMessage(
        "Invitation created. Copy the link and share it securely."
      );

      await loadTeam();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!window.confirm("Revoke this invitation?")) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await revokeWorkspaceInvitation(
        workspaceId,
        invitationId
      );

      setInviteLink("");
      setMessage("Invitation revoked successfully.");
      await loadTeam();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!acceptToken.trim()) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await acceptWorkspaceInvitation(
        acceptToken.trim()
      );

      setAcceptToken("");

      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());

      await loadWorkspaces();

      if (result.workspaceId) {
        switchWorkspace(result.workspaceId);
      }

      setMessage("Invitation accepted successfully.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setError("Unable to copy automatically. Copy the link manually.");
    }
  }

  return (
    <div className="team-page">
      <div className="team-heading">
        <div>
          <span className="team-eyebrow">
            WORKSPACE COLLABORATION
          </span>
          <h2>Team Management</h2>
          <p>
            Manage workspaces, members and invitations.
          </p>
        </div>

        <button
          className="team-button"
          onClick={() => void loadTeam()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="team-alert team-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="team-alert team-success">
          <Check size={16} />
          {message}
        </div>
      )}

      <div className="team-grid">
        <section className="team-panel">
          <h3>Active Workspace</h3>
          <p>Select the workspace you want to manage.</p>

          <select
            className="team-input"
            value={workspaceId}
            onChange={(event) =>
              switchWorkspace(event.target.value)
            }
          >
            {workspaces.length === 0 && (
              <option value="">No workspaces</option>
            )}

            {workspaces.map((workspace) => (
              <option
                key={workspace.id}
                value={workspace.id}
              >
                {workspace.name}
              </option>
            ))}
          </select>

          {selectedWorkspace && (
            <div className="team-workspace-details">
              <span>
                Role: <strong>{selectedWorkspace.role}</strong>
              </span>
              <span>
                Datasets:{" "}
                <strong>
                  {selectedWorkspace._count.datasets}
                </strong>
              </span>
              <span>
                Members:{" "}
                <strong>
                  {selectedWorkspace._count.members}
                </strong>
              </span>
            </div>
          )}
        </section>

        <section className="team-panel">
          <h3>Create Workspace</h3>
          <p>Create another workspace for your projects.</p>

          <form onSubmit={handleCreateWorkspace}>
            <input
              className="team-input"
              value={newWorkspace}
              onChange={(event) =>
                setNewWorkspace(event.target.value)
              }
              placeholder="Workspace name"
              minLength={2}
              maxLength={100}
              required
            />

            <button
              className="team-button team-primary"
              type="submit"
              disabled={busy}
            >
              <Plus size={16} />
              Create Workspace
            </button>
          </form>
        </section>
      </div>

      <section className="team-panel">
        <div className="team-section-heading">
          <div>
            <h3>
              <Users size={19} /> Workspace Members
            </h3>
            <p>Users with access to this workspace.</p>
          </div>
          <span className="team-count">{members.length} members</span>
        </div>

        {loading ? (
          <p>Loading members...</p>
        ) : members.length === 0 ? (
          <p>No members found.</p>
        ) : (
          <div className="team-table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.user.name}</td>
                    <td>{member.user.email}</td>
                    <td>
                      <span className="team-role">
                        {member.role}
                      </span>
                    </td>
                    <td>
                      {new Date(
                        member.joinedAt
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isOwner && (
        <div className="team-grid">
          <section className="team-panel">
            <h3>
              <Mail size={19} /> Invite Team Member
            </h3>
            <p>
              Generate an invitation link for another user.
            </p>

            <form onSubmit={handleInvite}>
              <input
                className="team-input"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(event) =>
                  setInviteEmail(event.target.value)
                }
                required
              />

              <button
                className="team-button team-primary"
                type="submit"
                disabled={busy}
              >
                <Plus size={16} />
                Generate Invitation
              </button>
            </form>

            {inviteLink && (
              <div className="team-link-box">
                <label>Invitation link</label>
                <input
                  className="team-input"
                  readOnly
                  value={inviteLink}
                />

                <button
                  className="team-button"
                  type="button"
                  onClick={() => void copyLink()}
                >
                  {copied ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
            )}
          </section>

          <section className="team-panel">
            <h3>Pending Invitations</h3>
            <p>Invitations awaiting acceptance.</p>

            {invitations.length === 0 ? (
              <p>No pending invitations.</p>
            ) : (
              <div className="team-invitation-list">
                {invitations.map((invitation) => (
                  <div
                    className="team-invitation"
                    key={invitation.id}
                  >
                    <div>
                      <strong>{invitation.email}</strong>
                      <small>
                        Expires{" "}
                        {new Date(
                          invitation.expiresAt
                        ).toLocaleDateString()}
                      </small>
                    </div>

                    <button
                      className="team-icon-button"
                      title="Revoke invitation"
                      aria-label={`Revoke invitation for ${invitation.email}`}
                      disabled={busy}
                      onClick={() =>
                        void handleRevoke(invitation.id)
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <section className="team-panel">
        <h3>Accept Invitation</h3>
        <p>
          Paste an invitation token or open an invitation link
          while signed in with the invited email address.
        </p>

        <form onSubmit={handleAccept}>
          <input
            className="team-input"
            value={acceptToken}
            onChange={(event) =>
              setAcceptToken(event.target.value)
            }
            placeholder="Invitation token"
            required
          />

          <button
            className="team-button team-primary"
            type="submit"
            disabled={busy}
          >
            <Check size={16} />
            Accept Invitation
          </button>
        </form>
      </section>
    </div>
  );
}
