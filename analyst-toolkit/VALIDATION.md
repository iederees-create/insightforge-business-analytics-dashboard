# Validation Record

This file records what was actually executed to validate the Python Analyst Toolkit, and
the exact results — not just a description of what should work.

Environment: Python 3.12.3, virtual environment at `analyst-toolkit/.venv`, dependencies
installed from `requirements.txt` (pandas 3.0.3, numpy 2.5.1, matplotlib 3.11.0,
scikit-learn 1.9.0, pytest 9.1.1, jupyter 1.1.1, nbconvert 7.17.1, ipykernel 7.3.0).

## 1. Dependency install

```
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Completed without errors.

## 2. Data generation

```
python data_generator.py
```

Ran successfully and wrote 5 CSVs to `sample_data/`:

| File | Rows |
|---|---|
| orders.csv | 6,326 |
| customers.csv | 2,100 |
| products.csv | 40 |
| reviews.csv | 2,051 |
| campaigns.csv | 18 |

Deterministic (fixed `RANDOM_SEED = 42`); re-running produces identical output.

Verified data-quality characteristics present in `orders.csv`:
- 12 exact duplicate rows (by design, for `clean_data.py` to detect)
- A handful of missing values in `discount`, `region`, `channel`, `marketingSource`
- A handful of injected negative-`profit` rows and large outlier orders (revenue/quantity
  spikes), confirmed via `clean_data.py`'s IQR and negative-value checks
- 18 months of daily history (2024-01-01 to 2025-06-30), multiple regions/countries, and
  repeat customers with a realistic order-frequency mix (see bug fix below)

### Bug found and fixed during validation

The first generated dataset used `N_CUSTOMERS = 350` against a daily order-volume model that
produced ~6,200 total orders. Because customer order assignment used a fixed-size pool
(sized from each customer's *intended* order count, ~1,026 slots) that got reshuffled and
re-consumed roughly 6 times to reach 6,200 draws, every customer's actual order count was
uniformly inflated ~6x — the generated data ended up with **zero** customers in the 1-2
order range (minimum observed frequency was 5), which directly violated the spec's "some
customers with 5+ orders, most with 1-2" requirement and made the RFM segmentation notebook
degenerate (340/350 customers landed in "Champions").

Root cause: the customer pool size and the daily-volume-driven total order count were sized
independently with no reconciliation. Fix: raised `N_CUSTOMERS` to 2,100 so the intended
per-customer order-count distribution sums to roughly the same total as the daily-volume
model produces, eliminating the multi-cycle pool reshuffle. Verified post-fix:

```
customers with orders: 2,083 of 2,100
pct with 1-2 orders: 54.9%
pct with 3-4 orders: 30.2%
pct with 5+ orders:  14.9%
```

This matches the intended distribution, and the RFM segmentation notebook now produces a
realistic spread across all five segments (see section 5 below) instead of a degenerate
one-bucket result.

### Known, non-bug characteristic

`orders.csv`'s `campaign` column uses an empty string to mean "no campaign attributed" to
an order (~60% of orders, since only ~60% of orders in a campaign's active date window are
attributed to it). Empty strings round-trip through CSV as missing values, so
`clean_data.py`'s missing-value report legitimately shows a large `campaign` "missing"
count. This is expected/realistic (most orders in real businesses aren't tied to a specific
marketing campaign) and is not treated as an error anywhere in the toolkit.

## 3. Test suite

```
pytest -v
```

**Result: 32 passed, 0 failed** (run twice — once before the data_generator fix, once after
final regeneration — both times all 32 tests passed, since the tests use small hand-built
fixtures in `tests/fixtures.py` and never depend on `sample_data/`).

Coverage: `find_missing_values`, `find_duplicate_rows`, `find_negative_values`,
`find_outliers_iqr`, and `clean_dataframe` in `clean_data.py` (15 tests); `compute_rfm`'s
R/F/M scoring and segment banding in `analysis_utils.py` against hand-computed expected
scores for 4 distinct customer profiles, including a custom-threshold override (7 tests);
`moving_average`, `fit_linear_trend`, `forecast_linear_trend`, and `residual_std` against
known-exact linear series and a deterministic zig-zag series (10 tests).

## 4. Report generation

```
python generate_report.py
```

Ran successfully and wrote `output/report.html` (KPIs, top products, RFM segment summary,
30-day linear-trend forecast summary, and the data-cleaning notes). No external network
calls are made.

## 5. Notebook execution — REAL, VERIFIED

All 5 notebooks were built as valid notebook JSON via `nbformat` and then **actually
executed end-to-end** with:

```
jupyter nbconvert --to notebook --execute --inplace notebooks/<name>.ipynb
```

against the regenerated `sample_data/` (after the N_CUSTOMERS fix above). Each run is
recorded below, and was independently re-verified afterward by parsing every notebook's
saved cell outputs and confirming zero `output_type == "error"` entries in any cell.

| Notebook | nbconvert exit | Embedded cell errors | Key output artifacts written |
|---|---|---|---|
| `01_sales_analysis.ipynb` | success | 0 | `01_monthly_trends.png`, `01_top_products.png`/`.csv`, `01_revenue_by_category.png`, `01_profit_margin.png` |
| `02_customer_segmentation.ipynb` | success | 0 | `02_rfm_segment_summary.csv`, `02_rfm_customer_detail.csv`, `02_segment_chart.png` |
| `03_sentiment_analysis.ipynb` | success | 0 | `03_classification_report.txt`, `03_confusion_matrix.png`, `03_informative_terms.csv` |
| `04_forecasting.ipynb` | success | 0 | `04_daily_revenue_moving_average.png`, `04_revenue_forecast.png`, `04_forecast_table.csv` |
| `05_geographic_analysis.ipynb` | success | 0 | `05_region_summary.csv`, `05_revenue_by_region.png`, `05_country_ranking.csv`, `05_revenue_by_country.png` |

Sample results observed (for context, not guarantees about your own data):
- Notebook 02's final RFM segment counts: Champions 487, Loyal Customers 493, Potential
  Loyalists 477, At Risk 515, Lost 111 — a realistic spread, confirming the data_generator
  fix worked.
- Notebook 03's Naive Bayes classifier reached ~99.6% test accuracy. This is called out
  explicitly in the notebook's "Model Limitations" section as an artifact of training on
  labels that were generated from the same template pool as the review text itself (label
  circularity) — real, human-written review data would not be expected to score this high.

## 6. Sandbox limitations encountered

- No sandbox limitation prevented real notebook execution — `jupyter` and `nbconvert` were
  installed successfully into the project's own `.venv` and used directly; nothing here was
  "converted and logic-checked as a plain script" as a substitute. All 5 notebooks ran as
  actual `.ipynb` files through the real Jupyter execution engine.
- `nbconvert`/`ipykernel` printed a routine warning about the local kernel running over
  unencrypted TCP (an artifact of this container's loopback-only kernel setup, not a
  toolkit issue) — this did not affect execution or results and requires no action from
  toolkit users.

## Summary

- `pip install -r requirements.txt`: succeeded
- `python data_generator.py`: succeeded, 5 CSVs written, 1 generator bug found and fixed
  (customer/order-volume mismatch), re-verified after the fix
- `pytest -v`: **32 passed, 0 failed**
- `python generate_report.py`: succeeded, `output/report.html` written
- All 5 notebooks: **executed top-to-bottom with zero errors**, confirmed both via
  `nbconvert`'s exit status and by programmatically scanning saved outputs for error cells
