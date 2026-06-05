from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import httpx
from datetime import datetime

load_dotenv()

app = FastAPI(title="EvidenceCheck AI API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos
class ClaimRequest(BaseModel):
    claim: str
    language: str = "es"

class JobResponse(BaseModel):
    job_id: str
    status: str

# Configuración
N8N_WEBHOOK = os.getenv("N8N_WEBHOOK", "https://n8n.orbisautomations.com/webhook/evidence-check-submit")
N8N_JOBS_URL = os.getenv("N8N_JOBS_URL", "https://n8n.orbisautomations.com/webhook/evidence-check-jobs")
N8N_RESULT_URL = os.getenv("N8N_RESULT_URL", "https://n8n.orbisautomations.com/webhook/b3a0e855-cd74-456f-b217-6d15618482f6/evidence-check-result")

# Conexión a PostgreSQL (opcional - alternativa directa)
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "evidencecheck"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "")
    )

# ============================================
# Endpoints
# ============================================

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "EvidenceCheck AI API"}

@app.post("/analysis", response_model=JobResponse)
async def create_analysis(claim_request: ClaimRequest):
    """Envía un claim a n8n para procesamiento"""
    
    # ============================================
    # 📥 LOG DE ENTRADA (IDA)
    # ============================================
    print("=" * 70)
    print(f"📥 [IDA] NUEVO CLAIM RECIBIDO EN FASTAPI")
    print(f"   🕐 Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   📝 Claim: {claim_request.claim}")
    print(f"   🌐 Idioma: {claim_request.language}")
    print(f"   🔗 Enviando a n8n: {N8N_WEBHOOK}")
    print("=" * 70)
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            N8N_WEBHOOK,
            json={
                "claim": claim_request.claim,
                "language": claim_request.language
            },
            timeout=30.0
        )
        if response.status_code != 200:
            print(f"❌ ERROR: n8n respondió con status {response.status_code}")
            raise HTTPException(status_code=500, detail="Error al enviar a n8n")
        
        data = response.json()
        job_id = data.get("job_id")
        status = data.get("status", "processing")
        
        # ============================================
        # 📤 LOG DE RESPUESTA (VUELTA)
        # ============================================
        print(f"✅ [VUELTA] CLAIM ENVIADO A N8N CORRECTAMENTE")
        print(f"   🆔 Job ID: {job_id}")
        print(f"   📊 Status: {status}")
        print("=" * 70)
        print("")  # Línea en blanco para separar
        
        return JobResponse(job_id=job_id, status=status)

@app.get("/jobs")
async def get_jobs(language: Optional[str] = None):
    """Obtiene la lista de análisis (opcionalmente filtrados por idioma)"""
    
    print(f"📋 [CONSULTA] Listando jobs - Idioma: {language if language else 'todos'}")
    
    url = f"{N8N_JOBS_URL}"
    if language:
        url += f"?language={language}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30.0)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Error al obtener jobs")
        return response.json()

@app.get("/result/{job_id}")
async def get_result(job_id: str):
    """Obtiene el resultado de un análisis completado"""
    
    print(f"🔍 [CONSULTA] Buscando resultado para job_id: {job_id}")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{N8N_RESULT_URL}/{job_id}", timeout=30.0)
        if response.status_code != 200:
            print(f"❌ [ERROR] No se encontró resultado para {job_id}")
            raise HTTPException(status_code=404, detail="Job no encontrado o no completado")
        
        data = response.json()
        
        # ============================================
        # 📊 LOG DEL RESULTADO (si está completado)
        # ============================================
        if data.get("status") == "completed":
            print(f"✅ [RESULTADO] Job {job_id} completado")
            print(f"   🏆 Veredicto: {data.get('verdict', 'N/A')}")
            print(f"   📊 Confianza: {data.get('confidence', 'N/A')}")
            print(f"   📝 Resumen: {data.get('summary', 'N/A')[:100]}...")
        else:
            print(f"⏳ [PENDIENTE] Job {job_id} aún en procesamiento: {data.get('status')}")
        
        return data