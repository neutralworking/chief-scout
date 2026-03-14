"""
FastAPI application for the Chief Scout Transfer Valuation Engine.

Endpoints:
  POST /value          — Single player valuation
  POST /batch_value    — Batch valuation (up to 50)
  POST /simulate       — Scenario simulation
  GET  /health         — Health check
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from valuation_api.routes.value import router as value_router

app = FastAPI(
    title="Chief Scout Valuation Engine",
    description="Multi-dimensional scouting-profile-driven transfer valuation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(value_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "engine": "chief-scout-valuation"}
