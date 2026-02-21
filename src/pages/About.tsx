import Layout from "@/components/Layout";
import { Link } from "react-router-dom";

const AboutPage = () => (
  <Layout>
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-pixel text-lg text-primary mb-6 glow-gold">About verdict.games</h1>

      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>
          <strong className="text-foreground">verdict.games</strong> was created by gamers who were tired of inflated review scores,
          sponsored content disguised as opinions, and reviews that ignore platform-specific issues.
        </p>
        <p>
          We review games on both <strong className="text-foreground">PC</strong> and <strong className="text-foreground">Android</strong>,
          with dedicated performance notes for each platform. Because a 9/10 game on PC might be a 6/10 on a budget phone.
        </p>

        <div className="pixel-border-gold p-6">
          <h2 className="font-pixel text-xs text-primary mb-4">Our Scoring System</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-pixel-green font-bold">9–10 Must Play</span> — Essential gaming experiences.</p>
            <p><span className="text-pixel-cyan font-bold">7–8.9 Worth It</span> — Great games with minor flaws.</p>
            <p><span className="text-primary font-bold">5–6.9 Wait for Sale</span> — Decent, but not at full price.</p>
            <p><span className="text-destructive font-bold">0–4.9 Skip</span> — Save your time and money.</p>
          </div>
        </div>

        <h2 className="font-pixel text-sm text-foreground pt-4">What We Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="pixel-card p-4">
            <h3 className="font-pixel text-[10px] text-pixel-cyan mb-2">🖥️ PC</h3>
            <ul className="text-sm space-y-1">
              <li>• Hardware requirements</li>
              <li>• Settings optimization</li>
              <li>• Frame rate stability</li>
              <li>• Ultrawide / controller support</li>
            </ul>
          </div>
          <div className="pixel-card p-4">
            <h3 className="font-pixel text-[10px] text-pixel-green mb-2">📱 Android</h3>
            <ul className="text-sm space-y-1">
              <li>• Device tier compatibility</li>
              <li>• FPS across chipsets</li>
              <li>• Battery drain testing</li>
              <li>• Thermal throttling check</li>
            </ul>
          </div>
        </div>

        {/* FAQ for SEO */}
        <h2 className="font-pixel text-sm text-foreground pt-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: "Are your reviews sponsored?", a: "Never. We do not accept payment for reviews. All opinions are our own." },
            { q: "How do you test Android games?", a: "We test on multiple device tiers (flagship, mid-range, budget) and measure FPS, battery drain, and thermal performance." },
            { q: "Can I submit my own review?", a: "Yes! Visit our Submit Review page to share your verdict with the community." },
            { q: "How often do you publish reviews?", a: "We aim to publish 2–3 editorial reviews per week, plus cover major releases within 48 hours." },
          ].map(({ q, a }) => (
            <div key={q} className="pixel-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-1">{q}</h3>
              <p className="text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Layout>
);

export default AboutPage;
