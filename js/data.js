/* Žabí jezero – herní data (plán a kouzla)
 *
 * Herní plán je mřížka 13x13. Vnitřní jezero má souřadnice 1..11
 * (přesně tak, jak je očíslované na plánu a jak ho adresují kostky D12).
 * Vnější prstenec (index 0 a 12) je BŘEH se STARTy a HOUBAMI.
 */
(function () {
  const FL = (window.FL = window.FL || {});

  FL.SIZE = 13;
  FL.LAKE_MIN = 1;
  FL.LAKE_MAX = 11;

  FL.TILE = {
    SHORE: 'shore',
    START: 'start',
    MUSHROOM: 'mushroom',
    LILY: 'lily',
    BIG: 'big',
    WATER: 'water',
    WHIRL: 'whirl',
    MAGIC: 'magic',
    TRAMPOLINE: 'trampoline',
    MUD: 'mud'                // v pravidlech je, na tomto plánu se nevyskytuje
  };

  FL.TILE_NAME = {
    shore: 'Břeh',
    start: 'Start',
    mushroom: 'Houba',
    lily: 'Leknín',
    big: 'Velký leknín',
    water: 'Voda',
    whirl: 'Vodní vír',
    magic: 'Kouzelný leknín',
    trampoline: 'Trampolína',
    mud: 'Bahno'
  };

  // Geometrie podkladového obrázku images/board.jpeg (1080 x 1080 px).
  FL.ART = { W: 1080, H: 1080, X0: 42.7, DX: 82.3, Y0: 50, DY: 82.3 };

  const key = (r, c) => r + ',' + c;
  FL.key = key;
  FL.parseKey = (k) => {
    const [r, c] = k.split(',').map(Number);
    return { r, c };
  };

  // --- pevné pozice odečtené z obrázku plánu -------------------------------
  /* Na každé hraně břehu je pořadí polí:
   * houba(0) – leknín(1) – břeh(2) – TRAMPOLÍNA(3) – START(4) – leknín(5) –
   * houba(6) – leknín(7) – START(8) – TRAMPOLÍNA(9) – břeh(10) – leknín(11) – houba(12)
   * Startovní pole je to s nápisem START, ne černý kruh trampolíny vedle něj.
   */
  FL.STARTS = [
    { r: 0, c: 4 }, { r: 0, c: 8 },
    { r: 12, c: 4 }, { r: 12, c: 8 },
    { r: 4, c: 0 }, { r: 8, c: 0 },
    { r: 4, c: 12 }, { r: 8, c: 12 }
  ];

  const TRAMPOLINES = [
    [0, 3], [0, 9],
    [12, 3], [12, 9],
    [3, 0], [9, 0],
    [3, 12], [9, 12]
  ];

  const MUSHROOMS = [
    [0, 0], [0, 6], [0, 12],
    [6, 0], [6, 12],
    [12, 0], [12, 6], [12, 12]
  ];

  // Velké lekníny – jediná pole, ze kterých lze provést veleskok (pravidlo 7).
  FL.BIG_LILIES = [
    [4, 4], [4, 6], [4, 8],
    [6, 4], [6, 8],
    [8, 4], [8, 6], [8, 8]
  ];

  FL.MAGIC_POS = { r: 6, c: 6 };

  // Volná voda: čtyři "díry" v rozích jezera + prstenec kolem Kouzelného leknínu.
  const WATER = [
    [2, 3], [3, 2], [2, 9], [3, 10],
    [9, 2], [10, 3], [9, 10], [10, 9],
    [5, 5], [5, 6], [5, 7],
    [6, 5], [6, 7],
    [7, 5], [7, 6], [7, 7]
  ];

  // Vodní víry na okraji jezera.
  const WHIRLS = [
    [1, 1], [1, 11], [11, 1], [11, 11],
    [1, 5], [1, 6], [1, 7],
    [11, 5], [11, 6], [11, 7],
    [5, 1], [6, 1], [7, 1],
    [5, 11], [6, 11], [7, 11]
  ];

  /* Šipky vírů (odečteno z plánu):
   * - rohový vír má jednu šipku úhlopříčně dovnitř,
   * - vír na pozici 5 a 7 dané hrany má tři šipky (rovně + obě úhlopříčky dovnitř),
   * - vír na pozici 6 (uprostřed hrany) má jednu šipku rovně dovnitř.
   * Vír přenáší žábu vždy o 2 pole ve zvoleném směru.
   */
  function whirlDirs(r, c) {
    const top = r === 1, bottom = r === 11, left = c === 1, right = c === 11;
    const dr = top ? 1 : bottom ? -1 : 0;
    const dc = left ? 1 : right ? -1 : 0;

    if (dr && dc) return [[dr, dc]]; // roh

    if (dr) { // horní / dolní hrana, normála svisle
      if (c === 6) return [[dr, 0]];
      return [[dr, -1], [dr, 0], [dr, 1]];
    }
    // levá / pravá hrana, normála vodorovně
    if (r === 6) return [[0, dc]];
    return [[-1, dc], [0, dc], [1, dc]];
  }
  FL.WHIRL_STEP = 2;

  /* Šipky trampolín (oranžové oblouky na plánu):
   * trampolína leží na břehu a její dvě šipky vedou podél břehu na obě strany,
   * vždy o 3 pole – tedy přesně na sousední houby.
   * Trampolína přenáší žábu o 3 pole ve zvoleném směru (pravidlo 5).
   */
  function trampolineDirs(r, c) {
    const horizontal = r === 0 || r === FL.SIZE - 1;
    return horizontal ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
  }
  FL.TRAMPOLINE_STEP = 3;

  // --- sestavení plánu -----------------------------------------------------
  FL.buildBoard = function buildBoard() {
    const T = FL.TILE;
    const tiles = {};
    const N = FL.SIZE;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const onRing = r === 0 || c === 0 || r === N - 1 || c === N - 1;
        tiles[key(r, c)] = { r, c, type: onRing ? T.SHORE : T.LILY, dirs: null };
      }
    }

    FL.STARTS.forEach(s => (tiles[key(s.r, s.c)].type = T.START));
    MUSHROOMS.forEach(([r, c]) => (tiles[key(r, c)].type = T.MUSHROOM));
    WATER.forEach(([r, c]) => (tiles[key(r, c)].type = T.WATER));
    FL.BIG_LILIES.forEach(([r, c]) => (tiles[key(r, c)].type = T.BIG));
    WHIRLS.forEach(([r, c]) => {
      const t = tiles[key(r, c)];
      t.type = T.WHIRL;
      t.dirs = whirlDirs(r, c);
    });
    TRAMPOLINES.forEach(([r, c]) => {
      const t = tiles[key(r, c)];
      t.type = T.TRAMPOLINE;
      t.dirs = trampolineDirs(r, c);
    });
    tiles[key(FL.MAGIC_POS.r, FL.MAGIC_POS.c)].type = T.MAGIC;

    return tiles;
  };

  FL.arrowGlyph = function (dr, dc) {
    const m = {
      '-1,-1': '↖', '-1,0': '↑', '-1,1': '↗',
      '0,-1': '←', '0,1': '→',
      '1,-1': '↙', '1,0': '↓', '1,1': '↘'
    };
    return m[dr + ',' + dc] || '→';
  };

  FL.inBoard = (r, c) => r >= 0 && c >= 0 && r < FL.SIZE && c < FL.SIZE;
  FL.inLake = (r, c) =>
    r >= FL.LAKE_MIN && r <= FL.LAKE_MAX && c >= FL.LAKE_MIN && c <= FL.LAKE_MAX;

  FL.neighbours = function (r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (FL.inBoard(r + dr, c + dc)) out.push({ r: r + dr, c: c + dc });
      }
    }
    return out;
  };

  // --- hmyz ----------------------------------------------------------------
  FL.INSECTS = {
    fly: { name: 'Moucha', value: 1, img: 'images/old/Fly.png' },
    firefly: { name: 'Světluška', value: 1, img: 'images/old/Firefly.png' },
    dragonfly: { name: 'Vážka', value: 2, img: 'images/old/Dragonfly.png' }
  };
  FL.INSECT_KEYS = ['fly', 'firefly', 'dragonfly'];

  // --- balíček kouzel (32 karet, dle obrázků cards-1 / cards-2) -------------
  FL.CARDS = [
    { id: 'volavka', name: 'Volavka', count: 1, color: '#7d2b1f',
      text: 'Útok volavky zasáhne oblast 5 × 5 polí. Zasažení hráči se vrátí na START. Hráč, který kouzlo aktivoval, získává veškerý hmyz nacházející se v zasažené oblasti.' },
    { id: 'stika', name: 'Štika', count: 2, color: '#c2560f',
      text: 'Útok štiky zasáhne oblast 3 × 3 polí. Zasažení hráči se vrátí na START. Hráč, který kouzlo aktivoval, získává veškerý hmyz nacházející se v zasažené oblasti.' },
    { id: 'hurikan', name: 'Hurikán', count: 1, color: '#1b3a63',
      text: 'Všichni hráči si předají své karty kouzel v ruce o jednoho hráče po směru hodinových ručiček.' },
    { id: 'tajfun', name: 'Tajfun', count: 1, color: '#14161a',
      text: 'Všichni hráči si předají své karty kouzel v ruce o jednoho hráče proti směru hodinových ručiček.' },
    { id: 'cerna_ruka', name: 'Černá ruka', count: 2, color: '#101014',
      text: 'Vezmi si 1 kus hmyzu od libovolného hráče.' },
    { id: 'cerna_magie', name: 'Černá magie', count: 2, color: '#14251a',
      text: 'Vezmi si 1 kartu kouzla od libovolného hráče.' },
    { id: 'jazyk', name: 'Vystřelovací jazyk', count: 2, color: '#d9629c',
      text: 'Seber kredity z jednoho sousedního pole.' },
    { id: 'bublina', name: 'Bublina', count: 2, color: '#8fb6cf', passive: true,
      text: 'Jednou tě ochrání před útokem Štiky nebo Volavky.' },
    { id: 'helma', name: 'Helma', count: 2, color: '#6b4a24', passive: true,
      text: 'Jednou tě ochrání před ztrátou 1 kreditu, když ti jiný hráč skočí na hlavu.' },
    { id: 'zlata_muska', name: 'Zlatá muška', count: 2, color: '#c9c9c9',
      text: 'Vezmi si 1 mouchu z banku.' },
    { id: 'svetluska', name: 'Zářící světluška', count: 2, color: '#d8a72a',
      text: 'Vezmi si 1 světlušku z banku.' },
    { id: 'duhova_vazka', name: 'Duhová vážka', count: 1, color: '#57c2a8',
      text: 'Vezmi si 1 vážku z banku.' },
    { id: 'zamena', name: 'Záměna', count: 2, color: '#4a2a6b',
      text: 'Prohoď si místo na herním plánu s hráčem, na kterého ukážeš.' },
    { id: 'plovaky', name: 'Plováky', count: 2, color: '#2f88b4', passive: true,
      text: 'Když tě má Vodní vír přemístit, můžeš zůstat jedno kolo nad ním bez přesouvání.' },
    { id: 'kvakrobatika', name: 'Kvákrobatika', count: 2, color: '#d3a028', passive: true,
      text: 'Když na tebe jiný hráč skáče, můžeš okamžitě uskočit o 1 pole v libovolném směru a vyhnout se následkům skoku.' },
    { id: 'kraken', name: 'Kraken', count: 1, color: '#241812',
      text: 'Všichni ostatní hráči odevzdají 1 kredit do banku.' },
    { id: 'eko', name: 'Eko katastrofa', count: 1, color: '#0d0d0d',
      text: 'Veškerý hmyz umístěný na herním plánu okamžitě zmizí. Hmyz, který již vlastní hráči, zůstává nedotčen.' },
    { id: 'zabijak', name: 'Žabiják', count: 4, color: '#9aa0a6',
      text: 'Každá žába, na jejíž hlavu v tomto kole skočíš, se okamžitě vrací na START.' }
  ];

  FL.CARD_BY_ID = {};
  FL.CARDS.forEach(c => (FL.CARD_BY_ID[c.id] = c));

  FL.buildDeck = function () {
    const deck = [];
    let n = 0;
    FL.CARDS.forEach(c => {
      for (let i = 0; i < c.count; i++) deck.push({ uid: 'k' + n++, id: c.id });
    });
    return deck;
  };

  FL.FROG_COLORS = ['#4caf50', '#e0533d', '#f2c744', '#3d8fe0', '#b45fd6', '#e07fb0', '#26bfa5', '#c98a3c'];
  FL.FROG_IMG = i => 'images/old/Frog' + (i + 1) + '.png';
})();
