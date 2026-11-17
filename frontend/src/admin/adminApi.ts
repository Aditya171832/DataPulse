
import axios from "axios";

const adminApi = axios.create({
  baseURL: "http://localhost:4000/api/admin",
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("datapulse_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminUsersResponse {
  success: boolean;
  message: string;
  totalUsers: number;
  users: AdminUser[];
}

export interface AdminUserResponse {
  success: boolean;
  message: string;
  user: AdminUser;
}

export const getAdminUsers =
  async (): Promise<AdminUsersResponse> => {
    const response =
      await adminApi.get<AdminUsersResponse>("/users");

    return response.data;
  };

export const getAdminUserById = async (
  id: string
): Promise<AdminUserResponse> => {
  const response =
    await adminApi.get<AdminUserResponse>(
      `/users/${encodeURIComponent(id)}`
    );

  return response.data;
};

export const updateAdminUserRole = async (
  id: string,
  role: "USER" | "OWNER" | "ADMIN"
): Promise<AdminUserResponse> => {
  const response =
    await adminApi.put<AdminUserResponse>(
      `/users/${encodeURIComponent(id)}/role`,
      { role }
    );

  return response.data;
};

export default adminApi;

/* ------------------------------------------
   ADMIN WORKSPACE MANAGEMENT
------------------------------------------ */

export interface AdminWorkspace {
  id: string;
  name: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  memberCount: number;
  datasetCount: number;
  supportTicketCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWorkspacesResponse {
  success: boolean;
  message: string;
  totalWorkspaces: number;
  workspaces: AdminWorkspace[];
}

export const getAdminWorkspaces =
  async (): Promise<AdminWorkspacesResponse> => {
    const response =
      await adminApi.get<AdminWorkspacesResponse>(
        "/workspaces"
      );

    return response.data;
  };

/* ------------------------------------------
   ADMIN DATASET MANAGEMENT
------------------------------------------ */

export interface AdminDataset {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDatasetsResponse {
  success: boolean;
  message: string;
  totalDatasets: number;
  totalStorageBytes: number;
  processedDatasets: number;
  datasets: AdminDataset[];
}

export const getAdminDatasets =
  async (): Promise<AdminDatasetsResponse> => {
    const response =
      await adminApi.get<AdminDatasetsResponse>(
        "/datasets"
      );

    return response.data;
  };

/* ------------------------------------------
   ADMIN SUPPORT TICKET MANAGEMENT
------------------------------------------ */

export type AdminTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export interface AdminSupportTicket {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
  };
}

export interface AdminSupportTicketsResponse {
  success: boolean;
  message: string;
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  tickets: AdminSupportTicket[];
}

export interface AdminSupportTicketResponse {
  success: boolean;
  message: string;
  ticket: AdminSupportTicket;
}

export const getAdminSupportTickets =
  async (): Promise<AdminSupportTicketsResponse> => {
    const response =
      await adminApi.get<AdminSupportTicketsResponse>(
        "/support-tickets"
      );

    return response.data;
  };

export const updateAdminSupportTicketStatus = async (
  id: string,
  status: AdminTicketStatus
): Promise<AdminSupportTicketResponse> => {
  const response =
    await adminApi.put<AdminSupportTicketResponse>(
      `/support-tickets/${encodeURIComponent(id)}/status`,
      { status }
    );

  return response.data;
};

/* ------------------------------------------
   ADMIN SYSTEM HEALTH API
------------------------------------------ */

export type AdminServiceStatus = "ONLINE" | "OFFLINE";

export interface AdminHealthService {
  status: AdminServiceStatus;
  message: string;
  responseTimeMs: number;
}

export interface AdminSystemHealthResponse {
  success: boolean;
  message: string;
  overallStatus: "HEALTHY" | "DEGRADED";
  totalServices: number;
  onlineServices: number;
  offlineServices: number;
  uptimeSeconds: number;
  timestamp: string;
  services: {
    backend: AdminHealthService;
    database: AdminHealthService;
    mlService: AdminHealthService;
    s3: AdminHealthService;
  };
}

export const getAdminSystemHealth =
  async (): Promise<AdminSystemHealthResponse> => {
    const response =
      await adminApi.get<AdminSystemHealthResponse>(
        "/system-health"
      );

    return response.data;
  };
