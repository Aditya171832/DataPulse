import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import type { FormEvent } from "react";

import {
  Bot,
  Sparkles,
  Send,
  Copy,
  Trash2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Plus,
  MessageSquare,
  Pencil,
  History,
  Lock,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  chatWithDataset,
  getChatSessions,
  getChatSessionById,
  renameChatSession,
  deleteChatSession,
  type Dataset,
  type ChatSession,
  type AIChatChart,
} from "../api";

import "./AIAssistant.css";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface Props {
  datasets: Dataset[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}

interface ChatResult {
  answer: string;
  query_plan: Record<string, unknown> | null;
  result: unknown;
  chart: AIChatChart | null;
}

interface ChatTurn {
  id: string;
  question: string;
  response?: ChatResult;
  error?: string;
}

const suggestedQuestions = [
  "Describe this dataset",
  "How many rows are in this dataset?",
  "Are there any missing values?",
  "How many duplicate rows are there?",
];

const HISTORY_PAGE_SIZE = 30;

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function formatValue(value: unknown): string {
  if (value == null) return "—";

  if (typeof value === "number") {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 8,
    });
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function isRow(
  value: unknown
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function getErrorMessage(
  err: unknown,
  fallback: string
): string {
  const apiError = err as {
    response?: {
      data?: {
        message?: string;
      };
    };
    message?: string;
  };

  return (
    apiError?.response?.data?.message ||
    apiError?.message ||
    fallback
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();

  if (
    date.toDateString() === today.toDateString()
  ) {
    return "Today";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// --------------------------------------------------
// RESTORE SAVED MESSAGES
// --------------------------------------------------

function restoreChatTurns(
  session: ChatSession
): ChatTurn[] {
  const restoredTurns: ChatTurn[] = [];

  for (const message of session.messages || []) {
    if (message.role === "USER") {
      restoredTurns.push({
        id: message.id,
        question: message.content,
      });

      continue;
    }

    if (message.role === "ASSISTANT") {
      const lastTurn =
        restoredTurns[restoredTurns.length - 1];

      const response: ChatResult = {
        answer: message.content,
        query_plan: message.queryPlan,
        result: message.result,
        chart: message.chart,
      };

      if (lastTurn && !lastTurn.response) {
        lastTurn.response = response;
      } else {
        restoredTurns.push({
          id: message.id,
          question: "",
          response,
        });
      }
    }
  }

  return restoredTurns;
}

// --------------------------------------------------
// AI RESPONSE RESULTS
// --------------------------------------------------

function AIResults({
  response,
}: {
  response: ChatResult;
}) {
  const rows = Array.isArray(response.result)
    ? response.result.filter(isRow)
    : [];

  const columns = Array.from(
    new Set(rows.flatMap(Object.keys))
  );

  const chart = response.chart;

  const isScalar =
    rows.length === 1 &&
    columns.length === 1 &&
    columns[0] === "value";

  return (
    <>
      {/* CALCULATED RESULT */}

      {isScalar && (
        <div className="dpai-metric">
          <small>Calculated result</small>

          <strong>
            {formatValue(rows[0].value)}
          </strong>
        </div>
      )}

      {/* DYNAMIC CHART */}

      {chart?.type === "bar" &&
        Array.isArray(chart.data) &&
        chart.data.length > 0 && (
          <div className="dpai-result">
            <h4>Data visualization</h4>

            <div className="dpai-chart">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={chart.data.map((row) => ({
                    category: formatValue(
                      row[chart.x_key]
                    ),

                    value: row[chart.y_key],
                  }))}
                  margin={{
                    left: 8,
                    right: 12,
                    top: 12,
                    bottom: 32,
                  }}
                >
                  <CartesianGrid
                    stroke="#263a4c"
                    vertical={false}
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="category"
                    tick={{
                      fill: "#a4b3c2",
                      fontSize: 11,
                    }}
                    angle={-20}
                    textAnchor="end"
                  />

                  <YAxis
                    tick={{
                      fill: "#a4b3c2",
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#142334",
                      border: "1px solid #294052",
                      borderRadius: 8,
                    }}
                    labelStyle={{
                      color: "#e5edf5",
                    }}
                    itemStyle={{
                      color: "#5eead4",
                    }}
                  />

                  <Bar
                    dataKey="value"
                    fill="#2dd4bf"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={52}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      {/* RESULT TABLE */}

      {!isScalar && rows.length > 0 && (
        <div className="dpai-result">
          <h4>
            Result table · {rows.length} returned rows
          </h4>

          <div className="dpai-table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>
                        {formatValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAILED RESULTS */}

      {isRow(response.result) && (
        <details className="dpai-details">
          <summary>Detailed results</summary>

          <pre>
            {JSON.stringify(
              response.result,
              null,
              2
            )}
          </pre>
        </details>
      )}

      {/* QUERY PLAN */}

      {response.query_plan && (
        <details className="dpai-details">
          <summary>View AI query plan</summary>

          <pre>
            {JSON.stringify(
              response.query_plan,
              null,
              2
            )}
          </pre>
        </details>
      )}
    </>
  );
}

// --------------------------------------------------
// MAIN AI ASSISTANT COMPONENT
// --------------------------------------------------

export default function AIAssistant({
  datasets,
  loading,
  error,
  onRetry,
}: Props) {
  // ------------------------------------------------
  // ELIGIBLE DATASETS
  // ------------------------------------------------

  const eligibleDatasets = datasets.filter(
    (dataset) =>
      dataset.originalName
        .toLowerCase()
        .endsWith(".csv") &&
      dataset.fileSize > 0 &&
      dataset.fileSize <= 20 * 1024 * 1024
  );

  // ------------------------------------------------
  // CHAT STATE
  // ------------------------------------------------

  const [datasetId, setDatasetId] = useState("");

  const [question, setQuestion] = useState("");

  const [turns, setTurns] = useState<ChatTurn[]>(
    []
  );

  const [busy, setBusy] = useState(false);

  const [notice, setNotice] = useState("");

  // ------------------------------------------------
  // CHAT HISTORY STATE
  // ------------------------------------------------

  const [sessions, setSessions] = useState<
    ChatSession[]
  >([]);

  const [activeSessionId, setActiveSessionId] =
    useState<string | null>(null);

  const [activeSession, setActiveSession] =
    useState<ChatSession | null>(null);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [historyError, setHistoryError] =
    useState("");

  const [sessionLoading, setSessionLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [historyPage, setHistoryPage] =
    useState(1);

  const [hasMoreSessions, setHasMoreSessions] =
    useState(false);

  const [hasOlderMessages, setHasOlderMessages] =
    useState(false);

  // ------------------------------------------------
  // REQUEST CONTROLLERS
  // ------------------------------------------------

  const requestRef =
    useRef<AbortController | null>(null);

  const historyRequestRef =
    useRef<AbortController | null>(null);

  const sessionRequestRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  // ------------------------------------------------
  // SELECTED DATASET
  // ------------------------------------------------

  const selectedDataset =
    eligibleDatasets.find(
      (dataset) => dataset.id === datasetId
    );

  const datasetUnavailable =
    !!activeSessionId &&
    !selectedDataset &&
    !loading &&
    !error;

  const controlsDisabled =
    busy ||
    sessionLoading ||
    actionLoading;

  const canAsk =
    !!selectedDataset &&
    !loading &&
    !error &&
    !controlsDisabled;

  // ------------------------------------------------
  // LOAD CONVERSATION HISTORY
  // ------------------------------------------------

  const loadHistory = useCallback(
    async (page = 1) => {
      historyRequestRef.current?.abort();

      const controller = new AbortController();

      historyRequestRef.current = controller;

      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await getChatSessions(
          page,
          HISTORY_PAGE_SIZE,
          controller.signal
        );

        if (controller.signal.aborted) {
          return;
        }

        if (page === 1) {
          setSessions(response.sessions);
        } else {
          setSessions((previous) => {
            const existingIds = new Set(
              previous.map((session) => session.id)
            );

            return [
              ...previous,
              ...response.sessions.filter(
                (session) =>
                  !existingIds.has(session.id)
              ),
            ];
          });
        }

        setHistoryPage(response.page);

        setHasMoreSessions(
          response.page < response.totalPages
        );
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setHistoryError(
            getErrorMessage(
              err,
              "Unable to load conversation history."
            )
          );
        }
      } finally {
        if (
          historyRequestRef.current === controller
        ) {
          historyRequestRef.current = null;

          if (!controller.signal.aborted) {
            setHistoryLoading(false);
          }
        }
      }
    },
    []
  );

  // ------------------------------------------------
  // INITIAL LOAD AND CLEANUP
  // ------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    void loadHistory();

    return () => {
      mountedRef.current = false;

      requestRef.current?.abort();

      historyRequestRef.current?.abort();

      sessionRequestRef.current?.abort();
    };
  }, [loadHistory]);

  // ------------------------------------------------
  // AUTO SCROLL TO LATEST MESSAGE
  // ------------------------------------------------

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [turns, busy]);

  // ------------------------------------------------
  // START NEW CONVERSATION
  // ------------------------------------------------

  function startNewChat() {
    if (controlsDisabled) return;

    sessionRequestRef.current?.abort();

    setActiveSessionId(null);
    setActiveSession(null);
    setDatasetId("");
    setTurns([]);
    setQuestion("");
    setNotice("");
    setHasOlderMessages(false);
  }

  // ------------------------------------------------
  // OPEN SAVED CONVERSATION
  // ------------------------------------------------

  async function openConversation(
    sessionId: string
  ) {
    if (controlsDisabled) return;

    sessionRequestRef.current?.abort();

    const controller = new AbortController();

    sessionRequestRef.current = controller;

    setSessionLoading(true);
    setNotice("");

    try {
      const response =
        await getChatSessionById(
          sessionId,
          controller.signal
        );

      if (controller.signal.aborted) {
        return;
      }

      const session = response.session;

      setActiveSessionId(session.id);

      setActiveSession(session);

      setDatasetId(session.datasetId || "");

      setTurns(restoreChatTurns(session));

      setQuestion("");

      setHasOlderMessages(
        !!response.hasOlderMessages
      );
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setNotice(
          getErrorMessage(
            err,
            "Unable to open conversation."
          )
        );
      }
    } finally {
      if (
        sessionRequestRef.current === controller
      ) {
        sessionRequestRef.current = null;

        if (!controller.signal.aborted) {
          setSessionLoading(false);
        }
      }
    }
  }

  // ------------------------------------------------
  // RENAME CONVERSATION
  // ------------------------------------------------

  async function handleRename(
    session: ChatSession
  ) {
    if (controlsDisabled) return;

    const newTitle = window.prompt(
      "Enter a new conversation title:",
      session.title
    );

    if (newTitle === null) return;

    const title = newTitle.trim();

    if (!title) {
      setNotice(
        "Conversation title cannot be empty."
      );

      return;
    }

    if (title.length > 120) {
      setNotice(
        "Conversation title cannot exceed 120 characters."
      );

      return;
    }

    if (title === session.title) return;

    setActionLoading(true);
    setNotice("");

    try {
      const response =
        await renameChatSession(
          session.id,
          title
        );

      if (!mountedRef.current) return;

      setSessions((previous) =>
        previous.map((item) =>
          item.id === session.id
            ? {
                ...item,
                title: response.session.title,
              }
            : item
        )
      );

      setActiveSession((previous) =>
        previous?.id === session.id
          ? {
              ...previous,
              title: response.session.title,
            }
          : previous
      );

      setNotice(
        "Conversation renamed successfully."
      );

      void loadHistory();
    } catch (err: unknown) {
      if (mountedRef.current) {
        setNotice(
          getErrorMessage(
            err,
            "Unable to rename conversation."
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  // ------------------------------------------------
  // DELETE CONVERSATION
  // ------------------------------------------------

  async function handleDelete(
    session: ChatSession
  ) {
    if (controlsDisabled) return;

    const confirmed = window.confirm(
      `Delete "${session.title}"?\n\n` +
        "All saved messages in this conversation " +
        "will be permanently deleted."
    );

    if (!confirmed) return;

    setActionLoading(true);
    setNotice("");

    try {
      await deleteChatSession(session.id);

      if (!mountedRef.current) return;

      setSessions((previous) =>
        previous.filter(
          (item) => item.id !== session.id
        )
      );

      if (activeSessionId === session.id) {
        setActiveSessionId(null);
        setActiveSession(null);
        setDatasetId("");
        setTurns([]);
        setQuestion("");
        setHasOlderMessages(false);
      }

      setNotice(
        "Conversation deleted successfully."
      );

      void loadHistory();
    } catch (err: unknown) {
      if (mountedRef.current) {
        setNotice(
          getErrorMessage(
            err,
            "Unable to delete conversation."
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  // ------------------------------------------------
  // SEND QUESTION
  // ------------------------------------------------

  async function submitQuestion(text: string) {
    const trimmedQuestion = text.trim();

    if (
      !selectedDataset ||
      !canAsk ||
      !trimmedQuestion ||
      trimmedQuestion.length > 1000 ||
      requestRef.current
    ) {
      return;
    }

    const controller = new AbortController();

    requestRef.current = controller;

    const turnId = crypto.randomUUID();

    const currentDataset = selectedDataset;

    setBusy(true);
    setNotice("");
    setQuestion("");

    setTurns((previous) => [
      ...previous,
      {
        id: turnId,
        question: trimmedQuestion,
      },
    ]);

    try {
      const response = await chatWithDataset(
        currentDataset.id,
        trimmedQuestion,
        controller.signal,
        activeSessionId || undefined
      );

      if (controller.signal.aborted) {
        return;
      }

      const updatedSession: ChatSession = {
        ...response.session,

        dataset: response.dataset,
      };

      setActiveSessionId(response.sessionId);

      setActiveSession(updatedSession);

      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                id: response.userMessageId,
                response: {
                  answer: response.answer,
                  query_plan:
                    response.query_plan,
                  result: response.result,
                  chart: response.chart,
                },
              }
            : turn
        )
      );

      // Move the current conversation to the top.

      historyRequestRef.current?.abort();

      setSessions((previous) => [
        updatedSession,

        ...previous.filter(
          (session) =>
            session.id !== response.sessionId
        ),
      ]);

      // Sync the sidebar with PostgreSQL.

      void loadHistory();
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setTurns((previous) =>
          previous.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,

                  error: getErrorMessage(
                    err,
                    "Unable to analyze the dataset."
                  ),
                }
              : turn
          )
        );

        setQuestion(trimmedQuestion);

        setNotice(
          "The request failed. Check your saved history before retrying."
        );

        void loadHistory();
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;

        if (!controller.signal.aborted) {
          setBusy(false);
        }
      }
    }
  }

  // ------------------------------------------------
  // CHANGE DATASET
  // ------------------------------------------------

  function changeDataset(id: string) {
    if (
      activeSessionId ||
      controlsDisabled
    ) {
      return;
    }

    setDatasetId(id);
    setTurns([]);
    setQuestion("");
    setNotice("");
  }

  // ------------------------------------------------
  // HANDLE FORM SUBMISSION
  // ------------------------------------------------

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    void submitQuestion(question);
  }

  // ------------------------------------------------
  // COPY ANSWER
  // ------------------------------------------------

  async function copyAnswer(value: string) {
    try {
      await navigator.clipboard.writeText(
        value
      );

      if (mountedRef.current) {
        setNotice(
          "Answer copied successfully."
        );
      }
    } catch {
      if (mountedRef.current) {
        setNotice(
          "Clipboard unavailable. Select the answer to copy it manually."
        );
      }
    }
  }

  // ------------------------------------------------
  // COMPONENT UI
  // ------------------------------------------------

  return (
    <div className="page-content dpai">
      {/* PAGE HEADER */}

      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <Sparkles size={13} />

            NATURAL LANGUAGE ANALYTICS
          </div>

          <h2>AI Data Assistant</h2>

          <p>
            Chat with your data, discover insights
            and explore intelligent visualizations.
          </p>
        </div>

        <button
          className="dpai-secondary"
          disabled={controlsDisabled}
          onClick={startNewChat}
        >
          <Plus size={16} />

          New Chat
        </button>
      </section>

      {/* MAIN LAYOUT */}

      <div className="dpai-layout">
        {/* CONVERSATION HISTORY SIDEBAR */}

        <aside className="dpai-history">
          <div className="dpai-history-header">
            <div className="dpai-history-heading">
              <History size={19} />

              <div>
                <h3>Conversations</h3>

                <small>Saved chat history</small>
              </div>
            </div>

            <button
              className="dpai-icon-button"
              onClick={() => void loadHistory()}
              disabled={
                historyLoading ||
                controlsDisabled
              }
              title="Refresh conversations"
              aria-label="Refresh conversations"
            >
              <RefreshCw
                size={16}
                className={
                  historyLoading
                    ? "dpai-spin"
                    : ""
                }
              />
            </button>
          </div>

          {/* NEW CONVERSATION BUTTON */}

          <button
            className="dpai-new-chat"
            onClick={startNewChat}
            disabled={controlsDisabled}
          >
            <Plus size={18} />

            New conversation
          </button>

          <div className="dpai-history-label">
            RECENT CONVERSATIONS
          </div>

          {/* HISTORY ERROR */}

          {historyError && (
            <div className="dpai-history-error">
              <p>{historyError}</p>

              <button
                className="dpai-secondary"
                disabled={historyLoading}
                onClick={() => void loadHistory()}
              >
                Try again
              </button>
            </div>
          )}

          {/* LOADING HISTORY */}

          {historyLoading &&
            sessions.length === 0 && (
              <div className="dpai-history-empty">
                <Loader2
                  size={22}
                  className="dpai-spin"
                />

                <p>Loading conversations...</p>
              </div>
            )}

          {/* EMPTY HISTORY */}

          {!historyLoading &&
            !historyError &&
            sessions.length === 0 && (
              <div className="dpai-history-empty">
                <MessageSquare size={28} />

                <p>No saved conversations</p>

                <small>
                  Your conversations will appear
                  here after your first question.
                </small>
              </div>
            )}

          {/* CONVERSATION LIST */}

          <div className="dpai-history-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`dpai-history-item ${
                  activeSessionId === session.id
                    ? "active"
                    : ""
                }`}
              >
                <button
                  className="dpai-history-open"
                  disabled={controlsDisabled}
                  aria-current={
                    activeSessionId === session.id
                      ? "true"
                      : undefined
                  }
                  onClick={() =>
                    void openConversation(
                      session.id
                    )
                  }
                >
                  <MessageSquare size={17} />

                  <div className="dpai-history-info">
                    <strong title={session.title}>
                      {session.title}
                    </strong>

                    <small>
                      {session.dataset
                        ?.originalName ||
                        "Unavailable dataset"}
                    </small>

                    <span>
                      {formatDate(
                        session.updatedAt
                      )}

                      {" · "}

                      {session._count.messages}{" "}
                      messages
                    </span>
                  </div>
                </button>

                {/* SESSION ACTIONS */}

                <div className="dpai-history-actions">
                  <button
                    className="dpai-icon-button"
                    title="Rename conversation"
                    aria-label={`Rename ${session.title}`}
                    disabled={controlsDisabled}
                    onClick={() =>
                      void handleRename(session)
                    }
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    className="dpai-icon-button danger"
                    title="Delete conversation"
                    aria-label={`Delete ${session.title}`}
                    disabled={controlsDisabled}
                    onClick={() =>
                      void handleDelete(session)
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* LOAD MORE HISTORY */}

          {hasMoreSessions && (
            <button
              className="dpai-secondary dpai-load-more"
              disabled={
                historyLoading ||
                controlsDisabled
              }
              onClick={() =>
                void loadHistory(historyPage + 1)
              }
            >
              {historyLoading ? (
                <Loader2
                  size={14}
                  className="dpai-spin"
                />
              ) : (
                <History size={14} />
              )}

              Load more conversations
            </button>
          )}

          <div className="dpai-history-footer">
            <ShieldCheck size={15} />

            <span>
              Conversations are private to your
              account and workspace.
            </span>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}

        <div className="dpai-main">
          {/* DATASET SELECTOR */}

          <section className="dpai-source">
            <div className="dpai-source-icon">
              <FileSpreadsheet size={22} />
            </div>

            <div className="dpai-source-field">
              <label htmlFor="dpai-dataset">
                {activeSessionId
                  ? "CONVERSATION DATASET"
                  : "SELECT DATASET"}
              </label>

              <select
                id="dpai-dataset"
                value={datasetId}
                disabled={
                  loading ||
                  controlsDisabled ||
                  !!error ||
                  !!activeSessionId
                }
                onChange={(event) =>
                  changeDataset(
                    event.target.value
                  )
                }
              >
                <option value="">
                  {loading
                    ? "Loading datasets..."
                    : activeSessionId
                      ? "Dataset unavailable"
                      : "Select a CSV dataset"}
                </option>

                {activeSessionId &&
                  datasetId &&
                  !selectedDataset && (
                    <option value={datasetId}>
                      {activeSession?.dataset
                        ?.originalName ||
                        "Unavailable dataset"}
                    </option>
                  )}

                {eligibleDatasets.map(
                  (dataset) => (
                    <option
                      key={dataset.id}
                      value={dataset.id}
                    >
                      {dataset.originalName}
                      {" · "}
                      {(
                        dataset.fileSize / 1024
                      ).toFixed(1)}{" "}
                      KB
                    </option>
                  )
                )}
              </select>
            </div>

            {activeSessionId && (
              <span
                className="dpai-dataset-lock"
                title="Start a new chat to change datasets"
              >
                <Lock size={14} />

                Locked
              </span>
            )}

            <button
              className="dpai-secondary"
              disabled={
                loading || controlsDisabled
              }
              onClick={onRetry}
              aria-label="Refresh datasets"
              title="Refresh datasets"
            >
              <RefreshCw size={16} />
            </button>
          </section>

          {/* DATASET ERRORS */}

          {error && (
            <p
              className="dpai-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {datasetUnavailable && (
            <div className="dpai-unavailable">
              <Lock size={16} />

              <span>
                This dataset is no longer
                available. You can still view
                saved messages and results,
                but cannot ask new questions.
              </span>
            </div>
          )}

          {!loading &&
            !error &&
            !activeSessionId &&
            eligibleDatasets.length === 0 && (
              <p className="dpai-hint">
                Upload a nonempty CSV dataset
                of up to 20 MB to get started.
              </p>
            )}

          {/* CHAT CONTAINER */}

          <section className="dpai-chat">
            {/* CHAT HEADER */}

            <header className="dpai-chat-header">
              <div className="dpai-bot">
                <Bot size={22} />
              </div>

              <div>
                <strong>
                  {activeSession?.title ||
                    "DataPulse Assistant"}
                </strong>

                <small>
                  Powered by Gemini · DuckDB
                </small>
              </div>

              <span className="dpai-session">
                {activeSessionId ? (
                  <>
                    <ShieldCheck size={13} />
                    Saved
                  </>
                ) : (
                  "New Chat"
                )}
              </span>
            </header>

            {/* CHAT MESSAGES */}

            <div
              className="dpai-messages"
              aria-live="polite"
            >
              {/* LOADING SAVED CHAT */}

              {sessionLoading ? (
                <div className="dpai-empty">
                  <Loader2
                    size={32}
                    className="dpai-spin"
                  />

                  <h3>
                    Loading conversation...
                  </h3>

                  <p>
                    Retrieving your saved
                    messages and results.
                  </p>
                </div>
              ) : (
                <>
                  {/* OLDER MESSAGES NOTICE */}

                  {hasOlderMessages && (
                    <p className="dpai-hint">
                      Showing the latest 100
                      saved messages. Older
                      messages remain stored
                      in your account.
                    </p>
                  )}

                  {/* EMPTY STATE */}

                  {turns.length === 0 && (
                    <div className="dpai-empty">
                      <div className="dpai-empty-icon">
                        <Sparkles size={30} />
                      </div>

                      <h3>
                        Discover insights in
                        your data
                      </h3>

                      <p>
                        Select a dataset and
                        ask a question. Try
                        one of these
                        suggestions.
                      </p>

                      <div className="dpai-prompts">
                        {suggestedQuestions.map(
                          (prompt) => (
                            <button
                              key={prompt}
                              disabled={!canAsk}
                              onClick={() =>
                                void submitQuestion(
                                  prompt
                                )
                              }
                            >
                              {prompt}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* CONVERSATION MESSAGES */}

                  {turns.map((turn) => (
                    <div
                      className="dpai-turn"
                      key={turn.id}
                    >
                      {/* USER MESSAGE */}

                      {turn.question && (
                        <div className="dpai-user-message">
                          {turn.question}
                        </div>
                      )}

                      {/* AI RESPONSE */}

                      <div className="dpai-reply">
                        <div className="dpai-bot">
                          <Bot size={19} />
                        </div>

                        <div className="dpai-reply-body">
                          {turn.response ? (
                            <>
                              <p className="dpai-answer">
                                {
                                  turn.response
                                    .answer
                                }
                              </p>

                              <AIResults
                                response={
                                  turn.response
                                }
                              />

                              <button
                                className="dpai-secondary"
                                onClick={() =>
                                  void copyAnswer(
                                    turn.response!
                                      .answer
                                  )
                                }
                              >
                                <Copy size={14} />

                                Copy answer
                              </button>
                            </>
                          ) : turn.error ? (
                            <p
                              className="dpai-error"
                              role="alert"
                            >
                              {turn.error}
                            </p>
                          ) : busy ? (
                            <div className="dpai-loading">
                              <Loader2
                                size={18}
                                className="dpai-spin"
                              />

                              Analyzing your
                              dataset...
                            </div>
                          ) : (
                            <p className="dpai-hint">
                              No saved response
                              available.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* MESSAGE INPUT */}

            <form
              className="dpai-composer"
              onSubmit={handleSubmit}
            >
              <label
                htmlFor="dpai-question"
                className="dpai-label"
              >
                Ask a question
              </label>

              <div className="dpai-input-row">
                <textarea
                  id="dpai-question"
                  value={question}
                  maxLength={1000}
                  rows={2}
                  placeholder={
                    datasetUnavailable
                      ? "Start a new chat with an available dataset..."
                      : "Ask a question about your selected dataset..."
                  }
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  disabled={!canAsk}
                />

                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    !canAsk ||
                    !question.trim()
                  }
                >
                  {busy ? (
                    <Loader2
                      className="dpai-spin"
                      size={18}
                    />
                  ) : (
                    <Send size={18} />
                  )}

                  {busy
                    ? "Processing"
                    : "Send"}
                </button>
              </div>

              {/* PRIVACY INFORMATION */}

              <div className="dpai-composer-foot">
                <span>
                  <ShieldCheck size={13} />

                  Questions and column
                  metadata are sent to
                  Gemini. Avoid sensitive
                  data.
                </span>

                <span>
                  {question.length}/1000
                </span>
              </div>

              <p className="dpai-hint">
                Successful questions, answers
                and analysis results are saved
                automatically. Each question
                is analyzed independently.
              </p>

              {notice && (
                <p
                  role="status"
                  className="dpai-hint"
                >
                  {notice}
                </p>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}