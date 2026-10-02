/**
 * Gemini API service — isolated here so NO other component touches the API.
 *
 * QUOTA PROTECTION:
 *  - Only called explicitly when starting a NEW puzzle.
 *  - One single API call per new puzzle — never multiple.
 *  - Never called during piece movement, rotation, checking, or scoring.
 *  - Maximum 0 automatic retries on failure.
 *
 * PROMPT VARIETY:
 *  - Each category has a pool of distinct scene variants.
 *  - One variant is chosen randomly on each call — using the puzzleId as a
 *    seed so the same puzzle always maps to the same variant, while a new
 *    puzzle always produces a different scene.
 *  - The prompt is also enriched with a style/lighting randomizer so even the
 *    same variant description renders with different colors and compositions.
 */

import { GoogleGenAI } from '@google/genai';

// Use the image model
const IMAGE_MODEL = 'gemini-3.1-flash-image';

// ---------------------------------------------------------------------------
// Scene Pools — each category has 10+ distinct subject/scene ideas.
// One is picked at random per new puzzle call (seeded on puzzleId).
// ---------------------------------------------------------------------------
const CATEGORY_SCENE_POOLS = {
  Nature: [
    'A misty mountain lake at dawn, perfectly still water reflecting snow-capped peaks, meadow wildflowers in the foreground, rays of golden light breaking through fog.',
    'A dramatic tropical waterfall cascading into a luminescent turquoise pool surrounded by dense jungle ferns and exotic flowers.',
    'An enchanting autumn forest with a winding leaf-covered path, blazing red, orange and gold maple trees, shafts of sunlight through the canopy.',
    'A pristine Arctic tundra panorama with the Northern Lights shimmering green and purple above a frozen lake and lone pine trees.',
    'A vibrant desert landscape at sunset — towering sandstone arches, crimson dunes, a crescent moon rising in a warm orange sky.',
    'A lush New Zealand rainforest with massive ancient kauri trees, moss-covered stones, bioluminescent glowworms in a grotto.',
    'A dramatic Scottish Highland landscape with rolling purple heather moorland, a ruined stone castle, and storm clouds breaking with a rainbow.',
    'A Patagonian glacier calving into a deep blue fjord, jagged ice formations in brilliant cyan and white, condors circling overhead.',
    'A cherry blossom forest in full bloom along a winding river, petals drifting in the breeze, Mount Fuji in the distant background.',
    'A ethereal mangrove swamp at blue hour — twisted roots reflecting violet and rose in still water, fireflies glowing, cypress silhouettes.',
    'Rolling emerald green Irish countryside with dry-stone walls, a thatched cottage, dramatic Atlantic cliffs and crashing waves.',
    'A subalpine wildflower meadow in the Swiss Alps bursting with blue gentians, red poppies and white edelweiss, the Matterhorn behind.',
  ],
  Animals: [
    'A majestic snow leopard prowling across a rocky Himalayan ridge at golden hour, prayer flags fluttering, distant peaks behind.',
    'A playful family of meerkats in the Kalahari Desert at sunrise, standing upright on a termite mound, warm amber light.',
    'Humpback whales breaching in the Arctic Sea, ice floes, deep blue water, auroras visible in the sky above.',
    'A vivid poison dart frog on a dewy leaf in the Amazon, surrounded by tropical flowers and iridescent butterflies.',
    'A crash of rhinoceroses crossing the Serengeti savanna at dusk, golden dust, silhouetted acacia trees, vast sky.',
    'An arctic fox in its pure white winter coat investigating a snow-covered pine branch, falling snowflakes, blue twilight.',
    'A dazzling murmuration of starlings swirling in a sunset sky above a flooded rice paddy, reflections below.',
    'A majestic bald eagle in mid-dive over a crystal mountain river, wings fully spread, trout visible in the water below.',
    'Baby emperor penguins huddled together on sea ice in Antarctica, adults towering above, icebergs in the background.',
    'A cloud leopard draped across a mossy jungle branch in Borneo, misty rainforest canopy, shafts of light through leaves.',
    'A pride of lions resting beneath an acacia tree at sunset, golden savanna, Mount Kilimanjaro on the horizon.',
    'A sloth bear mother with cubs climbing a fig tree in an Indian forest, monsoon green leaves, soft dappled light.',
  ],
  Space: [
    'A gas giant planet with vivid amber and cream cloud bands, massive storm system, two moons, rings catching sunlight.',
    'An astronaut floating above Earth, visor reflecting a sunrise from orbit, the curvature of the planet, star-filled darkness.',
    'A binary star system with a brilliant blue star and a red giant in a vast nebula of swirling crimson and violet gas.',
    'A meteor shower streaking above a dark desert landscape, Milky Way arch, an observatory silhouetted on a clifftop.',
    'A futuristic space station orbiting Jupiter, solar panels glowing, the Great Red Spot below, Io visible in the background.',
    'A comet blazing through the solar system close to the sun, glowing tail arcing across a field of dense stars.',
    'A distant galaxy collision — two spirals merging in a blaze of blue star formation and golden ancient stars.',
    'A terraformed Mars colony under a salmon-pink sky, geodesic domes, pressurized gardens, red dust plains stretching to the horizon.',
    'A black hole warping spacetime, accretion disk of super-heated plasma, a distant star being stretched, dramatic lens-flare rings.',
    'The surface of an exoplanet ocean world, twin suns setting over bioluminescent turquoise waves, alien sea creatures leaping.',
    'A deep-space pulsar lighthouse beaming twin jets of energy, surrounded by glowing ionized gas clouds and distant nebulae.',
    'Saturn seen from its moon Titan, orange haze, hydrocarbon lakes reflecting the ringed planet above.',
  ],
  Fantasy: [
    'A crystal dragon hatching from a giant geode egg, iridescent wings unfurling, cave walls glowing with magic runes.',
    'An enormous ancient tree city in a bioluminescent forest, elves gliding on giant dragonflies, waterfalls of glowing mist.',
    'A forbidden library carved into a massive cliff, thousands of floating spell-books, a lone scholar using a levitation spell.',
    'A sky archipelago — dozens of floating islands connected by rope bridges, waterfalls falling into clouds, airships moored below.',
    'A tournament of wizards in a floating colosseum above the clouds, spells colliding in brilliant light, thousands of spectators.',
    'An enchanted winter palace made entirely of ice, ice golems as guards, aurora dancing above, a magical sleigh arriving.',
    'A sea serpent breaching from a stormy magical ocean beside a lighthouse built from the bones of an ancient leviathan.',
    'A sprawling underground dwarf kingdom — luminous mushroom forests, molten rivers, enormous stone-carved temples, forge fires.',
    'A spirit fox with nine tails standing on a moonlit mountain shrine, lanterns floating upward, cherry blossom petals swirling.',
    'An alchemist workshop in a tower top at midnight, bubbling potions, a homunculus stirring, a philosopher stone glowing gold.',
    'A giant mechanical colossus walking through an ancient forest, vines reclaiming its bronze legs, small creatures living inside.',
    'A witch s cottage floating on a lake at dusk, pumpkin lanterns, cauldron smoke, a familiar cat sitting on the roof.',
  ],
  Cartoon: [
    'A cheerful underwater city for fish and sea creatures, coral skyscrapers, jellyfish taxis, colorful banners, happy seahorses.',
    'A cozy candy kingdom village with gumdrop houses, chocolate rivers, lollipop trees, friendly gingerbread people waving.',
    'A futuristic cartoon robot school, robot students with different shaped heads, holographic chalkboards, a teacher robot.',
    'A vibrant jungle treehouse community — monkey architects, parrot postmen, sloth librarians, ziplines through the canopy.',
    'A magical toy workshop at the North Pole, animated toys building themselves, conveyor belts, stockings everywhere, festive chaos.',
    'An alien planet market — strange colorful creatures selling exotic goods, flying saucers parked nearby, twin suns overhead.',
    'A cloud city of sky creatures — fluffy cloud houses, lightning bolt slides, sun and moon neighbors, rainbow roads.',
    'A dinosaur school where young dinos learn different subjects, a T-Rex painting, a Triceratops doing math, a Brachiosaurus reading.',
    'A pirate island adventure — cartoon treasure map, a friendly sea monster helping the crew, colorful sails, animated waves.',
    'A superhero academy for kids, students flying, lifting boulders, shooting rainbows, a wise owl as headmaster.',
    'A cozy autumn fair in a woodland village — fox bakers, bear woodworkers, hedgehog harvest celebration, lantern light.',
    'A cartoon space academy where young aliens learn to pilot spaceships, planets as climbing frames, meteor dodging obstacle course.',
  ],
  Food: [
    'An overhead flat-lay of a Japanese omakase feast — sashimi roses, wagyu nigiri, miso soup, matcha desserts, on black lacquer.',
    'A rustic Italian countryside table — handmade pasta with truffle, wood-fired pizza, burrata, figs, Chianti wine, cypress view.',
    'A rainbow smoothie bowl station — dragonfruit, mango, spirulina, acai, topped with exotic fruit, edible flowers, gold dust.',
    'An elaborate French patisserie window — croissants, eclairs, macarons in every color, tarts, millefeuille, beautiful lettering.',
    'A Mexican fiesta spread — tacos with every topping, elotes, guacamole, mole, churros, fresh-squeezed agua fresca.',
    'A Moroccan feast on a low table — tagines, harira, couscous, bastilla, mint tea poured from height, colorful tiles below.',
    'A Korean BBQ grill scene — marbled wagyu, banchan rainbow, bubbling jjigae, sesame oil gleam, smoke rising gently.',
    'An Indian festival thali — biryani, curries in 8 colors, roti, raita, ladoo sweets, fresh mango lassi, banana leaf.',
    'A Nordic smorgasbord — gravlax, open-faced rye sandwiches, herring, lingonberries, pickled vegetables, dill flowers, birch wood.',
    'A decadent American diner scene — towering milkshakes, giant cheeseburger cross-section, waffle stacks, neon sign glow.',
    'A Peruvian ceviche and tapas table — leche de tigre, causa, tiradito, colorful aji amarillo sauces, ocean view behind.',
    'A tea ceremony spread — elegant Japanese wagashi sweets, matcha whisked in a ceramic bowl, paper lanterns, moss garden.',
  ],
  Travel: [
    'Sunrise over the ancient temples of Angkor Wat, Cambodia — mist rising from the jungle, reflections in the moat, lotus flowers.',
    'The turquoise coastal cliffs of Amalfi, Italy — terraced lemon groves, pastel villages cascading to the Mediterranean, sailboats.',
    'A bustling Grand Bazaar in Istanbul at golden hour — spice mountains in every color, lanterns, carpets, mosaic arches.',
    'The Atacama Desert salt flats at twilight — flamingos wading in pink-tinted water, volcanoes above, reflections in the flats.',
    'The historic medina of Chefchaouen, Morocco — blue-painted walls, arched doorways, terracotta pots of geraniums, cat on steps.',
    'A fjord in the Faroe Islands — dramatic black cliffs, cascading waterfalls, green turf-roof cottages, boat in glassy water.',
    'The ancient Silk Road city of Samarkand — Registan Madrassahs, golden domes, intricate tile mosaics, camels passing.',
    'A tranquil Japanese onsen village in winter — steam rising from outdoor baths, ryokan lanterns, snow on pine trees, Mount Yotei.',
    'The volcanic black sand beaches of Iceland — dramatic sea stacks, puffins in flight, aurora-lit sky, crashing surf.',
    'A narrow gondola canal in Venice at dusk — palazzo facades, bridge silhouettes, lamp reflections on rippling water.',
    'The Amazon river at sunrise — river dolphins leaping, dense jungle canopy either side, fog drifting, pirogue boat.',
    'New Zealand Milford Sound — mirror fjord, waterfalls plunging from sheer cliffs, seals on rocks, Mitre Peak above.',
  ],
  'Everyday Life': [
    'A warm Paris café terrace on a rainy morning — steaming café au lait, croissants, people under umbrellas, cobblestones.',
    'A vibrant Japanese convenience store at night — glowing shelves, onigiri rainbow, a sleepy tabby cat behind the counter.',
    'A cozy Brooklyn apartment kitchen — plants on every surface, sourdough bread baking, vinyl records, afternoon light through lace curtains.',
    'A lively Colombian town market at dawn — vendors arranging tropical fruit pyramids, bright flowers, locals bargaining, color everywhere.',
    'A peaceful Finnish forest sauna — birch branches, a bucket of water, towels on a log, a quiet lake visible through the door.',
    'A chaotic but warm family Sunday lunch in a Sicilian courtyard — long table, generations mixed, wine, laughter, lemon trees.',
    'A rainy Sunday afternoon in a Tokyo bookshop — cramped shelves to the ceiling, a reader on a step stool, a cat asleep.',
    'A sunlit Provençal lavender farm at harvest — rows of purple stretching to the horizon, a stone farmhouse, bees, blue sky.',
    'A New Orleans street musician on a wrought-iron balcony — jazz trumpet, bougainvillea, pedestrians below looking up smiling.',
    'A Portland Saturday farmers market — artisan cheese vendors, flower stalls, sourdough loaves, dogs on leashes, a folk duo playing.',
    'An Indian street chai stall at dusk — clay cups, steam rising, auto-rickshaws passing, temple bells audible, warm amber light.',
    'A Norwegian fishing village early morning — wooden docks, colorful rorbuer, fishermen mending nets, seagulls, icy stillness.',
  ],
};

// Style/lighting/composition modifiers injected to add extra variation even
// within the same scene description.
const STYLE_MODIFIERS = [
  'Ultra-realistic photograph, 8K resolution, award-winning National Geographic style.',
  'Painterly oil painting style with rich impasto texture, dramatic chiaroscuro lighting.',
  'Cinematic wide-angle shot, golden hour lighting, shallow depth of field, bokeh background.',
  'Moody atmospheric illustration, soft diffused overcast light, muted but rich color palette.',
  'Vivid aerial drone perspective, late afternoon light, long shadows, hyper-detailed.',
  'Impressionist painting style, visible brushstrokes, dappled light, saturated warm tones.',
  'Dramatic studio-quality photography, rim lighting, deep shadows, crystal-sharp foreground.',
  'Digital concept art style, atmospheric fog, volumetric light rays, cinematic composition.',
  'Travel documentary photography style, warm tones, authentic candid framing, rich detail.',
  'Fine-art landscape photography, blue hour light, long exposure smoothing, balanced exposure.',
];

/**
 * Deterministic seeded pick from an array using a numeric seed.
 * Same seed → same pick. Different seed → different pick (distributed).
 */
function seededPick(array, seed) {
  // Simple hash: fold the seed into an index
  const hash = Math.abs(Math.floor(seed)) % array.length;
  return array[hash];
}

/**
 * Convert a string puzzle ID into a numeric seed.
 */
function puzzleIdToSeed(puzzleId) {
  let h = 0;
  for (let i = 0; i < puzzleId.length; i++) {
    h = (Math.imul(31, h) + puzzleId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

let _client = null;

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    throw new Error('MISSING_API_KEY');
  }
  if (!_client) {
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

/**
 * Generate a puzzle image for the given category.
 *
 * @param {string} category - The selected category name.
 * @param {string} [puzzleId] - The unique puzzle ID used to deterministically
 *   select which scene variant to generate. A different puzzleId will always
 *   produce a different prompt, giving a unique image per puzzle.
 *
 * Returns: { data: string (base64), mimeType: string }
 * Throws on failure with a descriptive error code string.
 */
export async function generatePuzzleImage(category, puzzleId = '') {
  const scenePool = CATEGORY_SCENE_POOLS[category];
  if (!scenePool) {
    throw new Error('UNKNOWN_CATEGORY');
  }

  // Derive a numeric seed from the puzzle ID so the same puzzle always gets
  // the same scene, but every new puzzle gets a fresh one.
  const seed = puzzleIdToSeed(puzzleId || String(Date.now()));
  const sceneDescription = seededPick(scenePool, seed);

  // Pick a style modifier that's offset from the scene index so they don't
  // always correlate (e.g. scene 0 always gets style 0).
  const styleModifier = seededPick(STYLE_MODIFIERS, seed + 7);

  const prompt = `${sceneDescription} ${styleModifier} No text, no watermarks, no borders. Square or landscape composition. Highly detailed and vibrant.`;

  let client;
  try {
    client = getClient();
  } catch (e) {
    throw new Error(e.message || 'MISSING_API_KEY');
  }

  try {
    const interaction = await client.interactions.create({
      model: IMAGE_MODEL,
      input: prompt,
    });

    const img = interaction.output_image;
    if (!img || !img.data) {
      throw new Error('NO_IMAGE_RETURNED');
    }

    return {
      data: img.data,          // base64 string
      mimeType: img.mime_type || 'image/png',
      // Include debug info (not shown to player, useful for logging)
      _promptUsed: prompt,
    };
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('QUOTA_EXCEEDED');
    }
    if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
      throw new Error('INVALID_API_KEY');
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('ENOTFOUND')) {
      throw new Error('NETWORK_ERROR');
    }
    if (msg.includes('MISSING_API_KEY') || msg.includes('YOUR_KEY_HERE')) {
      throw new Error('MISSING_API_KEY');
    }
    throw new Error('GENERATION_FAILED');
  }
}

/** Human-readable messages for each error code */
export function getErrorMessage(errorCode) {
  const messages = {
    MISSING_API_KEY: 'No API key found. Please add your Gemini API key to the .env file.',
    INVALID_API_KEY: 'Invalid API key. Please check your Gemini API key in the .env file.',
    QUOTA_EXCEEDED: 'Gemini API quota exceeded. Please try again later or check your usage limits.',
    NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
    NO_IMAGE_RETURNED: 'The AI didn\'t generate an image. Please try again.',
    GENERATION_FAILED: 'Couldn\'t generate a new puzzle right now. Please try again later.',
    UNKNOWN_CATEGORY: 'Unknown category selected.',
  };
  return messages[errorCode] || messages['GENERATION_FAILED'];
}
