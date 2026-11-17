
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";

import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  Database,
  Mail,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
  RefreshCw,
  Ticket,
} from "lucide-react";

import {
  createSupportTicket,
  getMySupportTickets,
  type SupportTicket,
  type SupportTicketCategory,
} from "../api";

import "./HelpSupport.css";

type HelpItem = {
  question: string;
  answer: string;
};

const faqs: HelpItem[] = [
  {
    question: "How do I upload a dataset?",
    answer:
      "Open Datasets from the sidebar, choose Upload Dataset, select a supported file, and upload it to your workspace.",
  },
  {
    question: "How do I clean a CSV dataset?",
    answer:
      "Open Data Cleaning, select a CSV dataset, choose the cleaning options, and run the process. You can download the cleaned output afterward.",
  },
  {
    question: "How does the ETL pipeline work?",
    answer:
      "The ETL Pipeline extracts data from your selected CSV, transforms it, and saves the processed output as a new dataset.",
  },
  {
    question: "Why does anomaly detection fail?",
    answer:
      "AI Insights requires a CSV dataset with at least five rows and usable numeric columns. Upload a larger dataset if you receive a minimum-row error.",
  },
  {
    question: "Where are my datasets stored?",
    answer:
      "DataPulse stores uploaded and processed dataset files in AWS S3, while PostgreSQL stores dataset metadata and workspace information.",
  },
  {
    question: "Can I collaborate with team members?",
    answer:
      "Use the Team page to manage your workspace and its members. Available actions depend on your workspace permissions.",
  },
];

const guides = [
  {
    icon: Database,
    title: "Dataset Management",
    description: "Upload, download, organize, and manage datasets.",
  },
  {
    icon: Wrench,
    title: "Data Processing",
    description: "Understand profiling, cleaning, ETL, and Spark.",
  },
  {
    icon: Sparkles,
    title: "AI Insights",
    description: "Learn how Isolation Forest detects unusual records.",
  },
  {
    icon: ShieldCheck,
    title: "Account & Workspace",
    description: "Find help with settings, teams, and access.",
  },
];

const categories: SupportTicketCategory[] = [
  "General Question",
  "Dataset Management",
  "Data Processing",
  "AI Insights",
  "Account & Workspace",
  "Technical Issue",
];

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") {
      return message;
    }

    if (!error.response) {
      return "Cannot connect to the DataPulse backend.";
    }

    return `Request failed (${error.response.status}).`;
  }

  return "Something went wrong. Please try again.";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

export default function HelpSupportPage() {
  const [search, setSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const [subject, setSubject] = useState("");
  const [category, setCategory] =
    useState<SupportTicketCategory>("General Question");
  const [description, setDescription] = useState("");

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [ticketError, setTicketError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [expandedTicket, setExpandedTicket] =
    useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketError("");

    try {
      const response = await getMySupportTickets();
      setTickets(response.tickets);
    } catch (error) {
      setTicketError(getErrorMessage(error));
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const filteredFaqs = faqs.filter((item) =>
    `${item.question} ${item.answer}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    setFormError("");
    setFormSuccess("");

    const cleanSubject = subject.trim();
    const cleanDescription = description.trim();

    if (cleanSubject.length < 3) {
      setFormError("Subject must contain at least 3 characters.");
      return;
    }

    if (cleanDescription.length < 10) {
      setFormError(
        "Description must contain at least 10 characters."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await createSupportTicket({
        subject: cleanSubject,
        category,
        description: cleanDescription,
      });

      setTickets((current) => [
        response.ticket,
        ...current.filter(
          (ticket) => ticket.id !== response.ticket.id
        ),
      ]);

      setSubject("");
      setCategory("General Question");
      setDescription("");

      setExpandedTicket(response.ticket.id);
      setFormSuccess(
        `Support ticket submitted successfully. Ticket ID: ${response.ticket.id}`
      );
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="help-page">
      <section className="help-hero">
        <div className="help-hero-icon">
          <CircleHelp size={28} />
        </div>

        <div>
          <span className="help-eyebrow">
            DATAPULSE SUPPORT CENTER
          </span>
          <h1>How can we help you?</h1>
          <p>
            Find answers, explore documentation, and troubleshoot
            your data workflows.
          </p>
        </div>
      </section>

      <div className="help-search">
        <Search size={19} />
        <input
          type="search"
          placeholder="Search frequently asked questions..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search help articles"
        />
      </div>

      <section className="help-section">
        <div className="help-section-heading">
          <div>
            <h2>Explore Help Topics</h2>
            <p>Quick guides for essential DataPulse features.</p>
          </div>
          <BookOpen size={21} />
        </div>

        <div className="help-guide-grid">
          {guides.map((guide) => {
            const Icon = guide.icon;

            return (
              <article
                className="help-guide-card"
                key={guide.title}
              >
                <div className="help-guide-icon">
                  <Icon size={23} />
                </div>
                <h3>{guide.title}</h3>
                <p>{guide.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="help-section">
        <div className="help-section-heading">
          <div>
            <h2>Frequently Asked Questions</h2>
            <p>
              Answers to common questions about DataPulse.
            </p>
          </div>
        </div>

        <div className="help-faq-list">
          {filteredFaqs.length === 0 ? (
            <div className="help-empty">
              No matching questions found. Try another search.
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const index = faqs.indexOf(faq);
              const expanded = expandedFaq === index;

              return (
                <div className="help-faq" key={faq.question}>
                  <button
                    type="button"
                    className="help-faq-question"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedFaq(expanded ? null : index)
                    }
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={
                        expanded ? "help-chevron-open" : ""
                      }
                    />
                  </button>

                  {expanded && (
                    <p className="help-faq-answer">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="help-section">
        <div className="help-section-heading">
          <div>
            <h2>Troubleshooting</h2>
            <p>
              Solutions to common processing problems.
            </p>
          </div>
          <Wrench size={21} />
        </div>

        <div className="help-troubleshooting">
          <div>
            <strong>Dataset not appearing?</strong>
            <p>
              Check your active workspace and refresh the
              Datasets page.
            </p>
          </div>

          <div>
            <strong>AI Insights returns a 400 error?</strong>
            <p>
              Use a CSV containing at least five rows and
              numeric data.
            </p>
          </div>

          <div>
            <strong>Processing service unavailable?</strong>
            <p>
              Check that the Express backend and Python ML
              service are running.
            </p>
          </div>
        </div>
      </section>

      <section className="help-section">
        <div className="help-section-heading">
          <div>
            <h2>Contact Support</h2>
            <p>
              Submit a support request for your active workspace.
            </p>
          </div>
          <Mail size={21} />
        </div>

        <form className="help-form" onSubmit={handleSubmit}>
          <div className="help-form-grid">
            <label>
              Subject
              <input
                type="text"
                placeholder="Briefly describe your issue"
                value={subject}
                onChange={(event) =>
                  setSubject(event.target.value)
                }
                minLength={3}
                maxLength={150}
                required
              />
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value as SupportTicketCategory
                  )
                }
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Description
            <textarea
              rows={5}
              placeholder="Describe the problem and any error messages..."
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              minLength={10}
              maxLength={5000}
              required
            />
          </label>

          {formError && (
            <p role="alert" style={{ color: "#dc2626" }}>
              {formError}
            </p>
          )}

          {formSuccess && (
            <p role="status" style={{ color: "#15803d" }}>
              {formSuccess}
            </p>
          )}

          <div className="help-form-footer">
            <span>
              Your request will be saved to your workspace.
            </span>

            <button type="submit" disabled={submitting}>
              <Send size={16} />
              {submitting
                ? "Submitting..."
                : "Submit Ticket"}
            </button>
          </div>
        </form>
      </section>

      <section className="help-section">
        <div className="help-section-heading">
          <div>
            <h2>My Support Tickets</h2>
            <p>
              View requests submitted in your active workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadTickets()}
            disabled={loadingTickets}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              cursor: loadingTickets
                ? "not-allowed"
                : "pointer",
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {ticketError && (
          <p role="alert" style={{ color: "#dc2626" }}>
            {ticketError}
          </p>
        )}

        {loadingTickets ? (
          <div className="help-empty">
            Loading your support tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="help-empty">
            <Ticket size={24} />
            <p>You have not submitted any support tickets yet.</p>
          </div>
        ) : (
          <div className="help-faq-list">
            {tickets.map((ticket) => {
              const expanded =
                expandedTicket === ticket.id;

              return (
                <div className="help-faq" key={ticket.id}>
                  <button
                    type="button"
                    className="help-faq-question"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedTicket(
                        expanded ? null : ticket.id
                      )
                    }
                  >
                    <span>
                      <strong>{ticket.subject}</strong>
                      {" — "}
                      {ticket.status.replaceAll("_", " ")}
                    </span>

                    <ChevronDown
                      size={18}
                      className={
                        expanded ? "help-chevron-open" : ""
                      }
                    />
                  </button>

                  {expanded && (
                    <div
                      className="help-faq-answer"
                      style={{ paddingBottom: 16 }}
                    >
                      <p>
                        <strong>Ticket ID:</strong>{" "}
                        {ticket.id}
                      </p>
                      <p>
                        <strong>Category:</strong>{" "}
                        {ticket.category}
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        {ticket.status}
                      </p>
                      <p>
                        <strong>Priority:</strong>{" "}
                        {ticket.priority}
                      </p>
                      <p>
                        <strong>Created:</strong>{" "}
                        {formatDate(ticket.createdAt)}
                      </p>
                      <p>
                        <strong>Description:</strong>
                      </p>
                      <p style={{ whiteSpace: "pre-wrap" }}>
                        {ticket.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
