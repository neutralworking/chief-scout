# Test-First Stat Metrics Pipeline — Implementation Plan

## Overview

Build a comprehensive test suite for the stat metrics pipeline (scripts 08, 09, 10, 13) using pytest. All tests use pure-unit or mock-based approaches — no live database connections required. The pipeline scripts need minor refactoring to extract testable functions from module-level side effects.

## Files to Create

| File | Purpose |
|---|---|
| `pipeline/pytest.ini` | pytest configuration |
| `pipeline/conftest.py` | Shared fixtures (fake Supabase client, fake cursor, sample data) |
| `pipeline/tests/__init__.py` | Package marker |
| `pipeline/tests/test_08_statsbomb_helpers.py` | Unit tests for script 08 helper functions |
| `pipeline/tests/test_09_understat_helpers.py` | Unit tests for script 09 helper functions |
| `pipeline/tests/test_10_player_matching.py` | Unit tests for script 10 matching logic |
| `pipeline/tests/test_13_stat_metrics.py` | Unit tests for script 13 computation logic |

## Files to Modify

| File | Change | Reason |
|---|---|---|
| `pipeline/08_statsbomb_ingest.py` | Wrap module-level code in `if __name__ == "__main__"` guard | Currently runs side effects on import: arg parsing, Supabase client init, main loop. Tests can't import helpers without triggering all of this. |
| `pipeline/09_understat_ingest.py` | Same `if __name__ == "__main__"` guard | Same problem: arg parsing, client creation, fetch loop all run on import. |
| `pipeline/10_player_matching.py` | Same guard + make `people_by_norm` a parameter to `find_match` | Module-level DB connection, arg parsing, and `people_by_norm` dict all run on import. `find_match` reads the global `people_by_norm`. |
| `pipeline/13_stat_metrics.py` | Same guard + parameterize globals in key functions | Arg parsing and DB connections run on import. `chunked_upsert` reads global `DRY_RUN`. |
| `pipeline/requirements.txt` | Add `pytest>=8.0` and `pytest-mock>=3.14` | No test dependencies exist yet. |

### Refactoring Details

**Script 08** (`08_statsbomb_ingest.py`): Move arg parsing + client init and main loop inside `if __name__ == "__main__":`. Keep `_name`, `_id`, `_safe`, `_sanitize`, `_row_to_json` at module level. Refactor `chunked_upsert` to accept `client`, `dry_run`, `chunk_size` as parameters (or use `mocker.patch`).

**Script 09** (`09_understat_ingest.py`): Move arg parsing + client init and main loop inside `if __name__ == "__main__":`. Keep `_safe_float`, `_safe_int` at module level. Same `chunked_upsert` treatment.

**Script 10** (`10_player_matching.py`): Move arg parsing, DB connection, table creation, people loading, and matching loops inside `if __name__ == "__main__":`. Refactor `find_match(ext_name, club_hint)` → `find_match(ext_name, club_hint, people_by_norm)`.

**Script 13** (`13_stat_metrics.py`): Move arg parsing + connections inside `if __name__ == "__main__":`. Parameterize `MIN_MATCHES` in aggregate functions and `DRY_RUN`/`sb_client` in `chunked_upsert`.

---

## Stage 1: StatsBomb Ingest Tests

**File:** `pipeline/tests/test_08_statsbomb_helpers.py`

### Test Functions

```python
# _safe()
def test_safe_none_passthrough(): """_safe(None) returns None."""
def test_safe_nan_becomes_none(): """_safe(float('nan')) returns None."""
def test_safe_inf_becomes_none(): """_safe(float('inf')) and float('-inf') return None."""
def test_safe_normal_float_passthrough(): """_safe(3.14) returns 3.14."""
def test_safe_timestamp_valid(): """_safe(pd.Timestamp('2024-01-01')) returns ISO string."""
def test_safe_timestamp_nat(): """_safe(pd.NaT) returns None."""

# _sanitize()
def test_sanitize_flat_dict_with_nan(): """{'a': nan, 'b': 1} → {'a': None, 'b': 1}."""
def test_sanitize_nested_dict(): """Nested NaN/inf values become None."""
def test_sanitize_list_with_nan(): """[1, nan, 3] → [1, None, 3]."""
def test_sanitize_mixed_nested(): """Dicts inside lists inside dicts."""

# _row_to_json()
def test_row_to_json_with_nan(): """Produces valid JSON with null."""
def test_row_to_json_roundtrip(): """json.loads() produces clean dict."""

# chunked_upsert()
def test_chunked_upsert_empty_rows(): """Empty list → 0, no API calls."""
def test_chunked_upsert_dry_run(mocker): """Dry run → count without calling client."""
def test_chunked_upsert_chunking(mocker): """150 rows, chunk=100 → 2 calls."""

# _name() / _id()
def test_name_extracts_from_dict(): """{'name': 'Pass'} → 'Pass'."""
def test_id_extracts_from_dict(): """{'id': 1} → 1."""
```

### Edge Cases
- `_safe` with numpy NaN
- `_sanitize` with pd.NaT nested in a list
- `chunked_upsert` with exactly CHUNK_SIZE rows (boundary)

---

## Stage 2: Understat Ingest Tests

**File:** `pipeline/tests/test_09_understat_helpers.py`

### Test Functions

```python
# _safe_float()
def test_safe_float_normal(): """'3.14' → 3.14."""
def test_safe_float_none(): """None → None."""
def test_safe_float_nan_string(): """'nan' → None."""
def test_safe_float_inf(): """'inf' → None."""
def test_safe_float_non_numeric(): """'abc' → None."""
def test_safe_float_empty_string(): """'' → None."""
def test_safe_float_zero(): """0 → 0.0 (not None)."""

# _safe_int()
def test_safe_int_normal(): """'42' → 42."""
def test_safe_int_none(): """None → None."""
def test_safe_int_float_string(): """'3.9' → documents behavior."""
def test_safe_int_non_numeric(): """'abc' → None."""
def test_safe_int_zero(): """0 → 0 (not None)."""
def test_safe_int_empty_string(): """'' → None."""
```

---

## Stage 3: Player Matching Tests

**File:** `pipeline/tests/test_10_player_matching.py`

### Test Functions

```python
# normalize_name()
def test_normalize_basic(): """'André Silva' → 'andre silva'."""
def test_normalize_html_entities(): """HTML entities decoded."""
def test_normalize_accents_stripped(): """'Müller' → 'muller'."""
def test_normalize_suffix_jr(): """'Neymar Jr.' → 'neymar'."""
def test_normalize_extra_whitespace(): """Collapsed to single spaces."""
def test_normalize_empty_string(): """'' → ''."""

# name_variants()
def test_variants_simple_two_part(): """Includes full, dehyphen, parts."""
def test_variants_three_part_name(): """Includes consecutive pairs."""
def test_variants_single_name(): """Just the normalized name."""

# _disambiguate_by_club()
def test_disambiguate_exact_club_match(): """Returns matching candidate."""
def test_disambiguate_no_club_hint(): """Returns (None, None)."""
def test_disambiguate_no_match(): """No candidates match → (None, None)."""

# find_match() — requires people_by_norm injection
def test_find_match_exact(): """Exact match → (pid, name, 'exact')."""
def test_find_match_manual_override(): """Override → (pid, name, 'manual')."""
def test_find_match_ambiguous(): """Duplicate name, no club → (None, None, 'ambiguous')."""
def test_find_match_club_disambig(): """Club hint resolves ambiguity."""
def test_find_match_no_match(): """Unknown → (None, None, 'none')."""
```

### Fixture: `sample_people_by_norm`
~10 synthetic players covering: unique names, duplicates at different clubs, hyphenated, single-word, accented.

---

## Stage 4: Metrics Computation Tests

**File:** `pipeline/tests/test_13_stat_metrics.py`

### Test Functions

```python
# percentile_rank()
def test_percentile_rank_basic(): """3 values: 0, 50, 100."""
def test_percentile_rank_empty(): """Empty → empty dict."""
def test_percentile_rank_single(): """Single value → percentile 0."""
def test_percentile_rank_tied_values(): """Documents tie-breaking behavior."""

# percentile_to_score()
def test_score_zero_percentile(): """0 → 1 (clamped)."""
def test_score_hundred_percentile(): """100 → 20."""
def test_score_fifty_percentile(): """50 → 10."""
def test_score_negative_percentile(): """-5 → 1 (clamped)."""
def test_score_over_hundred(): """105 → 20 (clamped)."""

# compute_positional_percentiles()
def test_positional_percentiles_basic(): """5 attackers → all get 1-20 scores."""
def test_positional_percentiles_filters_irrelevant(): """Attackers don't get 'tackling'."""
def test_positional_percentiles_too_few_players(): """<3 players → no scores."""
def test_positional_percentiles_mixed_groups(): """Groups scored independently."""
def test_positional_percentiles_empty_input(): """Empty → empty dict."""

# Division-by-zero guards
def test_understat_metrics_zero_minutes(): """Prevented by max(mins, 1)."""
def test_statsbomb_zero_dribble_attempts(): """Division guard needed."""

# Mocked DB integration
def test_aggregate_understat_mocked_cursor(mocker): """Synthetic rows → valid 1-20 scores."""
def test_aggregate_statsbomb_mocked_cursor(mocker): """8 queries mocked → valid scores."""
def test_load_player_positions_mocked(mocker): """Cursor → position group mapping."""
```

### Edge Cases
- Division by zero: `pass_accuracy` with 0 total passes, `aerial_duels` with 0 total
- StatsBomb float-string ID: `"3089"` + `".0"` = `"3089.0"` join key
- `composure` threshold: only computed when `total >= 5`
- `percentile_to_score` at every 5-unit boundary

---

## Shared Fixtures (`conftest.py`)

```python
@pytest.fixture
def fake_supabase_client(mocker):
    """Mock Supabase client with chainable .table().upsert().execute()."""

@pytest.fixture
def sample_people_by_norm():
    """Dict of normalized_name → [(pid, original_name, club)] for ~10 players."""

@pytest.fixture
def sample_player_metrics():
    """Dict of person_id → {metric: raw_value} for ~8 players across 3 groups."""

@pytest.fixture
def sample_player_positions():
    """Dict of person_id → position_group for the same ~8 players."""
```

## `pytest.ini`

```ini
[pytest]
testpaths = tests
pythonpath = .
```

---

## Implementation Order

### Phase 1: Infrastructure
1. Add `pytest>=8.0`, `pytest-mock>=3.14` to `pipeline/requirements.txt`
2. Create `pipeline/pytest.ini`
3. Create `pipeline/conftest.py` with shared fixtures
4. Create `pipeline/tests/__init__.py`

### Phase 2: Refactor for importability
5. Refactor `08_statsbomb_ingest.py` — `if __name__ == "__main__"` guard
6. Refactor `09_understat_ingest.py` — same
7. Refactor `10_player_matching.py` — same + `people_by_norm` injection
8. Refactor `13_stat_metrics.py` — same + parameterize globals

### Phase 3: Stage 1 — StatsBomb tests
9. Write `test_08_statsbomb_helpers.py` → run tests → green

### Phase 4: Stage 2 — Understat tests
10. Write `test_09_understat_helpers.py` → run tests → green

### Phase 5: Stage 3 — Player matching tests
11. Write `test_10_player_matching.py` → run tests → green

### Phase 6: Stage 4 — Metrics tests
12. Write `test_13_stat_metrics.py` → run tests → green

### Phase 7: Full suite
13. `cd pipeline && python -m pytest -v` → all green

---

## Known Constraints

1. **Module-level side effects**: All four scripts run code at import time. Must add `if __name__ == "__main__"` guards before tests can import functions.
2. **Global state**: `chunked_upsert` reads globals (`DRY_RUN`, `client`). Use `mocker.patch` or refactor to accept parameters.
3. **`find_match` global dependency**: `people_by_norm` built at module level from DB. Must inject as parameter.
4. **StatsBomb float-string IDs**: `sb_player_map` uses `external_id || '.0'` for join key. Tests must verify.
5. **`p90_factor` approximation**: Uses `1/matches` assuming 90 min/match. Document, don't fix.
6. **Division by zero risks**: `reactions` divides by `matches`; `pass_accuracy`/`takeons`/`aerial_duels` divide by counts. SQL HAVING prevents zero but Python has no guards.
7. **Supabase single-query limit**: One statement per RPC/REST call.
8. **No pandas in scripts 10/13**: They use raw psycopg2.
9. **`config.py` .env loading**: Tests must handle missing credentials (mock or skip).
10. **Repo is private**: GitHub Pages won't work for deployment.
