/**
 * Chief Scout Valuation Engine — TypeScript API Client
 *
 * Usage:
 *   import { ValuationClient } from './client';
 *   const client = new ValuationClient('http://localhost:8000');
 *   const result = await client.value({ player_id: 123 });
 */

import type {
  BatchValuationRequest,
  SimulationRequest,
  ValuationRequest,
  ValuationResponse,
} from "./types";

export class ValuationClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Single player valuation.
   */
  async value(request: ValuationRequest): Promise<ValuationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Valuation failed (${res.status}): ${error}`);
    }

    return res.json();
  }

  /**
   * Batch valuation for up to 50 players.
   */
  async batchValue(
    request: BatchValuationRequest
  ): Promise<ValuationResponse[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/batch_value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Batch valuation failed (${res.status}): ${error}`);
    }

    return res.json();
  }

  /**
   * Scenario simulation — change profile fields and re-value.
   */
  async simulate(request: SimulationRequest): Promise<ValuationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Simulation failed (${res.status}): ${error}`);
    }

    return res.json();
  }

  /**
   * Health check.
   */
  async health(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }
}
