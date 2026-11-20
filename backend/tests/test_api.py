import json

import httpx


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_openapi_lists_endpoints(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert {"/health", "/analysis", "/jobs", "/result/{job_id}"} <= set(paths)


# ---------- /analysis ----------

def test_analysis_requires_claim(client):
    r = client.post("/analysis", json={})
    assert r.status_code == 422


def test_analysis_forwards_claim_and_returns_job(client, mock_n8n):
    calls = mock_n8n(lambda req: httpx.Response(200, json={"job_id": "job-1", "status": "processing"}))

    r = client.post("/analysis", json={"claim": "El café previene el cáncer", "language": "es"})

    assert r.status_code == 200
    assert r.json() == {"job_id": "job-1", "status": "processing"}
    assert len(calls) == 1
    assert calls[0].method == "POST"
    assert json.loads(calls[0].content) == {"claim": "El café previene el cáncer", "language": "es"}


def test_analysis_default_language_is_es(client, mock_n8n):
    calls = mock_n8n(lambda req: httpx.Response(200, json={"job_id": "job-2"}))

    r = client.post("/analysis", json={"claim": "x"})

    assert r.status_code == 200
    assert r.json()["status"] == "processing"
    assert json.loads(calls[0].content)["language"] == "es"


def test_analysis_n8n_error_returns_500(client, mock_n8n):
    mock_n8n(lambda req: httpx.Response(502, text="Bad gateway"))
    assert client.post("/analysis", json={"claim": "x"}).status_code == 500


def test_analysis_n8n_non_json_returns_500(client, mock_n8n):
    mock_n8n(lambda req: httpx.Response(200, text="<html>oops</html>"))
    r = client.post("/analysis", json={"claim": "x"})
    assert r.status_code == 500
    assert "JSON" in r.json()["detail"]["error"]


def test_analysis_n8n_down_returns_503(client, mock_n8n):
    def down(req):
        raise httpx.ConnectError("connection refused", request=req)

    mock_n8n(down)
    r = client.post("/analysis", json={"claim": "x"})
    assert r.status_code == 503
    assert "no disponible" in r.json()["detail"]


def test_analysis_n8n_timeout_returns_503(client, mock_n8n):
    def slow(req):
        raise httpx.ReadTimeout("timeout", request=req)

    mock_n8n(slow)
    assert client.post("/analysis", json={"claim": "x"}).status_code == 503


# ---------- /jobs ----------

def test_jobs_passes_language_filter(client, mock_n8n):
    calls = mock_n8n(lambda req: httpx.Response(200, json=[{"job_id": "a"}]))

    r = client.get("/jobs", params={"language": "en"})

    assert r.status_code == 200
    assert r.json() == [{"job_id": "a"}]
    assert calls[0].url.params["language"] == "en"


def test_jobs_without_language(client, mock_n8n):
    calls = mock_n8n(lambda req: httpx.Response(200, json=[]))
    assert client.get("/jobs").status_code == 200
    assert "language" not in calls[0].url.params


def test_jobs_n8n_down_returns_503(client, mock_n8n):
    def down(req):
        raise httpx.ConnectError("connection refused", request=req)

    mock_n8n(down)
    assert client.get("/jobs").status_code == 503


# ---------- /result/{job_id} ----------

def test_result_completed(client, mock_n8n):
    payload = {"status": "completed", "verdict": "FALSE", "confidence": 0.9, "summary": "..."}
    calls = mock_n8n(lambda req: httpx.Response(200, json=payload))

    r = client.get("/result/job-1")

    assert r.status_code == 200
    assert r.json() == payload
    assert calls[0].url.params["job_id"] == "job-1"


def test_result_pending(client, mock_n8n):
    mock_n8n(lambda req: httpx.Response(200, json={"status": "processing"}))
    r = client.get("/result/job-1")
    assert r.status_code == 200
    assert r.json()["status"] == "processing"


def test_result_not_found_returns_404(client, mock_n8n):
    mock_n8n(lambda req: httpx.Response(404, text="not found"))
    assert client.get("/result/missing").status_code == 404


def test_result_n8n_down_returns_503(client, mock_n8n):
    def down(req):
        raise httpx.ConnectError("connection refused", request=req)

    mock_n8n(down)
    assert client.get("/result/job-1").status_code == 503
