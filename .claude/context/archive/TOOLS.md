# Tools & Useful Queries

## Pipeline Discoveries
- `14_seed_profiles.py`: Seeds full profiles for 50 curated players across all 6 tables — good for testing complete data flows
- `40_promote_to_prod.py --dry-run`: Preview which players would be promoted to prod. Use `--list` to see all eligible.
- `51_fingerprints.py`: Generates percentile-based radar fingerprints per position group. Must run after grade computation.
- `fbref_paste_to_csv.py`: Workaround for dead FBRef scraper — paste table HTML → CSV. Generates deterministic fbref_id.

## Useful SQL
- Count Tier 1 profiles: `SELECT count(*) FROM people p JOIN player_profiles pp ON pp.person_id = p.id WHERE pp.archetype IS NOT NULL AND pp.level IS NOT NULL`
- Data completeness check: `SELECT 'profiles' as t, count(*) FROM player_profiles UNION ALL SELECT 'personality', count(*) FROM player_personality UNION ALL SELECT 'market', count(*) FROM player_market UNION ALL SELECT 'status', count(*) FROM player_status UNION ALL SELECT 'grades', count(DISTINCT player_id) FROM attribute_grades`
- Find players missing grades: `SELECT p.id, p.name FROM people p LEFT JOIN attribute_grades ag ON ag.player_id = p.id WHERE ag.id IS NULL AND p.active = true`

## Custom Scripts Created
- `pipeline/34_personality_rules.py`: Rule-based personality correction (loyalty→intrinsic, comp→intrinsic patterns)
- `pipeline/35_personality_llm.py`: LLM-powered personality assessment via Groq (--min-level, --limit flags)
- `pipeline/44_xp_milestones.py`: XP milestone computation from career history (4,589 players, 11,663 milestones)
- `pipeline/51_fingerprints.py`: Percentile-based radar fingerprints per position group
