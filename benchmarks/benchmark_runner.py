#!/usr/bin/env python3
"""
EvidenceCheck Benchmark Runner v2.0
====================================
Ejecuta claims contra el pipeline de EvidenceCheck y compara con expected values.
Soporta regresión automática, claims nicho, y reporte detallado.

ADAPTADO para EvidenceCheck AI con n8n:
  - Submit: POST /webhook/evidence-check-submit → devuelve {job_id, status}
  - Result: GET /webhook/evidence-check-result?job_id=xxx → devuelve JSON del pipeline
  - El pipeline guarda resultados en Postgres y el nodo "Preparar Dashboard JSON" 
    genera el output final con: verdict, confidence, consensus, articles, etc.

CORRECCIONES v2.0:
  - Normalización bidireccional única (canonical) para evitar falsos fallos ES/EN
  - papers_used: cuenta artículos con relation_to_claim != "UNCLEAR"
  - Exit code configurable con --min-score (default 0.8 = 80%)
  - Soporta benchmark_core.csv + benchmark_niche.csv

Uso:
    python benchmark_runner.py --webhook https://n8n.tudominio.com/webhook/evidence-check-submit \
                               --result-url https://n8n.tudominio.com/webhook/evidence-check-result \
                               --claims benchmark_core.csv \
                               --output results.json \
                               --baseline baseline.json \
                               --min-score 0.75

Autor: Generado para EvidenceCheck AI
"""

import argparse
import csv
import json
import sys
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
import urllib.request
import urllib.error


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

DEFAULT_TIMEOUT_SUBMIT = 30
DEFAULT_TIMEOUT_POLL = 300
DEFAULT_POLL_INTERVAL = 5
DEFAULT_MIN_SCORE = 0.80  # 80% de claims deben pasar para exit code 0


# ============================================================================
# CANONICAL NORMALIZATION (bidireccional única)
# ============================================================================

# Todos los valores se normalizan a un formato interno único.
# Esto evita falsos fallos cuando el pipeline devuelve ES o EN,
# o cuando el CSV tiene formatos mixtos.

VERDICT_CANONICAL = {
    # Español → canonical
    "VERDADERO": "VERDADERO",
    "PARCIALMENTE_CIERTO": "PARCIALMENTE_CIERTO",
    "EXAGERADO": "EXAGERADO",
    "FALSO": "FALSO",
    "EVIDENCIA_INSUFICIENTE": "EVIDENCIA_INSUFICIENTE",
    "ERROR_ANALISIS": "ERROR_ANALISIS",
    # Inglés → canonical
    "TRUE": "VERDADERO",
    "PARTIAL": "PARCIALMENTE_CIERTO",
    "PARTIALLY_TRUE": "PARCIALMENTE_CIERTO",
    "EXAGGERATED": "EXAGERADO",
    "FALSE": "FALSO",
    "INSUFFICIENT_EVIDENCE": "EVIDENCIA_INSUFICIENTE",
    "INSUFFICIENT": "EVIDENCIA_INSUFICIENTE",
}

CONSENSUS_CANONICAL = {
    # Español → canonical
    "FUERTE": "FUERTE",
    "MODERADO": "MODERADO",
    "DÉBIL": "DÉBIL",
    "DEBIL": "DÉBIL",
    "MIXTO": "MIXTO",
    "INSUFICIENTE": "INSUFICIENTE",
    # Inglés → canonical
    "STRONG": "FUERTE",
    "MODERATE": "MODERADO",
    "WEAK": "DÉBIL",
    "MIXED": "MIXTO",
    "INSUFFICIENT": "INSUFICIENTE",
    "UNCLEAR": "INSUFICIENTE",
    "NO_CLARO": "INSUFICIENTE",
}

CONFIDENCE_CANONICAL = {
    # Español → canonical
    "ALTA": "HIGH",
    "MODERADA": "MODERATE",
    "BAJA": "LOW",
    # Inglés → canonical (ya es el formato interno)
    "HIGH": "HIGH",
    "MODERATE": "MODERATE",
    "LOW": "LOW",
}


def canonical_verdict(value: Optional[str]) -> Optional[str]:
    """Normaliza cualquier veredicto al formato canonical interno.
    Si no está en el mapping, devuelve el valor original (no None).
    """
    if not value:
        return None
    val = value.strip().upper()
    return VERDICT_CANONICAL.get(val, val)


def canonical_consensus(value: Optional[str]) -> Optional[str]:
    """Normaliza cualquier consenso al formato canonical interno.
    Si no está en el mapping, devuelve el valor original (no None).
    """
    if not value:
        return None
    val = value.strip().upper()
    return CONSENSUS_CANONICAL.get(val, val)


def canonical_confidence(value: Optional[str]) -> Optional[str]:
    """Normaliza cualquier confidence al formato canonical interno.
    Si no está en el mapping, devuelve el valor original (no None).
    """
    if not value:
        return None
    val = value.strip().upper()
    return CONFIDENCE_CANONICAL.get(val, val)


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class BenchmarkClaim:
    """Un claim del benchmark con sus expected values (en formato canonical)."""
    id: str
    claim: str
    category: str
    expected_verdict: str
    expected_confidence: str
    expected_consensus: str
    causal_claim: bool
    expected_reasoning: str
    common_failure: str
    allowed_verdicts: List[str]
    allowed_confidence: List[str]
    allowed_consensus: List[str]

    @classmethod
    def from_csv_row(cls, row: Dict[str, str]) -> "BenchmarkClaim":
        """Parsea una fila del CSV y normaliza todo a canonical."""
        # Parsear allowed_verdicts (pueden ser "EXAGERADO|FALSO" o vacío)
        allowed_v = row.get("allowed_verdicts", "")
        verdicts = [v.strip() for v in allowed_v.split("|") if v.strip()] if allowed_v else []
        if not verdicts:
            verdicts = [row["expected_verdict"]]
        # Normalizar a canonical
        verdicts = [v for v in [canonical_verdict(v) for v in verdicts] if v]

        allowed_c = row.get("allowed_confidence", "")
        confidences = [c.strip() for c in allowed_c.split("|") if c.strip()] if allowed_c else []
        if not confidences:
            confidences = [row["expected_confidence"]]
        confidences = [c for c in [canonical_confidence(c) for c in confidences] if c]

        allowed_s = row.get("allowed_consensus", "")
        consensuses = [s.strip() for s in allowed_s.split("|") if s.strip()] if allowed_s else []
        if not consensuses:
            consensuses = [row["expected_consensus"]]
        consensuses = [s for s in [canonical_consensus(s) for s in consensuses] if s]

        return cls(
            id=row["id"],
            claim=row["claim"],
            category=row.get("category", ""),
            expected_verdict=canonical_verdict(row["expected_verdict"]) or row["expected_verdict"],
            expected_confidence=canonical_confidence(row["expected_confidence"]) or row["expected_confidence"],
            expected_consensus=canonical_consensus(row["expected_consensus"]) or row["expected_consensus"],
            causal_claim=row.get("causal_claim", "").lower() in ("true", "1", "yes"),
            expected_reasoning=row.get("expected_reasoning", ""),
            common_failure=row.get("common_failure", ""),
            allowed_verdicts=verdicts,
            allowed_confidence=confidences,
            allowed_consensus=consensuses,
        )


@dataclass
class BenchmarkResult:
    """Resultado de ejecutar un claim contra el pipeline."""
    claim_id: str
    claim: str
    category: str

    expected_verdict: str
    expected_confidence: str
    expected_consensus: str
    allowed_verdicts: List[str]
    allowed_confidence: List[str]
    allowed_consensus: List[str]

    actual_verdict: Optional[str]
    actual_confidence: Optional[str]
    actual_consensus: Optional[str]
    actual_reasoning: Optional[str]

    job_id: Optional[str]
    papers_found: int
    papers_used: int
    processing_time_ms: int
    execution_error: Optional[str]

    verdict_pass: bool
    confidence_pass: bool
    consensus_pass: bool
    overall_pass: bool
    fail_reasons: List[str]

    raw_result: Optional[dict]

    submitted_at: str
    completed_at: str
    poll_count: int


@dataclass
class BenchmarkReport:
    """Reporte agregado de todo el benchmark."""
    run_id: str
    timestamp: str
    total_claims: int
    passed: int
    failed: int
    score_pct: float

    by_dimension: Dict[str, Dict[str, int]]
    by_category: Dict[str, Dict[str, int]]
    by_pattern: Dict[str, int]

    regressions: List[Dict[str, Any]]
    improvements: List[Dict[str, Any]]

    results: List[BenchmarkResult]


# ============================================================================
# HTTP HELPERS
# ============================================================================

def http_post(url: str, data: dict, timeout: int = 30) -> dict:
    """POST JSON a una URL y devuelve JSON parseado."""
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "EvidenceCheckBenchmarkRunner/2.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code}: {body}")
    except Exception as e:
        raise RuntimeError(f"Request failed: {e}")


def http_get(url: str, timeout: int = 30) -> dict:
    """GET JSON de una URL."""
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "EvidenceCheckBenchmarkRunner/2.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        raise RuntimeError(f"GET failed: {e}")


# ============================================================================
# PIPELINE INTERFACE
# ============================================================================

class EvidenceCheckPipeline:
    """
    Interfaz para comunicarse con el pipeline de EvidenceCheck en n8n.

    Flujo:
      1. POST /evidence-check-submit → {job_id, status}
      2. GET /evidence-check-result?job_id=xxx → espera hasta status=completed
      3. El resultado contiene: verdict, confidence, consensus, articles, etc.
    """

    def __init__(self, submit_url: str, result_url: str, 
                 timeout_submit: int = DEFAULT_TIMEOUT_SUBMIT,
                 timeout_poll: int = DEFAULT_TIMEOUT_POLL,
                 poll_interval: int = DEFAULT_POLL_INTERVAL):
        self.submit_url = submit_url.rstrip("/")
        self.result_url = result_url.rstrip("/")
        self.timeout_submit = timeout_submit
        self.timeout_poll = timeout_poll
        self.poll_interval = poll_interval

    def submit(self, claim: BenchmarkClaim) -> str:
        """Envía un claim benchmark al pipeline y devuelve el benchmark_id."""
        payload = {
            "claim": claim.claim,
            "source": "benchmark",
            "benchmark_id": claim.id,
            "expected_verdict": claim.expected_verdict,
            "expected_confidence": claim.expected_confidence,
            "expected_consensus": claim.expected_consensus,
            "allowed_verdicts": "|".join(claim.allowed_verdicts),
            "allowed_confidence": "|".join(claim.allowed_confidence),
            "allowed_consensus": "|".join(claim.allowed_consensus),
            "category": claim.category,
            "language": "es",
        }

        http_post(self.submit_url, payload, self.timeout_submit)

        return claim.id

    def poll_result(self, benchmark_id: str) -> dict:
        """Poll hasta que el benchmark esté tested/error."""
        start = time.time()
        poll_count = 0

        while time.time() - start < self.timeout_poll:
            poll_count += 1

            try:
                resp = http_get(f"{self.result_url}?id={benchmark_id}", timeout=30)

                status = str(resp.get("status", "")).lower()
                execution_status = str(resp.get("execution_status", "")).lower()

                if status in ("tested", "completed", "done", "success"):
                    return {**resp, "_poll_count": poll_count, "_completed": True}

                if status in ("error", "failed") or execution_status in ("error", "failed"):
                    return {**resp, "_poll_count": poll_count, "_failed": True}

                time.sleep(self.poll_interval)

            except Exception:
                time.sleep(self.poll_interval)
                continue

        raise TimeoutError(f"Benchmark {benchmark_id} no completó en {self.timeout_poll}s")


# ============================================================================
# EXTRACTION & EVALUATION
# ============================================================================

def extract_result_fields(result: dict) -> dict:
    """
    Extrae los campos relevantes del resultado del pipeline n8n.
    Busca en múltiples lugares posibles del JSON.
    """
    # El nodo "Preparar Dashboard JSON" genera:
    #   verdict, confidence, consensus, summary, detailed_analysis, articles, job_id, claim
    # Pero también puede venir anidado en result: {result: {verdict, ...}}

    r = result.get("result", result)  # Si está anidado, desanidar

    return {
        "verdict": (
            r.get("verdict") or 
            r.get("veredicto") or 
            r.get("actual_verdict") or
            result.get("verdict") or
            result.get("veredicto") or
            result.get("actual_verdict")
        ),
        "confidence": (
            r.get("confidence") or 
            r.get("confidence_level") or 
            r.get("actual_confidence") or
            result.get("confidence") or
            result.get("confidence_level") or
            result.get("actual_confidence")
        ),
        "consensus": (
            r.get("consensus") or 
            r.get("consensus_level") or 
            r.get("actual_consensus") or
            result.get("consensus") or
            result.get("consensus_level") or
            result.get("actual_consensus")
        ),
        "reasoning": (
            r.get("detailed_analysis") or 
            r.get("analisis_detallado") or 
            r.get("actual_reasoning") or
            result.get("detailed_analysis") or
            result.get("analisis_detallado") or
            result.get("actual_reasoning")
        ),
        "articles": (
            r.get("articles") or 
            result.get("articles") or []
        ),
        "status": (
            r.get("status") or 
            result.get("status") or "unknown"
        ),
    }


def count_papers_used(articles: List[dict]) -> int:
    """
    Cuenta artículos que fueron realmente usados en el análisis.
    El pipeline no envía 'used_in_analysis', así que usamos heurística:
    - Artículos con relation_to_claim != "UNCLEAR" fueron considerados relevantes
    - Si no hay relation_to_claim, asumimos que todos los artículos devueltos fueron usados
    """
    if not articles:
        return 0

    # Si hay relation_to_claim, contar los que no son UNCLEAR
    with_relation = [a for a in articles if a.get("relation_to_claim")]
    if with_relation:
        return len([a for a in with_relation if a.get("relation_to_claim") != "UNCLEAR"])

    # Si no hay relation_to_claim, todos fueron usados
    return len(articles)


def evaluate_claim(claim: BenchmarkClaim, result: dict) -> BenchmarkResult:
    """Evalúa si el resultado actual coincide con lo esperado (todo en canonical)."""

    fields = extract_result_fields(result)

    # Normalizar a canonical
    actual_verdict = canonical_verdict(fields["verdict"])
    actual_confidence = canonical_confidence(fields["confidence"])
    actual_consensus = canonical_consensus(fields["consensus"])
    actual_reasoning = fields["reasoning"]
    articles = fields["articles"]

    # Evaluar cada dimensión (comparación en canonical)
    verdict_pass = actual_verdict in claim.allowed_verdicts if actual_verdict else False
    confidence_pass = actual_confidence in claim.allowed_confidence if actual_confidence else False
    consensus_pass = actual_consensus in claim.allowed_consensus if actual_consensus else False

    overall_pass = verdict_pass and confidence_pass and consensus_pass

    # Construir razones de fallo (mostrar en formato legible)
    fail_reasons = []
    if not verdict_pass:
        fail_reasons.append(
            f"Veredicto esperado {' o '.join(claim.allowed_verdicts)}, recibido {actual_verdict or 'NULL'}"
        )
    if not confidence_pass:
        fail_reasons.append(
            f"Confidence esperada {' o '.join(claim.allowed_confidence)}, recibida {actual_confidence or 'NULL'}"
        )
    if not consensus_pass:
        fail_reasons.append(
            f"Consensus esperado {' o '.join(claim.allowed_consensus)}, recibido {actual_consensus or 'NULL'}"
        )

    return BenchmarkResult(
        claim_id=claim.id,
        claim=claim.claim,
        category=claim.category,
        expected_verdict=claim.expected_verdict,
        expected_confidence=claim.expected_confidence,
        expected_consensus=claim.expected_consensus,
        allowed_verdicts=claim.allowed_verdicts,
        allowed_confidence=claim.allowed_confidence,
        allowed_consensus=claim.allowed_consensus,
        actual_verdict=actual_verdict,
        actual_confidence=actual_confidence,
        actual_consensus=actual_consensus,
        actual_reasoning=actual_reasoning,
        job_id=result.get("job_id"),
        papers_found=len(articles),
        papers_used=count_papers_used(articles),
        processing_time_ms=result.get("processing_time_ms", 0),
        execution_error=result.get("error") or result.get("execution_error"),
        verdict_pass=verdict_pass,
        confidence_pass=confidence_pass,
        consensus_pass=consensus_pass,
        overall_pass=overall_pass,
        fail_reasons=fail_reasons,
        raw_result=result,
        submitted_at=result.get("_submitted_at", datetime.now().isoformat()),
        completed_at=datetime.now().isoformat(),
        poll_count=result.get("_poll_count", 0),
    )


def detect_failure_pattern(result: BenchmarkResult) -> Optional[str]:
    """Detecta patrones de falla para análisis agregado."""
    if result.overall_pass:
        return None

    # Patrón 0: TIMEOUT / Pipeline error (infraestructura, no ciencia)
    if result.execution_error:
        error_str = result.execution_error.lower()
        if any(kw in error_str for kw in ["timeout", "time out", "timed out", "no completó"]):
            return "TIMEOUT"
        if "pipeline error" in error_str:
            return "PIPELINE_ERROR"

    # Patrón 1: Consenso MIXED vs MODERATE (el más común en tu benchmark)
    if "MIXTO" in result.allowed_consensus and result.actual_consensus == "MODERADO" and not result.consensus_pass:
        return "MIXED_vs_MODERATE"

    # Patrón 2: EXAGERADO vs FALSO
    if "EXAGERADO" in result.allowed_verdicts and result.actual_verdict == "FALSO":
        return "EXAGERADO_vs_FALSO"

    # Patrón 3: FALSO vs EXAGERADO
    if result.expected_verdict == "FALSO" and result.actual_verdict == "EXAGERADO":
        return "FALSO_vs_EXAGERADO"

    # Patrón 4: EVIDENCIA_INSUFICIENTE inesperado
    if result.actual_verdict == "EVIDENCIA_INSUFICIENTE":
        return "UNEXPECTED_INSUFFICIENT"

    # Patrón 5: Confidence MODERATE vs HIGH
    if result.expected_confidence == "MODERATE" and result.actual_confidence == "HIGH":
        return "MODERATE_vs_HIGH_CONFIDENCE"

    # Patrón 6: STRONG vs MIXED consensus
    if "FUERTE" in result.allowed_consensus and result.actual_consensus == "MIXTO":
        return "STRONG_vs_MIXED_CONSENSUS"

    # Patrón 7: ERROR_ANALISIS
    if result.actual_verdict == "ERROR_ANALISIS":
        return "ANALYSIS_ERROR"

    return "OTHER"


# ============================================================================
# REGRESSION ANALYSIS
# ============================================================================

def load_baseline(path: str) -> Dict[str, dict]:
    """Carga un baseline previo para comparación."""
    if not Path(path).exists():
        return {}

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return {r["claim_id"]: r for r in data.get("results", [])}


def compare_with_baseline(current: List[BenchmarkResult], baseline: Dict[str, dict]) -> tuple:
    """Compara resultados actuales con baseline. Devuelve (regressions, improvements)."""
    regressions = []
    improvements = []

    for result in current:
        prev = baseline.get(result.claim_id)
        if not prev:
            continue

        was_pass = prev.get("overall_pass", False)

        if was_pass and not result.overall_pass:
            regressions.append({
                "claim_id": result.claim_id,
                "claim": result.claim,
                "before": {
                    "verdict": prev.get("actual_verdict"),
                    "confidence": prev.get("actual_confidence"),
                    "consensus": prev.get("actual_consensus"),
                },
                "after": {
                    "verdict": result.actual_verdict,
                    "confidence": result.actual_confidence,
                    "consensus": result.actual_consensus,
                },
                "reason": "; ".join(result.fail_reasons),
            })

        elif not was_pass and result.overall_pass:
            improvements.append({
                "claim_id": result.claim_id,
                "claim": result.claim,
                "before": {
                    "verdict": prev.get("actual_verdict"),
                    "confidence": prev.get("actual_confidence"),
                    "consensus": prev.get("actual_consensus"),
                },
                "after": {
                    "verdict": result.actual_verdict,
                    "confidence": result.actual_confidence,
                    "consensus": result.actual_consensus,
                },
            })

    return regressions, improvements


# ============================================================================
# REPORTING
# ============================================================================

def generate_report(results: List[BenchmarkResult], baseline_path: Optional[str] = None) -> BenchmarkReport:
    """Genera el reporte agregado."""

    total = len(results)
    passed = sum(1 for r in results if r.overall_pass)
    failed = total - passed
    score_pct = round(passed / total * 100, 1) if total else 0.0

    by_dimension = {
        "verdict": {"correct": 0, "incorrect": 0},
        "confidence": {"correct": 0, "incorrect": 0},
        "consensus": {"correct": 0, "incorrect": 0},
    }
    for r in results:
        by_dimension["verdict"]["correct" if r.verdict_pass else "incorrect"] += 1
        by_dimension["confidence"]["correct" if r.confidence_pass else "incorrect"] += 1
        by_dimension["consensus"]["correct" if r.consensus_pass else "incorrect"] += 1

    by_category: Dict[str, Dict[str, int]] = {}
    for r in results:
        cat = r.category or "unknown"
        if cat not in by_category:
            by_category[cat] = {"total": 0, "passed": 0, "failed": 0}
        by_category[cat]["total"] += 1
        if r.overall_pass:
            by_category[cat]["passed"] += 1
        else:
            by_category[cat]["failed"] += 1

    by_pattern: Dict[str, int] = {}
    for r in results:
        pattern = detect_failure_pattern(r)
        if pattern:
            by_pattern[pattern] = by_pattern.get(pattern, 0) + 1

    regressions = []
    improvements = []
    if baseline_path:
        baseline = load_baseline(baseline_path)
        regressions, improvements = compare_with_baseline(results, baseline)

    return BenchmarkReport(
        run_id=str(uuid.uuid4())[:8],
        timestamp=datetime.now().isoformat(),
        total_claims=total,
        passed=passed,
        failed=failed,
        score_pct=score_pct,
        by_dimension=by_dimension,
        by_category=by_category,
        by_pattern=by_pattern,
        regressions=regressions,
        improvements=improvements,
        results=results,
    )


def print_report(report: BenchmarkReport):
    """Imprime el reporte en consola de forma legible."""

    print("=" * 70)
    print(f"  EVIDENCECHECK BENCHMARK v2.0")
    print(f"  Run ID: {report.run_id} | {report.timestamp}")
    print("=" * 70)

    print(f"\n📊 SCORE GLOBAL: {report.passed}/{report.total_claims} ({report.score_pct:.1f}%)")
    print(f"   ✅ Pasaron: {report.passed}")
    print(f"   ❌ Fallaron: {report.failed}")

    print(f"\n📋 POR DIMENSIÓN:")
    for dim, counts in report.by_dimension.items():
        total_dim = counts["correct"] + counts["incorrect"]
        pct_dim = (counts["correct"] / total_dim * 100) if total_dim else 0
        print(f"   {dim.capitalize():12} {counts['correct']}/{total_dim} correctos ({pct_dim:.0f}%)")

    print(f"\n📂 POR CATEGORÍA:")
    for cat, counts in sorted(report.by_category.items()):
        pct_cat = (counts["passed"] / counts["total"] * 100) if counts["total"] else 0
        print(f"   {cat:25} {counts['passed']}/{counts['total']} ({pct_cat:.0f}%)")

    if report.by_pattern:
        print(f"\n🔍 PATRONES DE FALLA DETECTADOS:")
        for pattern, count in sorted(report.by_pattern.items(), key=lambda x: -x[1]):
            desc = {
                "TIMEOUT": "⏱️  Timeout del pipeline (infraestructura)",
                "PIPELINE_ERROR": "💥 Error del pipeline (no ciencia)",
                "MIXED_vs_MODERATE": "Consenso MIXED interpretado como MODERATE",
                "EXAGERADO_vs_FALSO": "Claim EXAGERADO marcado como FALSO",
                "FALSO_vs_EXAGERADO": "Claim FALSO marcado como EXAGERADO",
                "UNEXPECTED_INSUFFICIENT": "EVIDENCIA_INSUFICIENTE inesperado",
                "MODERATE_vs_HIGH_CONFIDENCE": "Confidence MODERATE marcada como HIGH",
                "STRONG_vs_MIXED_CONSENSUS": "Consenso STRONG interpretado como MIXED",
                "ANALYSIS_ERROR": "Error en el análisis de Gemini",
                "OTHER": "Otro patrón no clasificado",
            }.get(pattern, pattern)
            print(f"   {desc:45} {count} caso(s)")

    if report.regressions:
        print(f"\n🚨 REGRESIONES ({len(report.regressions)}):")
        for reg in report.regressions:
            print(f"   ❌ {reg['claim'][:50]}...")
            print(f"      Antes: {reg['before']['verdict']}/{reg['before']['confidence']}/{reg['before']['consensus']}")
            print(f"      Ahora: {reg['after']['verdict']}/{reg['after']['confidence']}/{reg['after']['consensus']}")

    if report.improvements:
        print(f"\n✨ MEJORAS ({len(report.improvements)}):")
        for imp in report.improvements:
            print(f"   ✅ {imp['claim'][:50]}...")
            print(f"      Antes: {imp['before']['verdict']}/{imp['before']['confidence']}/{imp['before']['consensus']}")
            print(f"      Ahora: {imp['after']['verdict']}/{imp['after']['confidence']}/{imp['after']['consensus']}")

    failed_results = [r for r in report.results if not r.overall_pass]
    if failed_results:
        print(f"\n❌ DETALLE DE FALLOS ({len(failed_results)}):")
        for r in failed_results:
            print(f"\n[{r.claim_id[:8]}] {r.claim[:55]}...")
            print(f"      Esperado: {r.expected_verdict} | {r.expected_confidence} | {r.expected_consensus}")
            print(f"      Actual:   {r.actual_verdict} | {r.actual_confidence} | {r.actual_consensus}")
            for reason in r.fail_reasons:
                print(f"      ⚠️  {reason}")

    print("\n" + "=" * 70)


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="EvidenceCheck Benchmark Runner v2.0 - Evalúa claims contra el pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # Benchmark core (25 claims clásicos)
  python benchmark_runner.py --webhook https://your-n8n-domain.com/webhook/evidence-check-submit \
                             --result-url https://your-n8n-domain.com/webhook/evidence-check-result \
                             --claims benchmark_core.csv

  # Benchmark nicho (claims difíciles donde EvidenceCheck aporta valor)
  python benchmark_runner.py ... --claims benchmark_niche.csv --output niche_results.json

  # Con baseline para detectar regresiones
  python benchmark_runner.py ... --baseline baseline.json --output results.json

  # Con umbral de score personalizado (default: 0.80 = 80%)
  python benchmark_runner.py ... --min-score 0.75

  # Solo claims de una categoría
  python benchmark_runner.py ... --filter-category supplements

  # Validar CSV sin ejecutar
  python benchmark_runner.py --claims benchmark.csv --dry-run
        """
    )

    parser.add_argument("--webhook", required=True, help="URL del webhook de submit (evidence-check-submit)")
    parser.add_argument("--result-url", required=True, help="URL del webhook de resultado (evidence-check-result)")
    parser.add_argument("--claims", required=True, help="Path al CSV de claims de benchmark (benchmark_core.csv o benchmark_niche.csv)")
    parser.add_argument("--output", default="benchmark_results.json", help="Path para guardar resultados JSON")
    parser.add_argument("--baseline", help="Path a baseline previo para comparación de regresiones")
    parser.add_argument("--min-score", type=float, default=DEFAULT_MIN_SCORE, 
                        help=f"Score mínimo para exit code 0 (default: {DEFAULT_MIN_SCORE})")
    parser.add_argument("--filter-category", help="Filtrar solo claims de esta categoría")
    parser.add_argument("--filter-ids", help="IDs específicos a ejecutar (coma-separados)")
    parser.add_argument("--timeout-poll", type=int, default=DEFAULT_TIMEOUT_POLL, 
                        help=f"Timeout máximo de polling en segundos (default: {DEFAULT_TIMEOUT_POLL})")
    parser.add_argument("--poll-interval", type=int, default=DEFAULT_POLL_INTERVAL, 
                        help=f"Intervalo entre polls en segundos (default: {DEFAULT_POLL_INTERVAL})")
    parser.add_argument("--dry-run", action="store_true", help="Valida CSV sin ejecutar pipeline")
    parser.add_argument("--verbose", "-v", action="store_true", help="Output detallado por claim")

    args = parser.parse_args()

    # Cargar claims
    claims = []
    with open(args.claims, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            claims.append(BenchmarkClaim.from_csv_row(row))

    print(f"📥 Cargados {len(claims)} claims desde {args.claims}")

    # Filtrar si se pidió
    if args.filter_category:
        claims = [c for c in claims if c.category == args.filter_category]
        print(f"🔍 Filtrado a {len(claims)} claims de categoría '{args.filter_category}'")

    if args.filter_ids:
        ids = set(args.filter_ids.split(","))
        claims = [c for c in claims if c.id in ids]
        print(f"🔍 Filtrado a {len(claims)} claims por ID")

    if args.dry_run:
        print("\nCSV válido. Claims cargados correctamente.")
        print("\nFormato interno (canonical):")
        for c in claims[:3]:
            print(f"   {c.id[:8]}... | V:{c.expected_verdict} C:{c.expected_confidence} S:{c.expected_consensus}")
        if len(claims) > 3:
            print(f"   ... y {len(claims) - 3} más")
        return

    # Inicializar pipeline
    pipeline = EvidenceCheckPipeline(
        submit_url=args.webhook,
        result_url=args.result_url,
        timeout_poll=args.timeout_poll,
        poll_interval=args.poll_interval,
    )

    # Ejecutar benchmark
    results = []

    for i, claim in enumerate(claims, 1):
        print(f"\n[{i}/{len(claims)}] {claim.claim[:60]}...")

        try:
            benchmark_id = pipeline.submit(claim)
            (f"   📤 Benchmark ID: {benchmark_id}")

            result = pipeline.poll_result(benchmark_id)
            print(f"   ⏱️  Polls: {result.get('_poll_count', 0)} | Status: {result.get('status', 'unknown')}")

            benchmark_result = evaluate_claim(claim, result)
            results.append(benchmark_result)

            status = "✅ PASS" if benchmark_result.overall_pass else "❌ FAIL"
            print(f"   {status} | V:{benchmark_result.actual_verdict} C:{benchmark_result.actual_confidence} S:{benchmark_result.actual_consensus}")

            if not benchmark_result.overall_pass and args.verbose:
                for reason in benchmark_result.fail_reasons:
                    print(f"      ⚠️  {reason}")

        except Exception as e:
            print(f"   💥 ERROR: {e}")
            results.append(BenchmarkResult(
                claim_id=claim.id,
                claim=claim.claim,
                category=claim.category,
                expected_verdict=claim.expected_verdict,
                expected_confidence=claim.expected_confidence,
                expected_consensus=claim.expected_consensus,
                allowed_verdicts=claim.allowed_verdicts,
                allowed_confidence=claim.allowed_confidence,
                allowed_consensus=claim.allowed_consensus,
                actual_verdict=None,
                actual_confidence=None,
                actual_consensus=None,
                actual_reasoning=None,
                job_id=None,
                papers_found=0,
                papers_used=0,
                processing_time_ms=0,
                execution_error=str(e),
                verdict_pass=False,
                confidence_pass=False,
                consensus_pass=False,
                overall_pass=False,
                fail_reasons=[f"Pipeline error: {e}"],
                raw_result={"error": str(e), "error_type": "TIMEOUT" if "timeout" in str(e).lower() or "time" in str(e).lower() else "OTHER"},
                submitted_at=datetime.now().isoformat(),
                completed_at=datetime.now().isoformat(),
                poll_count=0,
            ))

    # Generar reporte
    report = generate_report(results, args.baseline)

    # Imprimir
    print_report(report)

    # Guardar
    output_data = {
        "run_id": report.run_id,
        "timestamp": report.timestamp,
        "config": {
            "webhook": args.webhook,
            "result_url": args.result_url,
            "claims_file": args.claims,
            "baseline": args.baseline,
            "min_score": args.min_score,
        },
        "summary": {
            "total": report.total_claims,
            "passed": report.passed,
            "failed": report.failed,
            "score_pct": report.score_pct,
        },
        "by_dimension": report.by_dimension,
        "by_category": report.by_category,
        "by_pattern": report.by_pattern,
        "regressions": report.regressions,
        "improvements": report.improvements,
        "results": [asdict(r) for r in report.results],
    }

    # Serializar raw_result de forma segura (puede contener valores no estándar)
    def serialize_raw(obj):
        if isinstance(obj, dict):
            return {k: serialize_raw(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize_raw(v) for v in obj]
        if isinstance(obj, (str, int, float, bool)) or obj is None:
            return obj
        return str(obj)

    # Asegurar que raw_result sea serializable
    for r in output_data["results"]:
        if r.get("raw_result"):
            r["raw_result"] = serialize_raw(r["raw_result"])

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Resultados guardados en: {args.output}")

    # Exit code configurable
    score = report.passed / report.total_claims if report.total_claims else 0
    passed_threshold = score >= args.min_score

    print(f"\n📊 Score: {score:.1%} | Umbral: {args.min_score:.0%} | {'✅ PASS' if passed_threshold else '❌ FAIL'}")

    sys.exit(0 if passed_threshold else 1)


if __name__ == "__main__":
    main()
