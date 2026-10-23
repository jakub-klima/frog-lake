/* Žabí jezero / Frog Lake – hlášky a nápovědy (čeština + angličtina)
 *
 * Všechny texty, které hra hlásí, jsou na jednom místě, aby šly snadno ladit.
 * České hlášky jsou v přítomném čase – v češtině tak nezáleží na rodu hráče.
 * U většiny je několik variant, hra z nich náhodně vybírá, aby se neokoukaly.
 * FL.MSG je slovník podle zvoleného jazyka (FL.LANG, viz js/i18n.js);
 * oba slovníky mají stejné klíče – hlídá to tools/selftest.js.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});

  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  const say = (variants, v) => fill(pick(variants), v || {});
  const forms = type => FL.INSECT_FORMS[type];
  const medal = place => ['', '🥇', '🥈', '🥉'][place] || '🏅';
  const card = id => FL.CARD_BY_ID[id].name;

  // =====================================================================
  //  ČEŠTINA
  // =====================================================================
  const ARRIVE_CS = {
    fly: [
      'Na jezero přiletěla nová moucha!',
      'Bzzz! Na jezero přiletěla tlustá moucha!',
      'Nová moucha krouží nad jezerem!'
    ],
    firefly: [
      'Na jezero přiletěla nová světluška!',
      'Nad jezerem se rozsvítila nová světluška!',
      'Blik, blik! Na jezero přiletěla světluška!'
    ],
    dragonfly: [
      'Na jezero přiletěla nová vážka!',
      'Duhová křídla! Na jezero přiletěla vážka!',
      'Vzácná návštěva – na jezero přiletěla vážka!'
    ]
  };

  const CS = {
    // ---------- události hodu ----------
    arrive: type => pick(ARRIVE_CS[type]),
    landsOn: (type, pos) => say([
      'Usadila se na poli {pos}.',
      'Přistála na poli {pos}.',
      'Sedí na poli {pos} – kdo si pro ni skočí?'
    ], { pos }),
    landsOnFrog: (name, type) => say([
      'Dosedla přímo na žábu {name} – {acc} si nechává!',
      '{name} jen otevře tlamu a {one} je fuč. Ňam!',
      'Přímo na hlavu! {name} ji okamžitě sbírá.'
    ], Object.assign({ name }, forms(type))),
    fieldLabel: pos => `Pole ${pos}: `,
    landsOnMagic: (name, type) => say([
      'Dosedla na Kouzelný leknín – a ten ji posílá rovnou hráči {name}!',
      'Kouzelný leknín zazářil: {acc} dostává {name}, kdo hodil kostkami.'
    ], Object.assign({ name }, forms(type))),
    twelve: (name, what, type) => say([
      'Padla dvanáctka! {name} si vybírá {what}, kam přiletí {one}.',
      'Dvanáctka! {name} určuje {what} pro {acc}.'
    ], Object.assign({ name, what }, forms(type))),
    twelveWhat: { any: 'pole', row: 'řádek', col: 'sloupec' },
    twelveTitle: n => n === 2 ? 'Dvě dvanáctky! Volba libovolného pole.' : 'Padla dvanáctka!',
    vodnikTitle: () => pick([
      'Vodník Lojzík se vynořil z hlubin!',
      'Šplouch! Na hladině se objevil Vodník Lojzík!',
      'Vodník Lojzík vylézá z rákosí!'
    ]),
    vodnikSub: name => say([
      '{name}, Vodník Tě přenese na pole, které si vybereš.',
      '{name}, vyber si, kam Tě Vodník přenese. Skok Ti pak ještě zůstane.'
    ], { name }),
    vodnikDone: (name, pos) => say([
      'Vodník přenesl hráče {name} na pole {pos}.',
      'Šup! {name} se zjevuje na poli {pos}.'
    ], { name, pos }),

    // ---------- tah ----------
    welcome: price => `Vítejte u Žabího jezera! Cena veleskoku: ${price} kreditů.`,
    turn: name => say(['Na tahu je {name}.', '{name} je na řadě.', 'Kvák! Teď hraje {name}.'], { name }),
    firstPlayer: name => say(['Kostky rozhodly: začíná {name}!', 'Los padl – první skáče {name}!'], { name }),
    rollLog: (name, d10, black, white) =>
      `${name} hází: zelená D10 = ${d10}, černá D12 = ${black}, bílá D12 = ${white}.`,
    move: (name, pos) => say(['{name} skáče na pole {pos}.', 'Hop! {name} doskakuje na {pos}.'], { name, pos }),
    noJump: name => `${name} nemá kam skočit a zůstává na místě.`,
    gain: (name, credits, pos) => say([
      '{name} sbírá hmyz za {credits} kr. na poli {pos}.',
      'Mňam! {name} si na poli {pos} pochutnává za {credits} kr.'
    ], { name, credits, pos }),
    luck: name => say([
      'Žabí štěstí: jezero posílá hráči {name} mouchu na povzbuzení.',
      'Žabí štěstí! {name} dostává z banku mouchu, ať neztrácí krok.'
    ], { name }),
    shore: (r, c) => `břeh (${r},${c})`,
    setupTaken: name => `${name} obsazuje startovní pole.`,
    randomStarts: () => 'Žáby byly rozmístěny náhodně.',

    // ---------- karty ----------
    deckEmpty: () => 'Balíček kouzel je prázdný.',
    deckShuffled: () => 'Odhazovací balíček byl zamíchán a vrácen do hry.',
    noTarget: () => 'Není koho zvolit.',
    use: spell => 'Použít ' + spell,
    dontUse: () => 'Nepoužít',
    passiveCard: spell => `${spell} je pasivní kouzlo – nabídne se samo, až nastane situace, na kterou reaguje.`,

    // ---------- pole ----------
    water: name => say([
      'Žbluňk! {name} padá do vody a plave zpátky na START.',
      'Šplouch! {name} skáče vedle leknínu – zpátky na START.',
      'Voda je studená! {name} se vrací na START.'
    ], { name }),
    mud: name => say([
      'Čvacht! {name} zapadá do bažiny a příští tah vynechá.',
      'Bažina nepustí! {name} trčí v bažině – příští tah stojí.',
      '{name} se boří do bažiny. Příští tah se nehraje.'
    ], { name }),
    mudSkip: name => say([
      '{name} se pořád vyhrabává z bažiny – tento tah vynechává.',
      'Bažina drží! {name} tento tah nehází ani neskáče.'
    ], { name }),
    whirl: name => say(['{name} se dostává do Vodního víru!', 'Vír! {name} se točí dokola…'], { name }),
    whirlMove: (name, pos) => `Vír unáší hráče ${name} na pole ${pos}.`,
    whirlNoWay: () => 'Vír tě nemá kam odnést – zůstáváš na místě.',
    floatsQ: name => `${name}, nasadíš Plováky a zůstaneš nad vírem?`,
    floats: name => `${name} nasazuje Plováky a zůstává nad vírem.`,
    tramp: name => say(['Boing! {name} dopadá na Trampolínu.', '{name} skáče na Trampolínu – boing!'], { name }),
    trampMove: (name, pos) => `Trampolína odpaluje hráče ${name} na pole ${pos}.`,
    trampNoWay: () => 'Trampolína nemá kam odpálit.',
    mushroomCard: (name, spell) => say([
      'Kouzelná houba! {name} získává kouzlo {spell}.',
      '{name} skáče na houbu a získává kouzlo {spell}!',
      'Houba se rozzářila – {name} získává kouzlo {spell}.'
    ], { name, spell }),
    magicNoWin: () => 'Na Kouzelný leknín lze zvítězit jen veleskokem z velkého leknínu.',
    startPick: name => `${name} usedá na startovní pole.`,
    toStart: (name, reason) => `${name} se vrací na START (${reason}).`,
    reasonWater: 'voda',

    // ---------- skok na hlavu ----------
    headJump: (att, vic) => say([
      'Hop na hlavu! {att} skáče na hráče {vic}!',
      'Bum! {att} přistává hráči {vic} přímo na hlavě!'
    ], { att, vic }),
    dodgeQ: (vic, att) => `${vic}, ${att} Ti skáče na hlavu! Použiješ Kvákrobatiku a uskočíš?`,
    noDodge: vic => `${vic} nemá kam uskočit.`,
    helmetQ: vic => `${vic}, použiješ Helmu a neztratíš kredit?`,
    headSteal: (att, vic) => `${att} bere hráči ${vic} 1 kredit.`,
    headEmpty: vic => `${vic} nemá žádný kredit, o který by přišel.`,
    slide: (name, pos) => `${name} sklouzává na pole ${pos}.`,
    noSlide: name => `${name} nemá kam sklouznout.`,
    landStays: (name, pos) => `Pole ${pos} je volné – ${name} na něm zůstává.`,
    dodge: (name, pos) => `${name} provádí Kvákrobatiku a uskakuje na pole ${pos}!`,
    helmet: name => `Cink! ${name} má Helmu a kredit si nechává.`,
    bubble: name => `${name} se schovává v Bublině – útok neplatí.`,

    // ---------- kouzla ----------
    spell: (name, spell) => say([
      '{name} uplatňuje kouzlo: {spell}!',
      'Abraka-kvák! {name} uplatňuje kouzlo: {spell}.'
    ], { name, spell }),
    areaHint: (name, spell, size) => `${name}, ${spell}: vyber střed zasažené oblasti ${size} × ${size}.`,
    areaLog: (spell, size, pos) => `${spell} útočí na oblast ${size}×${size} se středem ${pos}.`,
    areaLoot: (name, loot) => `${name} získává z oblasti hmyz za ${loot} kr.`,
    areaEmpty: () => 'V zasažené oblasti nebyl žádný hmyz.',
    bubbleQ: (name, spell) => `${name}, schováš se do Bubliny před kouzlem ${spell}?`,
    hurricane: () => 'Hurikán! Karty putují po směru hodinových ručiček.',
    typhoon: () => 'Tajfun! Karty putují proti směru hodinových ručiček.',
    blackHandHint: name => `${name}, Černá ruka: vyber hráče, kterému sebereš 1 kus hmyzu.`,
    blackHandWhich: (name, target) => `${name}, který hmyz sebereš hráči ${target}?`,
    blackHandLog: (name, target, type) => `Černá ruka bere hráči ${target} ${forms(type).acc} pro hráče ${name}.`,
    blackMagicHint: name => `${name}, Černá magie: vyber hráče, kterému sebereš 1 kartu kouzla.`,
    blackMagicLog: (name, target) => `Černá magie: ${name} bere hráči ${target} jednu kartu kouzla.`,
    tongueNone: () => 'Na sousedních polích není žádný hmyz.',
    tongueHint: name => `${name}, Vystřelovací jazyk: vyber sousední pole, ze kterého sebereš kredity.`,
    bankInsect: (name, type) => `${name} bere z banku ${forms(type).acc}.`,
    swapHint: name => `${name}, Záměna: vyber hráče, se kterým si prohodíš místo.`,
    swapLog: (a, b) => `${a} a ${b} si vyměňují místa.`,
    kraken: () => 'Kraken se vynořil! Všichni ostatní odevzdávají 1 kredit.',
    krakenPay: name => `${name} odevzdává 1 kredit do banku.`,
    eco: n => `Eko katastrofa! Z plánu mizí hmyz z ${n} polí.`,
    zabijak: () => 'Žabiják: každá žába, na kterou teď hráč skočí, odevzdá 1 kredit a vrátí se na START.',
    zabijakNotTurn: name => `${name} ale není na tahu – Žabiják platí jen do konce tohoto tahu.`,

    // ---------- akce ----------
    fireflyHit: (att, vic) => say([
      'Světluška zasáhla! {att} oslňuje hráče {vic} a bere mu 1 kredit.',
      'Blesk světlušky! {vic} přichází o 1 kredit ve prospěch hráče {att}.'
    ], { att, vic }),
    exchangeSplit: name => `${name} mění v banku vážku za 2 mouchy.`,
    exchangeMerge: name => `${name} mění v banku 2 mouchy za vážku.`,
    timeout: name => `Čas vypršel – za hráče ${name} rozhodla žabí intuice.`,
    pause: (name, sec) => name
      ? `⏸ ${name} vyvolává Akci – hra stojí až ${sec} s, kouzlete a svěťte!`
      : `⏸ Akce! Hra stojí až ${sec} s – kdo chce, použije světlušku nebo kouzlo.`,
    pauseEnd: () => '▶ Čas na Akci vypršel – hra pokračuje.',

    // ---------- konec ----------
    leap: (name, price) => `VELESKOK! ${name} platí ${price} kreditů a letí ke Kouzelnému leknínu…`,
    win: name => `🏆 ${name} dosedá na Kouzelný leknín a vyhrává Žabí jezero!`,
    finish: (name, place) => `${medal(place)} ${name} doskakuje na Kouzelný leknín a bere ${place}. místo!`,
    continueGame: () => pick([
      'Hra pokračuje – ostatní žáby skáčou o další místa!',
      'Dohráváme na pořadí! Kdo bude další na Kouzelném leknínu?'
    ]),
    gameOver: () => 'Konec hry – všechna místa jsou rozdána.',

    // ---------- nápovědy (komu a co teď udělat) ----------
    hint: {
      setup: name => `${name}, vyber si své startovní pole.`,
      start: name => `${name}, vyber si volné startovní pole.`,
      roll: name => `${name}, hoď kostkami! (tlačítko nebo Enter)`,
      move: name => `${name}, vyber cíl svého skoku.`,
      leapReady: name => `${name}, máš dost kreditů! Klikni na zářící Kouzelný leknín a proveď veleskok – nebo skoč obyčejně.`,
      moveAfterVodnik: name => `${name}, Vodník Tě přenesl – teď vyber cíl svého skoku.`,
      teleport: name => `${name}, Vodník Tě přenese na pole, které si vybereš.`,
      twelveRow: (name, type) => `${name}, vyber řádek, kam přiletí ${forms(type).one}.`,
      twelveCol: (name, type) => `${name}, vyber sloupec, kam přiletí ${forms(type).one}.`,
      twelveAny: (name, type) => `${name}, vyber libovolné pole, kam přiletí ${forms(type).one}.`,
      slide: name => `${name}, sklouzni na libovolné sousední pole.`,
      dodge: name => `${name}, uskoč o 1 pole kamkoli – i do vody. Pole platí jako po každém skoku.`,
      whirl: name => `${name}, Vodní vír Tě unáší – klikni na pole, kam Tě má odnést.`,
      tramp: name => `${name}, Trampolína Tě odpálí – klikni na pole, kam doskočíš.`,
      firefly: name => `${name}, koho oslní Tvá světluška? Klikni na hráče v tabulce nebo na plánu.`,
      done: () => 'Tah je u konce – hra sama předává dalšímu hráči…',
      skip: name => `${name} trčí v bažině, tah se přeskočí…`
    }
  };

  // =====================================================================
  //  ENGLISH
  // =====================================================================
  const ARRIVE_EN = {
    fly: [
      'A new fly has arrived at the lake!',
      'Bzzz! A fat fly has arrived at the lake!',
      'A new fly is circling over the lake!'
    ],
    firefly: [
      'A new firefly has arrived at the lake!',
      'A new firefly lights up over the lake!',
      'Blink, blink! A firefly has arrived at the lake!'
    ],
    dragonfly: [
      'A new dragonfly has arrived at the lake!',
      'Rainbow wings! A dragonfly has arrived at the lake!',
      'A rare visitor – a dragonfly has arrived at the lake!'
    ]
  };

  const EN = {
    // ---------- dice events ----------
    arrive: type => pick(ARRIVE_EN[type]),
    landsOn: (type, pos) => say([
      'It settled on field {pos}.',
      'It landed on field {pos}.',
      'It is sitting on field {pos} – who will jump for it?'
    ], { pos }),
    landsOnFrog: (name, type) => say([
      'It landed right on {name} – the {one} is theirs!',
      '{name} just opens wide and the {one} is gone. Yum!',
      'Right on the head! {name} snaps it up at once.'
    ], Object.assign({ name }, forms(type))),
    fieldLabel: pos => `Field ${pos}: `,
    landsOnMagic: (name, type) => say([
      'It landed on the Magic Lily – which sends it straight to {name}!',
      'The Magic Lily glows: the {one} goes to {name}, who rolled the dice.'
    ], Object.assign({ name }, forms(type))),
    twelve: (name, what, type) => say([
      'A twelve! {name} chooses {what} where the {one} lands.',
      'Twelve! {name} picks {what} for the {one}.'
    ], Object.assign({ name, what }, forms(type))),
    twelveWhat: { any: 'the field', row: 'the row', col: 'the column' },
    twelveTitle: n => n === 2 ? 'Double twelve! Free choice of any field.' : 'A twelve!',
    vodnikTitle: () => pick([
      'Lojzík the Water Goblin rises from the deep!',
      'Splash! Lojzík the Water Goblin pops up on the surface!',
      'Lojzík the Water Goblin climbs out of the reeds!'
    ]),
    vodnikSub: name => say([
      '{name}, the Water Goblin will carry you to any field you choose.',
      '{name}, choose where the Water Goblin takes you. You still get your jump afterwards.'
    ], { name }),
    vodnikDone: (name, pos) => say([
      'The Water Goblin carries {name} to field {pos}.',
      'Whoosh! {name} appears on field {pos}.'
    ], { name, pos }),

    // ---------- turn ----------
    welcome: price => `Welcome to Frog Lake! Grand leap price: ${price} credits.`,
    turn: name => say(['It is {name}’s turn.', '{name} is up.', 'Ribbit! Now {name} plays.'], { name }),
    firstPlayer: name => say(['The dice have spoken: {name} starts!', 'The lot is cast – {name} jumps first!'], { name }),
    rollLog: (name, d10, black, white) =>
      `${name} rolls: green D10 = ${d10}, black D12 = ${black}, white D12 = ${white}.`,
    move: (name, pos) => say(['{name} jumps to field {pos}.', 'Hop! {name} lands on {pos}.'], { name, pos }),
    noJump: name => `${name} has nowhere to jump and stays put.`,
    gain: (name, credits, pos) => say([
      '{name} collects insects worth {credits} cr. on field {pos}.',
      'Yum! {name} enjoys a {credits} cr. snack on field {pos}.'
    ], { name, credits, pos }),
    luck: name => say([
      'Frog luck: the lake sends {name} a fly for encouragement.',
      'Frog luck! {name} gets a fly from the bank to keep up.'
    ], { name }),
    shore: (r, c) => `shore (${r},${c})`,
    setupTaken: name => `${name} takes a start field.`,
    randomStarts: () => 'The frogs were placed at random.',

    // ---------- cards ----------
    deckEmpty: () => 'The spell deck is empty.',
    deckShuffled: () => 'The discard pile was shuffled back into the deck.',
    noTarget: () => 'There is nobody to choose.',
    use: spell => 'Use ' + spell,
    dontUse: () => 'Don’t use',
    passiveCard: spell => `${spell} is a passive spell – it will be offered automatically when the situation it reacts to happens.`,

    // ---------- fields ----------
    water: name => say([
      'Splash! {name} falls into the water and swims back to START.',
      'Sploosh! {name} misses the lily pad – back to START.',
      'The water is cold! {name} returns to START.'
    ], { name }),
    mud: name => say([
      'Squelch! {name} sinks into the swamp and skips the next turn.',
      'The swamp won’t let go! {name} is stuck – next turn is lost.',
      '{name} sinks into the swamp. No next turn.'
    ], { name }),
    mudSkip: name => say([
      '{name} is still digging out of the swamp – this turn is skipped.',
      'The swamp holds tight! {name} neither rolls nor jumps this turn.'
    ], { name }),
    whirl: name => say(['{name} gets caught in a Whirlpool!', 'Whirlpool! {name} spins round and round…'], { name }),
    whirlMove: (name, pos) => `The whirlpool carries ${name} to field ${pos}.`,
    whirlNoWay: () => 'The whirlpool has nowhere to carry you – you stay put.',
    floatsQ: name => `${name}, put on your Floaties and stay above the whirlpool?`,
    floats: name => `${name} puts on Floaties and stays above the whirlpool.`,
    tramp: name => say(['Boing! {name} lands on a Trampoline.', '{name} jumps onto a Trampoline – boing!'], { name }),
    trampMove: (name, pos) => `The trampoline launches ${name} to field ${pos}.`,
    trampNoWay: () => 'The trampoline has nowhere to launch you.',
    mushroomCard: (name, spell) => say([
      'Magic mushroom! {name} gets the spell {spell}.',
      '{name} jumps onto a mushroom and gets the spell {spell}!',
      'The mushroom glows – {name} gets the spell {spell}.'
    ], { name, spell }),
    magicNoWin: () => 'You can only win on the Magic Lily with a grand leap from a big lily pad.',
    startPick: name => `${name} settles on a start field.`,
    toStart: (name, reason) => `${name} goes back to START (${reason}).`,
    reasonWater: 'water',

    // ---------- head jump ----------
    headJump: (att, vic) => say([
      'Head jump! {att} jumps on {vic}!',
      'Bonk! {att} lands right on {vic}’s head!'
    ], { att, vic }),
    dodgeQ: (vic, att) => `${vic}, ${att} is jumping on your head! Use Croakrobatics and leap away?`,
    noDodge: vic => `${vic} has nowhere to leap.`,
    helmetQ: vic => `${vic}, use your Helmet and keep your credit?`,
    headSteal: (att, vic) => `${att} takes 1 credit from ${vic}.`,
    headEmpty: vic => `${vic} has no credit to lose.`,
    slide: (name, pos) => `${name} slides to field ${pos}.`,
    noSlide: name => `${name} has nowhere to slide.`,
    landStays: (name, pos) => `Field ${pos} is free – ${name} stays there.`,
    dodge: (name, pos) => `${name} performs Croakrobatics and leaps to field ${pos}!`,
    helmet: name => `Clang! ${name} has a Helmet and keeps the credit.`,
    bubble: name => `${name} hides in a Bubble – the attack misses.`,

    // ---------- spells ----------
    spell: (name, spell) => say([
      '{name} casts a spell: {spell}!',
      'Abraca-croak! {name} casts a spell: {spell}.'
    ], { name, spell }),
    areaHint: (name, spell, size) => `${name}, ${spell}: choose the center of the ${size} × ${size} area.`,
    areaLog: (spell, size, pos) => `${spell} strikes a ${size}×${size} area centered on ${pos}.`,
    areaLoot: (name, loot) => `${name} collects insects worth ${loot} cr. from the area.`,
    areaEmpty: () => 'There were no insects in the area.',
    bubbleQ: (name, spell) => `${name}, hide in your Bubble from the ${spell}?`,
    hurricane: () => 'Hurricane! Spell cards travel clockwise.',
    typhoon: () => 'Typhoon! Spell cards travel counter-clockwise.',
    blackHandHint: name => `${name}, Black Hand: choose the player you take 1 insect from.`,
    blackHandWhich: (name, target) => `${name}, which insect do you take from ${target}?`,
    blackHandLog: (name, target, type) => `The Black Hand takes a ${forms(type).one} from ${target} for ${name}.`,
    blackMagicHint: name => `${name}, Black Magic: choose the player you take 1 spell card from.`,
    blackMagicLog: (name, target) => `Black Magic: ${name} takes one spell card from ${target}.`,
    tongueNone: () => 'There are no insects on the neighboring fields.',
    tongueHint: name => `${name}, Shooting Tongue: choose a neighboring field to collect credits from.`,
    bankInsect: (name, type) => `${name} takes a ${forms(type).one} from the bank.`,
    swapHint: name => `${name}, Swap: choose the player to swap places with.`,
    swapLog: (a, b) => `${a} and ${b} swap places.`,
    kraken: () => 'The Kraken rises! All other players pay 1 credit.',
    krakenPay: name => `${name} pays 1 credit to the bank.`,
    eco: n => `Eco Disaster! Insects vanish from ${n} fields.`,
    zabijak: () => 'Frogslayer: every frog this player jumps on now pays 1 credit and goes back to START.',
    zabijakNotTurn: name => `${name} is not on turn, though – Frogslayer only lasts until the end of this turn.`,

    // ---------- actions ----------
    fireflyHit: (att, vic) => say([
      'The firefly strikes! {att} dazzles {vic} and takes 1 credit.',
      'Firefly flash! {vic} loses 1 credit to {att}.'
    ], { att, vic }),
    exchangeSplit: name => `${name} exchanges a dragonfly for 2 flies at the bank.`,
    exchangeMerge: name => `${name} exchanges 2 flies for a dragonfly at the bank.`,
    timeout: name => `Time’s up – frog instinct decided for ${name}.`,
    pause: (name, sec) => name
      ? `⏸ ${name} calls an Action – the game stops for up to ${sec} s. Cast and shine!`
      : `⏸ Action! The game stops for up to ${sec} s – use a firefly or a spell.`,
    pauseEnd: () => '▶ Action time is over – the game goes on.',

    // ---------- end ----------
    leap: (name, price) => `GRAND LEAP! ${name} pays ${price} credits and flies to the Magic Lily…`,
    win: name => `🏆 ${name} lands on the Magic Lily and wins Frog Lake!`,
    finish: (name, place) => `${medal(place)} ${name} lands on the Magic Lily and takes place ${place}!`,
    continueGame: () => pick([
      'The game goes on – the other frogs jump for the next places!',
      'Playing on for places! Who will be next on the Magic Lily?'
    ]),
    gameOver: () => 'Game over – all places are decided.',

    // ---------- hints (who does what now) ----------
    hint: {
      setup: name => `${name}, choose your start field.`,
      start: name => `${name}, choose a free start field.`,
      roll: name => `${name}, roll the dice! (button or Enter)`,
      move: name => `${name}, choose where to jump.`,
      leapReady: name => `${name}, you have enough credits! Click the glowing Magic Lily for a grand leap – or make a normal jump.`,
      moveAfterVodnik: name => `${name}, the Water Goblin carried you – now choose where to jump.`,
      teleport: name => `${name}, the Water Goblin will carry you to any field you choose.`,
      twelveRow: (name, type) => `${name}, choose the row where the ${forms(type).one} lands.`,
      twelveCol: (name, type) => `${name}, choose the column where the ${forms(type).one} lands.`,
      twelveAny: (name, type) => `${name}, choose any field where the ${forms(type).one} lands.`,
      slide: name => `${name}, slide to any neighboring field.`,
      dodge: name => `${name}, leap 1 field anywhere – even into water. The field counts like after any jump.`,
      whirl: name => `${name}, the Whirlpool is carrying you – click the field it should take you to.`,
      tramp: name => `${name}, the Trampoline launches you – click the field to land on.`,
      firefly: name => `${name}, whom will your firefly dazzle? Click a player in the scoreboard or on the board.`,
      done: () => 'The turn is over – the game passes to the next player…',
      skip: name => `${name} is stuck in the swamp, the turn is skipped…`
    }
  };

  const common = { pick, fill, tileName: t => (FL.TILE_NAME[t] || t), card };
  FL.MSG_ALL = { cs: Object.assign({}, common, CS), en: Object.assign({}, common, EN) };
  FL.MSG = FL.MSG_ALL[FL.LANG === 'en' ? 'en' : 'cs'];
})();
