/**
 * The Daily: one prompt for the whole world, changing once a day.
 *
 * Different from a round in two ways that shape everything below. There is no
 * writer, so these are complete prompts rather than templates with a blank —
 * and there is no clock, so they can ask for more than 75 seconds of drawing
 * would allow. Nobody is judged and nothing is scored: you draw, you submit,
 * and then you get to see what everyone else made of the same idea.
 *
 * The day rolls over at midnight UTC everywhere at once. Using each device's
 * local midnight would mean two friends in different time zones see different
 * prompts, which defeats the point of a single global gallery.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** One entry a day, so this needs to be long. Repeats after ~400 days, by
 *  which time the first ones are new again to almost everyone.
 *
 *  Written to be drawn, not answered: each names a scene, an object or a
 *  small situation with a visual in it, and leaves the interpretation open.
 *  "Your morning, as a weather forecast" beats "draw something about
 *  mornings" — a twist gives people somewhere to start. Kept everyday and
 *  warm; the daily is the one part of the game with no competition in it, so
 *  it can afford to be gentle. */
export const DAILY_PROMPTS: readonly string[] = [
  // --- around the house -----------------------------------------------
  "The inside of your fridge right now, honestly.",
  "Your most-used mug, and what it has been through.",
  "The chair where all the clothes end up.",
  "A houseplant that has seen things.",
  "The remote control, but it is a spaceship.",
  "What lives under the sofa.",
  "Your front door as a face.",
  "The kettle, mid-argument with the toaster.",
  "The sock that got away.",
  "Your bed, from the point of view of the pillow.",
  "A radiator that thinks it is a piano.",
  "The drawer everyone has, and everything in it.",
  "A lamp that is a little too proud of itself.",
  "The view from your window, but the weather is having a mood.",
  "A bathroom mirror that gives compliments.",
  "The washing machine, as a submarine.",
  "Your shoes lined up by the door, gossiping.",
  "A doorbell that plays a tune, and the tune it plays.",
  "The last thing you cooked, as a portrait.",
  "A very organised spice rack, with one rebel.",
  "The house key, and the adventure it had while it was lost.",
  "A ceiling fan with somewhere to be.",
  "Laundry day, as an epic battle.",
  "The perfect reading corner, invented.",
  "A bathtub that is secretly a boat.",
  "Your kitchen table on a busy morning.",
  "The bin, on the night before collection.",
  "A cupboard that is bigger on the inside.",
  "Your phone charger, tangled with everything it has ever met.",
  "The moment the toast pops up.",

  // --- animals ----------------------------------------------------------
  "A cat who has just knocked something off a shelf, and does not care.",
  "A dog that has finally caught the ball, and is unsure what to do next.",
  "A pigeon in a small business suit.",
  "A snail on its way somewhere important.",
  "A very fluffy sheep in a very strong wind.",
  "An owl trying to stay awake in the daytime.",
  "A fish that has learned to ride a bicycle.",
  "A bear who has just discovered coffee.",
  "A hedgehog wearing a tiny raincoat.",
  "A giraffe at a low doorway.",
  "A penguin on holiday somewhere warm.",
  "A crab, playing the drums.",
  "A goat that has eaten something it should not have.",
  "A duck leading a parade.",
  "A hamster in a hamster-sized car.",
  "A frog on a lily pad, waiting for a bus.",
  "Two squirrels arguing over one nut.",
  "A dinosaur trying to use a phone.",
  "A cow who is a famous singer.",
  "A dragon that is scared of a moth.",
  "A whale with a very small hat.",
  "An octopus doing eight things at once.",
  "A turtle who is late, as fast as it can.",
  "A rabbit who runs a bakery.",
  "A flamingo standing on the wrong leg.",
  "A sloth at a running race.",
  "A parrot repeating something it should not.",
  "A mouse building a house out of cheese.",
  "A horse with a magnificent haircut.",
  "A crocodile at the dentist.",

  // --- food -------------------------------------------------------------
  "A sandwich that is far too tall.",
  "The perfect pizza, according to you.",
  "A cake with a secret inside.",
  "Breakfast in bed, going wrong.",
  "A single chip, heroically.",
  "An ice cream on the hottest day of the year.",
  "Soup, as a swimming pool.",
  "A banana who is a superhero.",
  "The last biscuit in the tin, and who is watching it.",
  "A cup of tea at exactly the right moment.",
  "Noodles, as a roller coaster.",
  "A picnic that has attracted attention.",
  "A very fancy restaurant, for ants.",
  "A pancake mid-flip.",
  "A burger that is a building.",
  "Fruit having a party in the bowl.",
  "Popcorn at the exact moment it pops.",
  "A birthday cake with too many candles.",
  "Spaghetti, as a hairstyle.",
  "An egg at breakfast, not ready to be eaten.",
  "A watermelon, as a planet.",
  "A lunchbox with a surprise in it.",
  "A very small chef cooking a very big meal.",
  "A doughnut rolling downhill.",
  "Your favourite snack, as a monument.",
  "A chocolate bar melting on purpose.",
  "A sushi train, on an actual train.",
  "Toast, as a work of art.",
  "A teapot pouring for a very long table.",
  "The vegetables nobody picks, forming a band.",

  // --- travel and places -----------------------------------------------
  "A lighthouse that has lost its light.",
  "A tiny island with exactly one tree.",
  "A bus stop at the end of the world.",
  "A treehouse with too many rooms.",
  "The best seat on a train.",
  "A city where all the buildings are hats.",
  "A hot air balloon shaped like something it should not be.",
  "A road that goes straight up.",
  "A tent in a storm, from the inside.",
  "A castle built by someone in a hurry.",
  "A beach in winter.",
  "A bridge between two mountains, and who is crossing it.",
  "The view from the top of a very tall slide.",
  "A cabin in the woods, with the lights on.",
  "An airport for birds.",
  "A submarine with a garden.",
  "A market stall selling something unusual.",
  "A campfire, and the faces around it.",
  "A town square with a strange statue.",
  "A train station at midnight.",
  "A desert with one shop.",
  "A rooftop with a view of everything.",
  "A cave with a comfortable sofa in it.",
  "The world's smallest library.",
  "A ship in a bottle, and the crew inside it.",
  "A waterfall going the wrong way.",
  "A cliff with a house right on the edge.",
  "A forest where the trees are lamps.",
  "A harbour at sunrise.",
  "A village on the back of a giant animal.",

  // --- space and sky ----------------------------------------------------
  "A rocket built out of kitchen things.",
  "The moon, having a bad day.",
  "An astronaut who packed the wrong bag.",
  "A planet made entirely of one thing.",
  "A star that wants to be a different shape.",
  "Aliens on their first visit to a supermarket.",
  "A satellite that has fallen in love.",
  "The sun, putting on sunscreen.",
  "A cloud that looks exactly like something specific.",
  "A comet, leaving a strange trail.",
  "A space station run by cats.",
  "A telescope pointed at something surprising.",
  "The night sky, but the constellations are kitchen tools.",
  "A rainbow with an extra colour.",
  "A weather forecast for the whole solar system.",
  "A meteor shower, as seen by a very nervous rabbit.",
  "The first tree on Mars.",
  "A kite that made it all the way up.",
  "A very polite black hole.",
  "A UFO that is just here to park.",

  // --- machines and inventions -----------------------------------------
  "A machine that makes the bed.",
  "A robot learning to dance.",
  "A bicycle for three people who all want to go different ways.",
  "An umbrella for a whole crowd.",
  "A clock that shows the wrong things.",
  "A vending machine with a mystery button.",
  "A car built for a very long road trip.",
  "A device that catches falling toast.",
  "A robot vacuum with big ambitions.",
  "A machine that turns rain into something useful.",
  "A hat with everything you could need built in.",
  "The engine of a very small plane, seen up close.",
  "A lift that goes sideways.",
  "A typewriter that types on its own.",
  "A washing line that stretches across a city.",
  "A remote control for the weather.",
  "The world's most complicated toothbrush.",
  "A wheelbarrow that flies.",
  "A machine that hugs you.",
  "A camera that photographs dreams.",
  "A phone from a hundred years in the future.",
  "A boat powered by ducks.",
  "The control room of a very ordinary object.",
  "A jetpack for a tortoise.",
  "A lawnmower that is having a nice time.",

  // --- people and moments ----------------------------------------------
  "Someone carrying far too many bags from the car.",
  "The face you make when the wifi drops.",
  "A hairdresser working on a lion.",
  "Two people sharing one umbrella, badly.",
  "A very tall person and a very short person hugging.",
  "A musician playing an instrument that does not exist.",
  "Someone who has just remembered something important.",
  "A crowd waiting for a shop to open.",
  "A teacher explaining something with great enthusiasm.",
  "The moment before a surprise party.",
  "A gardener whose plants have grown too well.",
  "A juggler with too many things in the air.",
  "Somebody reading a very long receipt.",
  "A superhero on their day off.",
  "A pirate with a modern problem.",
  "A wizard who is bad at magic.",
  "A knight afraid of the dark.",
  "A ghost that is just trying to be helpful.",
  "A detective who has found a clue.",
  "Someone asleep somewhere they should not be.",
  "A chef presenting something questionable.",
  "A king with a very small kingdom.",
  "A postman with a strange parcel.",
  "A dancer in the rain.",
  "A person and their pet, dressed the same.",
  "A scientist whose experiment has just worked.",
  "A cowboy on a very tiny horse.",
  "Someone trying to put up a tent in the wind.",
  "A librarian shushing a dragon.",
  "The exact moment of winning a board game.",

  // --- weather and seasons ---------------------------------------------
  "A snowman who is too warm.",
  "The first day of spring, as a party.",
  "A thunderstorm, from a snug place.",
  "A heatwave, and everyone dealing with it differently.",
  "Autumn leaves with somewhere to be.",
  "A puddle that is deeper than it looks.",
  "Fog, and whatever is hiding in it.",
  "The wind, as a person.",
  "A rainbow that ends somewhere unexpected.",
  "A sunny day, from the shade.",
  "Frost on a window, drawing pictures of its own.",
  "A beach umbrella in a gale.",
  "The last snow of the year.",
  "A garden after the rain.",
  "Hail, from the point of view of a car.",
  "A perfect evening for sitting outside.",
  "Wellington boots in a very large puddle.",
  "A sunset over the sea.",
  "A frozen pond with skaters on it.",
  "The sun and the moon in the sky at the same time.",

  // --- twists on the ordinary ------------------------------------------
  "Your morning, as a weather forecast.",
  "Your week, as a landscape.",
  "Your favourite song, as a place.",
  "Your handwriting, as a creature.",
  "The alphabet, but every letter is an animal.",
  "The number seven, as a character.",
  "A map of somewhere that does not exist.",
  "A family portrait, of a family of vegetables.",
  "A wanted poster for a naughty pet.",
  "A menu for a restaurant on the moon.",
  "A postcard from somewhere very boring.",
  "The flag of a made-up country.",
  "A trophy for something nobody has won before.",
  "A stamp celebrating a small achievement.",
  "A crest for your household.",
  "A shop sign for a shop that sells one thing.",
  "A board game about your daily routine.",
  "A superhero costume for your grandmother.",
  "The cover of a book about today.",
  "A movie poster for a film about a sandwich.",
  "A coin with your face on it.",
  "A theme park ride based on doing the dishes.",
  "A garden gnome with a secret life.",
  "The mascot for a very early morning.",
  "A treasure map to your own kitchen.",
  "A monster made of things from a junk drawer.",
  "A vehicle made out of fruit.",
  "The world's tallest sandwich, being served.",
  "A sport played only in the rain.",
  "An instrument played with your feet.",

  // --- childhood and play ----------------------------------------------
  "A blanket fort with a drawbridge.",
  "The best playground ever built.",
  "A paper aeroplane that went further than expected.",
  "A toy that has come to life at night.",
  "A sandcastle with a moat, and what lives in the moat.",
  "Hide and seek, from the hider's point of view.",
  "A very serious game of marbles.",
  "A kite shaped like your favourite animal.",
  "A tricycle with rocket boosters.",
  "A teddy bear on an expedition.",
  "A game of tag between a cat and a butterfly.",
  "A yo-yo that will not come back.",
  "Chalk drawings on the pavement, coming alive.",
  "A bubble that refuses to pop.",
  "A skateboard for a dog.",
  "A ball that has bounced somewhere it should not.",
  "The swing that goes the highest.",
  "A rubber duck fleet.",
  "A spinning top that will not stop.",
  "A snow fort under attack.",

  // --- work and school -------------------------------------------------
  "A classroom for monsters.",
  "A desk on the first day back.",
  "The office coffee machine, as the boss.",
  "A very long meeting, from above.",
  "A pencil case with an ecosystem inside.",
  "A whiteboard covered in an important plan.",
  "The perfect homework machine.",
  "A stapler with a grudge.",
  "A very tidy desk and a very messy one, side by side.",
  "A school bus that is also a boat.",
  "A lunch break in an unusual place.",
  "The world's biggest to-do list.",
  "A filing cabinet full of secrets.",
  "A pot plant that runs the office.",
  "A laptop taking a nap.",

  // --- music and art ---------------------------------------------------
  "A band made up of household appliances.",
  "A guitar with too many strings.",
  "A drum kit for a very small drummer.",
  "A concert for an audience of one.",
  "Sheet music that shows what the music looks like.",
  "A paintbrush that paints on its own.",
  "A statue that has had enough of standing still.",
  "A gallery where the paintings look back.",
  "A piano with wheels, on a hill.",
  "A choir of frogs.",
  "The saddest trombone.",
  "A DJ at a party for grandparents.",
  "A violin made of ice.",
  "A dance move nobody has done before.",
  "Your favourite colour, as a place you could visit.",

  // --- night ------------------------------------------------------------
  "The kitchen at 3am.",
  "A dream about flying, mid-flight.",
  "A nightlight that keeps the whole street safe.",
  "What the toys do after bedtime.",
  "A street at night, with one window lit.",
  "An owl's night shift.",
  "A campfire story, and the story itself.",
  "A cat's route across the rooftops.",
  "The moon reflected in something surprising.",
  "A lighthouse keeper's dinner.",
  "Fireflies spelling a word.",
  "A very early alarm clock, and its victim.",
  "The bakery at dawn.",
  "A city that only wakes up at night.",
  "Someone counting sheep, and the sheep.",

  // --- sport ------------------------------------------------------------
  "A football match between animals.",
  "A marathon for snails.",
  "A goalkeeper who is too small for the goal.",
  "A swimming race in a bathtub.",
  "A tennis match with a very odd ball.",
  "A gymnast on a washing line.",
  "The world's longest golf hole.",
  "A cycling race up a spiral staircase.",
  "A boxing match between a pillow and a duvet.",
  "A very slow race car.",
  "A high jump over something unusual.",
  "A team huddle of penguins.",
  "A skateboarder on the moon.",
  "A surfer on a very small wave.",
  "A referee who has lost control.",

  // --- feelings, gently -------------------------------------------------
  "The feeling of a warm drink on a cold day.",
  "Nervous, as a small creature.",
  "The colour of a good laugh.",
  "Calm, as a place.",
  "Excitement, as a machine.",
  "The moment you find something you thought was lost.",
  "A hug, from far away.",
  "The shape of a yawn.",
  "Curiosity, as an animal.",
  "Relief, as weather.",
  "A good idea arriving.",
  "The feeling of Friday afternoon.",
  "Homesick, as a landscape.",
  "Brave, in a very small way.",
  "The last five minutes before a holiday.",

  // --- odd requests ------------------------------------------------------
  "Draw the sound of a sneeze.",
  "Draw the smell of rain.",
  "Draw a hiccup.",
  "Draw what silence looks like.",
  "Draw a secret handshake.",
  "Draw the taste of lemon.",
  "Draw a whisper.",
  "Draw the moment a light switches on.",
  "Draw something very fast, very slowly.",
  "Draw a shadow that does not match its owner.",
  "Draw a doorway to somewhere else.",
  "Draw the inside of a pocket.",
  "Draw the world from a worm's point of view.",
  "Draw something huge, tiny.",
  "Draw something tiny, huge.",
  "Draw a reflection that is doing its own thing.",
  "Draw the wind blowing through a market.",
  "Draw a footprint, and who made it.",
  "Draw a knot that cannot be undone.",
  "Draw yesterday.",

  // --- celebrations -----------------------------------------------------
  "A birthday party for a plant.",
  "Fireworks that make shapes.",
  "A parade with a very unlikely leader.",
  "A wedding cake as tall as a house.",
  "The best present, being unwrapped.",
  "A picnic on a rooftop.",
  "Balloons escaping into the sky.",
  "A festival of lanterns.",
  "A very fancy party, for dogs.",
  "The world's biggest candle, being lit.",
  "A trophy ceremony for a small achievement.",
  "Confetti, mid-air.",
  "A surprise nobody expected, being sprung.",
  "A dance floor at the end of the night.",
  "A party hat on something that does not need one.",

  // --- transport ----------------------------------------------------------
  "A tram going through a forest.",
  "A bicycle built for a giraffe.",
  "A ferry with a swimming pool.",
  "A taxi that only goes uphill.",
  "A helicopter made of paper.",
  "A train that runs on the ceiling.",
  "A scooter for a very long journey.",
  "A canoe on a very busy river.",
  "A tractor in a city.",
  "A bus that has become a house.",
  "A rowing boat racing a duck.",
  "A motorbike with a sidecar for a cat.",
  "A sleigh in summer.",
  "A cable car over something surprising.",
  "The traffic jam to end all traffic jams.",

  // --- small kindnesses ---------------------------------------------------
  "Someone leaving a note for a stranger.",
  "A shared umbrella.",
  "A cake baked for a neighbour.",
  "A lost glove waiting to be found.",
  "A bench with a good view, and who is on it.",
  "Someone watering a plant that is not theirs.",
  "A hand-drawn map for a visitor.",
  "A lift up a big hill.",
  "The last seat on the bus, being offered.",
  "A birthday remembered.",
  "A door held open for a very long queue.",
  "Flowers left on a doorstep.",
  "A thank-you card for a pet.",
  "A jar of something homemade, with a label.",
  "Someone teaching someone else to ride a bike.",
];

/** Mixes the list so consecutive days do not come from the same section.
 *  Fixed seed, so every server on earth agrees on the order. */
function scheduled(): readonly string[] {
  const out = [...DAILY_PROMPTS];
  let state = 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SCHEDULE = scheduled();

export type Daily = {
  /** Whole days since the epoch, UTC. The key everything else hangs off. */
  day: number;
  prompt: string;
  /** When this prompt is replaced by the next one. */
  endsAtMs: number;
};

export function dayOf(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS);
}

export function promptForDay(day: number): string {
  return SCHEDULE[((day % SCHEDULE.length) + SCHEDULE.length) % SCHEDULE.length];
}

export function dailyFor(nowMs = Date.now()): Daily {
  const day = dayOf(nowMs);
  return { day, prompt: promptForDay(day), endsAtMs: (day + 1) * DAY_MS };
}
