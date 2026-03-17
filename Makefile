.PHONY: setup pipeline dry-run parse insert enrich refine valuation dof push news metrics wikidata clubs wikidata-clubs transfermarkt

PYTHON ?= python3
PIPELINE := pipeline

setup:
	$(PYTHON) -m pip install -r $(PIPELINE)/requirements.txt

parse:
	cd $(PIPELINE) && $(PYTHON) 01_parse_rsg.py

insert:
	cd $(PIPELINE) && $(PYTHON) 02_insert_missing.py

enrich:
	cd $(PIPELINE) && $(PYTHON) 03_enrich_nation_pos.py

refine:
	cd $(PIPELINE) && $(PYTHON) 04_refine_players.py

valuation:
	cd $(PIPELINE) && $(PYTHON) 05_add_valuation.py

dof:
	cd $(PIPELINE) && $(PYTHON) 06_add_dof_columns.py

push:
	cd $(PIPELINE) && $(PYTHON) 07_push_to_supabase.py

statsbomb:
	cd $(PIPELINE) && $(PYTHON) 08_statsbomb_ingest.py

understat:
	cd $(PIPELINE) && $(PYTHON) 09_understat_ingest.py

match:
	cd $(PIPELINE) && $(PYTHON) 10_player_matching.py

fbref:
	cd $(PIPELINE) && $(PYTHON) 11_fbref_ingest.py

news:
	cd $(PIPELINE) && $(PYTHON) 12_news_ingest.py

metrics:
	cd $(PIPELINE) && $(PYTHON) 13_stat_metrics.py

wikidata:
	cd $(PIPELINE) && $(PYTHON) 15_wikidata_enrich.py

clubs:
	cd $(PIPELINE) && $(PYTHON) 16_club_ingest.py

wikidata-clubs:
	cd $(PIPELINE) && $(PYTHON) 17_wikidata_clubs.py --batch-sparql

transfermarkt:
	cd $(PIPELINE) && $(PYTHON) 28_transfermarkt_ingest.py

# ── Kaggle datasets ──────────────────────────────────────────────────────────

kaggle-download:
	$(PYTHON) $(PIPELINE)/50_kaggle_download.py

kaggle-euro:
	cd $(PIPELINE) && $(PYTHON) 51_kaggle_euro_leagues.py

kaggle-transfers:
	cd $(PIPELINE) && $(PYTHON) 52_kaggle_transfer_values.py

kaggle-fifa:
	cd $(PIPELINE) && $(PYTHON) 53_kaggle_fifa_historical.py

kaggle-pl:
	cd $(PIPELINE) && $(PYTHON) 54_kaggle_pl_stats.py

kaggle-injuries:
	cd $(PIPELINE) && $(PYTHON) 55_kaggle_injuries.py --tags --traits

kaggle-all: kaggle-euro kaggle-transfers kaggle-fifa kaggle-pl kaggle-injuries

pipeline: parse insert enrich refine valuation dof push statsbomb understat match fbref news wikidata metrics clubs wikidata-clubs transfermarkt kaggle-all

dry-run:
	cd $(PIPELINE) && $(PYTHON) 01_parse_rsg.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 02_insert_missing.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 03_enrich_nation_pos.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 04_refine_players.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 05_add_valuation.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 06_add_dof_columns.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 07_push_to_supabase.py --dry-run
