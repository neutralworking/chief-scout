.PHONY: setup pipeline dry-run parse insert enrich refine valuation dof push

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

pipeline: parse insert enrich refine valuation dof push

dry-run:
	cd $(PIPELINE) && $(PYTHON) 01_parse_rsg.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 02_insert_missing.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 03_enrich_nation_pos.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 04_refine_players.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 05_add_valuation.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 06_add_dof_columns.py --dry-run
	cd $(PIPELINE) && $(PYTHON) 07_push_to_supabase.py --dry-run
