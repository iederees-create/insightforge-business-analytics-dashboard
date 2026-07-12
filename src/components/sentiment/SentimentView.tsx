import { useMemo } from "react";
import { analyzeSentiment } from "../../lib/metrics/sentiment";
import { useDatasetStore } from "../../store/datasetStore";
import { formatInteger, formatPercent } from "../../utils/format";
import { DonutChart } from "../charts/DonutChart";
import { LineChart } from "../charts/LineChart";
import { BarChart } from "../charts/BarChart";
import { EmptyState } from "../common/EmptyState";

const SENTIMENT_BADGE: Record<string, string> = {
  positive: "text-success border-success",
  neutral: "text-text-muted border-border",
  negative: "text-danger border-danger",
};

/** Review Sentiment & Topic Explorer. Every surface repeats that this is an automated lexicon estimate, not a scientific measurement. */
export function SentimentView() {
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const sentiment = useMemo(() => analyzeSentiment(mappedRows), [mappedRows]);

  if (!sentiment.available) {
    return <EmptyState title="Sentiment analysis needs review text" description={sentiment.unavailableReason ?? "Map a Review text column to unlock this view."} />;
  }

  return (
    <section aria-labelledby="sentiment-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="sentiment-heading" className="text-xl font-semibold text-text">
          Review Sentiment & Topic Explorer
        </h2>
        <p className="mt-2 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
          This is an automated estimate from a simple keyword-scoring method, not a clinical or scientific measurement
          of how customers feel. Use it to spot patterns worth investigating, not as ground truth.
        </p>
        <p className="mt-1 text-sm text-text-muted">Based on {formatInteger(sentiment.totalReviews)} review(s) with text.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Sentiment mix</h3>
          <div className="mt-3">
            <DonutChart
              title="Share of reviews by sentiment"
              data={[
                { label: "Positive", value: sentiment.positiveShare },
                { label: "Neutral", value: sentiment.neutralShare },
                { label: "Negative", value: sentiment.negativeShare },
              ]}
              formatValue={formatPercent}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Sentiment over time</h3>
          {sentiment.overTime.length > 0 ? (
            <div className="mt-3">
              <LineChart
                title="Average estimated sentiment over time"
                series={[{ id: "sentiment", name: "Average sentiment (-1 to 1)", points: sentiment.overTime.map((p) => ({ x: p.date, y: p.averageScore })) }]}
                formatValue={(v) => v.toFixed(2)}
                formatX={(x) => (x instanceof Date ? x.toLocaleDateString() : String(x))}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Not enough dated reviews to plot a trend.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Rating vs. estimated sentiment</h3>
          {sentiment.ratingVsSentiment.length > 0 ? (
            <div className="mt-3">
              <BarChart
                title="Average estimated sentiment by star rating"
                data={sentiment.ratingVsSentiment.map((r) => ({ label: `${r.rating} star(s)`, value: r.averageSentiment }))}
                formatValue={(v) => v.toFixed(2)}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Map a Rating column to compare it against estimated sentiment.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-base font-semibold text-text">Frequent words</h3>
          <p className="mt-1 text-xs text-text-muted">Common words across reviews (stop words and very short words excluded).</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sentiment.topWords.map((w) => (
              <li key={w.word} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text">
                {w.word} <span className="text-text-muted">({w.count})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-base font-semibold text-text">Example reviews</h3>
        <p className="mt-1 text-xs text-text-muted">Shown without customer names or IDs.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {sentiment.examples.map((example, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className={`rounded-md border-l-4 bg-bg px-3 py-2 text-sm text-text ${SENTIMENT_BADGE[example.sentiment]}`}>
              <span className="mr-2 font-medium capitalize">{example.sentiment}:</span>
              {example.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
