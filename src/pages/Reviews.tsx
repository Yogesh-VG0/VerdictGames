import Layout from "@/components/Layout";
import ReviewCard from "@/components/ReviewCard";
import { reviews } from "@/data/mockData";
import { useState, useMemo } from "react";

const ReviewsPage = () => {
  const [platform, setPlatform] = useState<"" | "PC" | "Android">("");
  const [sort, setSort] = useState<"date" | "score">("date");

  const filtered = useMemo(() => {
    let list = [...reviews];
    if (platform) list = list.filter((r) => r.platform === platform);
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [platform, sort]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-pixel text-lg text-primary mb-2 glow-gold">Editorial Reviews</h1>
        <p className="text-muted-foreground text-sm mb-8">In-depth verdicts from our team of reviewers.</p>

        <div className="flex flex-wrap gap-3 mb-6">
          {(["", "PC", "Android"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`font-pixel text-[10px] uppercase px-4 py-2 transition-colors ${
                platform === p ? "pixel-btn" : "pixel-btn-secondary"
              }`}
            >
              {p || "All"}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setSort("date")}
              className={`text-xs px-3 py-1 ${sort === "date" ? "text-primary" : "text-muted-foreground"}`}
            >
              Newest
            </button>
            <button
              onClick={() => setSort("score")}
              className={`text-xs px-3 py-1 ${sort === "score" ? "text-primary" : "text-muted-foreground"}`}
            >
              Highest Score
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ReviewsPage;
