/**
 * Full library ingestion — ingest a massive catalog of games to make
 * Verdict.games a production-quality site.
 *
 * Run: node scripts/ingest-full-library.mjs
 * Requires dev server running on localhost:3000
 */

const games = [
  // ── Already ingested (will skip if exists) ──
  "Elden Ring", "Hades", "Baldurs Gate 3", "Portal 2",
  "Cyberpunk 2077", "Dark Souls III", "Hollow Knight",
  "Celeste", "Stardew Valley", "Disco Elysium",
  "Control", "Sekiro Shadows Die Twice", "Half-Life Alyx",
  "The Witcher 3", "Death Stranding", "Red Dead Redemption 2",
  "It Takes Two", "Horizon Zero Dawn",
  "The Last of Us Part II", "Ghost of Tsushima",
  "God of War Ragnarok",

  // ── AAA Blockbusters ──
  "Grand Theft Auto V",
  "The Elder Scrolls V Skyrim",
  "Fallout 4",
  "Doom Eternal",
  "Resident Evil Village",
  "Resident Evil 4 2023",
  "Monster Hunter World",
  "Monster Hunter Rise",
  "Final Fantasy VII Remake",
  "Final Fantasy XVI",
  "Hogwarts Legacy",
  "Starfield",
  "Spider-Man Remastered",
  "Spider-Man Miles Morales",
  "God of War 2018",
  "Uncharted Legacy of Thieves",
  "Horizon Forbidden West",
  "Alan Wake 2",
  "Star Wars Jedi Fallen Order",
  "Star Wars Jedi Survivor",
  "Assassins Creed Valhalla",
  "Assassins Creed Mirage",
  "Far Cry 6",
  "Diablo IV",
  "Overwatch 2",
  "Destiny 2",
  "Call of Duty Modern Warfare II 2022",
  "Battlefield 2042",
  "Titanfall 2",
  "Hitman 3",
  "Dying Light 2",
  "Metro Exodus",
  "A Plague Tale Requiem",
  "Atomic Heart",
  "Lies of P",
  "Lords of the Fallen 2023",
  "Armored Core VI Fires of Rubicon",
  "Forza Horizon 5",
  "Returnal",
  "Ratchet and Clank Rift Apart",
  "Dragons Dogma 2",
  "Like a Dragon Infinite Wealth",
  "Yakuza 0",

  // ── Indie Darlings ──
  "Hades II",
  "Undertale",
  "Cuphead",
  "Dead Cells",
  "Terraria",
  "Outer Wilds",
  "Inscryption",
  "Slay the Spire",
  "Into the Breach",
  "Vampire Survivors",
  "Cult of the Lamb",
  "Tunic",
  "Ori and the Will of the Wisps",
  "Ori and the Blind Forest",
  "Shovel Knight",
  "Katana ZERO",
  "Gris",
  "Journey",
  "Braid",
  "Limbo",
  "Inside",
  "Fez",
  "Hyper Light Drifter",
  "Nuclear Throne",
  "Enter the Gungeon",
  "Risk of Rain 2",
  "Noita",
  "Spelunky 2",
  "The Binding of Isaac Rebirth",
  "Neon White",
  "Sifu",
  "Dave the Diver",
  "Pizza Tower",
  "Cocoon",
  "Viewfinder",
  "Chants of Sennaar",
  "Bomb Rush Cyberfunk",
  "Sea of Stars",
  "Blasphemous 2",
  "Hi-Fi Rush",

  // ── RPGs ──
  "Divinity Original Sin 2",
  "Pillars of Eternity",
  "Pathfinder Wrath of the Righteous",
  "Persona 5 Royal",
  "Persona 3 Reload",
  "NieR Automata",
  "NieR Replicant",
  "Dragon Age The Veilguard",
  "Mass Effect Legendary Edition",
  "Diablo II Resurrected",
  "Path of Exile",
  "Genshin Impact",
  "Xenoblade Chronicles 3",
  "Fire Emblem Three Houses",
  "Octopath Traveler",
  "Octopath Traveler II",
  "Tales of Arise",
  "Dragon Quest XI",
  "Chrono Cross",
  "Valheim",
  "V Rising",

  // ── Survival / Crafting / Open World ──
  "Minecraft",
  "Subnautica",
  "Subnautica Below Zero",
  "No Mans Sky",
  "Satisfactory",
  "Factorio",
  "Rust",
  "ARK Survival Evolved",
  "The Forest",
  "Sons of the Forest",
  "Grounded",
  "Palworld",
  "Enshrouded",
  "Raft",
  "Deep Rock Galactic",
  "Don't Starve Together",
  "7 Days to Die",
  "Project Zomboid",
  "The Long Dark",
  "Green Hell",

  // ── Strategy / Sim / Management ──
  "Civilization VI",
  "Crusader Kings III",
  "Total War Warhammer III",
  "XCOM 2",
  "Age of Empires IV",
  "Stellaris",
  "Europa Universalis IV",
  "Hearts of Iron IV",
  "Cities Skylines",
  "Cities Skylines II",
  "Planet Coaster",
  "Planet Zoo",
  "Two Point Hospital",
  "Two Point Campus",
  "Rimworld",
  "Dwarf Fortress",
  "Frostpunk",
  "Anno 1800",
  "Tropico 6",
  "Manor Lords",

  // ── Multiplayer / Competitive / Live Service ──
  "Counter-Strike 2",
  "Valorant",
  "Apex Legends",
  "Fortnite",
  "League of Legends",
  "Dota 2",
  "Rocket League",
  "Fall Guys",
  "Among Us",
  "PUBG Battlegrounds",
  "Rainbow Six Siege",
  "Dead by Daylight",
  "Lethal Company",
  "Phasmophobia",
  "Sea of Thieves",
  "Left 4 Dead 2",
  "Back 4 Blood",
  "Payday 3",
  "Warframe",
  "Team Fortress 2",
  "Hell Let Loose",
  "Ready or Not",
  "Squad",
  "Escape from Tarkov",
  "Hunt Showdown",

  // ── Horror / Atmospheric ──
  "Resident Evil 2 Remake",
  "Silent Hill 2 2024",
  "Amnesia The Dark Descent",
  "Soma",
  "Outlast",
  "Layers of Fear",
  "Little Nightmares",
  "Little Nightmares II",
  "Signalis",
  "Dredge",

  // ── Racing / Sports ──
  "Forza Motorsport 2023",
  "Gran Turismo 7",
  "Need for Speed Unbound",
  "EA Sports FC 24",
  "NBA 2K24",
  "F1 23",

  // ── Platformers / Action ──
  "Super Meat Boy",
  "Mega Man 11",
  "Metroid Dread",
  "Sonic Frontiers",
  "Crash Bandicoot 4",
  "Psychonauts 2",
  "Ghostrunner",
  "Ghostrunner 2",
  "Ultrakill",
  "Devil May Cry 5",

  // ── Puzzle / Narrative / Cozy ──
  "The Witness",
  "The Talos Principle",
  "The Talos Principle 2",
  "Baba Is You",
  "Return of the Obra Dinn",
  "Firewatch",
  "What Remains of Edith Finch",
  "Unpacking",
  "A Short Hike",
  "Spiritfarer",
  "Eastward",
  "Oxenfree",
  "Night in the Woods",
  "Pentiment",
  "Norco",
  "Kentucky Route Zero",
  "The Stanley Parable Ultra Deluxe",
  "Superliminal",
  "Gorogoa",
  "Townscaper",

  // ── VR ──
  "Beat Saber",
  "Boneworks",
  "Pavlov VR",
  "Blade and Sorcery",

  // ── Soulslike / Challenging ──
  "Dark Souls Remastered",
  "Dark Souls II Scholar of the First Sin",
  "Bloodborne",
  "Nioh 2",
  "Mortal Shell",
  "Remnant 2",
  "Remnant From the Ashes",
  "Wo Long Fallen Dynasty",
  "Code Vein",
  "Salt and Sanctuary",

  // ── Simulation / Unique ──
  "Microsoft Flight Simulator",
  "Euro Truck Simulator 2",
  "American Truck Simulator",
  "Farming Simulator 22",
  "PowerWash Simulator",
  "House Flipper",

  // ── Fighting ──
  "Street Fighter 6",
  "Mortal Kombat 1 2023",
  "Tekken 8",
  "Guilty Gear Strive",
  "Dragon Ball FighterZ",

  // ── Card / Roguelike ──
  "Balatro",
  "Across the Obelisk",
  "Monster Train",
  "Roguebook",
  "Griftlands",

  // ── Recent 2024-2025 Hits ──
  "Black Myth Wukong",
  "Metaphor ReFantazio",
  "Astro Bot",
  "Indiana Jones and the Great Circle",
  "Stalker 2 Heart of Chornobyl",
  "Wuthering Waves",
  "Zenless Zone Zero",
  "The First Descendant",
  "Helldivers 2",
  "Animal Well",
  "1000xRESIST",
  "Neva",
  "Pacific Drive",
  "Palworld",
  "Prince of Persia The Lost Crown",
  "Banishers Ghosts of New Eden",
  "Skull and Bones",
  "Stellar Blade",
  "Senuas Saga Hellblade II",
  "Still Wakes the Deep",
  "Frostpunk 2",
  "Warhammer 40000 Space Marine 2",
  "Dragon Age The Veilguard",
  "Kingdom Come Deliverance II",
  "Avowed",
  "Civilization VII",
  "Like a Dragon Pirate Yakuza in Hawaii",
  "Satisfactory",
  "Elden Ring Shadow of the Erdtree",
  "Final Fantasy VII Rebirth",
];

// Deduplicate
const unique = [...new Set(games)];
console.log(`\n🎮 Full Library Ingestion — ${unique.length} games\n`);
console.log("This will skip games that already exist (unless they need updating).\n");

let success = 0;
let skipped = 0;
let failed = 0;
const errors = [];

const BATCH_SIZE = 5; // How many to run before a longer pause
const DELAY_MS = 1500; // Delay between each game (rate limit friendly)
const BATCH_PAUSE_MS = 5000; // Longer pause every BATCH_SIZE games

for (let i = 0; i < unique.length; i++) {
  const query = unique[i];
  const num = `[${i + 1}/${unique.length}]`;

  try {
    const r = await fetch("http://localhost:3000/api/ingest/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const j = await r.json();
    if (j.success) {
      const msg = j.data?.message || "";
      if (msg.includes("already exists")) {
        console.log(`⏭  ${num} ${query.padEnd(40)} (exists)`);
        skipped++;
      } else {
        console.log(`✓  ${num} ${query.padEnd(40)} ${msg.substring(0, 50)}`);
        success++;
      }
    } else {
      console.log(`✗  ${num} ${query.padEnd(40)} ${(j.message || "unknown error").substring(0, 60)}`);
      errors.push({ query, error: j.message });
      failed++;
    }
  } catch (e) {
    console.log(`✗  ${num} ${query.padEnd(40)} ${e.message}`);
    errors.push({ query, error: e.message });
    failed++;
  }

  // Rate limiting
  if ((i + 1) % BATCH_SIZE === 0) {
    console.log(`   ... pausing ${BATCH_PAUSE_MS / 1000}s after batch ...`);
    await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  } else {
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(`✅ New: ${success}  ⏭ Existed: ${skipped}  ❌ Failed: ${failed}`);
console.log(`Total in library: ${success + skipped}`);
if (errors.length > 0) {
  console.log(`\nFailed games:`);
  errors.forEach(({ query, error }) => console.log(`  - ${query}: ${error}`));
}
console.log();
