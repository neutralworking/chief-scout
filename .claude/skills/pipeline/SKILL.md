## Data Pipeline Ingestion
1. Check target table schema with `\d table_name` equivalent
2. Validate source data column types (especially IDs: int vs float vs string)
3. Run ingestion script
4. Verify row counts and spot-check 3 joined records
5. Report any NaN/null issues
