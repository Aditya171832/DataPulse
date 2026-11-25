import axios from "axios";

// --------------------------------------------------
// AXIOS CONFIGURATION
// --------------------------------------------------

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

// Add authentication token and active workspace.

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("datapulse_token");

  const workspaceId = localStorage.getItem(
    "datapulse_workspace_id"
  );

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (workspaceId) {
    config.headers["x-workspace-id"] = workspaceId;
  }

  return config;
});

// --------------------------------------------------
// DATASET TYPES
// --------------------------------------------------

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

export interface DatasetsResponse {
  success: boolean;
  count: number;
  datasets: Dataset[];
}

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

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

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

// --------------------------------------------------
// DATASET MANAGEMENT
// --------------------------------------------------

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

// --------------------------------------------------
// DATA PROFILING
// --------------------------------------------------

export const profileDataset = async (id: string) => {
  const response = await api.post(
    `/datasets/${id}/profile`,
    {}
  );

  return response.data;
};

// --------------------------------------------------
// DATA CLEANING
// --------------------------------------------------

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

// --------------------------------------------------
// ETL PIPELINE
// --------------------------------------------------

export const runEtlPipeline = async (id: string) => {
  const response = await api.post(
    `/datasets/${id}/etl`,
    {}
  );

  return response.data;
};

// --------------------------------------------------
// APACHE SPARK PROCESSING
// --------------------------------------------------

export const runSparkProcessing = async (
  id: string
) => {
  const response = await api.post(
    `/datasets/${id}/spark`,
    {}
  );

  return response.data;
};

// --------------------------------------------------
// AI ANOMALY DETECTION
// --------------------------------------------------

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

// --------------------------------------------------
// DOWNLOAD DATASET
// --------------------------------------------------

export const downloadDataset = async (
  id: string
) => {
  const response = await api.get(
    `/datasets/${id}/download`,

    {
      responseType: "blob",
    }
  );

  return response.data;
};

// --------------------------------------------------
// DELETE DATASET
// --------------------------------------------------

export const deleteDataset = async (
  id: string
) => {
  const response = await api.delete(
    `/datasets/${id}`
  );

  return response.data;
};

// --------------------------------------------------
// WORKSPACE & TEAM MANAGEMENT TYPES
// --------------------------------------------------

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

// --------------------------------------------------
// GET WORKSPACES
// --------------------------------------------------

export const getWorkspaces = async (): Promise<{
  success: boolean;
  count: number;
  workspaces: Workspace[];
}> => {
  const response = await api.get(
    "/workspaces"
  );

  return response.data;
};

// --------------------------------------------------
// CREATE WORKSPACE
// --------------------------------------------------

export const createWorkspace = async (
  name: string
) => {
  const response = await api.post(
    "/workspaces",

    {
      name,
    }
  );

  return response.data;
};

// --------------------------------------------------
// GET WORKSPACE MEMBERS
// --------------------------------------------------

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

// --------------------------------------------------
// CREATE WORKSPACE INVITATION
// --------------------------------------------------

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

    {
      email,
    },

    {
      headers: {
        "x-workspace-id": workspaceId,
      },
    }
  );

  return response.data;
};

// --------------------------------------------------
// GET WORKSPACE INVITATIONS
// --------------------------------------------------

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

// --------------------------------------------------
// ACCEPT WORKSPACE INVITATION
// --------------------------------------------------

export const acceptWorkspaceInvitation = async (
  token: string
) => {
  const response = await api.post(
    "/workspaces/invitations/accept",

    {
      token,
    }
  );

  return response.data;
};

// --------------------------------------------------
// REVOKE WORKSPACE INVITATION
// --------------------------------------------------

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

// --------------------------------------------------
// ACCOUNT SETTINGS
// --------------------------------------------------

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}

// --------------------------------------------------
// GET ACCOUNT PROFILE
// --------------------------------------------------

export const getAccountProfile = async (): Promise<{
  success: boolean;
  user: AccountUser;
}> => {
  const response = await api.get(
    "/auth/me"
  );

  return response.data;
};

// --------------------------------------------------
// UPDATE ACCOUNT PROFILE
// --------------------------------------------------

export const updateAccountProfile = async (
  name: string
): Promise<{
  success: boolean;
  message: string;
  user: AccountUser;
}> => {
  const response = await api.patch(
    "/auth/profile",

    {
      name,
    }
  );

  return response.data;
};

// --------------------------------------------------
// CHANGE ACCOUNT PASSWORD
// --------------------------------------------------

export const changeAccountPassword = async (
  currentPassword: string,

  newPassword: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await api.patch(
    "/auth/password",

    {
      currentPassword,
      newPassword,
    }
  );

  return response.data;
};

// --------------------------------------------------
// HELP & SUPPORT TYPES
// --------------------------------------------------

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

// --------------------------------------------------
// CREATE SUPPORT TICKET
// --------------------------------------------------

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

// --------------------------------------------------
// GET MY SUPPORT TICKETS
// --------------------------------------------------

export const getMySupportTickets = async (): Promise<{
  success: boolean;
  count: number;
  tickets: SupportTicket[];
}> => {
  const response = await api.get(
    "/support/tickets"
  );

  return response.data;
};

// --------------------------------------------------
// GET SUPPORT TICKET BY ID
// --------------------------------------------------

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

// ==================================================
// AI DATA ASSISTANT
// ==================================================

// --------------------------------------------------
// AI CHAT CHART
// --------------------------------------------------

export interface AIChatChart {
  type: "bar";

  x_key: string;

  y_key: string;

  data: Record<
    string,
    string | number | null
  >[];
}

// --------------------------------------------------
// CHAT SESSION DATASET
// --------------------------------------------------

export interface ChatSessionDataset {
  id: string;

  name: string;

  originalName: string;

  fileType?: string;

  fileSize?: number;
}

// --------------------------------------------------
// CHAT MESSAGE
// --------------------------------------------------

export interface ChatMessage {
  id: string;

  sessionId: string;

  role: "USER" | "ASSISTANT";

  content: string;

  queryPlan: Record<string, unknown> | null;

  result: unknown;

  chart: AIChatChart | null;

  createdAt: string;
}

// --------------------------------------------------
// CHAT SESSION
// --------------------------------------------------

export interface ChatSession {
  id: string;

  title: string;

  userId?: string;

  workspaceId?: string;

  datasetId: string | null;

  dataset?: ChatSessionDataset | null;

  createdAt: string;

  updatedAt: string;

  _count: {
    messages: number;
  };

  messages?: ChatMessage[];
}

// --------------------------------------------------
// AI CHAT RESPONSE
// --------------------------------------------------

export interface AIChatResponse {
  success: boolean;

  message: string;

  sessionId: string;

  session: ChatSession;

  userMessageId: string;

  assistantMessageId: string;

  dataset: {
    id: string;

    name: string;

    originalName: string;

    fileType: string;

    fileSize: number;
  };

  question: string;

  answer: string;

  query_plan: Record<string, unknown>;

  result: unknown;

  chart: AIChatChart | null;
}

// --------------------------------------------------
// CHAT SESSIONS LIST RESPONSE
// --------------------------------------------------

export interface ChatSessionsResponse {
  success: boolean;

  count: number;

  total: number;

  page: number;

  limit: number;

  totalPages: number;

  sessions: ChatSession[];
}

// --------------------------------------------------
// SINGLE CHAT SESSION RESPONSE
// --------------------------------------------------

export interface ChatSessionResponse {
  success: boolean;

  message?: string;

  session: ChatSession;

  hasOlderMessages?: boolean;
}

// --------------------------------------------------
// RENAME CHAT SESSION RESPONSE
// --------------------------------------------------

export interface RenameChatSessionResponse {
  success: boolean;

  message: string;

  session: {
    id: string;

    title: string;
  };
}

// --------------------------------------------------
// DELETE CHAT SESSION RESPONSE
// --------------------------------------------------

export interface DeleteChatSessionResponse {
  success: boolean;

  message: string;
}

// --------------------------------------------------
// CHAT WITH DATASET
// --------------------------------------------------

export const chatWithDataset = async (
  datasetId: string,

  question: string,

  signal?: AbortSignal,

  sessionId?: string

): Promise<AIChatResponse> => {
  const response = await api.post<AIChatResponse>(
    "/ai/chat",

    {
      datasetId,

      question,

      ...(sessionId ? { sessionId } : {}),
    },

    {
      timeout: 200000,

      signal,
    }
  );

  return response.data;
};

// --------------------------------------------------
// CREATE NEW CHAT SESSION
// --------------------------------------------------

export const createChatSession = async (
  datasetId: string,

  title?: string

): Promise<ChatSessionResponse> => {
  const response = await api.post<ChatSessionResponse>(
    "/ai/sessions",

    {
      datasetId,

      ...(title ? { title } : {}),
    }
  );

  return response.data;
};

// --------------------------------------------------
// GET CHAT SESSIONS
// --------------------------------------------------

export const getChatSessions = async (
  page = 1,

  limit = 30,

  signal?: AbortSignal

): Promise<ChatSessionsResponse> => {
  const response = await api.get<ChatSessionsResponse>(
    "/ai/sessions",

    {
      params: {
        page,

        limit,
      },

      signal,
    }
  );

  return response.data;
};

// --------------------------------------------------
// GET CHAT SESSION BY ID
// --------------------------------------------------

export const getChatSessionById = async (
  sessionId: string,

  signal?: AbortSignal

): Promise<ChatSessionResponse> => {
  const response = await api.get<ChatSessionResponse>(
    `/ai/sessions/${encodeURIComponent(sessionId)}`,

    {
      signal,
    }
  );

  return response.data;
};

// --------------------------------------------------
// RENAME CHAT SESSION
// --------------------------------------------------

export const renameChatSession = async (
  sessionId: string,

  title: string

): Promise<RenameChatSessionResponse> => {
  const response =
    await api.patch<RenameChatSessionResponse>(

      `/ai/sessions/${encodeURIComponent(sessionId)}`,

      {
        title,
      }
    );

  return response.data;
};

// --------------------------------------------------
// DELETE CHAT SESSION
// --------------------------------------------------

export const deleteChatSession = async (
  sessionId: string

): Promise<DeleteChatSessionResponse> => {
  const response =
    await api.delete<DeleteChatSessionResponse>(

      `/ai/sessions/${encodeURIComponent(sessionId)}`
    );

  return response.data;
};

// --------------------------------------------------
// EXPORT AXIOS INSTANCE
// --------------------------------------------------

export default api;