
import { useRef, useState } from "react";
import {
  Database,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Upload,
  Download,
  Trash2,
} from "lucide-react";

import type { Dataset } from "../api";
import {
  uploadDataset,
  downloadDataset,
  deleteDataset,
} from "../api";

interface DatasetsProps {
  datasets: Dataset[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}

function readableStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DatasetsPage({
  datasets,
  loading,
  error,
  onRetry,
}: DatasetsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploadMessage("");
    setUploadError("");

    const allowedExtensions = [".csv", ".xlsx", ".xls", ".json"];
    const extension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setUploadError(
        "Invalid file type. Please upload CSV, XLSX, XLS or JSON."
      );
      event.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File size cannot exceed 20 MB.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

      await uploadDataset(file);

      setUploadMessage(`${file.name} uploaded successfully.`);
      event.target.value = "";

      onRetry();
    } catch (err) {
      const uploadErr = err as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
        };
        message?: string;
      };

      setUploadError(
        uploadErr.response?.data?.message ||
          uploadErr.response?.data?.error ||
          uploadErr.message ||
          "Dataset upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (
    id: string,
    filename: string
  ) => {
    try {
      setDownloadError("");
      setDownloadingId(id);

      const blob = await downloadDataset(id);

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename || "datapulse-dataset.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      const downloadErr = err as {
        response?: {
          data?: {
            message?: string;
          };
        };
        message?: string;
      };

      setDownloadError(
        downloadErr.response?.data?.message ||
          downloadErr.message ||
          "Could not download the dataset."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (
    id: string,
    filename: string
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${filename}"?\n\nThis will remove the dataset from DataPulse and AWS S3.`
    );

    if (!confirmed) return;

    try {
      setDeleteMessage("");
      setDeleteError("");
      setDeletingId(id);

      await deleteDataset(id);

      setDeleteMessage(`${filename} deleted successfully.`);
      onRetry();
    } catch (err) {
      const deleteErr = err as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
        };
        message?: string;
      };

      setDeleteError(
        deleteErr.response?.data?.message ||
          deleteErr.response?.data?.error ||
          deleteErr.message ||
          "Could not delete the dataset."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-content">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            DATA MANAGEMENT
          </div>

          <h2>Datasets</h2>

          <p>
            View and manage datasets uploaded to your DataPulse platform.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={17} />
            {uploading ? "Uploading..." : "Upload Dataset"}
          </button>

          <button
            className="primary-button"
            onClick={onRetry}
            disabled={loading}
          >
            <RefreshCw size={17} />
            Refresh datasets
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleUpload}
            style={{ display: "none" }}
          />
        </div>
      </section>

      {uploading && (
        <div className="backend-error" role="status">
          Uploading dataset to DataPulse and AWS S3...
        </div>
      )}

      {uploadMessage && (
        <div className="backend-success" role="status">
          {uploadMessage}
        </div>
      )}

      {uploadError && (
        <div className="backend-error" role="alert">
          {uploadError}
        </div>
      )}

      {downloadError && (
        <div className="backend-error" role="alert">
          {downloadError}
        </div>
      )}

      {deleteMessage && (
        <div className="backend-success" role="status">
          {deleteMessage}
        </div>
      )}

      {deleteError && (
        <div className="backend-error" role="alert">
          {deleteError}
        </div>
      )}

      {error && (
        <div className="backend-error" role="alert">
          <span>{error}</span>
          <button onClick={onRetry}>Retry</button>
        </div>
      )}

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon teal">
              <Database size={20} />
            </div>

            <span className="stat-label">TOTAL DATASETS</span>
          </div>

          <div className="stat-number">{datasets.length}</div>

          <div className="stat-foot">
            <span className="stat-neutral">
              Available in your account
            </span>
          </div>
        </div>
      </section>

      <section className="panel dataset-panel">
        <div className="panel-header">
          <div>
            <h3>All datasets</h3>
            <p>Your uploaded and processed files</p>
          </div>

          <span className="chart-tag">
            {datasets.length} FILES
          </span>
        </div>

        <div className="dataset-table">
          <div
            className="table-row table-heading"
            style={{
              gridTemplateColumns:
                "minmax(180px, 2fr) 0.7fr 1fr 0.8fr 1.8fr",
            }}
          >
            <span>DATASET NAME</span>
            <span>TYPE</span>
            <span>STATUS</span>
            <span>SIZE</span>
            <span>ACTIONS</span>
          </div>

          {loading && (
            <div className="dataset-empty">
              Loading your datasets...
            </div>
          )}

          {!loading && datasets.length === 0 && (
            <div className="dataset-empty">
              {error
                ? "Could not load datasets."
                : "No datasets uploaded yet."}
            </div>
          )}

          {!loading &&
            datasets.map((dataset) => {
              const completed = [
                "CLEANED",
                "ETL_COMPLETED",
                "SPARK_COMPLETED",
              ].includes(dataset.status);

              const filename =
                dataset.originalName || dataset.name;

              return (
                <div
                  className="table-row"
                  key={dataset.id}
                  style={{
                    gridTemplateColumns:
                      "minmax(180px, 2fr) 0.7fr 1fr 0.8fr 1.8fr",
                  }}
                >
                  <div className="dataset-name">
                    <div className="file-icon">
                      <FileSpreadsheet size={17} />
                    </div>

                    <div>
                      <strong>{filename}</strong>

                      <small>
                        {new Date(dataset.createdAt).toLocaleString()}
                      </small>
                    </div>
                  </div>

                  <span className="file-type">
                    {dataset.fileType.toUpperCase()}
                  </span>

                  <span>
                    <span
                      className={`status-pill ${
                        completed ? "success" : ""
                      }`}
                    >
                      {completed && <ShieldCheck size={12} />}
                      {readableStatus(dataset.status)}
                    </span>
                  </span>

                  <strong className="row-count">
                    {dataset.fileSize
                      ? `${(dataset.fileSize / 1024).toFixed(1)} KB`
                      : "—"}
                  </strong>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="primary-button"
                      style={{
                        padding: "8px 12px",
                        fontSize: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        width: "fit-content",
                      }}
                      disabled={
                        downloadingId === dataset.id ||
                        deletingId === dataset.id
                      }
                      onClick={() =>
                        void handleDownload(dataset.id, filename)
                      }
                    >
                      <Download size={14} />
                      {downloadingId === dataset.id
                        ? "Downloading..."
                        : "Download"}
                    </button>

                    <button
                      className="primary-button"
                      style={{
                        padding: "8px 12px",
                        fontSize: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        width: "fit-content",
                        background: "#dc2626",
                      }}
                      disabled={
                        deletingId === dataset.id ||
                        downloadingId === dataset.id
                      }
                      onClick={() =>
                        void handleDelete(dataset.id, filename)
                      }
                    >
                      <Trash2 size={14} />
                      {deletingId === dataset.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      <footer className="page-footer">
        <span>
          DataPulse · Intelligent Data Engineering Platform
        </span>

        <span>
          Dataset information retrieved from backend
        </span>
      </footer>
    </div>
  );
}
