import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Search, Menu, X } from "lucide-react";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/reviews", label: "Reviews" },
  { to: "/pc", label: "PC" },
  { to: "/android", label: "Android" },
  { to: "/games", label: "Games" },
  { to: "/search", label: "Search" },
];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 pixel-border border-t-0 border-x-0 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="font-pixel text-xs text-primary glow-gold">
          verdict.games
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-pixel text-[10px] uppercase tracking-wider transition-colors hover:text-primary ${
                location.pathname === link.to ? "text-primary glow-gold" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/submit" className="pixel-btn-secondary text-[10px] py-2 px-4">
            Submit Review
          </Link>
          <button className="font-pixel text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase">
            Sign In
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-foreground p-1"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden pixel-border border-x-0 bg-background/95 backdrop-blur-md p-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block font-pixel text-[10px] uppercase tracking-wider py-2 ${
                location.pathname === link.to ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border flex gap-3">
            <Link to="/submit" onClick={() => setMobileOpen(false)} className="pixel-btn-secondary text-[10px] py-2 px-3">
              Submit Review
            </Link>
            <button className="font-pixel text-[10px] text-muted-foreground uppercase">Sign In</button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
