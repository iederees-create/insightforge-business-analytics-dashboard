"""Synthetic data generator for InsightForge Business Analytics Studio.

*** ALL DATA PRODUCED BY THIS SCRIPT IS 100% FICTIONAL / SYNTHETIC. ***
No real customers, orders, reviews, or businesses are represented. It exists
purely so buyers of the toolkit have a realistic-looking, reproducible sample
dataset to explore the notebooks and scripts with before pointing them at
their own exports.

Run directly:

    python data_generator.py

Writes five CSVs into ``sample_data/``:
    orders.csv, customers.csv, products.csv, reviews.csv, campaigns.csv

The generator is deterministic (fixed RANDOM_SEED) so re-running it always
produces byte-for-byte identical output.
"""
from __future__ import annotations

import os
import random
import string
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

RANDOM_SEED = 42
START_DATE = date(2024, 1, 1)
END_DATE = date(2025, 6, 30)  # ~18 months of history
N_CUSTOMERS = 2100  # sized so sum(per-customer target order counts) ~= total daily-volume-driven
# order count below (~6,200 over the 18-month range); otherwise the customer pool cycles
# multiple times and uniformly inflates everyone's order count (see _weighted_customer_order_counts).
N_CAMPAIGNS = 18
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data")

rng = np.random.default_rng(RANDOM_SEED)
py_random = random.Random(RANDOM_SEED)

# ---------------------------------------------------------------------------
# Reference data: regions/countries, channels, marketing sources, categories
# ---------------------------------------------------------------------------

REGION_COUNTRIES = {
    "North America": [
        ("United States", 39.8283, -98.5795),
        ("Canada", 56.1304, -106.3468),
    ],
    "Europe": [
        ("United Kingdom", 55.3781, -3.4360),
        ("Germany", 51.1657, 10.4515),
        ("France", 46.2276, 2.2137),
    ],
    "Asia Pacific": [
        ("Australia", -25.2744, 133.7751),
        ("Japan", 36.2048, 138.2529),
        ("Singapore", 1.3521, 103.8198),
    ],
    "Latin America": [
        ("Brazil", -14.2350, -51.9253),
        ("Mexico", 23.6345, -102.5528),
    ],
}

CHANNELS = ["Online Store", "Marketplace", "Retail Partner", "Mobile App"]
MARKETING_SOURCES = [
    "Google Ads",
    "Facebook Ads",
    "Instagram Ads",
    "Email",
    "Organic Search",
    "Referral",
    "Direct",
    "TikTok Ads",
]
STATUSES = ["completed", "completed", "completed", "completed", "refunded", "cancelled", "pending"]

CATEGORIES = {
    "Home & Kitchen": ["Ceramic Mug Set", "Bamboo Cutting Board", "Non-Stick Skillet", "Electric Kettle", "Knife Block Set"],
    "Office Supplies": ["Notebook 3-Pack", "Mechanical Pencil", "Desk Organizer", "Wireless Mouse", "Standing Desk Mat"],
    "Fitness": ["Yoga Mat", "Resistance Bands Set", "Adjustable Dumbbell", "Foam Roller", "Jump Rope"],
    "Outdoors": ["Insulated Water Bottle", "Camping Hammock", "LED Headlamp", "Trail Backpack", "Portable Camp Chair"],
    "Electronics Accessories": ["USB-C Hub", "Wireless Charger Pad", "Bluetooth Earbuds", "Laptop Stand", "Cable Organizer Kit"],
    "Beauty & Personal Care": ["Facial Cleanser", "Bamboo Hairbrush", "Vitamin C Serum", "Silk Sleep Mask", "Travel Toiletry Bag"],
    "Pet Supplies": ["Dog Chew Toy", "Cat Scratching Post", "Pet Travel Carrier", "Automatic Feeder", "Orthopedic Pet Bed"],
    "Stationery & Gifts": ["Scented Candle", "Gift Wrap Bundle", "Personalized Tumbler", "Greeting Card Set", "Desktop Planter"],
}

CAMPAIGN_NAMES = [
    "New Year Kickoff 2024", "Spring Refresh 2024", "Mothers Day Gifting 2024", "Summer Clearance 2024",
    "Back to School 2024", "Fall Favorites 2024", "Black Friday 2024", "Holiday Gift Guide 2024",
    "New Year Kickoff 2025", "Winter Warmup 2025", "Spring Refresh 2025", "Mothers Day Gifting 2025",
    "Loyalty Rewards Push", "Flash Sale Weekend", "Referral Bonus Drive", "App Launch Promo",
    "Clearance Blowout", "Evergreen Search",
]

FIRST_NAMES = [
    "Amara", "Ben", "Carla", "Deshawn", "Elin", "Farid", "Grace", "Hiro", "Isla", "Jamal",
    "Kavya", "Liam", "Mei", "Noah", "Olga", "Priya", "Quinn", "Rosa", "Sanjay", "Talia",
    "Uma", "Victor", "Wren", "Ximena", "Yusuf", "Zoe", "Aiden", "Bianca", "Caleb", "Dana",
]
LAST_NAMES = [
    "Nguyen", "Smith", "Garcia", "Muller", "Tanaka", "Silva", "Kowalski", "Johnson", "Patel", "Dubois",
    "Andersson", "Kim", "Rossi", "Fernandez", "Brown", "Osei", "Costa", "Ivanov", "Lindgren", "Haddad",
]

# ---------------------------------------------------------------------------
# Sentiment templates: 20 varied sentences across positive/neutral/negative.
# Combined with randomized second clauses so review text is not one canned
# sentence per bucket.
# ---------------------------------------------------------------------------

POSITIVE_TEMPLATES = [
    "Absolutely love this {product}, it exceeded my expectations.",
    "Great quality and fast shipping, I will definitely buy again.",
    "This {product} is exactly what I needed. Highly recommend!",
    "Five stars, no complaints at all.",
    "Excellent value for the price, very happy with this purchase.",
    "My {product} arrived quickly and works perfectly.",
    "The build quality is impressive for this price point.",
    "Best purchase I've made this year, works flawlessly.",
]
NEUTRAL_TEMPLATES = [
    "It's okay, does what it says on the box.",
    "Average {product}, nothing special but it works fine.",
    "Shipping took a bit longer than expected but the item is fine.",
    "Not bad, not great. Meets basic expectations.",
    "Decent for the price, might consider alternatives next time.",
    "The {product} works as described, no major issues.",
]
NEGATIVE_TEMPLATES = [
    "Disappointed with the quality of this {product}.",
    "Arrived damaged and customer service was slow to respond.",
    "Not worth the money, wouldn't recommend.",
    "Stopped working after a few weeks, very frustrating.",
    "The description was misleading, this isn't what I expected.",
    "Poor packaging led to a broken {product} on arrival.",
]
EXTRA_CLAUSES = [
    "Packaging was minimal.",
    "Shipping was fast.",
    "Customer support was responsive.",
    "Would consider other brands next time.",
    "Instructions could be clearer.",
    "",  # sometimes no extra clause at all
]


@dataclass(frozen=True)
class Product:
    product: str
    category: str
    base_price: float
    base_cost: float


def build_products() -> list[Product]:
    """Build the fixed product catalog with a realistic price/cost split."""
    products: list[Product] = []
    for category, names in CATEGORIES.items():
        for name in names:
            base_price = round(float(rng.uniform(8.0, 120.0)), 2)
            margin_pct = float(rng.uniform(0.35, 0.65))
            base_cost = round(base_price * (1 - margin_pct), 2)
            products.append(Product(product=name, category=category, base_price=base_price, base_cost=base_cost))
    return products


def build_campaigns() -> pd.DataFrame:
    """Generate the campaigns table: one row per marketing campaign."""
    rows = []
    span_days = (END_DATE - START_DATE).days
    for i, name in enumerate(CAMPAIGN_NAMES[:N_CAMPAIGNS]):
        start_offset = int(rng.integers(0, max(span_days - 30, 1)))
        campaign_start = START_DATE + timedelta(days=start_offset)
        duration = int(rng.integers(10, 45))
        campaign_end = min(campaign_start + timedelta(days=duration), END_DATE)
        channel = py_random.choice(CHANNELS)
        source = py_random.choice(MARKETING_SOURCES)
        spend = round(float(rng.uniform(500, 15000)), 2)
        rows.append(
            {
                "campaign": name,
                "marketingSource": source,
                "channel": channel,
                "startDate": campaign_start.isoformat(),
                "endDate": campaign_end.isoformat(),
                "spend": spend,
            }
        )
    return pd.DataFrame(rows)


def build_customers() -> pd.DataFrame:
    """Generate the customer master table with a home region/country."""
    rows = []
    used_ids: set[str] = set()
    for i in range(N_CUSTOMERS):
        customer_id = f"CUST{i + 1:05d}"
        used_ids.add(customer_id)
        first = py_random.choice(FIRST_NAMES)
        last = py_random.choice(LAST_NAMES)
        region = py_random.choice(list(REGION_COUNTRIES.keys()))
        country, lat_center, lon_center = py_random.choice(REGION_COUNTRIES[region])
        lat = round(lat_center + float(rng.normal(0, 3.0)), 4)
        lon = round(lon_center + float(rng.normal(0, 3.0)), 4)
        signup_offset = int(rng.integers(0, (END_DATE - START_DATE).days))
        signup_date = START_DATE + timedelta(days=signup_offset)
        rows.append(
            {
                "customerId": customer_id,
                "customerName": f"{first} {last}",
                "region": region,
                "country": country,
                "latitude": lat,
                "longitude": lon,
                "signupDate": signup_date.isoformat(),
            }
        )
    return pd.DataFrame(rows)


def _order_volume_for_day(day_index: int, total_days: int) -> float:
    """Deterministic-ish expected order count for a given day: trend + yearly
    seasonality + weekly pattern. Used as a Poisson mean.
    """
    growth = 6.0 + 10.0 * (day_index / total_days)  # gentle upward trend
    day_of_year_angle = 2 * np.pi * (day_index % 365) / 365
    seasonal = 2.5 * np.sin(day_of_year_angle - np.pi / 2) + 1.5 * np.cos(2 * day_of_year_angle)
    weekday = (START_DATE + timedelta(days=day_index)).weekday()
    weekly_boost = 2.0 if weekday >= 5 else 0.0  # weekend bump
    return max(1.0, growth + seasonal + weekly_boost)


def _weighted_customer_order_counts(customer_ids: list[str]) -> dict[str, int]:
    """Assign each customer a target order count: most get 1-2, a minority
    (~15%) become repeat buyers with 5+ orders, matching the spec's
    'repeat customers' requirement.
    """
    counts: dict[str, int] = {}
    for cid in customer_ids:
        roll = rng.random()
        if roll < 0.55:
            counts[cid] = int(rng.integers(1, 3))  # 1-2 orders
        elif roll < 0.85:
            counts[cid] = int(rng.integers(3, 5))  # 3-4 orders
        else:
            counts[cid] = int(rng.integers(5, 12))  # loyal repeat customers
    return counts


def _make_review_text(bucket: str, product_name: str) -> str:
    templates = {"positive": POSITIVE_TEMPLATES, "neutral": NEUTRAL_TEMPLATES, "negative": NEGATIVE_TEMPLATES}[bucket]
    sentence = py_random.choice(templates).format(product=product_name)
    extra = py_random.choice(EXTRA_CLAUSES)
    return f"{sentence} {extra}".strip()


def _rating_for_bucket(bucket: str) -> int:
    if bucket == "positive":
        return int(rng.choice([4, 5], p=[0.35, 0.65]))
    if bucket == "neutral":
        return 3
    return int(rng.choice([1, 2], p=[0.45, 0.55]))


def build_orders_and_reviews(
    customers: pd.DataFrame, products: list[Product], campaigns: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Generate the orders table (and a matched reviews table) day by day."""
    total_days = (END_DATE - START_DATE).days + 1
    customer_ids = customers["customerId"].tolist()
    order_targets = _weighted_customer_order_counts(customer_ids)

    # Expand each customer id by its target order count, then shuffle so
    # orders get spread across the date range rather than clustered.
    customer_pool: list[str] = []
    for cid, count in order_targets.items():
        customer_pool.extend([cid] * count)
    py_random.shuffle(customer_pool)

    customer_lookup = customers.set_index("customerId").to_dict(orient="index")
    campaign_records = campaigns.to_dict(orient="records")

    order_rows = []
    review_rows = []
    order_seq = 0
    txn_seq = 0
    pool_index = 0
    pool_len = len(customer_pool)

    for day_index in range(total_days):
        current_date = START_DATE + timedelta(days=day_index)
        expected = _order_volume_for_day(day_index, total_days)
        n_orders_today = int(rng.poisson(expected))
        for _ in range(n_orders_today):
            if pool_index >= pool_len:
                pool_index = 0
                py_random.shuffle(customer_pool)
            customer_id = customer_pool[pool_index]
            pool_index += 1

            customer = customer_lookup[customer_id]
            product = py_random.choice(products)
            quantity = int(rng.choice([1, 1, 1, 2, 2, 3, 4], p=[0.35, 0.2, 0.15, 0.13, 0.09, 0.05, 0.03]))
            discount_pct = float(rng.choice([0.0, 0.0, 0.05, 0.1, 0.15, 0.2], p=[0.5, 0.15, 0.15, 0.1, 0.06, 0.04]))
            unit_price = product.base_price
            gross_revenue = unit_price * quantity
            revenue = round(gross_revenue * (1 - discount_pct), 2)
            cost = round(product.base_cost * quantity, 2)
            profit = round(revenue - cost, 2)
            status = py_random.choice(STATUSES)

            eligible_campaigns = [
                c for c in campaign_records if c["startDate"] <= current_date.isoformat() <= c["endDate"]
            ]
            if eligible_campaigns and rng.random() < 0.6:
                campaign = py_random.choice(eligible_campaigns)
                campaign_name = campaign["campaign"]
                marketing_source = campaign["marketingSource"]
                channel = campaign["channel"]
            else:
                campaign_name = ""
                marketing_source = py_random.choice(MARKETING_SOURCES)
                channel = py_random.choice(CHANNELS)

            order_seq += 1
            txn_seq += 1
            order_id = f"ORD{order_seq:06d}"
            transaction_id = f"TXN{txn_seq:06d}"

            order_rows.append(
                {
                    "date": current_date.isoformat(),
                    "orderId": order_id,
                    "transactionId": transaction_id,
                    "customerId": customer_id,
                    "customerName": customer["customerName"],
                    "product": product.product,
                    "category": product.category,
                    "quantity": quantity,
                    "revenue": revenue,
                    "cost": cost,
                    "profit": profit,
                    "discount": discount_pct,
                    "channel": channel,
                    "region": customer["region"],
                    "country": customer["country"],
                    "marketingSource": marketing_source,
                    "campaign": campaign_name,
                    "status": status,
                }
            )

            # Roughly 55% of completed orders get a review.
            if status == "completed" and rng.random() < 0.55:
                bucket = str(rng.choice(["positive", "neutral", "negative"], p=[0.55, 0.25, 0.2]))
                review_rows.append(
                    {
                        "date": (current_date + timedelta(days=int(rng.integers(1, 14)))).isoformat(),
                        "orderId": order_id,
                        "transactionId": transaction_id,
                        "customerId": customer_id,
                        "product": product.product,
                        "rating": _rating_for_bucket(bucket),
                        "reviewText": _make_review_text(bucket, product.product),
                        "sentimentLabel": bucket,
                    }
                )

    orders_df = pd.DataFrame(order_rows)
    reviews_df = pd.DataFrame(review_rows)
    return orders_df, reviews_df


def inject_data_quality_issues(orders_df: pd.DataFrame, reviews_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Inject a handful of missing values, duplicate rows, and outliers so
    the cleaning script / notebooks have something realistic to catch.
    """
    orders_df = orders_df.copy()

    # A handful of missing values in optional-ish columns.
    n_missing = max(5, len(orders_df) // 400)
    missing_idx = rng.choice(orders_df.index, size=n_missing, replace=False)
    for idx in missing_idx:
        col = py_random.choice(["discount", "region", "channel", "marketingSource"])
        orders_df.loc[idx, col] = np.nan

    # A handful of exact duplicate rows.
    n_duplicates = max(4, len(orders_df) // 500)
    dup_rows = orders_df.sample(n=n_duplicates, random_state=RANDOM_SEED)
    orders_df = pd.concat([orders_df, dup_rows], ignore_index=True)

    # A handful of outliers: unusually large quantity/revenue spikes.
    n_outliers = max(6, len(orders_df) // 350)
    outlier_idx = rng.choice(orders_df.index, size=n_outliers, replace=False)
    for idx in outlier_idx:
        multiplier = float(rng.uniform(15, 40))
        orders_df.loc[idx, "quantity"] = int(orders_df.loc[idx, "quantity"] * multiplier)
        orders_df.loc[idx, "revenue"] = round(float(orders_df.loc[idx, "revenue"]) * multiplier, 2)
        orders_df.loc[idx, "cost"] = round(float(orders_df.loc[idx, "cost"]) * multiplier, 2)
        orders_df.loc[idx, "profit"] = round(orders_df.loc[idx, "revenue"] - orders_df.loc[idx, "cost"], 2)

    # A few negative values (data entry errors: refund amounts entered wrong).
    n_negative = max(3, len(orders_df) // 600)
    negative_idx = rng.choice(orders_df.index, size=n_negative, replace=False)
    for idx in negative_idx:
        orders_df.loc[idx, "profit"] = -abs(float(orders_df.loc[idx, "profit"]))

    reviews_df = reviews_df.copy()
    if len(reviews_df) > 20:
        n_missing_reviews = max(3, len(reviews_df) // 300)
        missing_review_idx = rng.choice(reviews_df.index, size=n_missing_reviews, replace=False)
        reviews_df.loc[missing_review_idx, "reviewText"] = np.nan

    return orders_df, reviews_df


def build_products_table(products: list[Product]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "product": p.product,
                "category": p.category,
                "basePrice": p.base_price,
                "baseCost": p.base_cost,
            }
            for p in products
        ]
    )


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    products = build_products()
    products_df = build_products_table(products)
    campaigns_df = build_campaigns()
    customers_df = build_customers()
    orders_df, reviews_df = build_orders_and_reviews(customers_df, products, campaigns_df)
    orders_df, reviews_df = inject_data_quality_issues(orders_df, reviews_df)

    # Shuffle orders so injected duplicates aren't all trailing at the end,
    # then reset the index for a clean CSV.
    orders_df = orders_df.sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)

    header = (
        "# SYNTHETIC DATA — generated by data_generator.py (InsightForge Business Analytics Studio)\n"
        "# This file is entirely fictional. No real customers, orders, or businesses are represented.\n"
    )

    def write_with_header(df: pd.DataFrame, filename: str) -> None:
        path = os.path.join(OUTPUT_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(header)
            df.to_csv(f, index=False)
        print(f"Wrote {len(df):,} rows -> {path}")

    write_with_header(orders_df, "orders.csv")
    write_with_header(customers_df, "customers.csv")
    write_with_header(products_df, "products.csv")
    write_with_header(reviews_df, "reviews.csv")
    write_with_header(campaigns_df, "campaigns.csv")

    print("\nSynthetic dataset generation complete.")
    print(f"Date range: {START_DATE.isoformat()} to {END_DATE.isoformat()}")


if __name__ == "__main__":
    main()
