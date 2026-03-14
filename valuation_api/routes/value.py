"""
POST /value — Single player valuation endpoint.
POST /batch_value — Batch valuation (up to 50 players).
POST /simulate — Scenario simulation.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from valuation_api.schemas import (
    BatchValuationRequestSchema,
    SimulationRequestSchema,
    ValuationRequestSchema,
    ValuationResponseSchema,
)
from valuation_api.service import (
    run_single_valuation,
    run_batch_valuation,
    run_simulation,
)

router = APIRouter()


@router.post("/value", response_model=ValuationResponseSchema)
async def value_player(request: ValuationRequestSchema):
    """
    Compute transfer valuation for a single player.

    Accepts a player_id and optional evaluation context.
    If no evaluation context is provided, returns market value only.
    """
    try:
        result = run_single_valuation(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Valuation error: {e}")


@router.post("/batch_value", response_model=list[ValuationResponseSchema])
async def batch_value(request: BatchValuationRequestSchema):
    """Batch valuation for up to 50 players."""
    if len(request.requests) > 50:
        raise HTTPException(status_code=400, detail="Max 50 players per batch")
    try:
        return run_batch_valuation(request.requests)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch error: {e}")


@router.post("/simulate", response_model=ValuationResponseSchema)
async def simulate(request: SimulationRequestSchema):
    """
    Scenario simulation — change contract, age, context and see impact.
    """
    try:
        return run_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {e}")
