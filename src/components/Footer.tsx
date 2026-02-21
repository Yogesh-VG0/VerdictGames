import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t-4 border-border bg-muted/30 mt-20">
    {/* Pixel skyline divider */}
    <div className="h-8 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-4" style={{
        backgroundImage: `
          linear-gradient(to right, transparent 0px, hsl(225 30% 18%) 0px, hsl(225 30% 18%) 4px, transparent 4px),
          linear-gradient(to right, transparent 20px, hsl(225 30% 18%) 20px, hsl(225 30% 18%) 28px, transparent 28px),
          linear-gradient(to right, transparent 60px, hsl(225 30% 18%) 60px, hsl(225 30% 18%) 64px, transparent 64px)
        `,
        backgroundSize: '100px 100%',
        backgroundRepeat: 'repeat-x',
      }} />
    </div>

    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-pixel text-xs text-primary mb-4">verdict.games</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Honest reviews for PC and Android games. No fluff, no paid scores — just real verdicts.
          </p>
        </div>

        <div>
          <h4 className="font-pixel text-[10px] text-foreground mb-4 uppercase">Browse</h4>
          <div className="space-y-2">
            <Link to="/games" className="block text-sm text-muted-foreground hover:text-primary transition-colors">All Games</Link>
            <Link to="/pc" className="block text-sm text-muted-foreground hover:text-primary transition-colors">PC Games</Link>
            <Link to="/android" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Android Games</Link>
            <Link to="/reviews" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Reviews</Link>
          </div>
        </div>

        <div>
          <h4 className="font-pixel text-[10px] text-foreground mb-4 uppercase">Community</h4>
          <div className="space-y-2">
            <Link to="/submit" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Submit a Review</Link>
            <Link to="/about" className="block text-sm text-muted-foreground hover:text-primary transition-colors">About Us</Link>
            <Link to="/search" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Search</Link>
          </div>
        </div>

        <div>
          <h4 className="font-pixel text-[10px] text-foreground mb-4 uppercase">Legal</h4>
          <div className="space-y-2">
            <Link to="/disclaimer" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Disclaimer</Link>
            <Link to="/privacy" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-border text-center">
        <p className="font-pixel text-[8px] text-muted-foreground">
          © 2025 verdict.games — All rights reserved. Made with ❤️ for gamers.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
