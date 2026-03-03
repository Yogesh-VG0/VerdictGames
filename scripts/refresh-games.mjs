/**
 * Re-ingest games with forceRefresh to pick up Steam store links.
 */

const games = [
  "Elden Ring", "Hades", "Baldurs Gate 3", "Portal 2",
  "Cyberpunk 2077", "Dark Souls III", "Hollow Knight",
  "Celeste", "Stardew Valley", "Disco Elysium",
  "Control", "Sekiro Shadows Die Twice", "Half-Life Alyx",
  "The Witcher 3", "Death Stranding", "Red Dead Redemption 2",
  "It Takes Two", "Horizon Zero Dawn",
  "The Last of Us Part II", "Ghost of Tsushima",
  "God of War Ragnarok"
];

console.log(`Re-ingesting ${games.length} games with forceRefresh to get Steam data...\n`);

let success = 0;
let failed = 0;

for (const query of games) {
  try {
    const r = await fetch("http://localhost:3000/api/ingest/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, forceRefresh: true }),
    });
    const j = await r.json();
    if (j.success) {
      console.log("✓", query.padEnd(30), j.data.message.substring(0, 50));
      success++;
    } else {
      console.log("✗", query.padEnd(30), j.message?.substring(0, 50));
      failed++;
    }
  } catch (e) {
    console.log("✗", query.padEnd(30), e.message);
    failed++;
  }
  // Rate limit
  await new Promise((r) => setTimeout(r, 1200));
}

console.log(`\nDone! ${success} succeeded, ${failed} failed.`);
