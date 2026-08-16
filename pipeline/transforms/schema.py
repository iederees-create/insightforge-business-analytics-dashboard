"""Column-role schema definitions mirroring docs/DATA_SCHEMA.md (the browser
dashboard's own column-role vocabulary). Shared by validate.py (checks) and
clean.py (fixes) so both agree on what "required", "numeric", and "date"
mean for each input file - and so pipeline outputs stay meaningfully
compatible with the dashboard's own coercion rules.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ColumnSpec:
    name: str
    dtype: str  # "date" | "number" | "integer" | "string"
    required: bool


SALES_COLUMNS: tuple[ColumnSpec, ...] = (
    ColumnSpec("date", "date", required=True),
    ColumnSpec("orderId", "string", required=True),
    ColumnSpec("transactionId", "string", required=False),
    ColumnSpec("customerId", "string", required=False),
    ColumnSpec("product", "string", required=False),
    ColumnSpec("category", "string", required=False),
    ColumnSpec("quantity", "integer", required=False),
    ColumnSpec("revenue", "number", required=True),
    ColumnSpec("cost", "number", required=False),
    ColumnSpec("profit", "number", required=False),
    ColumnSpec("discount", "number", required=False),
    ColumnSpec("channel", "string", required=False),
    ColumnSpec("region", "string", required=False),
    ColumnSpec("country", "string", required=False),
    ColumnSpec("marketingSource", "string", required=False),
    ColumnSpec("campaign", "string", required=False),
    ColumnSpec("status", "string", required=False),
)

CUSTOMERS_COLUMNS: tuple[ColumnSpec, ...] = (
    ColumnSpec("customerId", "string", required=True),
    ColumnSpec("customerName", "string", required=False),
    ColumnSpec("region", "string", required=False),
    ColumnSpec("country", "string", required=False),
    ColumnSpec("latitude", "number", required=False),
    ColumnSpec("longitude", "number", required=False),
    ColumnSpec("signupDate", "date", required=False),
)

REVIEWS_COLUMNS: tuple[ColumnSpec, ...] = (
    ColumnSpec("date", "date", required=False),
    ColumnSpec("orderId", "string", required=False),
    ColumnSpec("customerId", "string", required=False),
    ColumnSpec("product", "string", required=False),
    ColumnSpec("rating", "integer", required=True),
    ColumnSpec("reviewText", "string", required=False),
)

SCHEMAS: dict[str, tuple[ColumnSpec, ...]] = {
    "sales": SALES_COLUMNS,
    "customers": CUSTOMERS_COLUMNS,
    "reviews": REVIEWS_COLUMNS,
}

REQUIRED_INPUT_FILES: tuple[str, ...] = ("sales.csv", "customers.csv", "reviews.csv")

# (0, 0) is a common "missing GPS data" placeholder in real-world exports,
# not a genuine point - mirrors docs/DATA_SCHEMA.md's coordinate rule.
LATITUDE_RANGE = (-90.0, 90.0)
LONGITUDE_RANGE = (-180.0, 180.0)


def required_columns(dataset: str) -> list[str]:
    return [c.name for c in SCHEMAS[dataset] if c.required]


def numeric_columns(dataset: str) -> list[str]:
    return [c.name for c in SCHEMAS[dataset] if c.dtype in ("number", "integer")]


def integer_columns(dataset: str) -> list[str]:
    return [c.name for c in SCHEMAS[dataset] if c.dtype == "integer"]


def date_columns(dataset: str) -> list[str]:
    return [c.name for c in SCHEMAS[dataset] if c.dtype == "date"]


def is_valid_coordinate(lat: float | None, lng: float | None) -> bool:
    if lat is None or lng is None:
        return False
    if not (LATITUDE_RANGE[0] <= lat <= LATITUDE_RANGE[1]):
        return False
    if not (LONGITUDE_RANGE[0] <= lng <= LONGITUDE_RANGE[1]):
        return False
    return not (lat == 0 and lng == 0)
