import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

// Add authentication token and active workspace to requests.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("datapulse_token");
  const workspaceId = localStorage.getItem("datapulse_workspace_id");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (workspaceId) {
    config.headers["x-workspace-id"] = workspaceId;
  }

  return config;
});

// Dataset interface
export interface Dataset {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Dataset response
export interface DatasetsResponse {
  success: boolean;
  count: number;
  datasets: Dataset[];
}

// Cleaning options
export interface CleaningOptions {
  remove_duplicates?: boolean;
  trim_whitespace?: boolean;
  standardize_columns?: boolean;
  missing_strategy?:
    | "none"
    | "drop_rows"
    | "fill_mean"
    | "fill_median"
    | "fill_mode";
}

// Login
export const loginUser = async (
  email: string,
  password: string
) => {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  return response.data;
};

// Register new user
export const registerUser = async (
  name: string,
  email: string,
  password: string
) => {
  const response = await api.post("/auth/register", {
    name,
    email,
    password,
  });

  return response.data;
};

// Get all datasets
export const getDatasets = async (): Promise<DatasetsResponse> => {
  const response = await api.get("/datasets");
  return response.data;
};

// Upload dataset to backend and AWS S3
export const uploadDataset = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(
    "/datasets/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

// Data Profiling
export const profileDataset = async (id: string) => {
  const response = await api.post(
    `/datasets/${id}/profile`,
    {}
  );

  return response.data;
};

// Data Cleaning
export const cleanDataset = async (
  id: string,
  options: CleaningOptions = {}
) => {
  const response = await api.post(
    `/datasets/${id}/clean`,
    {},
    {
      params: options,
    }
  );

  return response.data;
};

// ETL Pipeline
export const runEtlPipeline = async (id: string) => {
  const response = await api.post(
    `/datasets/${id}/etl`,
    {}
  );

  return response.data;
};

// Apache Spark Processing
export const runSparkProcessing = async (id: string) => {
  const response = await api.post(
    `/datasets/${id}/spark`,
    {}
  );

  return response.data;
};

// AI Anomaly Detection
export const detectAnomalies = async (
  id: string,
  contamination = 0.1
) => {
  const response = await api.post(
    `/datasets/${id}/anomaly`,
    {},
    {
      params: {
        contamination,
      },
    }
  );

  return response.data;
};

// Download dataset
export const downloadDataset = async (id: string) => {
  const response = await api.get(
    `/datasets/${id}/download`,
    {
      responseType: "blob",
    }
  );

  return response.data;
};

// Delete dataset
export const deleteDataset = async (id: string) => {
  const response = await api.delete(`/datasets/${id}`);
  return response.data;
};

export default api;



//
// WORKSPACE & TEAM MANAGEMENT
//

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  role: string;
  createdAt: string;
  _count: {
    members: number;
    datasets: number;
  };
}

export interface WorkspaceMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt?: string;
}

// List workspaces
export const getWorkspaces = async (): Promise<{
  success: boolean;
  count: number;
  workspaces: Workspace[];
}> => {
  const response = await api.get("/workspaces");
  return response.data;
};

// Create workspace
export const createWorkspace = async (name: string) => {
  const response = await api.post("/workspaces", { name });
  return response.data;
};

// Get workspace members
export const getWorkspaceMembers = async (
  workspaceId: string
): Promise<{
  success: boolean;
  count: number;
  members: WorkspaceMember[];
}> => {
  const response = await api.get(
    `/workspaces/${workspaceId}/members`,
    {
      headers: {
        "x-workspace-id": workspaceId,
      },
    }
  );

  return response.data;
};

// Create invitation
export const createWorkspaceInvitation = async (
  workspaceId: string,
  email: string
): Promise<{
  success: boolean;
  message: string;
  invitation: WorkspaceInvitation;
  token: string;
}> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/invitations`,
    { email },
    {
      headers: {
        "x-workspace-id": workspaceId,
      },
    }
  );

  return response.data;
};

// Get pending invitations
export const getWorkspaceInvitations = async (
  workspaceId: string
): Promise<{
  success: boolean;
  count: number;
  invitations: WorkspaceInvitation[];
}> => {
  const response = await api.get(
    `/workspaces/${workspaceId}/invitations`,
    {
      headers: {
        "x-workspace-id": workspaceId,
      },
    }
  );

  return response.data;
};

// Accept invitation
export const acceptWorkspaceInvitation = async (
  token: string
) => {
  const response = await api.post(
    "/workspaces/invitations/accept",
    { token }
  );

  return response.data;
};

// Revoke invitation
export const revokeWorkspaceInvitation = async (
  workspaceId: string,
  invitationId: string
) => {
  const response = await api.delete(
    `/workspaces/${workspaceId}/invitations/${invitationId}`,
    {
      headers: {
        "x-workspace-id": workspaceId,
      },
    }
  );

  return response.data;
};




//
// ACCOUNT SETTINGS
//

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}

export const getAccountProfile = async (): Promise<{
  success: boolean;
  user: AccountUser;
}> => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const updateAccountProfile = async (
  name: string
): Promise<{
  success: boolean;
  message: string;
  user: AccountUser;
}> => {
  const response = await api.patch("/auth/profile", { name });
  return response.data;
};

export const changeAccountPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await api.patch("/auth/password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};





//
// HELP & SUPPORT
//

export type SupportTicketCategory =
  | "General Question"
  | "Dataset Management"
  | "Data Processing"
  | "AI Insights"
  | "Account & Workspace"
  | "Technical Issue";

export interface SupportTicket {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketInput {
  subject: string;
  category: SupportTicketCategory;
  description: string;
}

// Create a support ticket
export const createSupportTicket = async (
  input: CreateSupportTicketInput
): Promise<{
  success: boolean;
  message: string;
  ticket: SupportTicket;
}> => {
  const response = await api.post(
    "/support/tickets",
    input
  );

  return response.data;
};

// Get tickets belonging to the logged-in user
// in the active workspace.
export const getMySupportTickets = async (): Promise<{
  success: boolean;
  count: number;
  tickets: SupportTicket[];
}> => {
  const response = await api.get("/support/tickets");

  return response.data;
};

// Get a specific support ticket
export const getSupportTicketById = async (
  ticketId: string
): Promise<{
  success: boolean;
  ticket: SupportTicket;
}> => {
  const response = await api.get(
    `/support/tickets/${encodeURIComponent(ticketId)}`
  );

  return response.data;
};
