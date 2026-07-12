# Limitations

Being upfront about what InsightForge does not do:

## Analytics limitations

- **Forecasting** is a simple linear-trend method. It does not model
  seasonality, promotions, marketing spend, competitor actions, or external
  shocks. It requires at least 14 historical data points and is disabled
  below that. It is not a guarantee of future results.
- **Sentiment analysis** (in-browser) is a lexicon-based estimate. It does not
  understand sarcasm, idioms, or domain-specific language, and has not been
  clinically or scientifically validated. It is intended as a fast triage
  signal, not a research-grade instrument.
- **Segmentation thresholds** are heuristics you configure, not an objective
  or industry-standard classification.
- **Anomaly detection** uses a rolling-window standard-deviation method; it
  will flag statistically unusual points, not necessarily business-meaningful
  ones — always interpret flags with domain context.
- **Geographic insights** use aggregated points and ranked tables, not a
  full interactive world map with tile imagery (no paid map API is used, by
  design, to avoid a recurring cost or API key requirement for buyers).

## Technical limitations

- Files are capped at 50MB / 250,000 rows for in-browser processing
  performance. Larger files should be pre-aggregated or split.
- The app is a single-page tool for one dataset at a time; it does not
  merge or join multiple files.
- There is no user-account system, multi-user collaboration, or scheduled
  automatic data refresh — every session starts from a fresh upload (unless
  you've opted into remembering your column mapping).
- Browser compatibility targets modern evergreen browsers (recent Chrome,
  Firefox, Safari, Edge). Older browsers are not supported.

## What the Python Analyst Toolkit adds (and still doesn't)

The optional toolkit's Naive Bayes sentiment model and notebooks are trained
on synthetic demo data by default; retraining on your own labeled reviews
improves accuracy but still does not constitute a certified or regulatory
analysis tool.

## Not a substitute for professional advice

InsightForge surfaces patterns in the data you provide. It does not replace
accounting, legal, tax, or professional business-consulting advice.
