# AI Disclosure

## Development

This product was built with the assistance of AI coding tools — Claude Code
(Anthropic) and ChatGPT (OpenAI) — used by the developer for code generation,
refactoring, and documentation drafting. All code was reviewed, tested, and
integrated by the developer before release.

## In-product AI

**The core InsightForge application does not call any external AI or machine
learning API.** Sentiment analysis, forecasting, anomaly detection, and the
Data Story Engine all run on transparent, deterministic, locally-executed
logic described in `docs/METHODOLOGY.md` — no data is sent to any AI service,
and no AI subscription or API key is required to use the product.

An optional "Bring Your Own Key" AI-insight interface may be present in the
codebase as a disabled-by-default extension point for buyers who want to
connect their own AI provider. It is off by default, is never required for
core functionality, and any API key a buyer enters for it is used only for
direct calls from their own browser to their own chosen provider — never
stored on any server InsightForge controls (there is no such server), and
never transmitted anywhere else.

## Python Analyst Toolkit

The Naive Bayes sentiment classifier in the optional Python toolkit is a
genuine trained machine-learning model (scikit-learn), trained locally on
synthetic demonstration data. It is not an external AI API call.

## Synthetic data

All demonstration data (orders, customers, products, reviews) is
algorithmically generated fictional data, not collected from, or based on,
any real business, customer, or individual.
