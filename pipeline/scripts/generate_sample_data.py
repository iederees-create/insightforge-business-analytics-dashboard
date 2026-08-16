"""Generates the synthetic sales/customers/reviews CSVs under pipeline/sample_data/.

Re-runnable and deterministic (fixed seed) - NOT executed by the DAG or the CLI
at pipeline run time. The pipeline's inputs are the static CSVs this script
already produced and committed; this script exists purely so the fixtures are
reproducible and their deliberate data-quality issues are documented, not
hand-typed.

# SYNTHETIC DATA - no real customers, orders, or reviews. Every value below is
# generated from a fixed random seed for demonstration and testing only.
"""

from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 20260101
SALES_ROWS = 1500
CUSTOMERS_ROWS = 400
REVIEWS_ROWS = 250

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "sample_data"

PRODUCTS = [
    ("Wireless Charging Pad", "Electronics"),
    ("Ceramic Coffee Mug", "Home"),
    ("Linen Throw Blanket", "Home"),
    ("Running Shoes - Trail", "Sportswear"),
    ("Yoga Mat - Extra Thick", "Sportswear"),
    ("Bluetooth Ear Buds", "Electronics"),
    ("Scented Soy Candle", "Home"),
    ("Leather Journal", "Stationery"),
    ("Stainless Water Bottle", "Sportswear"),
    ("Desk Organiser Set", "Stationery"),
]
CHANNELS = ["Online Store", "Etsy", "Marketplace", "Wholesale"]
REGIONS_COUNTRIES = [
    ("Western Cape", "South Africa"),
    ("Gauteng", "South Africa"),
    ("California", "United States"),
    ("Ontario", "Canada"),
    ("Greater London", "United Kingdom"),
    ("New South Wales", "Australia"),
]
MARKETING_SOURCES = ["Organic Search", "Instagram Ads", "Email", "Referral", "Direct"]
CAMPAIGNS = ["Spring Launch", "Holiday Sale", "New Arrivals", ""]
STATUSES = ["completed", "completed", "completed", "refunded"]
REVIEW_SNIPPETS = [
    "Exactly what I expected, great quality for the price.",
    "Shipping took a while but the product itself is excellent.",
    "Not quite what I pictured from the photos, a bit small.",
    "Fantastic - already ordered a second one for a friend.",
    "Good value overall, packaging could be better.",
    "Works well, does what it says.",
    "Disappointed with the finish, expected better for the price.",
    "Really happy with this purchase, will buy again.",
]


def _malformed_date_variants() -> list[str]:
    return ["32/13/2026", "not-a-date", "", "2026-02-30", "N/A"]


def generate_customers(rng: random.Random) -> list[dict[str, str]]:
    customers: list[dict[str, str]] = []
    start = date(2023, 1, 1)
    for i in range(1, CUSTOMERS_ROWS + 1):
        region, country = rng.choice(REGIONS_COUNTRIES)
        customer_id = f"CUST-{i:05d}"
        signup = start + timedelta(days=rng.randint(0, 1200))

        # Deliberately inject (0,0) placeholder coordinates for ~3% of rows -
        # a common "missing data" placeholder in real-world exports.
        if rng.random() < 0.03:
            lat, lng = "0", "0"
        else:
            lat = f"{rng.uniform(-60, 60):.4f}"
            lng = f"{rng.uniform(-120, 120):.4f}"

        customers.append(
            {
                "customerId": customer_id,
                "customerName": f"Customer {i:05d}",
                "region": region,
                "country": country,
                "latitude": lat,
                "longitude": lng,
                "signupDate": signup.isoformat(),
            }
        )
    return customers


def generate_sales(rng: random.Random, customer_ids: list[str]) -> list[dict[str, str]]:
    sales: list[dict[str, str]] = []
    start = date(2025, 1, 1)

    # A handful of customer IDs that deliberately do NOT exist in customers.csv,
    # so the join task's "unmatched customer rows" metric has something real to report.
    orphan_ids = [f"CUST-{90000 + i}" for i in range(8)]

    for i in range(1, SALES_ROWS + 1):
        product, category = rng.choice(PRODUCTS)
        quantity = rng.randint(1, 5)
        unit_price = rng.uniform(8, 120)
        revenue = round(unit_price * quantity, 2)
        cost = round(revenue * rng.uniform(0.35, 0.6), 2)
        discount = round(revenue * rng.choice([0, 0, 0, 0.1, 0.15]), 2)
        order_date = start + timedelta(days=rng.randint(0, 550))
        customer_id = rng.choice(orphan_ids) if rng.random() < 0.02 else rng.choice(customer_ids)

        # Inconsistent casing/whitespace on category for ~4% of rows.
        cat_value = category
        if rng.random() < 0.04:
            cat_value = rng.choice([category.upper(), category.lower(), f" {category} ", category.lower() + " "])

        row = {
            "date": order_date.isoformat(),
            "orderId": f"ORD-{i:06d}",
            "transactionId": f"TXN-{i:06d}",
            "customerId": customer_id,
            "product": product,
            "category": cat_value,
            "quantity": str(quantity),
            "revenue": f"{revenue}",
            "cost": f"{cost}",
            "profit": f"{round(revenue - cost, 2)}",
            "discount": f"{discount}",
            "channel": rng.choice(CHANNELS),
            "region": rng.choice(REGIONS_COUNTRIES)[0],
            "country": rng.choice(REGIONS_COUNTRIES)[1],
            "marketingSource": rng.choice(MARKETING_SOURCES),
            "campaign": rng.choice(CAMPAIGNS),
            "status": rng.choice(STATUSES),
        }

        # Deliberately blank out revenue for ~1% of rows.
        if rng.random() < 0.01:
            row["revenue"] = ""

        # Deliberately malform the date for ~0.7% of rows.
        if rng.random() < 0.007:
            row["date"] = rng.choice(_malformed_date_variants())

        sales.append(row)

    # Deliberate exact-duplicate rows (~0.5%): re-append copies of earlier rows verbatim.
    duplicate_count = max(1, SALES_ROWS // 200)
    for _ in range(duplicate_count):
        sales.append(dict(rng.choice(sales)))

    # Deliberate duplicate order IDs with DIFFERENT content (~0.4%): reuse an
    # existing orderId on a newly generated row so it's a data error, not a
    # true re-export duplicate.
    dupe_order_count = max(1, SALES_ROWS // 250)
    existing_order_ids = [r["orderId"] for r in sales[:SALES_ROWS]]
    for _ in range(dupe_order_count):
        product, category = rng.choice(PRODUCTS)
        quantity = rng.randint(1, 5)
        unit_price = rng.uniform(8, 120)
        revenue = round(unit_price * quantity, 2)
        order_date = start + timedelta(days=rng.randint(0, 550))
        sales.append(
            {
                "date": order_date.isoformat(),
                "orderId": rng.choice(existing_order_ids),
                "transactionId": f"TXN-DUPE-{rng.randint(100000, 999999)}",
                "customerId": rng.choice(customer_ids),
                "product": product,
                "category": category,
                "quantity": str(quantity),
                "revenue": f"{revenue}",
                "cost": f"{round(revenue * 0.5, 2)}",
                "profit": f"{round(revenue * 0.5, 2)}",
                "discount": "0",
                "channel": rng.choice(CHANNELS),
                "region": rng.choice(REGIONS_COUNTRIES)[0],
                "country": rng.choice(REGIONS_COUNTRIES)[1],
                "marketingSource": rng.choice(MARKETING_SOURCES),
                "campaign": "",
                "status": "completed",
            }
        )

    rng.shuffle(sales)
    return sales


def generate_reviews(rng: random.Random, customer_ids: list[str]) -> list[dict[str, str]]:
    reviews: list[dict[str, str]] = []
    start = date(2025, 1, 15)
    for i in range(1, REVIEWS_ROWS + 1):
        product, _category = rng.choice(PRODUCTS)
        review_date = start + timedelta(days=rng.randint(0, 500))
        reviews.append(
            {
                "date": review_date.isoformat(),
                "orderId": f"ORD-{rng.randint(1, SALES_ROWS):06d}",
                "customerId": rng.choice(customer_ids),
                "product": product,
                "rating": str(rng.choice([1, 2, 3, 4, 4, 5, 5, 5])),
                "reviewText": rng.choice(REVIEW_SNIPPETS),
            }
        )
    return reviews


SYNTHETIC_DATA_HEADER = (
    "# SYNTHETIC DATA — generated by generate_sample_data.py (InsightForge ETL Pipeline)\n"
    "# This file is entirely fictional. No real customers, orders, or businesses are represented.\n"
)


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        f.write(SYNTHETIC_DATA_HEADER)
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rng = random.Random(SEED)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    customers = generate_customers(rng)
    customer_ids = [c["customerId"] for c in customers]
    sales = generate_sales(rng, customer_ids)
    reviews = generate_reviews(rng, customer_ids)

    _write_csv(
        OUTPUT_DIR / "customers.csv",
        ["customerId", "customerName", "region", "country", "latitude", "longitude", "signupDate"],
        customers,
    )
    _write_csv(
        OUTPUT_DIR / "sales.csv",
        [
            "date", "orderId", "transactionId", "customerId", "product", "category",
            "quantity", "revenue", "cost", "profit", "discount", "channel", "region",
            "country", "marketingSource", "campaign", "status",
        ],
        sales,
    )
    _write_csv(
        OUTPUT_DIR / "reviews.csv",
        ["date", "orderId", "customerId", "product", "rating", "reviewText"],
        reviews,
    )

    print(f"Wrote {len(customers)} customers, {len(sales)} sales rows, {len(reviews)} reviews to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
