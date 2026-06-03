import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import "./App.css";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// API configuration is loaded from Vite environment variables.
// Do not hardcode private n8n domains, webhook IDs, tokens, or credentials here.
const API_BASE = (import.meta.env.VITE_EVIDENCECHECK_API_BASE || "").replace(/\/$/, "");
const LIST_JOBS_PATH = import.meta.env.VITE_EVIDENCECHECK_LIST_JOBS_PATH || "/evidence-check-jobs";
const SUBMIT_JOB_PATH = import.meta.env.VITE_EVIDENCECHECK_SUBMIT_JOB_PATH || "/evidence-check-submit";
const RESULT_JOB_PATH = import.meta.env.VITE_EVIDENCECHECK_RESULT_JOB_PATH || "/evidence-check-result";

function apiUrl(path) {
  if (!API_BASE) {
    throw new Error("Missing VITE_EVIDENCECHECK_API_BASE environment variable");
  }

  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${path}`;

  return `${API_BASE}${normalizedPath}`;
}

const verdictLabels = {
  VERDADERO: "🟢 VERDADERO",
  EXAGERADO: "🟡 EXAGERADO",
  FALSO: "🔴 FALSO",
  EVIDENCIA_INSUFICIENTE: "⚪ INSUFICIENTE",
  PARCIALMENTE_CIERTO: "🟠 PARCIAL",
};

const consensusLabels = {
  STRONG: "FUERTE",
  MODERATE: "MODERADO",
  WEAK: "DÉBIL",
  MIXED: "MIXTO",
  INSUFFICIENT: "INSUFICIENTE",
  UNCLEAR: "NO CLARO",
};

const VERDICT_COLORS = {
  VERDADERO: "#22c55e",
  EXAGERADO: "#facc15",
  FALSO: "#fb7185",
  EVIDENCIA_INSUFICIENTE: "#94a3b8",
  PARCIALMENTE_CIERTO: "#fb923c",
};

function badgeClass(value = "") {
  return String(value).toLowerCase().replaceAll("_", "-");
}

function App() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingJobId, setLoadingJobId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const [claimText, setClaimText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const pollingIntervals = useRef({});
  const longIntervalRef = useRef(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(apiUrl(LIST_JOBS_PATH));

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setJobs(data.jobs || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error loading jobs:", err);
      setError("No se pudieron cargar los análisis. Verifica la conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const processingJobs = jobs.filter(job => job.status === 'processing');
    
    if (processingJobs.length === 0) return;
    
    processingJobs.forEach(job => {
      if (pollingIntervals.current[job.job_id]) return;
      
      pollingIntervals.current[job.job_id] = setInterval(async () => {
        try {
          const res = await fetch(apiUrl(`${RESULT_JOB_PATH}/${job.job_id}`));
          const data = await res.json();
          
          if (data.status !== 'processing') {
            clearInterval(pollingIntervals.current[job.job_id]);
            delete pollingIntervals.current[job.job_id];
            loadJobs();
          }
        } catch (err) {
          console.error(`Polling error for job ${job.job_id}:`, err);
          clearInterval(pollingIntervals.current[job.job_id]);
          delete pollingIntervals.current[job.job_id];
        }
      }, 3000);
    });
    
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
    };
  }, [jobs, loadJobs]);

  async function openDetail(jobId, status) {
    if (!jobId || status !== "completed") return;

    try {
      setLoadingJobId(jobId);
      setError(null);

      const res = await fetch(
        apiUrl(`${RESULT_JOB_PATH}/${jobId}`)
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      
      const jobMeta = jobs.find(j => j.job_id === jobId);
      setSelectedJob({ ...jobMeta, ...data });
    } catch (err) {
      console.error("Error loading detail:", err);
      setError("No se pudo cargar el análisis detallado.");
    } finally {
      setLoadingJobId(null);
    }
  }

  async function submitClaim() {
    if (!claimText.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(apiUrl(SUBMIT_JOB_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: claimText.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.job_id) {
        setClaimText("");
        loadJobs();
      } else {
        setSubmitError("El servidor no devolvió un job_id");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs;

    const term = searchTerm.toLowerCase();

    return jobs.filter(
      (job) =>
        job.claim?.toLowerCase().includes(term) ||
        job.verdict?.toLowerCase().includes(term) ||
        job.summary?.toLowerCase().includes(term)
    );
  }, [jobs, searchTerm]);

  const kpis = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const processing = jobs.filter((j) => j.status === "processing").length;
    const totalArticles = jobs.reduce(
      (sum, j) => sum + (j.articles_count || 0),
      0
    );

    const verdictDistribution = {};
    jobs.forEach((job) => {
      if (job.verdict) {
        verdictDistribution[job.verdict] =
          (verdictDistribution[job.verdict] || 0) + 1;
      }
    });

    const consensusDistribution = {};
    jobs.forEach((job) => {
      if (job.consensus) {
        consensusDistribution[job.consensus] =
          (consensusDistribution[job.consensus] || 0) + 1;
      }
    });

    return {
      total,
      completed,
      processing,
      totalArticles,
      verdictDistribution,
      consensusDistribution,
    };
  }, [jobs]);

  const verdictChartData = Object.entries(kpis.verdictDistribution).map(
    ([name, value]) => ({
      name: verdictLabels[name] || name,
      originalName: name,
      value,
    })
  );

  const consensusChartData = Object.entries(kpis.consensusDistribution).map(
    ([name, value]) => ({
      name: consensusLabels[name] || name,
      originalName: name,
      value,
    })
  );

  const detail = selectedJob?.result;
  const consensus = detail?.evidence_consensus;
  const articles = detail?.articles || [];

  const totalDirectional =
    (consensus?.supporting_count || 0) +
    (consensus?.contradicting_count || 0);

  const supportsPercent =
    totalDirectional > 0
      ? (consensus.supporting_count / totalDirectional) * 100
      : 0;

  const contradictsPercent =
    totalDirectional > 0
      ? (consensus.contradicting_count / totalDirectional) * 100
      : 0;

  const supportingArticles = articles.filter(
    (a) => a.relation_to_claim === "SUPPORTS_CLAIM"
  );

  const contradictingArticles = articles.filter(
    (a) => a.relation_to_claim === "CONTRADICTS_CLAIM"
  );

  const neutralArticles = articles.filter(
    (a) =>
      a.relation_to_claim === "DOES_NOT_SUPPORT_CLAIM" ||
      a.relation_to_claim === "UNCLEAR" ||
      !a.relation_to_claim
  );

  const getElapsedTime = (createdAt) => {
    if (!createdAt) return "";
    const elapsed = Math.floor((Date.now() - new Date(createdAt)) / 1000);
    if (elapsed < 30) return ` (${elapsed}s)`;
    if (elapsed < 60) return ` (${elapsed}s)`;
    return ` (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`;
  };

  return (
    <main className="page">
      <header className="header">
        <p className="eyebrow">EvidenceCheck AI</p>
        <h1>Biomedical Evidence Dashboard</h1>
        <p className="subtitle">
          Verificación automatizada de evidencia científica con IA, ranking y evaluación causal.
        </p>
{lastRefresh && (
  <p className="last-refresh">
    Última actualización: {lastRefresh.toLocaleDateString()} {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </p>
)}
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ============================================ */}
      {/* VISTA DETALLE (cuando hay un análisis seleccionado) */}
      {/* ============================================ */}
      {selectedJob && (
        <section className="detailPanel">
          <button className="backButton" onClick={() => setSelectedJob(null)}>
            ← Volver a análisis
          </button>

          <div className="detailHeader">
            <div>
              <span className={`badge ${badgeClass(selectedJob.status)}`}>
                {selectedJob.status}
              </span>
              <h2>{selectedJob.claim || selectedJob.result?.claim || "Afirmación no disponible"}</h2>
            </div>

            <div
              className={`detailVerdict verdict-${badgeClass(
                detail?.verdict
              )}`}
            >
              <span>Veredicto</span>
              <strong>
                {verdictLabels[detail?.verdict] ||
                  detail?.verdict ||
                  "Pendiente"}
              </strong>
            </div>
          </div>

          <div className="metrics detailMetrics">
            <div>
              <span>Confianza</span>
              <strong>{detail?.confidence || "-"}</strong>
            </div>

            <div>
              <span>Consenso</span>
              <strong>
                {consensusLabels[detail?.consensus] || detail?.consensus || "-"}
              </strong>
            </div>

            <div>
              <span>Artículos</span>
              <strong>{articles.length}</strong>
            </div>

            <div>
              <span>Generado</span>
              <strong>
                {detail?.generated_at
                  ? new Date(detail.generated_at).toLocaleString()
                  : "-"}
              </strong>
            </div>
          </div>

          <section className="detailSection highlight">
            <h3>Resumen</h3>
            <p>{detail?.summary}</p>
          </section>

          {consensus && (
            <section className="detailSection">
              <h3>⚖️ Balance de Evidencia</h3>

              {totalDirectional > 0 && (
                <div
                  style={{
                    marginBottom: "28px",
                    background: "rgba(2, 6, 23, 0.6)",
                    borderRadius: "20px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: "var(--muted)",
                    }}
                  >
                    <span>✓ A FAVOR</span>
                    <span>✗ EN CONTRA</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      height: "40px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div
                      style={{
                        width: `${supportsPercent}%`,
                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "15px",
                      }}
                    >
                      {supportsPercent > 15
                        ? `${Math.round(supportsPercent)}%`
                        : ""}
                    </div>

                    <div
                      style={{
                        width: `${contradictsPercent}%`,
                        background: "linear-gradient(135deg, #fb7185, #e11d48)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "15px",
                      }}
                    >
                      {contradictsPercent > 15
                        ? `${Math.round(contradictsPercent)}%`
                        : ""}
                    </div>
                  </div>
                </div>
              )}

              <div className="consensusGrid">
                <div className="consensusBox supports">
                  <span>✓ Apoyan la afirmación</span>
                  <strong>{consensus.supporting_count ?? 0}</strong>
                </div>

                <div className="consensusBox contradicts">
                  <span>✗ Contradicen la afirmación</span>
                  <strong>{consensus.contradicting_count ?? 0}</strong>
                </div>

                <div className="consensusBox neutral">
                  <span>? No concluyente / Neutral</span>
                  <strong>{consensus.neutral_or_unclear_count ?? 0}</strong>
                </div>
              </div>
            </section>
          )}

          <section className="detailSection">
            <h3>📚 Desglose de Evidencia por Artículo</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.06)",
                  borderRadius: "20px",
                  padding: "20px",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                }}
              >
                <h4
                  style={{
                    color: "var(--green)",
                    marginTop: 0,
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "18px",
                  }}
                >
                  <span>✓</span> APOYAN LA AFIRMACIÓN
                  <span
                    style={{
                      background: "rgba(34, 197, 94, 0.2)",
                      padding: "2px 10px",
                      borderRadius: "20px",
                      fontSize: "14px",
                    }}
                  >
                    {supportingArticles.length}
                  </span>
                </h4>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {supportingArticles.length > 0 ? (
                    supportingArticles.map((article) => (
                      <a
                        key={article.pmid}
                        href={article.pubmed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: "none",
                          background: "rgba(15, 23, 42, 0.9)",
                          borderRadius: "14px",
                          padding: "14px",
                          borderLeft: "3px solid var(--green)",
                          display: "block",
                        }}
                      >
                        <strong style={{ color: "white", fontSize: "14px" }}>
                          {article.title}
                        </strong>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            marginTop: "10px",
                            fontSize: "11px",
                          }}
                        >
                          <span
                            style={{
                              background: "rgba(0,0,0,0.5)",
                              padding: "3px 8px",
                              borderRadius: "10px",
                              color: "var(--muted)",
                            }}
                          >
                            PMID {article.pmid}
                          </span>
                          <span
                            style={{
                              background: "rgba(0,0,0,0.5)",
                              padding: "3px 8px",
                              borderRadius: "10px",
                              color: "var(--muted)",
                            }}
                          >
                            Puntuación {Number(article.final_score).toFixed(2)}
                          </span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <p
                      style={{
                        color: "var(--muted)",
                        fontStyle: "italic",
                        textAlign: "center",
                        padding: "20px",
                      }}
                    >
                      No se encontró evidencia que apoye la afirmación
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(251, 113, 133, 0.06)",
                  borderRadius: "20px",
                  padding: "20px",
                  border: "1px solid rgba(251, 113, 133, 0.2)",
                }}
              >
                <h4
                  style={{
                    color: "var(--red)",
                    marginTop: 0,
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "18px",
                  }}
                >
                  <span>✗</span> CONTRADICEN LA AFIRMACIÓN
                  <span
                    style={{
                      background: "rgba(251, 113, 133, 0.2)",
                      padding: "2px 10px",
                      borderRadius: "20px",
                      fontSize: "14px",
                    }}
                  >
                    {contradictingArticles.length}
                  </span>
                </h4>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {contradictingArticles.length > 0 ? (
                    contradictingArticles.map((article) => (
                      <a
                        key={article.pmid}
                        href={article.pubmed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: "none",
                          background: "rgba(15, 23, 42, 0.9)",
                          borderRadius: "14px",
                          padding: "14px",
                          borderLeft: "3px solid var(--red)",
                          display: "block",
                        }}
                      >
                        <strong style={{ color: "white", fontSize: "14px" }}>
                          {article.title}
                        </strong>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            marginTop: "10px",
                            fontSize: "11px",
                          }}
                        >
                          <span
                            style={{
                              background: "rgba(0,0,0,0.5)",
                              padding: "3px 8px",
                              borderRadius: "10px",
                              color: "var(--muted)",
                            }}
                          >
                            PMID {article.pmid}
                          </span>
                          <span
                            style={{
                              background: "rgba(0,0,0,0.5)",
                              padding: "3px 8px",
                              borderRadius: "10px",
                              color: "var(--muted)",
                            }}
                          >
                            Puntuación {Number(article.final_score).toFixed(2)}
                          </span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <p
                      style={{
                        color: "var(--muted)",
                        fontStyle: "italic",
                        textAlign: "center",
                        padding: "20px",
                      }}
                    >
                      No se encontró evidencia que contradiga la afirmación
                    </p>
                  )}
                </div>
              </div>
            </div>

            {neutralArticles.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <details style={{ cursor: "pointer" }}>
                  <summary style={{ color: "var(--muted)", fontSize: "13px" }}>
                    📄 {neutralArticles.length} artículo(s) con relación no concluyente
                  </summary>

                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {neutralArticles.map((article) => (
                      <a
                        key={article.pmid}
                        href={article.pubmed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: "none",
                          background: "rgba(15, 23, 42, 0.6)",
                          borderRadius: "12px",
                          padding: "12px",
                          display: "block",
                        }}
                      >
                        <span style={{ fontSize: "13px" }}>
                          {article.title}
                        </span>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "var(--muted)",
                            marginTop: "6px",
                          }}
                        >
                          PMID {article.pmid} · Puntuación {Number(article.final_score).toFixed(2)}
                        </div>
                      </a>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>

          <section className="detailSection">
            <h3>🔬 Análisis Detallado</h3>
            <p>{detail?.detailed_analysis}</p>
          </section>

          <section className="detailSection">
            <h3>📊 Evaluación Causal</h3>
            <p>
              {detail?.causal_assessment?.main_reason ||
                detail?.causal_assessment?.epidemiological_reasoning ||
                "No hay datos causales disponibles."}
            </p>
          </section>
        </section>
      )}

      {/* ============================================ */}
      {/* VISTA PRINCIPAL (cuando NO hay análisis seleccionado) */}
      {/* ============================================ */}
      {!selectedJob && (
        <>
          {/* FORMULARIO DE NUEVO ANÁLISIS */}
          <div className="submit-section">
            <h3>🔬 Nuevo Análisis</h3>
            <div className="submit-form">
              <textarea
                className="submit-input"
                placeholder="Ejemplo: 'La vitamina D reduce el riesgo de cáncer'"
                value={claimText}
                onChange={(e) => {
                  setClaimText(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                rows={2}
              />
              <button 
                className="submit-button" 
                onClick={submitClaim}
                disabled={isSubmitting || !claimText.trim()}
              >
                {isSubmitting ? "⏳ Enviando..." : "🚀 Analizar Afirmación"}
              </button>
              {submitError && <p className="submit-error">{submitError}</p>}
            </div>
          </div>

          {/* KPIS */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Análisis</span>
              <strong className="kpi-value">{kpis.total}</strong>
            </div>

            <div className="kpi-card completed">
              <span className="kpi-label">Completados</span>
              <strong className="kpi-value">{kpis.completed}</strong>
            </div>

            <div className="kpi-card processing">
              <span className="kpi-label">Procesando</span>
              <strong className="kpi-value">{kpis.processing}</strong>
            </div>

            <div className="kpi-card articles">
              <span className="kpi-label">Artículos Analizados</span>
              <strong className="kpi-value">{kpis.totalArticles}</strong>
            </div>
          </div>

          {/* GRÁFICOS */}
          {(verdictChartData.length > 0 || consensusChartData.length > 0) && (
            <div className="charts-grid">
              {verdictChartData.length > 0 && (
                <div className="chart-card">
                  <h3>Distribución de Verdictos</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={verdictChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {verdictChartData.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={
                              VERDICT_COLORS[entry.originalName] || "#94a3b8"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {consensusChartData.length > 0 && (
                <div className="chart-card">
                  <h3>Distribución de Consenso</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={consensusChartData}
                      layout="vertical"
                      margin={{ left: 80 }}
                    >
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#22d3ee" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* BUSCADOR */}
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Buscar afirmaciones, veredictos o resúmenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* LISTA DE ANÁLISIS */}
          {loading ? (
            <p className="loading">Cargando análisis...</p>
          ) : filteredJobs.length === 0 ? (
            <div className="no-results">
              <p>No se encontraron análisis que coincidan con "{searchTerm}"</p>
              <button className="viewButton" onClick={() => setSearchTerm("")}>
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <section className="grid">
              {filteredJobs.map((job) => (
                <article className="card" key={job.job_id}>
                  <div className="cardTop">
                    <span className={`badge ${badgeClass(job.status)}`}>
                      {job.status === 'processing' ? '⏳ ' : ''}{job.status === 'processing' ? 'Procesando' : job.status === 'completed' ? 'Completado' : job.status}
                    </span>
                    <span className="date">
                      {job.created_at
                        ? new Date(job.created_at).toLocaleString()
                        : "-"}
                    </span>
                  </div>

                  <h2>{job.claim || "Afirmación pendiente..."}</h2>

                  <div className="metrics">
                    <div>
                      <span>Veredicto</span>
                      <strong>
                        {job.status === 'processing' 
                          ? "⏳ Pendiente" 
                          : (verdictLabels[job.verdict] || job.verdict || "Pendiente")}
                      </strong>
                    </div>
                    <div>
                      <span>Confianza</span>
                      <strong>{job.status === 'processing' ? "-" : (job.confidence || "-")}</strong>
                    </div>
                    <div>
                      <span>Consenso</span>
                      <strong>
                        {job.status === 'processing' 
                          ? "-" 
                          : (consensusLabels[job.consensus] || job.consensus || "-")}
                      </strong>
                    </div>
                    <div>
                      <span>Artículos</span>
                      <strong>{job.status === 'processing' ? "⏳" : (job.articles_count ?? 0)}</strong>
                    </div>
                  </div>

                  <p className="summary">
                    {job.status === 'processing' 
                      ? `⏳ Análisis en progreso${getElapsedTime(job.created_at)}... Normalmente toma unos 30 segundos.` 
                      : (job.summary || "Resumen no disponible")}
                  </p>

                  <button
                    className="viewButton"
                    onClick={() => openDetail(job.job_id, job.status)}
                    disabled={
                      loadingJobId === job.job_id || job.status !== "completed"
                    }
                  >
                    {loadingJobId === job.job_id
                      ? "Cargando..."
                      : job.status !== "completed"
                      ? "Procesando..."
                      : "Ver Análisis"}
                  </button>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default App;