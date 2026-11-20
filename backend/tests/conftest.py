import os
import sys
from pathlib import Path

import httpx
import pytest

# Variables necesarias para importar main.py (no se hace ninguna llamada real)
os.environ.setdefault("N8N_WEBHOOK", "http://n8n.test/webhook/analysis")
os.environ.setdefault("N8N_JOBS_URL", "http://n8n.test/webhook/jobs")
os.environ.setdefault("N8N_RESULT_URL", "http://n8n.test/webhook/result")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    return TestClient(main.app, raise_server_exceptions=False)


@pytest.fixture
def mock_n8n(monkeypatch):
    """Sustituye las llamadas HTTP a n8n por un handler simulado.

    Uso: mock_n8n(handler), donde handler(request) devuelve un httpx.Response
    o lanza una excepción de httpx.
    """
    calls = []

    def install(handler):
        def recording_handler(request):
            calls.append(request)
            return handler(request)

        transport = httpx.MockTransport(recording_handler)
        real_client = httpx.AsyncClient

        def fake_async_client(*args, **kwargs):
            kwargs.pop("verify", None)
            return real_client(*args, transport=transport, **kwargs)

        monkeypatch.setattr(main.httpx, "AsyncClient", fake_async_client)
        return calls

    return install
