"""Task 4: join_datasets - enriches sales with customer info and review signals.

Left-joins cleaned sales rows to cleaned customers on customerId (so every
sale is kept even if the customer record is missing - see
`unmatched_customer_rows`), then attaches per-product review aggregates
(average rating, review count) computed from the cleaned reviews file.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from transforms.io_utils import atomic_write_json
from transforms.logging_utils import JoinIntegrityError, get_logger

logger = get_logger("join")


@dataclass(frozen=True)
class JoinResult:
    logical_date: str
    output_dir: str
    joined_path: str
    row_count: int
    unmatched_customer_rows: int

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "joinedPath": self.joined_path,
            "rowCount": self.row_count,
            "unmatchedCustomerRows": self.unmatched_customer_rows,
        }


def join_datasets_impl(clean_result: dict) -> JoinResult:
    out_dir = Path(clean_result["outputDir"])
    cleaned_paths = clean_result["cleanedPaths"]

    sales = pd.read_csv(cleaned_paths["sales"], dtype={"customerId": str, "orderId": str})
    customers = pd.read_csv(cleaned_paths["customers"], dtype={"customerId": str})
    reviews = pd.read_csv(cleaned_paths["reviews"], dtype={"product": str})

    # customers.csv is only required to have customerId - every other column is
    # optional, mirroring the dashboard's own "adapts to whatever subset you
    # provide" philosophy (docs/DATA_SCHEMA.md). Select+rename only the columns
    # that are actually present rather than assuming a fixed customer schema.
    rename_map = {"customerName": "customer_name", "region": "customer_region", "country": "customer_country"}
    optional_columns = [c for c in ("customerName", "region", "country", "signupDate") if c in customers.columns]
    customers_slim = customers[["customerId", *optional_columns]].rename(columns=rename_map)

    has_customer_id = sales["customerId"].notna() & (sales["customerId"].astype(str).str.strip() != "")
    joined = sales.merge(customers_slim, on="customerId", how="left")
    if "customer_name" not in joined.columns:
        joined["customer_name"] = pd.NA

    unmatched = int((has_customer_id & joined["customer_name"].isna()).sum())

    if "product" in reviews.columns and "rating" in reviews.columns:
        review_agg = (
            reviews.groupby("product", dropna=True)
            .agg(review_count=("rating", "count"), average_rating=("rating", "mean"))
            .reset_index()
        )
        joined = joined.merge(review_agg, on="product", how="left")
    else:
        joined["review_count"] = pd.NA
        joined["average_rating"] = pd.NA

    if len(joined) == 0:
        raise JoinIntegrityError(
            "join_datasets failed: the sales-customers-reviews join produced zero rows. "
            "Check that sales.csv has at least one row - see docs/TROUBLESHOOTING.md#join-produced-no-rows."
        )

    joined_path = out_dir / "03_joined_dataset.csv"
    joined.to_csv(joined_path, index=False)

    result = JoinResult(
        logical_date=clean_result["logicalDate"],
        output_dir=str(out_dir),
        joined_path=str(joined_path),
        row_count=len(joined),
        unmatched_customer_rows=unmatched,
    )
    atomic_write_json(out_dir / "03_join_summary.json", result.to_xcom_dict())
    logger.info("Joined dataset: %d rows, %d unmatched customer row(s)", len(joined), unmatched)
    return result
