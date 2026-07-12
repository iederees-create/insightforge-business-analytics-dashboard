# Python Analyst Toolkit — Setup Guide

This is the optional Python companion to InsightForge Business Analytics Studio. It works
entirely offline against CSV files that follow the shared schema documented in the main
product. You do not need the React/TypeScript app installed to use this toolkit — you only
need Python.

## Requirements

- Python 3.10 or newer
- No internet access required to run anything in this toolkit (data is synthetic, generated
  locally)

## 1. Create a virtual environment

From inside the `analyst-toolkit/` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
```

## 2. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

This installs pandas, numpy, matplotlib, scikit-learn, pytest, and the Jupyter stack used to
run the notebooks.

## 3. Generate the synthetic sample dataset

```bash
python data_generator.py
```

This writes `orders.csv`, `customers.csv`, `products.csv`, `reviews.csv`, and `campaigns.csv`
into `sample_data/`. The generator is deterministic (fixed random seed) so you will get the
same numbers every time you run it. All data is fictional — nothing here comes from a real
business.

## 4. Clean a dataset (optional, standalone)

```bash
python clean_data.py sample_data/orders.csv
```

This prints a plain-text report of missing values, duplicates, negative values, and
IQR-based outliers found in the file, and never mutates the source file. Import
`clean_data` as a module from your own scripts/notebooks to get the cleaned
`pandas.DataFrame` back directly.

## 5. Run the test suite

```bash
pytest -v
```

Tests run against small, hand-built fixtures (not the generated dataset), so they are fast
and deterministic. They check the actual calculation logic (cleaning, RFM segmentation,
forecasting math), not just "does it run."

## 6. Run the notebooks

Each notebook in `notebooks/` reads from `sample_data/` (generated in step 3) and writes
charts/tables to `output/`. Run them either interactively:

```bash
jupyter notebook notebooks/
```

or non-interactively from the command line (useful for CI or a quick end-to-end check):

```bash
jupyter nbconvert --to notebook --execute --inplace notebooks/01_sales_analysis.ipynb
```

Repeat for `02_customer_segmentation.ipynb`, `03_sentiment_analysis.ipynb`,
`04_forecasting.ipynb`, and `05_geographic_analysis.ipynb`. Run them in that order the
first time — later notebooks assume `sample_data/` already exists (created in step 3), but
each notebook is otherwise independent of the others.

## 7. Generate the summary report

```bash
python generate_report.py
```

This reads the cleaned data and writes a single self-contained HTML report to
`output/report.html` with KPIs, top products, customer segment summary, and a forecast
summary. No external API calls are made.

## Project layout

```
analyst-toolkit/
├── requirements.txt
├── SETUP.md
├── VALIDATION.md          # record of what was actually run and verified
├── data_generator.py      # synthetic data -> sample_data/*.csv
├── clean_data.py          # cleaning + data-quality reporting (script + importable module)
├── generate_report.py     # reads cleaned data -> output/report.html
├── sample_data/           # generated CSVs (orders, customers, products, reviews, campaigns)
├── notebooks/              # 5 analysis notebooks, output saved to output/
├── output/                 # charts, tables, and report.html land here
└── tests/                  # pytest suite with fixtures, no dependency on generated data
```

## Using this toolkit with your own data

Point `clean_data.py` or the notebooks at your own CSV export instead of the synthetic
sample, as long as it follows the shared schema (see the toolkit README / product docs for
the full column list). Not every column is required — analyses that depend on a missing
optional column (e.g. `latitude`/`longitude`, `reviewText`) are skipped with a clear message
rather than failing or silently reporting zeros.
