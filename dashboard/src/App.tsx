import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import "./App.css";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

const API_BASE = "https://n8n.orbisautomations.com/webhook";
const RESULT_WEBHOOK_ID = "b3a0e855-cd74-456f-b217-6d15618482f6";

// ============================================
// Tipos TypeScript
// ============================================
interface Article {
  pmid: string;
  title: string;
  pubmed_url?: string;
  url?: string;
  final_score?: number;
  relation_to_claim?: string;
}

interface Job {
  job_id: string;
  status: string;
  claim: string;
  verdict: string | null;
  confidence: string | null;
  consensus: string | null;
  summary: string | null;
  articles_count: number;
  created_at: string;
  updated_at: string;
  error: string | null;
  language?: string;
  result?: {
    verdict?: string;
    confidence?: string;
    consensus?: string;
    summary?: string;
    generated_at?: string;
    detailed_analysis?: string;
    evidence_consensus?: {
      supporting_count: number;
      contradicting_count: number;
      neutral_or_unclear_count: number;
    };
    articles?: Article[];
    causal_assessment?: {
      main_reason?: string;
      epidemiological_reasoning?: string;
    };
  };
}

type Lang = "es" | "en";

// ============================================
// i18n — traducciones completas
// ============================================
const TRANSLATIONS: Record<Lang, any> = {
  es: {
    eyebrow: "EvidenceCheck AI",
    title: "Biomedical Evidence Dashboard",
    subtitle: "Verificación automatizada de evidencia científica con IA, ranking y evaluación causal.",
    lastRefresh: "Última actualización",
    newAnalysis: "🔬 Nuevo Análisis",
    placeholder: "Ejemplo: 'La vitamina D reduce el riesgo de cáncer'",
    submitting: "⏳ Enviando...",
    analyzeBtn: "🚀 Analizar Afirmación",
    serverError: "El servidor no devolvió un job_id",
    connectionError: "Error de conexión. Intenta de nuevo.",
    loadError: "No se pudieron cargar los análisis. Verifica la conexión.",
    detailError: "No se pudo cargar el análisis detallado.",
    kpiTotal: "Total Análisis",
    kpiCompleted: "Completados",
    kpiProcessing: "Procesando",
    kpiArticles: "Artículos Analizados",
    chartVerdicts: "Distribución de Verdictos",
    chartConsensus: "Distribución de Consenso",
    searchPlaceholder: "🔍 Buscar afirmaciones, veredictos o resúmenes...",
    noResults: (term: string) => `No se encontraron análisis que coincidan con "${term}"`,
    clearSearch: "Limpiar búsqueda",
    loading: "Cargando análisis...",
    processing: "Procesando",
    completed: "Completado",
    pending: "Pendiente",
    analyzing: (s: string) => `⏳ Análisis en progreso${s}... Normalmente toma unos 30 segundos.`,
    summaryUnavailable: "Resumen no disponible",
    viewAnalysis: "Ver Análisis",
    loadingDetail: "Cargando...",
    processingBtn: "Procesando...",
    back: "← Volver a análisis",
    verdict: "Veredicto",
    confidence: "Confianza",
    consensus: "Consenso",
    articles: "Artículos",
    generated: "Generado",
    summaryTitle: "Resumen",
    evidenceBalance: "⚖️ Balance de Evidencia",
    inFavor: "✓ A FAVOR",
    against: "✗ EN CONTRA",
    supports: "✓ Apoyan la afirmación",
    contradicts: "✗ Contradicen la afirmación",
    neutral: "? No concluyente / Neutral",
    evidenceBreakdown: "📚 Artículos por Posición",
    supportsTitle: "✓ APOYAN LA AFIRMACIÓN",
    contradictsTitle: "✗ CONTRADICEN LA AFIRMACIÓN",
    noSupporting: "No se encontró evidencia que apoye la afirmación",
    noContradicting: "No se encontró evidencia que contradiga la afirmación",
    neutralArticles: (n: number) => `📄 ${n} artículo(s) con relación no concluyente`,
    score: "Puntuación",
    detailedAnalysis: "🔬 Análisis Detallado",
    causalAssessment: "📊 Evaluación Causal",
    noCausal: "No hay datos causales disponibles.",
    analysisNote: "⚠️ El contenido del análisis se genera en español independientemente del idioma de la interfaz.",
    verdictLabels: {
      VERDADERO: "🟢 VERDADERO",
      EXAGERADO: "🟡 EXAGERADO",
      FALSO: "🔴 FALSO",
      EVIDENCIA_INSUFICIENTE: "⚪ INSUFICIENTE",
      PARCIALMENTE_CIERTO: "🟠 PARCIAL",
      TRUE: "🟢 VERDADERO",
      EXAGGERATED: "🟡 EXAGERADO",
      FALSE: "🔴 FALSO",
      INSUFFICIENT_EVIDENCE: "⚪ INSUFICIENTE",
      PARTIALLY_TRUE: "🟠 PARCIAL",
    },
    confidenceLabels: {
  HIGH: "ALTA",
  MEDIUM: "MEDIA",
  LOW: "BAJA",
  VERY_HIGH: "MUY ALTA",
  VERY_LOW: "MUY BAJA",
},
    consensusLabels: {
      STRONG: "FUERTE", MODERATE: "MODERADO", WEAK: "DÉBIL",
      MIXED: "MIXTO", INSUFFICIENT: "INSUFICIENTE", UNCLEAR: "NO CLARO",
      FUERTE: "FUERTE", MODERADO: "MODERADO", DÉBIL: "DÉBIL", DEBIL: "DÉBIL",
      MIXTO: "MIXTO", INSUFICIENTE: "INSUFICIENTE",
    },
  },
  en: {
    eyebrow: "EvidenceCheck AI",
    title: "Biomedical Evidence Dashboard",
    subtitle: "Automated scientific evidence verification with AI reasoning, ranking and causal assessment.",
    lastRefresh: "Last refresh",
    newAnalysis: "🔬 New Analysis",
    placeholder: "E.g. 'Vitamin D reduces the risk of cancer'",
    submitting: "⏳ Submitting...",
    analyzeBtn: "🚀 Analyze Claim",
    serverError: "Server did not return a job_id",
    connectionError: "Connection error. Please try again.",
    loadError: "Could not load analyses. Check connection.",
    detailError: "Could not load detailed analysis.",
    kpiTotal: "Total Analyses",
    kpiCompleted: "Completed",
    kpiProcessing: "Processing",
    kpiArticles: "Articles Analyzed",
    chartVerdicts: "Verdict Distribution",
    chartConsensus: "Consensus Distribution",
    searchPlaceholder: "🔍 Search claims, verdicts or summaries...",
    noResults: (term: string) => `No analyses found matching "${term}"`,
    clearSearch: "Clear search",
    loading: "Loading analyses...",
    processing: "Processing",
    completed: "Completed",
    pending: "Pending",
    analyzing: (s: string) => `⏳ Analysis in progress${s}... Usually takes about 30 seconds.`,
    summaryUnavailable: "Summary not available",
    viewAnalysis: "View Analysis",
    loadingDetail: "Loading...",
    processingBtn: "Processing...",
    back: "← Back to analyses",
    verdict: "Verdict",
    confidence: "Confidence",
    consensus: "Consensus",
    articles: "Articles",
    generated: "Generated",
    summaryTitle: "Summary",
    evidenceBalance: "⚖️ Evidence Balance",
    inFavor: "✓ IN FAVOR",
    against: "✗ AGAINST",
    supports: "✓ Support claim",
    contradicts: "✗ Contradict claim",
    neutral: "? Inconclusive / Neutral",
    evidenceBreakdown: "📚 Articles by Position",
    supportsTitle: "✓ SUPPORT CLAIM",
    contradictsTitle: "✗ CONTRADICT CLAIM",
    noSupporting: "No supporting evidence found",
    noContradicting: "No contradicting evidence found",
    neutralArticles: (n: number) => `📄 ${n} article(s) with inconclusive relation`,
    score: "Score",
    detailedAnalysis: "🔬 Detailed Analysis",
    causalAssessment: "📊 Causal Assessment",
    noCausal: "No causal data available.",
    analysisNote: "⚠️ Analysis content is generated in Spanish regardless of interface language.",
    verdictLabels: {
      VERDADERO: "🟢 TRUE",
      EXAGERADO: "🟡 EXAGGERATED",
      FALSO: "🔴 FALSE",
      EVIDENCIA_INSUFICIENTE: "⚪ INSUFFICIENT",
      PARCIALMENTE_CIERTO: "🟠 PARTIAL",
      TRUE: "🟢 TRUE",
      EXAGGERATED: "🟡 EXAGGERATED",
      FALSE: "🔴 FALSE",
      INSUFFICIENT_EVIDENCE: "⚪ INSUFFICIENT",
      PARTIALLY_TRUE: "🟠 PARTIAL",
    },
    confidenceLabels: {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  VERY_HIGH: "VERY HIGH",
  VERY_LOW: "VERY LOW",
},
    consensusLabels: {
      STRONG: "STRONG", MODERATE: "MODERATE", WEAK: "WEAK",
      MIXED: "MIXED", INSUFFICIENT: "INSUFFICIENT", UNCLEAR: "UNCLEAR",
      FUERTE: "STRONG", MODERADO: "MODERATE", DÉBIL: "WEAK", DEBIL: "WEAK",
      MIXTO: "MIXED", INSUFICIENTE: "INSUFFICIENT",
    },
  },
};

const VERDICT_COLORS: Record<string, string> = {
  VERDADERO: "#22c55e",
  EXAGERADO: "#facc15",
  FALSO: "#fb7185",
  EVIDENCIA_INSUFICIENTE: "#94a3b8",
  PARCIALMENTE_CIERTO: "#fb923c",
  TRUE: "#22c55e",
  EXAGGERATED: "#facc15",
  FALSE: "#fb7185",
  INSUFFICIENT_EVIDENCE: "#94a3b8",
  PARTIALLY_TRUE: "#fb923c",
};

const CONSENSUS_COLORS: Record<string, string> = {
  STRONG: "#22c55e",
  MODERATE: "#38bdf8",
  MIXED: "#facc15",
  WEAK: "#fb923c",
  INSUFFICIENT: "#94a3b8",
  UNCLEAR: "#64748b",
};

const VERDICT_ORDER = [
  "TRUE",
  "PARTIALLY_TRUE",
  "EXAGGERATED",
  "FALSE",
  "INSUFFICIENT_EVIDENCE",
];

const CONSENSUS_ORDER = [
  "STRONG",
  "MODERATE",
  "MIXED",
  "WEAK",
  "INSUFFICIENT",
  "UNCLEAR",
];

function normalizeVerdict(value: string | null | undefined): string {
  const key = String(value || "").trim().toUpperCase();
  const map: Record<string, string> = {
    VERDADERO: "TRUE",
    TRUE: "TRUE",
    FALSO: "FALSE",
    FALSE: "FALSE",
    EXAGERADO: "EXAGGERATED",
    EXAGGERATED: "EXAGGERATED",
    PARCIALMENTE_CIERTO: "PARTIALLY_TRUE",
    PARTIALLY_TRUE: "PARTIALLY_TRUE",
    EVIDENCIA_INSUFICIENTE: "INSUFFICIENT_EVIDENCE",
    INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
    INSUFFICIENT: "INSUFFICIENT_EVIDENCE",
  };
  return map[key] || key;
}

function normalizeConsensus(value: string | null | undefined): string {
  const key = String(value || "").trim().toUpperCase();
  const map: Record<string, string> = {
    FUERTE: "STRONG",
    STRONG: "STRONG",
    MODERADO: "MODERATE",
    MODERATE: "MODERATE",
    DÉBIL: "WEAK",
    DEBIL: "WEAK",
    WEAK: "WEAK",
    MIXTO: "MIXED",
    MIXED: "MIXED",
    INSUFICIENTE: "INSUFFICIENT",
    INSUFFICIENT: "INSUFFICIENT",
    "NO CLARO": "UNCLEAR",
    UNCLEAR: "UNCLEAR",
  };
  return map[key] || key;
}

function badgeClass(value: string) {
  return String(value).toLowerCase().replaceAll("_", "-");
}

function verdictCardClass(verdict: string | null | undefined, status: string) {
  if (status === "processing") return "card-processing";
  if (!verdict) return "";
  return "card-" + normalizeVerdict(verdict).toLowerCase().replaceAll("_", "-");
}

function getElapsedTime(createdAt: string) {
  if (!createdAt) return "";
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (elapsed < 60) return ` (${elapsed}s)`;
  return ` (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`;
}

// ============================================
// Language Toggle
// ============================================
function LangToggle({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <button
      onClick={() => onChange(lang === "es" ? "en" : "es")}
      style={{
        position: "fixed",
        top: "20px",
        right: "24px",
        background: "rgba(17,28,52,0.95)",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: "999px",
        padding: "8px 16px",
        color: "var(--muted)",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "700",
        zIndex: 1000,
        transition: "border-color 0.2s, color 0.2s",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--cyan)";
        e.currentTarget.style.color = "var(--cyan)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)";
        e.currentTarget.style.color = "var(--muted)";
      }}
    >
      {lang === "es" ? "🇪🇸 ES" : "🇬🇧 EN"}
    </button>
  );
}

// ============================================
// Article card (subcomponente reutilizable)
// ============================================
function ArticleLink({ article, accent, compact = false, scoreLabel }: { 
  article: Article; 
  accent: string; 
  compact?: boolean; 
  scoreLabel: string;
}) {
  const pubmedUrl = article.pubmed_url || article.url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
  return (
    <a
      href={pubmedUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        textDecoration: "none",
        background: compact ? "rgba(15,23,42,0.6)" : "rgba(15,23,42,0.9)",
        borderRadius: compact ? "12px" : "14px",
        padding: compact ? "12px" : "14px",
        borderLeft: `3px solid ${accent}`,
        display: "block",
      }}
    >
      <strong style={{ color: "white", fontSize: compact ? "13px" : "14px" }}>
        {article.title}
      </strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px", fontSize: "11px" }}>
        <span style={{ background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: "10px", color: "var(--muted)" }}>
          PMID {article.pmid}
        </span>
        {article.final_score !== undefined && (
          <span style={{ background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: "10px", color: "var(--muted)" }}>
            {scoreLabel} {Number(article.final_score).toFixed(2)}
          </span>
        )}
      </div>
    </a>
  );
}

// ============================================
// App principal
// ============================================
function App() {
  // Idioma — persistido en localStorage
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("ec_lang") as Lang;
    return saved === "es" || saved === "en" ? saved : "es";
  });
  const t = TRANSLATIONS[lang];

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("ec_lang", newLang);
    setJobs([]);
    setSelectedJob(null);
    setSearchTerm("");
    setError(null);
  };

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [claimText, setClaimText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/evidence-check-jobs?language=${lang}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError, lang]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const processingJobs = jobs.filter(job => job.status === "processing");
    if (processingJobs.length === 0) return;

    processingJobs.forEach(job => {
      if (pollingIntervals.current[job.job_id]) return;
      pollingIntervals.current[job.job_id] = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/${RESULT_WEBHOOK_ID}/evidence-check-result/${job.job_id}`);
          const data = await res.json();
          if (data.status !== "processing") {
            clearInterval(pollingIntervals.current[job.job_id]);
            delete pollingIntervals.current[job.job_id];
            loadJobs();
          }
        } catch {
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

  async function openDetail(jobId: string, status: string) {
    if (!jobId || status !== "completed") return;
    try {
      setLoadingJobId(jobId);
      setError(null);
      const res = await fetch(`${API_BASE}/${RESULT_WEBHOOK_ID}/evidence-check-result/${jobId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobMeta = jobs.find(j => j.job_id === jobId);
      setSelectedJob({ ...jobMeta, ...data });
    } catch {
      setError(t.detailError);
    } finally {
      setLoadingJobId(null);
    }
  }

  async function submitClaim() {
    if (!claimText.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`${API_BASE}/evidence-check-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: claimText.trim(), language: lang }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.job_id) {
        setClaimText("");
        loadJobs();
      } else {
        setSubmitError(t.serverError);
      }
    } catch {
      setSubmitError(t.connectionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs;
    const term = searchTerm.toLowerCase();
    return jobs.filter(
      job =>
        job.claim?.toLowerCase().includes(term) ||
        job.verdict?.toLowerCase().includes(term) ||
        job.summary?.toLowerCase().includes(term)
    );
  }, [jobs, searchTerm]);

  const kpis = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter(j => j.status === "completed").length;
    const processing = jobs.filter(j => j.status === "processing").length;
    const totalArticles = jobs.reduce((sum, j) => sum + (j.articles_count || 0), 0);
    const verdictDistribution: Record<string, number> = {};
    const consensusDistribution: Record<string, number> = {};
    jobs.forEach(job => {
      const normalizedVerdict = normalizeVerdict(job.verdict);
      const normalizedConsensus = normalizeConsensus(job.consensus);
      if (normalizedVerdict) {
        verdictDistribution[normalizedVerdict] = (verdictDistribution[normalizedVerdict] || 0) + 1;
      }
      if (normalizedConsensus) {
        consensusDistribution[normalizedConsensus] = (consensusDistribution[normalizedConsensus] || 0) + 1;
      }
    });
    return { total, completed, processing, totalArticles, verdictDistribution, consensusDistribution };
  }, [jobs]);

  const verdictChartData = VERDICT_ORDER
    .filter(name => kpis.verdictDistribution[name])
    .map(name => ({
      name: t.verdictLabels[name] || name,
      originalName: name,
      value: kpis.verdictDistribution[name],
    }));

  const consensusChartData = CONSENSUS_ORDER
    .filter(name => kpis.consensusDistribution[name])
    .map(name => ({
      name: t.consensusLabels[name] || name,
      originalName: name,
      value: kpis.consensusDistribution[name],
    }));

  const detail = selectedJob?.result;
  const consensus = detail?.evidence_consensus;
  const articles: Article[] = detail?.articles || [];

  const totalDirectional = (consensus?.supporting_count || 0) + (consensus?.contradicting_count || 0);
  const supportsPercent = totalDirectional > 0 ? (consensus.supporting_count / totalDirectional) * 100 : 0;
  const contradictsPercent = totalDirectional > 0 ? (consensus.contradicting_count / totalDirectional) * 100 : 0;

  const supportingArticles = articles.filter(a => a.relation_to_claim === "SUPPORTS_CLAIM");
  const contradictingArticles = articles.filter(a => a.relation_to_claim === "CONTRADICTS_CLAIM");
  const neutralArticles = articles.filter(
    a => a.relation_to_claim === "DOES_NOT_SUPPORT_CLAIM" || a.relation_to_claim === "UNCLEAR" || !a.relation_to_claim
  );

  return (
    <main className="page">
      <LangToggle lang={lang} onChange={handleLangChange} />

      <header className="header">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="subtitle">{t.subtitle}</p>
        {lastRefresh && (
          <p className="last-refresh">
            {t.lastRefresh}: {lastRefresh.toLocaleDateString()} {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* VISTA DETALLE */}
      {selectedJob && (
        <section className="detailPanel">
<div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
  <button className="backButton" onClick={() => setSelectedJob(null)}>
    ← {t.back.replace("←", "").trim()}
  </button>
</div>

          <div className="detailHeader">
            <div>
              <span className={`badge ${badgeClass(selectedJob.status)}`}>
                {selectedJob.status}
              </span>
              <h2>{selectedJob.claim || selectedJob.result?.claim || "—"}</h2>
            </div>
            <div className={`detailVerdict verdict-${badgeClass(detail?.verdict)}`}>
              <span>{t.verdict}</span>
              <strong>{t.verdictLabels[normalizeVerdict(detail?.verdict)] || detail?.verdict || t.pending}</strong>
            </div>
          </div>

          {lang === "en" && (
            <p style={{ color: "var(--muted)", fontSize: "12px", margin: "8px 0 0", fontStyle: "italic" }}>
              {t.analysisNote}
            </p>
          )}

          <div className="metrics detailMetrics">
            <div><span>{t.confidence}</span><strong>{detail?.confidence || "-"}</strong></div>
            <div><span>{t.consensus}</span><strong>{t.consensusLabels[normalizeConsensus(detail?.consensus)] || detail?.consensus || "-"}</strong></div>
            <div><span>{t.articles}</span><strong>{articles.length}</strong></div>
            <div><span>{t.generated}</span><strong>{detail?.generated_at ? new Date(detail.generated_at).toLocaleString() : "-"}</strong></div>
          </div>

          <section className="detailSection highlight">
            <h3>{t.summaryTitle}</h3>
            <p>{detail?.summary}</p>
          </section>

          {consensus && (
            <section className="detailSection">
              <h3>{t.evidenceBalance}</h3>
              {totalDirectional > 0 && (
                <div style={{ marginBottom: "28px", background: "rgba(2,6,23,0.6)", borderRadius: "20px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", color: "var(--muted)" }}>
                    <span>{t.inFavor}</span>
                    <span>{t.against}</span>
                  </div>
                  <div style={{ display: "flex", height: "40px", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                    <div style={{ width: `${supportsPercent}%`, background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "15px" }}>
                      {supportsPercent > 15 ? `${Math.round(supportsPercent)}%` : ""}
                    </div>
                    <div style={{ width: `${contradictsPercent}%`, background: "linear-gradient(135deg,#fb7185,#e11d48)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "15px" }}>
                      {contradictsPercent > 15 ? `${Math.round(contradictsPercent)}%` : ""}
                    </div>
                  </div>
                </div>
              )}
              <div className="consensusGrid">
                <div className="consensusBox supports"><span>{t.supports}</span><strong>{consensus.supporting_count ?? 0}</strong></div>
                <div className="consensusBox contradicts"><span>{t.contradicts}</span><strong>{consensus.contradicting_count ?? 0}</strong></div>
                <div className="consensusBox neutral"><span>{t.neutral}</span><strong>{consensus.neutral_or_unclear_count ?? 0}</strong></div>
              </div>
            </section>
          )}

          <section className="detailSection">
            <h3>{t.evidenceBreakdown}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "16px" }}>
              <div style={{ background: "rgba(34,197,94,0.06)", borderRadius: "20px", padding: "20px", border: "1px solid rgba(34,197,94,0.2)" }}>
                <h4 style={{ color: "var(--green)", marginTop: 0, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "18px" }}>
                  {t.supportsTitle}
                  <span style={{ background: "rgba(34,197,94,0.2)", padding: "2px 10px", borderRadius: "20px", fontSize: "14px" }}>
                    {supportingArticles.length}
                  </span>
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {supportingArticles.length > 0
                    ? supportingArticles.map(a => <ArticleLink key={a.pmid} article={a} accent="var(--green)" scoreLabel={t.score} />)
                    : <p style={{ color: "var(--muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>{t.noSupporting}</p>
                  }
                </div>
              </div>

              <div style={{ background: "rgba(251,113,133,0.06)", borderRadius: "20px", padding: "20px", border: "1px solid rgba(251,113,133,0.2)" }}>
                <h4 style={{ color: "var(--red)", marginTop: 0, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "18px" }}>
                  {t.contradictsTitle}
                  <span style={{ background: "rgba(251,113,133,0.2)", padding: "2px 10px", borderRadius: "20px", fontSize: "14px" }}>
                    {contradictingArticles.length}
                  </span>
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {contradictingArticles.length > 0
                    ? contradictingArticles.map(a => <ArticleLink key={a.pmid} article={a} accent="var(--red)" scoreLabel={t.score} />)
                    : <p style={{ color: "var(--muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>{t.noContradicting}</p>
                  }
                </div>
              </div>
            </div>

            {neutralArticles.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <details style={{ cursor: "pointer" }}>
                  <summary style={{ color: "var(--muted)", fontSize: "13px" }}>
                    {t.neutralArticles(neutralArticles.length)}
                  </summary>
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {neutralArticles.map(a => (
                      <a key={a.pmid} href={a.pubmed_url || `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`} target="_blank" rel="noopener noreferrer"
                        style={{ textDecoration: "none", background: "rgba(15,23,42,0.6)", borderRadius: "12px", padding: "12px", display: "block" }}>
                        <span style={{ fontSize: "13px" }}>{a.title}</span>
                        <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "6px" }}>
                          PMID {a.pmid} · {t.score} {Number(a.final_score).toFixed(2)}
                        </div>
                      </a>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>

          <section className="detailSection">
            <h3>{t.detailedAnalysis}</h3>
            <p>{detail?.detailed_analysis}</p>
          </section>

          <section className="detailSection">
            <h3>{t.causalAssessment}</h3>
            <p>{detail?.causal_assessment?.main_reason || detail?.causal_assessment?.epidemiological_reasoning || t.noCausal}</p>
          </section>
        </section>
      )}

      {/* VISTA PRINCIPAL */}
      {!selectedJob && (
        <>
          <div className="submit-section">
            <h3>{t.newAnalysis}</h3>
            <div className="submit-form">
              <textarea
                className="submit-input"
                placeholder={t.placeholder}
                value={claimText}
                onChange={(e) => {
                  setClaimText(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isSubmitting && claimText.trim()) {
                    submitClaim();
                  }
                }}
                rows={2}
              />
              <button className="submit-button" onClick={submitClaim} disabled={isSubmitting || !claimText.trim()}>
                {isSubmitting ? t.submitting : t.analyzeBtn}
              </button>
              {submitError && <p className="submit-error">{submitError}</p>}
            </div>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card"><span className="kpi-label">{t.kpiTotal}</span><strong className="kpi-value">{kpis.total}</strong></div>
            <div className="kpi-card completed"><span className="kpi-label">{t.kpiCompleted}</span><strong className="kpi-value">{kpis.completed}</strong></div>
            <div className="kpi-card processing"><span className="kpi-label">{t.kpiProcessing}</span><strong className="kpi-value">{kpis.processing}</strong></div>
            <div className="kpi-card articles"><span className="kpi-label">{t.kpiArticles}</span><strong className="kpi-value">{kpis.totalArticles}</strong></div>
          </div>

          {(verdictChartData.length > 0 || consensusChartData.length > 0) && (
            <div className="charts-grid">
              {verdictChartData.length > 0 && (
                <div className="chart-card">
                  <h3>{t.chartVerdicts}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={verdictChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                        {verdictChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={VERDICT_COLORS[entry.originalName] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {consensusChartData.length > 0 && (
                <div className="chart-card">
                  <h3>{t.chartConsensus}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={consensusChartData} layout="vertical" margin={{ left: 110, right: 36 }}>
                      <XAxis type="number" allowDecimals={false} stroke="#94a3b8" />
                      <YAxis type="category" dataKey="name" width={110} stroke="#e5e7eb" />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {consensusChartData.map((entry, idx) => (
                          <Cell key={`consensus-cell-${idx}`} fill={CONSENSUS_COLORS[entry.originalName] || "#22d3ee"} />
                        ))}
                        <LabelList dataKey="value" position="right" fill="#e5e7eb" fontSize={13} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="search-bar">
            <input type="text" className="search-input" placeholder={t.searchPlaceholder}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button className="search-clear" onClick={() => setSearchTerm("")}>✕</button>}
          </div>

          {loading ? (
            <p className="loading">{t.loading}</p>
          ) : filteredJobs.length === 0 ? (
            <div className="no-results">
              <p>{t.noResults(searchTerm)}</p>
              <button className="viewButton" onClick={() => setSearchTerm("")}>{t.clearSearch}</button>
            </div>
          ) : (
            <section className="grid">
              {filteredJobs.map((job) => (
                <article className={`card ${verdictCardClass(job.verdict, job.status)}`} key={job.job_id}>
                  <div className="cardTop">
                    <span className={`badge ${badgeClass(job.status)}`}>
                      {job.status === "processing" ? "⏳ " : ""}
                      {job.status === "processing" ? t.processing : job.status === "completed" ? t.completed : job.status}
                    </span>
                    <span className="date">
                      {job.created_at ? new Date(job.created_at).toLocaleString() : "-"}
                    </span>
                  </div>

                  <h2>{job.claim || "—"}</h2>

<div className="metrics">
  <div><span>{t.verdict}</span><strong>{job.status === "processing" ? `⏳ ${t.pending}` : (t.verdictLabels[normalizeVerdict(job.verdict)] || job.verdict || t.pending)}</strong></div>
  <div><span>{t.confidence}</span><strong>{job.status === "processing" ? "-" : (t.confidenceLabels?.[String(job.confidence).toUpperCase()] || job.confidence || "-")}</strong></div>
  <div><span>{t.consensus}</span><strong>{job.status === "processing" ? "-" : (t.consensusLabels[normalizeConsensus(job.consensus)] || job.consensus || "-")}</strong></div>
  <div><span>{t.articles}</span><strong>{job.status === "processing" ? "⏳" : (job.articles_count ?? 0)}</strong></div>
</div>

                  <p className="summary">
                    {job.status === "processing"
                      ? t.analyzing(getElapsedTime(job.created_at))
                      : (job.summary || t.summaryUnavailable)}
                  </p>

                  <button className="viewButton" onClick={() => openDetail(job.job_id, job.status)}
                    disabled={loadingJobId === job.job_id || job.status !== "completed"}>
                    {loadingJobId === job.job_id ? t.loadingDetail : job.status !== "completed" ? t.processingBtn : t.viewAnalysis}
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