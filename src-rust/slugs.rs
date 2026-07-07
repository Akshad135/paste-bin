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
];

const VERBS: &[&str] = &[
    "drifts", "falls", "rises", "sings", "rests", "flies", "grows", "shines",
    "flows", "glows", "hums", "fades", "leaps", "swirls", "blooms", "sparks",
    "floats", "whispers", "dances", "wanders", "rolls", "turns", "bends",
    "reaches", "stands", "lingers", "dreams", "breaks", "echoes", "runs",
];

/// Generate a slug in the form `adjective-noun-verb`.
pub fn generate_slug() -> String {
    let mut rng = rand::rng();
    let adj = ADJECTIVES[rng.random_range(0..ADJECTIVES.len())];
    let noun = NOUNS[rng.random_range(0..NOUNS.len())];
    let verb = VERBS[rng.random_range(0..VERBS.len())];
    format!("{adj}-{noun}-{verb}")
}
