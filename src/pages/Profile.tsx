import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import Layout from "@/components/Layout";
import { reviews, comments } from "@/data/mockData";

const ProfilePage = () => {
  const { username } = useParams();
  const [activeTab, setActiveTab] = useState<"reviews" | "lists" | "activity">("reviews");

  const userComments = comments.filter((c) => c.username === username);
  const avgScore = userComments.length > 0
    ? (userComments.reduce((sum, c) => sum + c.score, 0) / userComments.length).toFixed(1)
    : "—";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Profile header */}
        <div className="pixel-border-gold p-6 flex items-center gap-6 mb-8">
          <div className="w-20 h-20 pixel-border flex items-center justify-center text-3xl bg-muted">
            {userComments[0]?.avatar || "🎮"}
          </div>
          <div>
            <h1 className="font-pixel text-sm text-foreground mb-2">{username}</h1>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{userComments.length}</strong> reviews</span>
              <span>Avg: <strong className="text-primary">{avgScore}</strong></span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b-3 border-border">
          {(["reviews", "lists", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-pixel text-[10px] uppercase px-4 py-3 border-b-3 transition-colors ${
                activeTab === tab ? "text-primary border-primary" : "text-muted-foreground border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "reviews" && (
          <div className="space-y-4">
            {userComments.length === 0 && <p className="text-muted-foreground text-sm">No reviews yet.</p>}
            {userComments.map((c) => (
              <div key={c.id} className="pixel-card p-4">
                <div className="flex justify-between mb-2">
                  <Link to={`/games/${c.gameSlug}`} className="font-pixel text-[10px] text-pixel-cyan hover:underline">
                    {c.gameSlug.replace(/-/g, " ")}
                  </Link>
                  <span className="rating-badge text-[10px]">{c.score}</span>
                </div>
                <p className="text-sm text-muted-foreground">{c.text}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{c.date}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "lists" && (
          <p className="text-muted-foreground text-sm">Lists feature coming soon!</p>
        )}

        {activeTab === "activity" && (
          <p className="text-muted-foreground text-sm">Activity feed coming soon!</p>
        )}
      </div>
    </Layout>
  );
};

export default ProfilePage;
