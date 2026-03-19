import { describe, it, expect } from "vitest";
import { scoreToVerdict } from "../score";

describe("scoreToVerdict", () => {
  it('returns "MUST PLAY" for scores >= 90', () => {
    expect(scoreToVerdict(90)).toBe("MUST PLAY");
    expect(scoreToVerdict(95)).toBe("MUST PLAY");
    expect(scoreToVerdict(100)).toBe("MUST PLAY");
  });

  it('returns "WORTH IT" for scores 75-89', () => {
    expect(scoreToVerdict(75)).toBe("WORTH IT");
    expect(scoreToVerdict(80)).toBe("WORTH IT");
    expect(scoreToVerdict(89)).toBe("WORTH IT");
  });

  it('returns "MIXED" for scores 50-74', () => {
    expect(scoreToVerdict(50)).toBe("MIXED");
    expect(scoreToVerdict(60)).toBe("MIXED");
    expect(scoreToVerdict(74)).toBe("MIXED");
  });

  it('returns "SKIP" for scores < 50', () => {
    expect(scoreToVerdict(0)).toBe("SKIP");
    expect(scoreToVerdict(25)).toBe("SKIP");
    expect(scoreToVerdict(49)).toBe("SKIP");
  });

  it("handles boundary values precisely", () => {
    expect(scoreToVerdict(89)).toBe("WORTH IT");
    expect(scoreToVerdict(90)).toBe("MUST PLAY");
    expect(scoreToVerdict(74)).toBe("MIXED");
    expect(scoreToVerdict(75)).toBe("WORTH IT");
    expect(scoreToVerdict(49)).toBe("SKIP");
    expect(scoreToVerdict(50)).toBe("MIXED");
  });
});
