use rand::Rng;

const ADJECTIVES: &[&str] = &[
    "autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark",
    "summer", "icy", "quiet", "white", "cool", "spring", "winter", "crimson",
    "broken", "bold", "polished", "purple", "frosty", "wild", "black", "young",
    "holy", "solitary", "fragrant", "aged", "snowy", "proud", "floral", "green",
    "golden", "rapid", "calm", "damp", "morning", "rough", "still", "small",
    "sparkling", "wandering", "ancient", "twilight", "long", "lingering",
    "little", "celestial", "weathered", "blue", "lively", "restless", "cold",
    "sleepy", "shrill", "falling", "patient", "gentle", "lucky", "orange",
    "shy", "muddy", "scarlet", "floating", "singing", "rustic", "swift",
    "clever", "bright", "cosmic", "velvet", "crystal", "amber", "silver",
    // ─── extended set (added to widen the slug combination space) ───
    "hazy", "dusty", "salty", "arid", "humid", "breezy", "stormy", "sunny",
    "rainy", "foggy", "frozen", "blazing", "glowing", "shining", "drifting",
    "echoing", "distant", "secret", "secluded", "forgotten", "timeless",
    "eternal", "fleeting", "fading", "blooming", "evergreen", "mossy",
    "rocky", "sandy", "glacial", "tropical", "arctic", "coastal", "alpine",
    "wooded", "grassy", "leafy", "thorny", "radiant", "luminous", "shadowy",
    "murky", "vivid", "pale", "vibrant", "tranquil", "serene", "glassy",
    "rippling", "dewy",
];

const NOUNS: &[&str] = &[
    "waterfall", "river", "breeze", "moon", "rain", "wind", "sea", "morning",
    "snow", "lake", "sunset", "pine", "shadow", "leaf", "dawn", "forest",
    "hill", "cloud", "meadow", "sun", "glade", "bird", "brook", "butterfly",
    "bush", "dew", "dust", "field", "fire", "flower", "firefly", "feather",
    "grass", "haze", "mountain", "night", "pond", "darkness", "snowflake",
    "silence", "sound", "sky", "shape", "surf", "thunder", "violet", "water",
    "wildflower", "wave", "resonance", "dream", "cherry", "tree", "fog",
    "frost", "star", "paper", "stone", "smoke", "frog", "glitter", "pebble",
    "flame", "ocean", "canyon", "harbor", "reef", "riddle", "echo", "orbit",
    // ─── extended set (added to widen the slug combination space) ───
    "valley", "cave", "cliff", "island", "desert", "glacier", "volcano",
    "prairie", "marsh", "swamp", "delta", "plateau", "ridge", "summit",
    "peak", "boulder", "cavern", "grotto", "horizon", "current", "tide",
    "ripple", "glow", "ember", "spark", "blossom", "petal", "root", "branch",
    "vine", "thicket", "grove", "orchard", "owl", "wolf", "fox", "deer",
    "sparrow", "falcon", "raven", "heron", "swan", "otter", "whale",
    "dolphin", "coral", "dune", "oasis", "comet", "aurora",
];

const VERBS: &[&str] = &[
    "drifts", "falls", "rises", "sings", "rests", "flies", "grows", "shines",
    "flows", "glows", "hums", "fades", "leaps", "swirls", "blooms", "sparks",
    "floats", "whispers", "dances", "wanders", "rolls", "turns", "bends",
    "reaches", "stands", "lingers", "dreams", "breaks", "echoes", "runs",
    // ─── extended set (added to widen the slug combination space) ───
    "shimmers", "ripples", "murmurs", "glistens", "sways", "soars", "glides",
    "trembles", "flickers", "sparkles", "blazes", "howls", "roars", "rumbles",
    "settles", "wavers", "twinkles", "meanders", "cascades", "billows",
];

/// Generate a slug in the form `adjective-adjective-noun-verb`.
///
/// Two *distinct* adjectives are used (rather than one) to multiply the
/// number of possible slugs without resorting to random digits/characters,
/// keeping slugs human-readable and memorable while making them far less
/// practical to enumerate. With the current word lists this yields roughly
/// 122 × 121 × 120 × 50 ≈ 88.5 million possible slugs, versus ~151,000 with
/// the previous single-adjective, 3-word format.
pub fn generate_slug() -> String {
    let mut rng = rand::rng();

    let adj1 = ADJECTIVES[rng.random_range(0..ADJECTIVES.len())];
    let mut adj2 = ADJECTIVES[rng.random_range(0..ADJECTIVES.len())];
    while adj2 == adj1 {
        adj2 = ADJECTIVES[rng.random_range(0..ADJECTIVES.len())];
    }

    let noun = NOUNS[rng.random_range(0..NOUNS.len())];
    let verb = VERBS[rng.random_range(0..VERBS.len())];
    format!("{adj1}-{adj2}-{noun}-{verb}")
}
