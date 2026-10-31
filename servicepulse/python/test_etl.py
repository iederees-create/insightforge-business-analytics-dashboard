"""Run: python -m unittest discover -s servicepulse/python -p 'test_*.py'"""
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from etl import aggregate, load, normalize, parse_money, run

BASE = {"date": "2026-10-01", "client": "Test Client", "service": "Clean", "source": "Referral",
        "status": "won", "quote_amount": "1200.00", "cost_amount": "400.00"}

class TestETL(unittest.TestCase):
    def test_money_validation(self):
        self.assertEqual(parse_money("1200.30"), Decimal("1200.30"))
        for value in ("-10", "abc", "NaN", "1.234"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_money(value)

    def test_row_validation(self):
        self.assertEqual(normalize(dict(BASE), 2)["status"], "won")
        for value in ("2026-02-30", "31/10/2026", "2026-13-10"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize({**BASE, "date": value}, 2)
        with self.assertRaises(ValueError):
            normalize({**BASE, "status": "paid"}, 2)

    def test_kpis(self):
        rows = [normalize(BASE, 2), normalize({**BASE, "status":"lost", "client":"Other"},3)]
        result = aggregate(rows)
        self.assertEqual(result["won_quote_value_zar"], "1200.00")
        self.assertEqual(result["estimated_gross_profit_zar"], "800.00")
        self.assertEqual(result["win_rate_pct"], 50)

    def test_file_output(self):
        with tempfile.TemporaryDirectory() as d:
            csvpath=Path(d)/"leads.csv"
            csvpath.write_text("date,client,service,source,status,quote_amount,cost_amount\n"
                               "2026-10-01,Alice,Clean,Referral,won,1200,400\n",encoding="utf-8")
            destination=run(csvpath,Path(d)/"out")
            self.assertIn('"won_count": 1',destination.read_text())
            self.assertEqual(len(load(csvpath)),1)

if __name__ == "__main__":
    unittest.main()
