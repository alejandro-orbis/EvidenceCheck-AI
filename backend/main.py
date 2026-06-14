from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import httpx
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI(title="EvidenceCheck AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClaimRequest(BaseModel):
    claim: str
    language: str = "es"

class JobResponse(BaseModel):
    job_id: str
    status: str

N8N_WEBHOOK = os.getenv("N8N_WEBHOOK")
N8N_JOBS_URL = os.getenv("N8N_JOBS_URL")
N8N_RESULT_URL = os.getenv("N8N_RESULT_URL")

N8N_HEADERS = {
    "Accept": "application/json",
    "Accept-Encoding": "identity",
}

if not all([N8N_WEBHOOK, N8N_JOBS_URL, N8N_RESULT_URL]):
    raise ValueError(
        "Missing required environment variables: "
        "N8N_WEBHOOK, N8N_JOBS_URL, N8N_RESULT_URL"
    )

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "EvidenceCheck AI API"}

@app.post("/analysis", response_model=JobResponse)
async def create_analysis(claim_request: ClaimRequest):
    print("=" * 70)
    print("📥 [IDA] NUEVO CLAIM RECIBIDO EN FASTAPI")
    print(f"   🕐 Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   📝 Claim: {claim_request.claim}")
    print(f"   🌐 Idioma: {claim_request.language}")
    print("=" * 70)

    async with httpx.AsyncClient(verify=False) as client:
        response = await client.post(
            N8N_WEBHOOK,
            json={
                "claim": claim_request.claim,
                "language": claim_request.language,
            },
            headers=N8N_HEADERS,
            timeout=30.0,
        )

        if response.status_code != 200:
            print(f"❌ ERROR: n8n respondió con status {response.status_code}")
            print(response.text[:1000])
            raise HTTPException(status_code=500, detail="Error al enviar a n8n")

        try:
            data = response.json()
        except Exception:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "n8n no devolvió JSON en /analysis",
                    "status_code": response.status_code,
                    "content_type": response.headers.get("content-type"),
                    "body_start": response.text[:500],
                },
            )

        job_id = data.get("job_id")
        status = data.get("status", "processing")

        print("✅ [VUELTA] CLAIM ENVIADO A N8N CORRECTAMENTE")
        print(f"   🆔 Job ID: {job_id}")
        print(f"   📊 Status: {status}")
        print("=" * 70)
        print("")

        return JobResponse(job_id=job_id, status=status)

@app.get("/jobs")
async def get_jobs(language: Optional[str] = None):
    print(
        f"📋 [CONSULTA] Listando jobs - Idioma: "
        f"{language if language else 'todos'}"
    )

    url = f"{N8N_JOBS_URL}"
    if language:
        url += f"?language={language}"

    async with httpx.AsyncClient(verify=False) as client:
        response = await client.get(
            url,
            headers=N8N_HEADERS,
            timeout=30.0,
        )

        print(f"📡 n8n jobs URL: {url}")
        print(f"📡 n8n jobs status: {response.status_code}")
        print(f"📡 n8n jobs content-type: {response.headers.get('content-type')}")
        print("📡 n8n jobs response:")
        print(response.text[:2000])

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Error al obtener jobs")

        try:
            return response.json()
        except Exception:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "n8n no devolvió JSON",
                    "status_code": response.status_code,
                    "content_type": response.headers.get("content-type"),
                    "body_start": response.text[:500],
                },
            )

@app.get("/result/{job_id}")
async def get_result(job_id: str):
    print(f"🔍 [CONSULTA] Buscando resultado para job_id: {job_id}")

    async with httpx.AsyncClient(verify=False) as client:
        response = await client.get(
            N8N_RESULT_URL,
            params={"job_id": job_id},
            headers=N8N_HEADERS,
            timeout=30.0,
        )

        if response.status_code != 200:
            print(f"❌ [ERROR] No se encontró resultado para {job_id}")
            print(f"Status: {response.status_code}")
            print(response.text[:1000])
            raise HTTPException(
                status_code=404,
                detail="Job no encontrado o no completado",
            )

        try:
            data = response.json()
        except Exception:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "n8n no devolvió JSON en /result",
                    "status_code": response.status_code,
                    "content_type": response.headers.get("content-type"),
                    "body_start": response.text[:500],
                },
            )

        if data.get("status") == "completed":
            print(f"✅ [RESULTADO] Job {job_id} completado")
            print(f"   🏆 Veredicto: {data.get('verdict', 'N/A')}")
            print(f"   📊 Confianza: {data.get('confidence', 'N/A')}")
            print(f"   📝 Resumen: {str(data.get('summary', 'N/A'))[:100]}...")
        else:
            print(
                f"⏳ [PENDIENTE] Job {job_id} aún en procesamiento: "
                f"{data.get('status')}"
            )

        return data