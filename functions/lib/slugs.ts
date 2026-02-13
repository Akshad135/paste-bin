// Word lists for generating memorable slugs
const adjectives = [
    'autumn', 'hidden', 'bitter', 'misty', 'silent', 'empty', 'dry', 'dark',
    'summer', 'icy', 'quiet', 'white', 'cool', 'spring', 'winter', 'crimson',
    'broken', 'bold', 'polished', 'purple', 'frosty', 'wild', 'black', 'young',
    'holy', 'solitary', 'fragrant', 'aged', 'snowy', 'proud', 'floral', 'green',
    'golden', 'rapid', 'calm', 'damp', 'morning', 'rough', 'still', 'small',
    'sparkling', 'wandering', 'ancient', 'twilight', 'long', 'lingering', 'bold',
    'little', 'celestial', 'weathered', 'blue', 'lively', 'restless', 'cold',
    'sleepy', 'shrill', 'falling', 'patient', 'gentle', 'lucky', 'orange',
    'shy', 'muddy', 'scarlet', 'floating', 'singing', 'rustic', 'swift',
    'clever', 'bright', 'cosmic', 'velvet', 'crystal', 'amber', 'silver',
];

const nouns = [
    'waterfall', 'river', 'breeze', 'moon', 'rain', 'wind', 'sea', 'morning',
    'snow', 'lake', 'sunset', 'pine', 'shadow', 'leaf', 'dawn', 'forest',
    'hill', 'cloud', 'meadow', 'sun', 'glade', 'bird', 'brook', 'butterfly',
    'bush', 'dew', 'dust', 'field', 'fire', 'flower', 'firefly', 'feather',
    'grass', 'haze', 'mountain', 'night', 'pond', 'darkness', 'snowflake',
    'silence', 'sound', 'sky', 'shape', 'surf', 'thunder', 'violet', 'water',
    'wildflower', 'wave', 'resonance', 'dream', 'cherry', 'tree', 'fog',
    'frost', 'star', 'paper', 'stone', 'smoke', 'frog', 'glitter', 'pebble',
    'flame', 'ocean', 'canyon', 'harbor', 'reef', 'riddle', 'echo', 'orbit',
];

const verbs = [
    'drifts', 'falls', 'rises', 'sings', 'rests', 'flies', 'grows', 'shines',
    'flows', 'glows', 'hums', 'fades', 'leaps', 'swirls', 'blooms', 'sparks',
    'floats', 'whispers', 'dances', 'wanders', 'rolls', 'turns', 'bends',
    'reaches', 'stands', 'lingers', 'dreams', 'breaks', 'echoes', 'runs',
];

function pick(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSlug(): string {
    return `${pick(adjectives)}-${pick(nouns)}-${pick(verbs)}`;
}
