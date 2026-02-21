// ---------------------------------------------------------------------------
// Mock data used by the frontend while the real API is being wired up.
// ---------------------------------------------------------------------------

export interface Game {
    slug: string;
    title: string;
    cover: string;
    score: number;
    verdict: "Must Play" | "Worth It" | "Wait for Sale" | "Skip";
    platforms: ("PC" | "Android")[];
    genres: string[];
    tags: string[];
    releaseDate: string;
    developer: string;
    publisher: string;
    price: string;
    summary: string;
    pros: string[];
    cons: string[];
    bestFor: string[];
    pcSpecs?: {
        min: string;
        recommended: string;
        settingsNote: string;
    };
    androidPerf?: {
        tier: string;
        fps: string;
        battery: string;
        heat: string;
    };
}

export interface Review {
    id: string;
    gameSlug: string;
    gameCover: string;
    gameTitle: string;
    score: number;
    platform: "PC" | "Android";
    excerpt: string;
    author: string;
    date: string;
}

export interface Comment {
    id: string;
    gameSlug: string;
    username: string;
    avatar: string;
    score: number;
    text: string;
    date: string;
}

// -- Genres ------------------------------------------------------------------
export const genres: string[] = [
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Simulation",
    "Puzzle",
    "Shooter",
    "Platformer",
    "Racing",
    "Sports",
    "Horror",
    "Indie",
];

// -- Games -------------------------------------------------------------------
export const games: Game[] = [
    {
        slug: "elden-ring",
        title: "Elden Ring",
        cover: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop",
        score: 9.5,
        verdict: "Must Play",
        platforms: ["PC"],
        genres: ["Action", "RPG"],
        tags: ["Open World", "Souls-like", "Dark Fantasy"],
        releaseDate: "Feb 25, 2022",
        developer: "FromSoftware",
        publisher: "Bandai Namco",
        price: "$59.99",
        summary: "A masterpiece of open-world design fused with the punishing combat FromSoftware is known for.",
        pros: ["Massive, handcrafted open world", "Deep build variety", "Excellent boss design"],
        cons: ["Performance issues at launch", "Some late-game balancing issues", "Steep learning curve"],
        bestFor: ["Souls fans", "Exploration lovers", "Completionists"],
        pcSpecs: {
            min: "i5-8400 / RX 580, 12 GB RAM",
            recommended: "i7-8700K / RTX 2070, 16 GB RAM",
            settingsNote: "Runs well on mid-range hardware after patches.",
        },
    },
    {
        slug: "hades",
        title: "Hades",
        cover: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop",
        score: 9.3,
        verdict: "Must Play",
        platforms: ["PC", "Android"],
        genres: ["Action", "RPG", "Indie"],
        tags: ["Roguelike", "Hack & Slash", "Greek Mythology"],
        releaseDate: "Sep 17, 2020",
        developer: "Supergiant Games",
        publisher: "Supergiant Games",
        price: "$24.99",
        summary: "The best roguelike ever made, with a compelling story that keeps you coming back.",
        pros: ["Addictive gameplay loop", "Outstanding voice acting", "Beautiful art"],
        cons: ["Can be repetitive for some", "Touch controls slightly awkward on mobile"],
        bestFor: ["Roguelike fans", "Story enthusiasts", "On-the-go gamers"],
        pcSpecs: {
            min: "Dual Core 2.4 GHz, 4 GB RAM",
            recommended: "Quad Core 2.8 GHz, 8 GB RAM",
            settingsNote: "Runs on almost anything.",
        },
        androidPerf: {
            tier: "Mid-range+",
            fps: "60 FPS stable",
            battery: "Moderate drain",
            heat: "Minimal",
        },
    },
    {
        slug: "stardew-valley",
        title: "Stardew Valley",
        cover: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=300&fit=crop",
        score: 9.1,
        verdict: "Must Play",
        platforms: ["PC", "Android"],
        genres: ["Simulation", "RPG", "Indie"],
        tags: ["Farming", "Pixel Art", "Relaxing"],
        releaseDate: "Feb 26, 2016",
        developer: "ConcernedApe",
        publisher: "ConcernedApe",
        price: "$14.99",
        summary: "A charming farming sim with incredible depth and heart.",
        pros: ["Endless content", "Relaxing gameplay", "Active mod community"],
        cons: ["Combat is basic", "Pixel graphics not for everyone"],
        bestFor: ["Casual gamers", "Farming sim fans", "Completionists"],
        androidPerf: {
            tier: "Low-end",
            fps: "60 FPS",
            battery: "Low drain",
            heat: "None",
        },
    },
    {
        slug: "genshin-impact",
        title: "Genshin Impact",
        cover: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop",
        score: 8.2,
        verdict: "Worth It",
        platforms: ["PC", "Android"],
        genres: ["Action", "RPG", "Adventure"],
        tags: ["Open World", "Gacha", "Anime"],
        releaseDate: "Sep 28, 2020",
        developer: "miHoYo",
        publisher: "miHoYo",
        price: "Free",
        summary: "A gorgeous open-world RPG with generous free content, held back by aggressive monetisation.",
        pros: ["Stunning open world", "Great combat system", "Constant updates"],
        cons: ["Gacha monetisation", "Resin system limits play", "Repetitive dailies"],
        bestFor: ["Anime fans", "F2P gamers", "Exploration lovers"],
        pcSpecs: {
            min: "i5 equivalent, GTX 1030, 8 GB RAM",
            recommended: "i7, GTX 1060, 16 GB RAM",
            settingsNote: "Well-optimised on PC.",
        },
        androidPerf: {
            tier: "High-end",
            fps: "30–60 FPS depending on device",
            battery: "Heavy drain",
            heat: "Gets warm on extended sessions",
        },
    },
    {
        slug: "hollow-knight",
        title: "Hollow Knight",
        cover: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&h=300&fit=crop",
        score: 9.4,
        verdict: "Must Play",
        platforms: ["PC"],
        genres: ["Action", "Adventure", "Indie"],
        tags: ["Metroidvania", "Difficult", "Atmospheric"],
        releaseDate: "Feb 24, 2017",
        developer: "Team Cherry",
        publisher: "Team Cherry",
        price: "$14.99",
        summary: "One of the best Metroidvanias ever crafted. A dark, beautiful world with tight combat.",
        pros: ["Atmospheric world", "Tight controls", "Amazing value"],
        cons: ["Can be directionless", "Very challenging bosses"],
        bestFor: ["Metroidvania fans", "Completionists", "Speedrunners"],
        pcSpecs: {
            min: "Intel Core 2 Duo, 4 GB RAM",
            recommended: "Intel Core i5, 8 GB RAM",
            settingsNote: "Runs on a potato.",
        },
    },
    {
        slug: "dead-cells",
        title: "Dead Cells",
        cover: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&h=300&fit=crop",
        score: 8.8,
        verdict: "Worth It",
        platforms: ["PC", "Android"],
        genres: ["Action", "Indie"],
        tags: ["Roguelike", "Metroidvania", "Pixel Art"],
        releaseDate: "Aug 7, 2018",
        developer: "Motion Twin",
        publisher: "Motion Twin",
        price: "$24.99",
        summary: "Fast-paced roguelike with satisfying combat and endless replayability.",
        pros: ["Tight combat", "Great progression", "Excellent port on mobile"],
        cons: ["RNG can be frustrating", "Some cheap deaths"],
        bestFor: ["Action fans", "Roguelike enthusiasts"],
        pcSpecs: {
            min: "i5, 2 GB RAM",
            recommended: "i5, 4 GB RAM",
            settingsNote: "Extremely well optimised.",
        },
        androidPerf: {
            tier: "Mid-range",
            fps: "60 FPS",
            battery: "Low drain",
            heat: "Minimal",
        },
    },
    {
        slug: "minecraft",
        title: "Minecraft",
        cover: "https://images.unsplash.com/photo-1563207153-f403bf289096?w=400&h=300&fit=crop",
        score: 9.0,
        verdict: "Must Play",
        platforms: ["PC", "Android"],
        genres: ["Adventure", "Simulation"],
        tags: ["Sandbox", "Survival", "Creative"],
        releaseDate: "Nov 18, 2011",
        developer: "Mojang",
        publisher: "Microsoft",
        price: "$26.95",
        summary: "The definitive sandbox game. Build, explore, survive — endlessly.",
        pros: ["Limitless creativity", "Modding community", "Cross-platform play"],
        cons: ["Graphics are divisive", "Java Edition performance"],
        bestFor: ["Creative minds", "Kids and families", "Modders"],
        androidPerf: {
            tier: "Low-end",
            fps: "30–60 FPS",
            battery: "Moderate",
            heat: "Low",
        },
    },
    {
        slug: "cyberpunk-2077",
        title: "Cyberpunk 2077",
        cover: "https://images.unsplash.com/photo-1605379399642-870262d3d051?w=400&h=300&fit=crop",
        score: 8.5,
        verdict: "Worth It",
        platforms: ["PC"],
        genres: ["Action", "RPG"],
        tags: ["Open World", "Sci-Fi", "Story-Rich"],
        releaseDate: "Dec 10, 2020",
        developer: "CD Projekt Red",
        publisher: "CD Projekt",
        price: "$59.99",
        summary: "After years of patches, Night City finally delivers on its promise.",
        pros: ["Incredible atmosphere", "Deep story", "Stunning visuals"],
        cons: ["Still some bugs", "AI can be dumb", "Demanding hardware"],
        bestFor: ["RPG fans", "Sci-fi lovers", "High-end PC owners"],
        pcSpecs: {
            min: "i5-3570K, GTX 780, 8 GB RAM",
            recommended: "i7-4790, RTX 2060, 16 GB RAM",
            settingsNote: "Needs a beefy GPU for ray tracing.",
        },
    },
    {
        slug: "among-us",
        title: "Among Us",
        cover: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=400&h=300&fit=crop",
        score: 7.5,
        verdict: "Worth It",
        platforms: ["PC", "Android"],
        genres: ["Strategy", "Indie"],
        tags: ["Social Deduction", "Multiplayer", "Party"],
        releaseDate: "Jun 15, 2018",
        developer: "Innersloth",
        publisher: "Innersloth",
        price: "Free",
        summary: "A fun social deduction game, best played with friends.",
        pros: ["Great with friends", "Simple to learn", "Free on mobile"],
        cons: ["Random lobbies can be toxic", "Content gets stale solo"],
        bestFor: ["Party gamers", "Friend groups"],
        androidPerf: {
            tier: "Low-end",
            fps: "60 FPS",
            battery: "Very low drain",
            heat: "None",
        },
    },
    {
        slug: "baldurs-gate-3",
        title: "Baldur's Gate 3",
        cover: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=400&h=300&fit=crop",
        score: 9.7,
        verdict: "Must Play",
        platforms: ["PC"],
        genres: ["RPG", "Strategy"],
        tags: ["CRPG", "Turn-Based", "D&D"],
        releaseDate: "Aug 3, 2023",
        developer: "Larian Studios",
        publisher: "Larian Studios",
        price: "$59.99",
        summary: "The new gold standard for CRPGs. An unforgettable 100+ hour journey.",
        pros: ["Incredible writing", "Unmatched player freedom", "Deep tactical combat"],
        cons: ["Act 3 feels rushed", "Performance in large battles", "Very long"],
        bestFor: ["RPG purists", "D&D fans", "Story lovers"],
        pcSpecs: {
            min: "i5-4690, RX 580, 8 GB RAM",
            recommended: "i7-8700K, RTX 2060 Super, 16 GB RAM",
            settingsNote: "SSD strongly recommended.",
        },
    },
];

// -- Reviews -----------------------------------------------------------------
export const reviews: Review[] = [
    {
        id: "r1",
        gameSlug: "elden-ring",
        gameCover: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop",
        gameTitle: "Elden Ring",
        score: 9.5,
        platform: "PC",
        excerpt: "A masterpiece of open-world design fused with punishing combat. The Lands Between is breathtaking.",
        author: "PhantomBlade",
        date: "Jan 15, 2026",
    },
    {
        id: "r2",
        gameSlug: "hades",
        gameCover: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop",
        gameTitle: "Hades",
        score: 9.3,
        platform: "Android",
        excerpt: "Plays surprisingly well on mobile. The touch controls take getting used to, but the gameplay loop is addictive.",
        author: "RetroGamer99",
        date: "Jan 12, 2026",
    },
    {
        id: "r3",
        gameSlug: "stardew-valley",
        gameCover: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=300&fit=crop",
        gameTitle: "Stardew Valley",
        score: 9.1,
        platform: "Android",
        excerpt: "Perfect for commutes. The mobile version is feature-complete and runs flawlessly.",
        author: "PixelFarmer",
        date: "Jan 10, 2026",
    },
    {
        id: "r4",
        gameSlug: "genshin-impact",
        gameCover: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop",
        gameTitle: "Genshin Impact",
        score: 8.2,
        platform: "PC",
        excerpt: "Beautiful world, great combat, but the gacha keeps it from being a true classic.",
        author: "CriticalHit",
        date: "Jan 8, 2026",
    },
    {
        id: "r5",
        gameSlug: "baldurs-gate-3",
        gameCover: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=400&h=300&fit=crop",
        gameTitle: "Baldur's Gate 3",
        score: 9.7,
        platform: "PC",
        excerpt: "Over 200 hours in and I'm still finding new things. This is the RPG of the decade.",
        author: "DungeonMaster",
        date: "Jan 5, 2026",
    },
    {
        id: "r6",
        gameSlug: "dead-cells",
        gameCover: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&h=300&fit=crop",
        gameTitle: "Dead Cells",
        score: 8.8,
        platform: "Android",
        excerpt: "Exceptional mobile port. Controller support makes it even better.",
        author: "SpeedRunner42",
        date: "Jan 3, 2026",
    },
];

// -- Community comments (per game) -------------------------------------------
export const comments: Comment[] = [
    {
        id: "c1",
        gameSlug: "elden-ring",
        username: "PhantomBlade",
        avatar: "⚔️",
        score: 9.5,
        text: "Easily the best open-world game I've ever played. Every corner has something worth discovering.",
        date: "Jan 15, 2026",
    },
    {
        id: "c2",
        gameSlug: "elden-ring",
        username: "CasualKnight",
        avatar: "🛡️",
        score: 8.0,
        text: "Amazing but brutal. Spirit Ashes made it accessible though. Took 120 hours to 100%.",
        date: "Jan 14, 2026",
    },
    {
        id: "c3",
        gameSlug: "hades",
        username: "RetroGamer99",
        avatar: "🎮",
        score: 9.3,
        text: "Even on my 50th run, the dialogue is still fresh. Supergiant really outdid themselves.",
        date: "Jan 12, 2026",
    },
    {
        id: "c4",
        gameSlug: "baldurs-gate-3",
        username: "DungeonMaster",
        avatar: "🎲",
        score: 9.7,
        text: "The amount of reactivity is insane. Every playthrough feels unique.",
        date: "Jan 5, 2026",
    },
];
