import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Play,
  RefreshCw,
  WandSparkles,
  Zap,
} from "lucide-react";
import {
  cleanDataset,
  detectAnomalies,
  downloadDataset,
  profileDataset,
  runEtlPipeline,
  runSparkProcessing,
  type CleaningOptions,
  type Dataset,
} from "../api";
import "./DataTools.css";

type ToolPage = "Data Profiling" | "Data Cleaning" | "ETL Pipeline" | "AI Insights";

interface Props {
  page: ToolPage;
  datasets: Dataset[];
  onDatasetCreated: () => void;
}

type ResultData = Record<string, unknown>;

const isObject = (value: unknown): value is ResultData =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const prettyValue = (value: unknown) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

function ResultPanel({ title, data }: { title: string; data: unknown }) {
  if (!isObject(data)) {
    return (
      <section className="tool-result">
        <h3>{title}</h3>
        <pre>{prettyValue(data)}</pre>
      </section>
    );
  }

  const entries = Object.entries(data);
  return (
    <section className="tool-result">
      <h3>{title}</h3>
      <div className="result-grid">
        {entries.map(([key, value]) => (
          <div className="result-item" key={key}>
            <span>{key.replaceAll("_", " ")}</span>
            <pre>{prettyValue(value)}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DataToolsPage({
  page,
  datasets,
  onDatasetCreated,
}: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [missingStrategy, setMissingStrategy] =
    useState<NonNullable<CleaningOptions["missing_strategy"]>>("fill_mean");
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [standardizeColumns, setStandardizeColumns] = useState(true);
  const [contamination, setContamination] = useState(0.1);

  const csvDatasets = datasets.filter(
    (dataset) => dataset.fileType.toUpperCase() === "CSV"
  );
  const selectedDataset = csvDatasets.find((item) => item.id === selectedId);

  const runAction = async (
    action: () => Promise<unknown>,
    createsDataset = false
  ) => {
    if (!selectedId) {
      setError("Please select a CSV dataset first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await action();
      if (!isObject(response)) {
        throw new Error("The server returned an unexpected response.");
      }
      if (response.success === false) {
        throw new Error(
          typeof response.message === "string"
            ? response.message
            : "The operation could not be completed."
        );
      }
      setResult(response);
      if (createsDataset) onDatasetCreated();
    } catch (err: unknown) {
      const issue = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        issue.response?.data?.message ||
          issue.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const blob = await downloadDataset(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "datapulse-dataset.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download the processed dataset.");
    }
  };

  const pageInfo = {
    "Data Profiling": {
      icon: BarChart3,
      eyebrow: "DATA QUALITY ANALYSIS",
      description:
        "Understand the structure, completeness, uniqueness, and statistics of your selected dataset.",
      action: "Profile dataset",
    },
    "Data Cleaning": {
      icon: WandSparkles,
      eyebrow: "DATA QUALITY IMPROVEMENT",
      description:
        "Handle missing values, remove duplicates, and standardize your CSV data.",
      action: "Clean dataset",
    },
    "ETL Pipeline": {
      icon: Zap,
      eyebrow: "EXTRACT · TRANSFORM · LOAD",
      description:
        "Run the ETL workflow or process a dataset using Apache Spark.",
      action: "Run ETL pipeline",
    },
    "AI Insights": {
      icon: Activity,
      eyebrow: "MACHINE LEARNING ANALYSIS",
      description:
        "Use Isolation Forest to identify unusual records in your numeric data.",
      action: "Detect anomalies",
    },
  }[page];

  const PageIcon = pageInfo.icon;

  const runPrimaryAction = () => {
    if (page === "Data Profiling") {
      void runAction(() => profileDataset(selectedId));
    } else if (page === "Data Cleaning") {
      void runAction(
        () =>
          cleanDataset(selectedId, {
            remove_duplicates: removeDuplicates,
            trim_whitespace: trimWhitespace,
            standardize_columns: standardizeColumns,
            missing_strategy: missingStrategy,
          }),
        true
      );
    } else if (page === "ETL Pipeline") {
      void runAction(() => runEtlPipeline(selectedId), true);
    } else {
      void runAction(() => detectAnomalies(selectedId, contamination));
    }
  };

  const analysis = isObject(result?.analysis) ? result.analysis : null;
  const createdDataset =
    (isObject(result?.cleanedDataset) && result.cleanedDataset) ||
    (isObject(result?.etlDataset) && result.etlDataset) ||
    (isObject(result?.sparkDataset) && result.sparkDataset);

  return (
    <div className="page-content tool-page">
      <section className="tool-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            {pageInfo.eyebrow}
          </div>
          <h2>{page}</h2>
          <p>{pageInfo.description}</p>
        </div>
        <div className="tool-heading-icon">
          <PageIcon size={25} />
        </div>
      </section>

      <section className="panel tool-controls">
        <div className="panel-header">
          <div>
            <h3>Select your dataset</h3>
            <p>Choose an uploaded CSV file to begin processing.</p>
          </div>
          <FileSpreadsheet size={21} className="tool-muted-icon" />
        </div>

        <label className="tool-label" htmlFor="tool-dataset">
          DATASET
        </label>
        <select
          id="tool-dataset"
          className="tool-select"
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setResult(null);
            setError("");
          }}
          disabled={loading}
        >
          <option value="">Choose a CSV dataset</option>
          {csvDatasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.originalName || dataset.name}
            </option>
          ))}
        </select>

        {csvDatasets.length === 0 && (
          <p className="tool-hint">
            No CSV datasets found. Upload a CSV from the Datasets page first.
          </p>
        )}

        {selectedDataset && (
          <div className="selected-dataset">
            <FileSpreadsheet size={17} />
            <div>
              <strong>{selectedDataset.originalName || selectedDataset.name}</strong>
              <span>
                {selectedDataset.status.replaceAll("_", " ")} ·{" "}
                {(selectedDataset.fileSize / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        )}

        {page === "Data Cleaning" && (
          <div className="tool-options">
            <h4>Cleaning options</h4>
            <label>
              <input
                type="checkbox"
                checked={removeDuplicates}
                onChange={(event) => setRemoveDuplicates(event.target.checked)}
              />
              Remove duplicate rows
            </label>
            <label>
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(event) => setTrimWhitespace(event.target.checked)}
              />
              Trim whitespace
            </label>
            <label>
              <input
                type="checkbox"
                checked={standardizeColumns}
                onChange={(event) => setStandardizeColumns(event.target.checked)}
              />
              Standardize column names
            </label>
            <label className="tool-label" htmlFor="missing-strategy">
              MISSING VALUE STRATEGY
            </label>
            <select
              id="missing-strategy"
              className="tool-select"
              value={missingStrategy}
              onChange={(event) =>
                setMissingStrategy(
                  event.target.value as NonNullable<
                    CleaningOptions["missing_strategy"]
                  >
                )
              }
            >
              <option value="none">Do not change</option>
              <option value="drop_rows">Drop rows with missing values</option>
              <option value="fill_mean">Fill with mean (numeric)</option>
              <option value="fill_median">Fill with median (numeric)</option>
              <option value="fill_mode">Fill with mode</option>
            </select>
          </div>
        )}

        {page === "AI Insights" && (
          <div className="tool-options">
            <label className="tool-label" htmlFor="contamination">
              EXPECTED ANOMALY PROPORTION: {contamination.toFixed(2)}
            </label>
            <input
              id="contamination"
              className="tool-range"
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={contamination}
              onChange={(event) => setContamination(Number(event.target.value))}
            />
            <p className="tool-hint">
              This controls the expected proportion of unusual records. It is not
              a guaranteed anomaly rate.
            </p>
          </div>
        )}

        <div className="tool-actions">
          <button
            className="primary-button"
            onClick={runPrimaryAction}
            disabled={!selectedId || loading}
          >
            {loading ? (
              <RefreshCw size={16} className="spin" />
            ) : (
              <Play size={16} />
            )}
            {loading ? "Processing..." : pageInfo.action}
          </button>

          {page === "ETL Pipeline" && (
            <button
              className="secondary-button"
              onClick={() =>
                void runAction(() => runSparkProcessing(selectedId), true)
              }
              disabled={!selectedId || loading}
            >
              <Zap size={16} />
              Run Apache Spark
            </button>
          )}
        </div>

        {error && (
          <div className="tool-error" role="alert">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}
      </section>

      {result && (
        <section className="tool-results">
          <div className="tool-result-title">
            <div>
              <div className="eyebrow">
                <span className="live-dot" />
                PROCESS COMPLETED
              </div>
              <h3>
                <CheckCircle2 size={19} />
                {typeof result.message === "string"
                  ? result.message
                  : "Analysis completed successfully"}
              </h3>
            </div>
            <ClipboardList size={23} className="tool-muted-icon" />
          </div>

          {page === "AI Insights" && analysis && (
            <div className="tool-metrics">
              {[
                ["Total rows", analysis.total_rows],
                ["Anomalies", analysis.anomaly_count],
                ["Normal rows", analysis.normal_count],
                [
                  "Numeric columns",
                  Array.isArray(analysis.numeric_columns_analyzed)
                    ? analysis.numeric_columns_analyzed.length
                    : "—",
                ],
              ].map(([label, value]) => (
                <div className="tool-metric" key={String(label)}>
                  <span>{String(label)}</span>
                  <strong>{String(value ?? "—")}</strong>
                </div>
              ))}
            </div>
          )}

          {createdDataset && (
            <div className="created-dataset">
              <CheckCircle2 size={18} />
              <div>
                <strong>Processed dataset saved</strong>
                <span>
                  {String(createdDataset.originalName || createdDataset.name || "New dataset")}
                </span>
              </div>
              <button
                className="secondary-button"
                onClick={() =>
                  void handleDownload(
                    String(createdDataset.id),
                    String(createdDataset.originalName || createdDataset.name || "processed.csv")
                  )
                }
              >
                <Download size={15} />
                Download
              </button>
            </div>
          )}

          {page === "Data Profiling" && isObject(result.profile) && (
            <>
              <div className="tool-metrics">
                {[
                  ["Rows", result.profile.total_rows],
                  ["Columns", result.profile.total_columns],
                  ["Duplicate rows", result.profile.duplicate_rows],
                ].map(([label, value]) => (
                  <div className="tool-metric" key={String(label)}>
                    <span>{String(label)}</span>
                    <strong>{String(value ?? "—")}</strong>
                  </div>
                ))}
              </div>
              <ResultPanel title="Column details" data={result.profile.columns} />
              <ResultPanel title="Numeric statistics" data={result.profile.numeric_statistics} />
              <ResultPanel title="Categorical statistics" data={result.profile.categorical_statistics} />
            </>
          )}

          {page === "Data Cleaning" && (
            <>
              <ResultPanel title="Cleaning summary" data={result.cleaningSummary} />
              <ResultPanel title="Cleaned columns" data={result.cleanedColumns} />
            </>
          )}

          {page === "ETL Pipeline" && (
            <>
              <ResultPanel title="ETL pipeline stages" data={result.pipeline} />
              <ResultPanel title="Output columns" data={result.columns} />
              {isObject(result.processing) && (
                <ResultPanel title="Spark processing details" data={result.processing} />
              )}
            </>
          )}

          {page === "AI Insights" && analysis && (
            <>
              <ResultPanel title="Detection configuration" data={{
                algorithm: analysis.algorithm,
                numeric_columns_analyzed: analysis.numeric_columns_analyzed,
              }} />
              <ResultPanel title="Detected anomalies" data={analysis.anomalies} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
