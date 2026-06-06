# 🧬 EvidenceCheck AI
# Structured Biomedical Evidence Reasoning

EvidenceCheck AI is an AI-powered biomedical evidence analysis platform designed to evaluate health and nutrition claims using scientific literature retrieval, structured evidence reasoning and causal inference.

Unlike traditional AI summarization systems, EvidenceCheck builds a structured evidence model before generating conclusions. The platform retrieves PubMed literature, classifies study designs, ranks methodological quality, evaluates evidence directionality, detects contradictions, analyzes claim specificity, incorporates Bradford Hill causal signals and generates evidence-based verdicts.

Built as a real-world biomedical evidence verification platform.

![Dashboard](screenshots/dashboard-home.png)

[![n8n](https://img.shields.io/badge/n8n-Workflow-orange?style=flat-square)](https://n8n.io/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![PubMed](https://img.shields.io/badge/PubMed-NCBI-326599?style=flat-square)](https://pubmed.ncbi.nlm.nih.gov/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
![Biomedical Evidence](https://img.shields.io/badge/Biomedical-Evidence%20Analysis-blue?style=flat-square)
![Bradford Hill](https://img.shields.io/badge/Bradford%20Hill-Causal%20Inference-darkgreen?style=flat-square)
![Async Jobs](https://img.shields.io/badge/Architecture-Async%20Jobs-purple?style=flat-square)
![Portfolio Project](https://img.shields.io/badge/Portfolio-Project-success?style=flat-square)
[![Tests](https://img.shields.io/badge/Tests-26%20passing-brightgreen?style=flat-square)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

---

## 🎯 What Makes This Different?

EvidenceCheck is designed to reason about scientific evidence rather than simply summarize scientific papers.

Many AI fact-checking systems retrieve scientific articles and ask a language model to generate a summary.

EvidenceCheck introduces a structured biomedical evidence reasoning layer that evaluates:

* Study design quality
* Methodological strength
* Evidence directionality
* Scientific consensus
* Claim specificity
* Potential conflicts of interest
* Bradford Hill causal signals

before generating a verdict.

This allows the system to distinguish between:

* Direct support
* Partial support
* Lack of support
* Contradictory evidence
* Mixed evidence
* Overgeneralized claims
* Causal overstatement
* Genuine evidence insufficiency

By introducing structured evidence reasoning before AI analysis, EvidenceCheck aims to reduce common failure modes found in generic LLM-based fact-checking systems, including:

* Treating absence of evidence as evidence against
* Confusing weak evidence with contradictory evidence
* Overstating causal conclusions
* Misclassifying absolute claims
* Ignoring differences between study designs
* Applying unrealistic evidence standards when randomized trials are not ethically feasible

---

## 📋 Example Analysis

### Claim

> "Vitamin D prevents fractures in older adults"

### Result

| Metric | Value |
|----------|----------|
| Verdict | PARTIALLY TRUE |
| Confidence | MODERATE |
| Consensus | MIXED |

### Reasoning

Evidence suggests that vitamin D may help prevent fractures in specific populations, particularly when combined with calcium and in individuals with deficiency or higher risk profiles.

However, the effect is not consistent across all populations. Some randomized controlled trials and meta-analyses have found limited or no benefit in healthy community-dwelling older adults.

As a result, the claim cannot be considered universally true and depends on population characteristics, baseline deficiency status and supplementation strategy.

### Evidence Signals

- Evidence direction: Mixed
- Consensus strength: Mixed
- Context dependency: High
- Claim overgeneralization: Detected

---

## 🖼️ Screenshots

### Dashboard Overview

![Dashboard](screenshots/dashboard-home.png)

### Analysis List

![Analysis List](screenshots/analysis-list.png)

### Detailed Analysis

![Analysis Detail](screenshots/analysis-detail.png)

### Email Report

![Email Report](screenshots/email-report.png)

### Pipeline Overview

![Pipeline](screenshots/architecture-pipeline.png)

---

## 🚀 Key Features

- 🔬 Automated biomedical claim analysis
- 📚 PubMed scientific literature retrieval
- 🏆 Evidence ranking engine
- 🧬 Study design classification
- 📊 Methodological quality scoring
- ⚖️ Directionality engine (supports, contradicts, does not support)
- 🎯 Claim specificity analysis
- 📈 Weighted evidence consensus
- 🧪 Bradford Hill causal inference signals
- 🛡️ Conflict-of-interest detection
- 🚫 Anti-overstatement reasoning for absolute claims
- 🧠 Claude-powered scientific reasoning
- 📊 Interactive React + TypeScript dashboard
- 🐍 FastAPI backend with REST endpoints
- 🗄️ SQLite (n8n) + Supabase (results) architecture
- 🗄️ PostgreSQL asynchronous job architecture
- 📧 Automated email reports
- 🧪 26 passing tests with Vitest
- 📚 Interactive API documentation (Swagger UI)

---

## 🌍 Potential Use Cases

* Health misinformation verification
* Nutrition claim evaluation
* Scientific fact-checking
* Biomedical research assistance
* Evidence-based decision support
* Healthcare content review
* Educational demonstrations of evidence analysis systems

---

## 🧠 Evidence Reasoning Capabilities

EvidenceCheck performs multiple layers of evidence analysis before AI reasoning:

### Evidence Retrieval

- PubMed query generation
- Claim decomposition
- Exposure and outcome extraction
- Scientific literature retrieval

### Evidence Classification

- Study design identification
- Meta-analysis detection
- Systematic review detection
- Cohort study identification
- Clinical trial classification
- Outcome tier evaluation

### Evidence Evaluation

- Methodological quality scoring
- Relevance scoring
- Exposure specificity analysis
- Claim centrality scoring
- Outcome hierarchy weighting

### Evidence Reasoning

- Directionality detection
- Contradiction analysis
- Weighted consensus generation
- Claim specificity evaluation
- Conflict-of-interest assessment
- Bradford Hill causal inference signals

### Scientific Reporting

- Evidence-based verdict generation
- Confidence estimation
- Consensus assessment
- Structured scientific explanations

---

## 🔬 Structured Evidence Reasoning Engine

EvidenceCheck does not simply summarize PubMed abstracts.

Before AI reasoning, the platform constructs a structured evidence model that includes:

- Study design classification
- Methodological quality assessment
- Relevance scoring
- Evidence directionality analysis
- Weighted consensus calculation
- Claim specificity evaluation
- Conflict-of-interest signals
- Bradford Hill causal inference signals

This architecture allows the system to distinguish between:

- Direct support
- Partial support
- Lack of support
- Contradictory evidence
- Mixed evidence
- Overgeneralized claims
- Causal overstatement
- Genuine evidence insufficiency

The objective is to reduce common failure modes observed in generic LLM-based fact-checking systems.

---

## 🏗️ System Architecture

```mermaid
flowchart TD

A[React + TypeScript Dashboard]
--> B[FastAPI Backend]

B --> C[n8n Webhook]

C --> D[EvidenceCheck Pipeline]

D --> E[PubMed Retrieval]
D --> F[Study Classification]
D --> G[Evidence Ranking]
D --> H[Directionality Engine]
D --> I[Bradford Hill Signals]
D --> J[Claude Reasoning]

J --> K[Store Results in Supabase]

K --> L[Dashboard Polls Results]
K --> M[Email Reports]

B --> N[Swagger UI /docs]
```
> **Architectural Note:** SQLite is used internally by n8n for runtime operations and platform management. PostgreSQL/Supabase serves as EvidenceCheck's business data layer, persisting analysis jobs, claims, results, and dashboard-facing records generated by the workflows.
---

## ⚙️ Core Workflows

| Workflow               | Purpose                            |
| ---------------------- | ---------------------------------- |
| Submit Analysis Job    | Creates asynchronous analysis jobs |
| EvidenceCheck Pipeline | Full biomedical evidence analysis  |
| Get Job Result         | Retrieves completed analyses       |
| List Jobs              | Dashboard job listing              |

---

## 🛠️ Technology Stack

| Technology | Purpose |
|------------|---------|
| FastAPI | Backend API (REST endpoints) |
| TypeScript | Frontend type safety |
| Vitest | Unit testing (26 tests) |
| n8n | Workflow orchestration |
| Claude | Scientific reasoning |
| PubMed | Literature retrieval |
| SQLite | n8n local storage |
| Supabase | Result persistence |
| React | Dashboard UI |
| Vite | Frontend tooling |
| Recharts | Analytics and visualization |
| Gmail | Automated evidence reports |
| Bradford Hill Framework | Causal inference evaluation |

---

## 📂 Project Structure

```text
EvidenceCheck-AI/
│
├── README.md
├── README_ES.md
├── LICENSE
├── .env.example
│
├── backend/                    # 🆕 FastAPI backend
│   ├── main.py                 # API endpoints
│   ├── requirements.txt        # Python dependencies
│   └── venv/                   # Virtual environment
│
├── workflows/
│   ├── EvidenceCheck_API_Submit_Analysis_Job.json
│   ├── EvidenceCheck_AI_Pipeline_Principal_Claude.json
│   ├── EvidenceCheck_Get_Job_Result.json
│   └── EvidenceCheck_List_Jobs.json
│
├── database/
│   └── schema.sql
│
├── dashboard/
│   ├── src/                    # 🆕 TypeScript source
│   │   ├── App.tsx             # Main component
│   │   ├── App.test.tsx        # Tests
│   │   └── *.test.ts           # 26 unit tests
│   ├── vitest.config.ts        # 🆕 Vitest configuration
│   ├── package.json
│   └── vite.config.js
│
└── screenshots/
    ├── dashboard-home.png
    ├── analysis-list.png
    ├── analysis-detail.png
    ├── email-report.png
    └── architecture-pipeline.png
```

---

## 🎥 Demo Video

A short walkthrough demonstrating:

* Claim submission
* Evidence retrieval
* Scientific analysis
* Dashboard visualization
* Evidence consensus evaluation
* Final report generation

LinkedIn Demo Video:

[Watch Demo Video](https://www.linkedin.com/feed/update/urn:li:activity:7466543078049206273/)

---

## 🚀 Installation

### 1. Requirements

* n8n
* PostgreSQL 13+
* Python 3.12+
* Anthropic API Key
* Gmail account (optional)
* Node.js 20+

### 2. Configure FastAPI Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or: venv\Scripts\activate (Windows)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Import Workflows

In n8n:

```text
Menu → Import from File
```

Import all workflows from the `workflows/` folder.

### 4. Configure Environment Variables

Create `.env` file in `backend/` folder:

```env
N8N_WEBHOOK=https://n8n.yourdomain.com/webhook/evidence-check-submit
N8N_JOBS_URL=https://n8n.yourdomain.com/webhook/evidence-check-jobs
N8N_RESULT_URL=https://n8n.yourdomain.com/webhook/your-webhook-id/evidence-check-result
```

For n8n, create `.env` in `n8n/` folder:

```env
DB_PASSWORD=
N8N_ENCRYPTION_KEY=
```

and configure the required values.

### 5. Run Dashboard

```bash
cd dashboard

npm install

npm run dev
```

### 6. Access the System

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| FastAPI Swagger UI | http://localhost:8000/docs |
| FastAPI API | http://localhost:8000 |
| n8n | https://n8n.yourdomain.com |

---

## 🔐 Environment Variables

```env
ANTHROPIC_API_KEY=

POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=

EVIDENCECHECK_PIPELINE_URL=

VITE_EVIDENCECHECK_API_BASE=
VITE_EVIDENCECHECK_LIST_JOBS_PATH=
VITE_EVIDENCECHECK_SUBMIT_JOB_PATH=
VITE_EVIDENCECHECK_RESULT_JOB_PATH=
```

---

## 📊 Dashboard Features

* Submit new biomedical claims
* Real-time job status tracking
* Evidence consensus visualization
* Verdict distribution analytics
* Detailed evidence breakdown
* Scientific article inspection
* Search and filtering
* Interactive evidence balance charts
* Bilingual (ES/EN)
* TypeScript type safety

---

## 🔬 Analysis Pipeline

The platform performs a multi-stage evidence evaluation process:

1. Claim normalization
2. Claim decomposition
3. Exposure and outcome extraction
4. PubMed query generation
5. Scientific literature retrieval
6. Study design classification
7. Methodological quality scoring
8. Relevance ranking
9. Directionality detection
10. Conflict-of-interest analysis
11. Weighted consensus generation
12. Claim specificity analysis
13. Bradford Hill causal assessment
14. Contradiction detection
15. Claude scientific reasoning
16. Dashboard report generation
17. Result persistence
18. Email report generation

---

## 🧪 Testing

Run dashboard tests:

```bash
cd dashboard
npm run test
```

Tests cover:

* Verdict normalization
* Consensus normalization
* Badge classes
* Card styling
* KPIs calculation
* Search filtering
* Time formatting
* Translations

---

## 🛡️ Security

* Do not upload `.env` files
* Do not hardcode credentials
* Use environment variables
* Remove credentials before exporting workflows
* Remove webhook IDs before publishing
* Sanitize workflow exports before GitHub publication
* Keep Anthropic API keys private
* Use separate credentials per environment

---

## 🗺️ Roadmap

### ✅ Completed
- FastAPI backend integration
- TypeScript migration
- 26 passing tests with Vitest
- Bilingual dashboard (ES/EN)
- Interactive API documentation (Swagger UI)

### 🔄 Planned
- Cochrane integration
- WHO evidence sources
- NICE guideline integration
- User authentication
- Historical evidence tracking
- Public API
- Advanced evidence visualization
- Multi-user support
- ClinicalTrials.gov
- Guideline-based reasoning
- Evidence timeline analysis

---

## ⚠️ Disclaimer

This repository contains a public demonstration version intended for educational and portfolio purposes.

Scientific analyses generated by the system should not be considered medical advice.

Always consult qualified healthcare professionals for medical decisions.

---

## 📄 License

MIT License.

---

## 👤 Author

**Alejandro Peralta**

Process Automation & AI Systems

* GitHub: https://github.com/alejandro-orbis
* LinkedIn: https://linkedin.com/in/alejandro-orbis

---

Built to explore scalable biomedical evidence analysis using AI, scientific literature retrieval and modern workflow automation.
