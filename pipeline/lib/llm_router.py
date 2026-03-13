"""
llm_router.py — Multi-provider LLM router with automatic fallback.

Tries providers in priority order, falls back on 429/quota errors.
All pipeline scripts should use this instead of direct Gemini/Groq calls.

Usage:
    from lib.llm_router import call_llm, LLMRouter

    # Simple — uses default provider chain
    result = call_llm("Analyze this player: ...", json_mode=True)

    # With explicit preference
    result = call_llm("Write a scouting bio", preference="quality")

    # Reusable router instance (tracks stats across calls)
    router = LLMRouter()
    result = router.call("prompt here", json_mode=True)
    router.print_stats()

Provider priority:
    1. Groq (Llama 3.3 70B) — free, fast, 30 RPM
    2. Gemini Flash 2.0 — free tier (when available), cheap paid
    3. Gemini 2.5 Pro — free preview, strong reasoning
    4. Anthropic Claude (Haiku) — paid, high quality
"""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field

from config import GEMINI_API_KEY, GROQ_API_KEY

# Optional: Anthropic key
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


@dataclass
class ProviderStats:
    calls: int = 0
    successes: int = 0
    failures: int = 0
    quota_errors: int = 0
    total_ms: float = 0


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    parsed: dict | list | None = None
    latency_ms: float = 0


def _parse_response(text: str) -> dict | list | None:
    """Parse JSON from LLM response, stripping markdown fences and think tags."""
    text = text.strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # Try to find JSON
    if not text.startswith(("{", "[")):
        match = re.search(r"[\[{].*[\]}]", text, re.DOTALL)
        if match:
            text = match.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _is_quota_error(e: Exception) -> bool:
    """Check if an exception is a rate limit / quota error."""
    err = str(e).lower()
    return any(kw in err for kw in ["429", "quota", "rate limit", "resource_exhausted", "too many"])


class LLMRouter:
    """Multi-provider LLM router with automatic fallback."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.stats: dict[str, ProviderStats] = {}
        self._disabled_providers: set[str] = set()
        self._providers = self._init_providers()

    def _init_providers(self) -> list[dict]:
        """Initialize available providers in priority order."""
        providers = []

        # 1. Groq — free, fast
        if GROQ_API_KEY:
            providers.append({
                "name": "groq",
                "model": "llama-3.3-70b-versatile",
                "init": self._init_groq,
                "call": self._call_groq,
            })

        # 2. Gemini 2.5 Flash — newest, fast
        if GEMINI_API_KEY:
            providers.append({
                "name": "gemini-flash",
                "model": "gemini-2.5-flash",
                "init": self._init_gemini,
                "call": self._call_gemini_flash,
            })

        # 3. Gemini 2.5 Pro — strong reasoning
        if GEMINI_API_KEY:
            providers.append({
                "name": "gemini-pro",
                "model": "gemini-2.5-pro",
                "init": self._init_gemini,
                "call": self._call_gemini_pro,
            })

        # 4. Anthropic Claude — paid
        if ANTHROPIC_API_KEY:
            providers.append({
                "name": "anthropic",
                "model": "claude-haiku-4-5-20251001",
                "init": self._init_anthropic,
                "call": self._call_anthropic,
            })

        return providers

    # ── Provider init ─────────────────────────────────────────────────────

    def _init_groq(self):
        if not hasattr(self, "_groq_client"):
            from groq import Groq
            self._groq_client = Groq(api_key=GROQ_API_KEY)
        return self._groq_client

    def _init_gemini(self):
        if not hasattr(self, "_gemini_configured"):
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            self._gemini_configured = True
        return True

    def _init_anthropic(self):
        if not hasattr(self, "_anthropic_client"):
            import anthropic
            self._anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        return self._anthropic_client

    # ── Provider call implementations ─────────────────────────────────────

    def _call_groq(self, prompt: str, json_mode: bool, system: str | None) -> str:
        client = self._init_groq()
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.3,
            "max_completion_tokens": 4096,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    def _call_gemini(self, model_name: str, prompt: str, json_mode: bool, system: str | None) -> str:
        import google.generativeai as genai
        self._init_gemini()

        gen_config = {}
        if json_mode:
            gen_config["response_mime_type"] = "application/json"

        model = genai.GenerativeModel(
            model_name,
            system_instruction=system if system else None,
            generation_config=gen_config if gen_config else None,
        )
        response = model.generate_content(prompt)
        return response.text

    def _call_gemini_flash(self, prompt: str, json_mode: bool, system: str | None) -> str:
        return self._call_gemini("gemini-2.5-flash", prompt, json_mode, system)

    def _call_gemini_pro(self, prompt: str, json_mode: bool, system: str | None) -> str:
        return self._call_gemini("gemini-2.5-pro", prompt, json_mode, system)

    def _call_anthropic(self, prompt: str, json_mode: bool, system: str | None) -> str:
        client = self._init_anthropic()
        kwargs = {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system

        response = client.messages.create(**kwargs)
        return response.content[0].text

    # ── Main call method ──────────────────────────────────────────────────

    def call(
        self,
        prompt: str,
        *,
        json_mode: bool = False,
        system: str | None = None,
        preference: str = "fast",
        max_retries: int = 2,
        retry_delay: float = 2.0,
    ) -> LLMResult | None:
        """
        Call an LLM with automatic provider fallback.

        Args:
            prompt: The user prompt
            json_mode: Request JSON output (provider-specific implementation)
            system: Optional system prompt
            preference: "fast" (Groq first), "quality" (Gemini Pro first), "cheap" (default order)
            max_retries: Retries per provider before falling back
            retry_delay: Base delay between retries (seconds)

        Returns:
            LLMResult with text, provider, model, and parsed JSON (if json_mode)
            None if all providers fail
        """
        providers = self._get_ordered_providers(preference)

        if not providers:
            print("  ERROR: No LLM providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY")
            return None

        for provider in providers:
            name = provider["name"]
            if name in self._disabled_providers:
                continue

            stats = self.stats.setdefault(name, ProviderStats())

            for attempt in range(1, max_retries + 1):
                try:
                    stats.calls += 1
                    t0 = time.time()
                    raw_text = provider["call"](prompt, json_mode, system)
                    latency = (time.time() - t0) * 1000
                    stats.successes += 1
                    stats.total_ms += latency

                    result = LLMResult(
                        text=raw_text,
                        provider=name,
                        model=provider["model"],
                        latency_ms=latency,
                    )

                    if json_mode:
                        result.parsed = _parse_response(raw_text)
                        if result.parsed is None:
                            if self.verbose:
                                print(f"    [{name}] JSON parse failed, trying next provider")
                            break  # try next provider

                    if self.verbose:
                        print(f"    [{name}] OK ({latency:.0f}ms)")

                    return result

                except Exception as e:
                    stats.failures += 1
                    if _is_quota_error(e):
                        stats.quota_errors += 1
                        if self.verbose:
                            print(f"    [{name}] Quota/rate error — falling back")
                        self._disabled_providers.add(name)
                        break  # skip retries, go to next provider
                    else:
                        if self.verbose:
                            print(f"    [{name}] Error (attempt {attempt}/{max_retries}): {e}")
                        if attempt < max_retries:
                            time.sleep(retry_delay * attempt)
                        continue

        print("  ERROR: All LLM providers exhausted")
        return None

    def _get_ordered_providers(self, preference: str) -> list[dict]:
        """Order providers based on preference."""
        if preference == "quality":
            # Gemini Pro first, then Anthropic, then others
            order = ["gemini-pro", "anthropic", "gemini-flash", "groq"]
        elif preference == "fast":
            # Groq first (fastest inference)
            order = ["groq", "gemini-flash", "gemini-pro", "anthropic"]
        else:
            # Default: cheap (Groq free → Gemini free → paid)
            order = ["groq", "gemini-flash", "gemini-pro", "anthropic"]

        ordered = []
        for name in order:
            for p in self._providers:
                if p["name"] == name:
                    ordered.append(p)
                    break
        # Add any not in the order list
        for p in self._providers:
            if p not in ordered:
                ordered.append(p)
        return ordered

    def reset_disabled(self):
        """Re-enable all providers (e.g. after a wait period)."""
        self._disabled_providers.clear()

    def print_stats(self):
        """Print usage statistics."""
        print("\n── LLM Router Stats ──")
        for name, s in self.stats.items():
            avg_ms = s.total_ms / s.successes if s.successes else 0
            print(f"  {name:15s}  calls={s.calls}  ok={s.successes}  "
                  f"fail={s.failures}  quota={s.quota_errors}  avg={avg_ms:.0f}ms")

    def available_providers(self) -> list[str]:
        """List configured provider names."""
        return [p["name"] for p in self._providers if p["name"] not in self._disabled_providers]


# ── Module-level convenience ──────────────────────────────────────────────────

_default_router: LLMRouter | None = None


def get_router(verbose: bool = False) -> LLMRouter:
    """Get or create the default router singleton."""
    global _default_router
    if _default_router is None:
        _default_router = LLMRouter(verbose=verbose)
    return _default_router


def call_llm(
    prompt: str,
    *,
    json_mode: bool = False,
    system: str | None = None,
    preference: str = "fast",
    max_retries: int = 2,
    verbose: bool = False,
) -> LLMResult | None:
    """Convenience function — calls the default router."""
    router = get_router(verbose=verbose)
    return router.call(
        prompt,
        json_mode=json_mode,
        system=system,
        preference=preference,
        max_retries=max_retries,
    )
