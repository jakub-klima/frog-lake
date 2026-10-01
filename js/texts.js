/* Žabí jezero – hlášky a nápovědy
 *
 * Všechny texty, které hra hlásí, jsou na jednom místě, aby šly snadno ladit.
 * Hlášky jsou v přítomném čase – v češtině tak nezáleží na rodu hráče.
 * U většiny je několik variant, hra z nich náhodně vybírá, aby se neokoukaly.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});

  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  const say = (variants, v) => fill(pick(variants), v || {});

  const ARRIVE = {
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

  FL.MSG = {
    pick, fill,

    // ---------- události hodu ----------
    arrive: type => pick(ARRIVE[type]),
    landsOn: (type, pos) => say([
      'Usadila se na poli {pos}.',
      'Přistála na poli {pos}.',
      'Sedí na poli {pos} – kdo si pro ni skočí?'
    ], { pos }),
    landsOnFrog: (name, type) => say([
      'Dosedla přímo na žábu {name} – {acc} si nechává!',
      '{name} jen otevře tlamu a {one} je fuč. Ňam!',
      'Přímo na hlavu! {name} ji okamžitě sbírá.'
    ], Object.assign({ name }, FL.INSECT_FORMS[type])),
    landsOnMagic: (name, type) => say([
      'Dosedla na Kouzelný leknín – a ten ji posílá rovnou hráči {name}!',
      'Kouzelný leknín zazářil: {acc} dostává {name}, kdo hodil kostkami.'
    ], Object.assign({ name }, FL.INSECT_FORMS[type])),
    twelve: (name, what, type) => say([
      'Padla dvanáctka! {name} si vybírá {what}, kam přiletí {one}.',
      'Dvanáctka! {name} určuje {what} pro {acc}.'
    ], Object.assign({ name, what }, FL.INSECT_FORMS[type])),
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
    turn: name => say(['Na tahu je {name}.', '{name} je na řadě.', 'Kvák! Teď hraje {name}.'], { name }),
    firstPlayer: name => say(['Kostky rozhodly: začíná {name}!', 'Los padl – první skáče {name}!'], { name }),
    rollLog: (name, d10, black, white) =>
      `${name} hází: zelená D10 = ${d10}, černá D12 = ${black}, bílá D12 = ${white}.`,
    move: (name, pos) => say(['{name} skáče na pole {pos}.', 'Hop! {name} doskakuje na {pos}.'], { name, pos }),
    gain: (name, credits, pos) => say([
      '{name} sbírá hmyz za {credits} kr. na poli {pos}.',
      'Mňam! {name} si na poli {pos} pochutnává za {credits} kr.'
    ], { name, credits, pos }),
    luck: name => say([
      'Žabí štěstí: jezero posílá hráči {name} mouchu na povzbuzení.',
      'Žabí štěstí! {name} dostává z banku mouchu, ať neztrácí krok.'
    ], { name }),

    // ---------- pole ----------
    water: name => say([
      'Žbluňk! {name} padá do vody a plave zpátky na START.',
      'Šplouch! {name} skáče vedle leknínu – zpátky na START.',
      'Voda je studená! {name} se vrací na START.'
    ], { name }),
    mud: name => say([
      'Čvacht! {name} zapadá do bahna a příští tah vynechá.',
      'Bažina nepustí! {name} trčí v bahně – příští tah stojí.',
      '{name} se boří do bahna. Příští tah se nehraje.'
    ], { name }),
    mudSkip: name => say([
      '{name} se pořád vyhrabává z bahna – tento tah vynechává.',
      'Bahno drží! {name} tento tah nehází ani neskáče.'
    ], { name }),
    whirl: name => say(['{name} se dostává do Vodního víru!', 'Vír! {name} se točí dokola…'], { name }),
    whirlMove: (name, pos) => `Vír unáší hráče ${name} na pole ${pos}.`,
    floats: name => `${name} nasazuje Plováky a zůstává nad vírem.`,
    tramp: name => say(['Boing! {name} dopadá na Trampolínu.', '{name} skáče na Trampolínu – boing!'], { name }),
    trampMove: (name, pos) => `Trampolína odpaluje hráče ${name} na pole ${pos}.`,
    mushroom: name => say([
      '{name} nachází kouzelnou houbu a bere si kartu kouzla.',
      'Houba! {name} si bere kartu kouzla.'
    ], { name }),
    draw: (name) => `${name} si bere kartu kouzla.`,
    magicNoWin: () => 'Na Kouzelný leknín lze zvítězit jen veleskokem z velkého leknínu.',
    startPick: name => `${name} usedá na startovní pole.`,
    toStart: (name, reason) => `${name} se vrací na START (${reason}).`,

    // ---------- skok na hlavu ----------
    headJump: (att, vic) => say([
      'Hop na hlavu! {att} skáče na hráče {vic}!',
      'Bum! {att} přistává hráči {vic} přímo na hlavě!'
    ], { att, vic }),
    headSteal: (att, vic) => `${att} bere hráči ${vic} 1 kredit.`,
    headEmpty: vic => `${vic} nemá žádný kredit, o který by přišel.`,
    slide: (name, pos) => `${name} sklouzává na pole ${pos}.`,
    dodge: (name, pos) => `${name} provádí Kvákrobatiku a uskakuje na pole ${pos}!`,
    helmet: name => `Cink! ${name} má Helmu a kredit si nechává.`,
    bubble: name => `${name} se schovává v Bublině – útok neplatí.`,

    // ---------- akce ----------
    spell: (name, spell) => say([
      '{name} uplatňuje kouzlo: {spell}!',
      'Abraka-kvák! {name} uplatňuje kouzlo: {spell}.'
    ], { name, spell }),
    fireflyHit: (att, vic) => say([
      'Světluška zasáhla! {att} oslňuje hráče {vic} a bere mu 1 kredit.',
      'Blesk světlušky! {vic} přichází o 1 kredit ve prospěch hráče {att}.'
    ], { att, vic }),
    exchangeSplit: name => `${name} mění v banku vážku za 2 mouchy.`,
    exchangeMerge: name => `${name} mění v banku 2 mouchy za vážku.`,
    timeout: name => `Čas vypršel – za hráče ${name} rozhodla žabí intuice.`,

    // ---------- konec ----------
    leap: (name, price) => `VELESKOK! ${name} platí ${price} kreditů a letí ke Kouzelnému leknínu…`,
    win: name => `🏆 ${name} dosedá na Kouzelný leknín a vyhrává Žabí jezero!`,

    // ---------- nápovědy (komu a co teď udělat) ----------
    hint: {
      setup: name => `${name}, vyber si své startovní pole.`,
      start: name => `${name}, vyber si volné startovní pole.`,
      roll: name => `${name}, hoď kostkami! (tlačítko nebo Enter)`,
      move: name => `${name}, vyber cíl svého skoku.`,
      moveAfterVodnik: name => `${name}, Vodník Tě přenesl – teď vyber cíl svého skoku.`,
      teleport: name => `${name}, Vodník Tě přenese na pole, které si vybereš.`,
      twelveRow: (name, type) => `${name}, vyber řádek, kam přiletí ${FL.INSECT_FORMS[type].one}.`,
      twelveCol: (name, type) => `${name}, vyber sloupec, kam přiletí ${FL.INSECT_FORMS[type].one}.`,
      twelveAny: (name, type) => `${name}, vyber libovolné pole, kam přiletí ${FL.INSECT_FORMS[type].one}.`,
      slide: name => `${name}, sklouzni na libovolné sousední pole.`,
      dodge: name => `${name}, uskoč o 1 pole kamkoli.`,
      whirl: name => `${name}, Vodní vír Tě unáší – klikni na pole, kam Tě má odnést.`,
      tramp: name => `${name}, Trampolína Tě odpálí – klikni na pole, kam doskočíš.`,
      firefly: name => `${name}, koho oslní Tvá světluška? Klikni na hráče v tabulce nebo na plánu.`,
      done: () => 'Tah je u konce – hra sama předává dalšímu hráči…',
      skip: name => `${name} trčí v bahně, tah se přeskočí…`
    },

    reasonWater: 'voda',
    tileName: t => (FL.TILE_NAME[t] || t)
  };
})();
