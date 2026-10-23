/* Žabí jezero / Frog Lake – kompletní pravidla (verze 2), česky i anglicky
 *
 * Jediný zdroj textu pravidel: ve hře je ukáže klávesa R a skript
 * `node tools/export-rules.js` z něj vygeneruje soubory `game rules.txt`
 * (česky) a `game rules EN.txt` (anglicky) pro deskovou verzi.
 * Pravidla obou verzí jsou tedy vždy stejná.
 *
 * Blok je buď odstavec (řetězec), nebo { list: [...] }, nebo { table: [[...], ...] }.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});

  const RULES_CS = {
    title: 'ŽABÍ JEZERO® – PRAVIDLA HRY',
    version: 'verze 2',
    intro: [
      'Vítejte u Žabího jezera!',
      'V Žabím jezeře se až osm odvážných žab vydává na závod ke Kouzelnému leknínu. Cestou sbírají hmyz, kouzlí, využívají sílu jezera a občas skočí někomu přímo na hlavu.',
      'Každá hra je jiná. O vítězství rozhoduje strategie, taktika, štěstí i správný odhad okamžiku – a díky pravidlům Fér hry má šanci každý, kdo se do hraní pustí.',
      'První žába, která úspěšně skočí na Kouzelný leknín, vítězí!'
    ],
    sections: [
      {
        title: '1. Příprava hry',
        blocks: [
          'Hraje 1–8 hráčů. Deskovou hru hrají 2–8 hráči; v digitální verzi lze prázdná místa u stolu obsadit počítačovými žábami, takže si zahraje i jeden hráč.',
          { list: [
            'Rozložte herní plán.',
            'Připravte bank (zásobu hmyzu) a kostky: zelenou D10, černou D12 a bílou D12.',
            'Zamíchejte karty kouzel a připravte figurky žab.',
            'Každý hráč si vezme svou žábu a odpovídající tácek na kredity.',
            'Začínajícího hráče určí hod kostkou.',
            'Startovní pole si hráči vybírají v opačném pořadí, než budou hrát – začínající hráč si tedy vybírá jako poslední. Každý si vezme libovolné volné pole START.'
          ] },
          'Hráči mohou současně zastávat roli bankéře a spravovat společnou zásobu kreditů a herních prvků.'
        ]
      },
      {
        title: '2. Průběh hry',
        blocks: [
          'Hraje se po směru hodinových ručiček. Ve svém tahu hráč:',
          { list: [
            'hodí kostkami,',
            'vyhodnotí událost a případně umístí hmyz na herní plán,',
            'provede svůj skok (nebo jiný dostupný pohyb) a sebere hmyz či kouzlo z pole, kam dopadl,',
            'poté pokračuje další hráč.'
          ] },
          'Kouzla a světlušky smí kterýkoli hráč použít kdykoli během hry – i mimo svůj tah (viz Kredity a hmyz a Kouzla).',
          'Hráč, který uvízl v bažině, svůj tah vynechá – nehází kostkami ani neskáče.'
        ]
      },
      {
        title: '3. Kostky a události',
        blocks: [
          'Hráč hodí zelenou D10 + černou D12 + bílou D12. Zelená D10 určuje událost:',
          { table: [
            ['Hod D10', 'Událost'],
            ['1–3', 'Na jezero přiletí 1 moucha.'],
            ['4–6', 'Na jezero přiletí 1 světluška.'],
            ['7–9', 'Na jezero přiletí 1 vážka.'],
            ['10 / 0', 'Vodník Lojzík: hráč přenese svou žábu na libovolné pole kromě Kouzelného leknínu.']
          ] },
          'Kostky D12 určují místo události: černá D12 řádek, bílá D12 sloupec. Používají se hodnoty 1–11. Padne-li 12, hráč si pro danou situaci zvolí libovolné číslo. Padnou-li dvě 12, hráč si zvolí libovolné pole jezera.',
          { list: [
            'Hmyz na žábě: dopadne-li hmyz na pole, kde právě stojí žába, její hráč ho okamžitě získá – jako by na pole skočil.',
            'Hmyz na Kouzelném leknínu: dopadne-li hmyz na Kouzelný leknín (6-6), získává ho hráč, který hodil kostkami.',
            'Hmyz může dopadnout i na vodu. Zůstává tam, dokud si pro něj někdo neskočí (a pak spadne do vody) nebo ho nezíská kouzlem.',
            'Vodník Lojzík je událost hodu, ne skok: po přenesení se vyhodnotí pole, kam žába dopadla, a hráč pak ještě provede svůj skok.'
          ] }
        ]
      },
      {
        title: '4. Pohyb žab',
        blocks: [
          'Každý hráč se ve svém tahu musí pohnout – vyjma tahu, který vynechává kvůli bažině.',
          'Základní skok: žába skočí na jedno sousední pole vodorovně, svisle nebo úhlopříčně.',
          'Kromě základního skoku může žábu posunout herní plán (vír, trampolína), kouzlo nebo jiný hráč.'
        ]
      },
      {
        title: '5. Pole herního plánu',
        blocks: [
          { table: [
            ['Pole', 'Účinek'],
            ['START', 'Odsud žáby začínají. Při začátku hry nebo návratu na start si hráč vybere libovolné volné startovní pole.'],
            ['Břeh, Leknín', 'Běžné pole bez zvláštního účinku.'],
            ['Voda', 'Volná hladina bez leknínu. Žába, která do ní skočí, se okamžitě vrací na libovolný volný START.'],
            ['Vodní vír', 'Žába je okamžitě přenesena o 2 pole ve směru jedné z šipek vybrané hráčem.'],
            ['Trampolína', 'Černý kruh v oranžovém rámu na břehu. Žába se okamžitě posune o 3 pole ve směru vybrané šipky podél břehu – na sousední Houbu.'],
            ['Houba', 'Hráč si vezme 1 svrchní kartu kouzla. Po dobrání posledního balíčku se odhozené karty zamíchají a vrátí do hry.'],
            ['Bažina', 'Tmavé bažiny na břehu vedle Hub a STARTů. Hráč ztrácí svůj následující tah: nehází kostkami ani neskáče. Zapadne-li do bažiny ještě před svým skokem (např. po Vodníkovi), přichází i o zbytek tahu.'],
            ['Velký leknín', 'Pole 4-4, 4-6, 4-8, 6-4, 6-8, 8-4, 8-6, 8-8. Jen z nich lze provést veleskok.'],
            ['Kouzelný leknín', 'Vítězné pole uprostřed jezera (6-6). Dosáhnout ho lze jen veleskokem.']
          ] }
        ]
      },
      {
        title: '6. Kredity a hmyz',
        blocks: [
          { table: [
            ['Hmyz', 'Hodnota'],
            ['Moucha', '1 kredit'],
            ['Světluška', '1 kredit – nebo útok světluškou'],
            ['Vážka', '2 kredity']
          ] },
          'Kredity lze získávat, utrácet, krást nebo ztrácet podle pravidel hry a účinků kouzel. Vážku lze v banku kdykoli rozměnit za 2 mouchy a 2 mouchy za vážku.',
          'Útok světluškou: hráč smí kdykoli vrátit svou světlušku do banku a vzít jinému hráči 1 kredit (dostane ho jako mouchu z banku). Napadený hráč odevzdá hmyz v hodnotě 1 kreditu – vážku si v případě potřeby rozmění.'
        ]
      },
      {
        title: '7. Veleskok na Kouzelný leknín',
        blocks: [
          'Na Kouzelný leknín lze zvítězit pouze veleskokem, a to z jednoho z osmi velkých leknínů.',
          'Cena veleskoku se určuje před začátkem hry. Doporučená cena je 10 kreditů; pro rychlou hru lze zvolit nižší, pro náročnější nebo týmovou hru vyšší.',
          'Veleskok nahrazuje základní skok: hráč, který stojí na velkém leknínu a má dost kreditů, cenu zaplatí do banku a doskočí na Kouzelný leknín.',
          'V digitální verzi se v takové chvíli Kouzelný leknín rozzáří – stačí na něj kliknout (ťuknout).'
        ]
      },
      {
        title: '8. Skok na hlavu',
        blocks: [
          'Pokud hráč skočí na pole obsazené jiným hráčem:',
          { list: [
            'sebere mu 1 kredit,',
            'poté sklouzne na libovolné sousední pole.'
          ] },
          'Toto sklouznutí může způsobit další interakci s jiným hráčem.',
          { list: [
            'Na stejného hráče lze během jednoho tahu skočit nejvýše jednou – na pole, kde stojí žába, na kterou se už v tomto tahu skákalo, se skočit ani sklouznout nesmí.',
            'Na konci tahu nesmí nikdy stát dvě žáby na jednom poli.',
            'Uskočí-li napadený Kvákrobatikou (nebo ho Žabiják pošle na START), pole se uvolní: útočník na něm zůstane, nesklouzává a vyhodnotí se účinek pole.'
          ] }
        ]
      },
      {
        title: '9. Kouzla',
        blocks: [
          'Kouzla lze používat kdykoli během hry, pokud jejich účinek neurčuje jinak. Každé kouzlo je jednorázové; po použití se karta odhodí. Kartu kouzla hráč získá na poli Houba a nahlas oznámí, které kouzlo získal. Pasivní kouzla (Bublina, Helma, Plováky, Kvákrobatika) se použijí ve chvíli, kdy nastane situace, na kterou reagují.',
          { table: [
            ['Kouzlo', 'Účinek'],
            ['Volavka ×1', 'Útok zasáhne oblast 5 × 5 polí. Zasažení hráči se vrátí na START – i ten, kdo kouzlo seslal, pokud stojí v oblasti. Sesílající získá veškerý hmyz z oblasti.'],
            ['Štika ×2', 'Útok zasáhne oblast 3 × 3 polí. Zasažení hráči se vrátí na START – i ten, kdo kouzlo seslal, pokud stojí v oblasti. Sesílající získá veškerý hmyz z oblasti.'],
            ['Hurikán ×1', 'Všichni předají své karty kouzel o jednoho hráče po směru hodinových ručiček.'],
            ['Tajfun ×1', 'Všichni předají své karty kouzel o jednoho hráče proti směru hodinových ručiček.'],
            ['Černá ruka ×2', 'Vezmi si 1 kus hmyzu od libovolného hráče.'],
            ['Černá magie ×2', 'Vezmi si 1 kartu kouzla od libovolného hráče (naslepo).'],
            ['Vystřelovací jazyk ×2', 'Seber hmyz z jednoho sousedního pole.'],
            ['Bublina ×2 (pasivní)', 'Jednou tě ochrání před útokem Štiky nebo Volavky.'],
            ['Helma ×2 (pasivní)', 'Jednou tě ochrání před ztrátou kreditu, když ti jiný hráč skočí na hlavu.'],
            ['Zlatá muška ×2', 'Vezmi si 1 mouchu z banku.'],
            ['Zářící světluška ×2', 'Vezmi si 1 světlušku z banku.'],
            ['Duhová vážka ×1', 'Vezmi si 1 vážku z banku.'],
            ['Záměna ×2', 'Prohoď si místo s hráčem, na kterého ukážeš.'],
            ['Plováky ×2 (pasivní)', 'Když tě má Vodní vír přemístit, můžeš zůstat na svém poli.'],
            ['Kvákrobatika ×2 (pasivní)', 'Když ti jiný hráč skáče na hlavu, můžeš uskočit o 1 pole kamkoli (ne na jinou žábu, i do vody) a vyhnout se následkům. Pole, kam uskočíš, platí jako po každém skoku: sebereš z něj hmyz, voda tě pošle na START, vír i trampolína tě přenesou, houba dá kouzlo, bažina zdrží. Útočník zůstane na uvolněném poli a znovu na tebe v tomto tahu skočit nemůže.'],
            ['Kraken ×1', 'Všichni ostatní hráči odevzdají 1 kredit do banku.'],
            ['Eko katastrofa ×1', 'Veškerý hmyz na herním plánu zmizí. Hmyz, který už vlastní hráči, zůstává.'],
            ['Žabiják ×4', 'Každá žába, na jejíž hlavu do konce tohoto tahu skočíš, ti jako při každém skoku na hlavu odevzdá 1 kredit a pak se vrací na START.']
          ] },
          'Pozor: Volavka a Štika zasáhnou i hráče, který je seslal, pokud stojí v zasažené oblasti.'
        ]
      },
      {
        title: '10. Fér hra',
        blocks: [
          'Aby měl šanci každý, používají se tato doporučená pravidla:',
          { list: [
            'Kostka rozhoduje, kdo začne, a startovní pole si hráči vybírají v opačném pořadí tahů.',
            'Dohrávání na pořadí: hra nekončí prvním vítězem – ostatní mohou hrát dál o další místa.',
            'Akce kdykoli: světluškou nebo kouzlem může kdokoli zasáhnout i do cizího tahu – vedoucí žába se nikdy necítí v bezpečí. Kdo vyvolá Akci, zastaví hru až na 10 sekund (do provedení akce), aby mohli všichni v klidu kouzlit.',
            'Časový limit (volitelný): kdo se nerozhodne včas, za toho rozhodne žabí intuice.'
          ] }
        ]
      },
      {
        title: '11. Vítězství',
        blocks: [
          'Vítězem se stává první hráč, který:',
          { list: [
            'získá potřebný počet kreditů,',
            'provede veleskok z velkého leknínu,',
            'doskočí na Kouzelný leknín.'
          ] },
          'Dohrávání na pořadí: kdykoli někdo doskočí na Kouzelný leknín, hráči se rozhodnou, zda ostatní pokračují o další místa (C), začnou novou hru (N), nebo hru opustí (Q). Žába v cíli už do hry nezasahuje – nehraje, nelze na ni útočit a nemůže kouzlit. Když v jezeře zůstane poslední žába, bere poslední místo a hra končí.',
          'Ve výsledcích se u žab v cíli uvádějí kredity těsně před zaplacením veleskoku. Pod pořadím jsou statistiky hry: počet kol, kolik přiletělo much, světlušek a vážek, kolikrát zasáhl Vodník, a u každého hráče sebraná kouzla a hmyz, použitá kouzla a světlušky a uskákaná vzdálenost v polích.'
        ]
      },
      {
        title: '12. Digitální verze – ovládání',
        blocks: [
          'Skoky, cíle vírů, trampolín i kouzel se vybírají kliknutím (ťuknutím) na zvýrazněná pole. Veleskok = klik na zářící Kouzelný leknín. Hráče pro útok lze vybrat v tabulce i přímo na plánu. Na začátku si každý hráč vybere svou žábu (avatara).',
          { table: [
            ['Klávesa', 'Funkce'],
            ['Mezerník', 'Akce – zastaví hru až na 10 s a otevře nabídku světlušek a kouzel (znovu = zavřít a pokračovat)'],
            ['Enter', 'Hodit kostkami / další hráč'],
            ['C', 'Po doskoku na Kouzelný leknín: pokračovat – dohrát na pořadí'],
            ['S', 'Zvukové efekty zap / vyp'],
            ['M', 'Podkladová hudba zap / vyp'],
            ['R', 'Kompletní pravidla'],
            ['N', 'Nová hra'],
            ['Q', 'Opustit hru (zpět do menu)'],
            ['Esc', 'Zavřít okno / zrušit rozehranou akci']
          ] },
          'Tabulka skóre řadí nahoru žáby, které už jsou v cíli (podle pořadí doskoku), ostatní podle kreditů; při shodě je výš ten, kdo skóre dosáhl později, a při další shodě rozhoduje abeceda.',
          'Hraje se na jednom zařízení: jeden hráč proti počítačovým žábám, nebo více hráčů, kteří se u zařízení střídají.'
        ]
      }
    ],
    outro: ['Příjemnou žábavu!', 'Žabí jezero®']
  };

  const RULES_EN = {
    title: 'FROG LAKE® – GAME RULES',
    version: 'version 2',
    intro: [
      'Welcome to Frog Lake!',
      'At Frog Lake, up to eight brave frogs race to the Magic Lily. On the way they catch insects, cast spells, use the powers of the lake and now and then jump right on somebody’s head.',
      'Every game is different. Strategy, tactics, luck and good timing decide the winner – and thanks to the Fair Play rules, everyone who joins in has a chance.',
      'The first frog to land on the Magic Lily wins!'
    ],
    sections: [
      {
        title: '1. Setup',
        blocks: [
          '1–8 players. The board game is for 2–8 players; in the digital version empty seats can be filled with computer frogs, so you can even play alone.',
          { list: [
            'Unfold the game board.',
            'Prepare the bank (the supply of insects) and the dice: a green D10, a black D12 and a white D12.',
            'Shuffle the spell cards and get the frog figures ready.',
            'Each player takes their frog and the matching credit tray.',
            'A roll of the dice decides who starts.',
            'Players choose their start fields in reverse turn order – so the starting player chooses last. Everyone takes any free START field.'
          ] },
          'Players may also act as bankers and manage the shared supply of credits and game pieces.'
        ]
      },
      {
        title: '2. Playing the game',
        blocks: [
          'Play goes clockwise. On their turn a player:',
          { list: [
            'rolls the dice,',
            'resolves the event and places an insect on the board if needed,',
            'makes their jump (or another available move) and collects the insects or the spell from the field they landed on,',
            'then the next player continues.'
          ] },
          'Any player may use spells and fireflies at any time during the game – even outside their own turn (see Credits and insects and Spells).',
          'A player stuck in the swamp skips their turn – they neither roll the dice nor jump.'
        ]
      },
      {
        title: '3. Dice and events',
        blocks: [
          'The player rolls the green D10 + the black D12 + the white D12. The green D10 decides the event:',
          { table: [
            ['D10 roll', 'Event'],
            ['1–3', '1 fly arrives at the lake.'],
            ['4–6', '1 firefly arrives at the lake.'],
            ['7–9', '1 dragonfly arrives at the lake.'],
            ['10 / 0', 'Lojzík the Water Goblin: the player moves their frog to any field except the Magic Lily.']
          ] },
          'The D12 dice decide where the event happens: the black D12 gives the row, the white D12 the column. Values 1–11 are used. If a 12 comes up, the player chooses any number for it. If two 12s come up, the player chooses any field of the lake.',
          { list: [
            'Insect on a frog: if an insect lands on a field where a frog is standing, its player gets it at once – as if they had jumped there.',
            'Insect on the Magic Lily: if an insect lands on the Magic Lily (6-6), the player who rolled the dice gets it.',
            'An insect may also land on water. It stays there until someone jumps for it (and then falls into the water) or collects it with a spell.',
            'The Water Goblin is an event of the roll, not a jump: after the move the field where the frog landed takes effect, and the player still makes their jump.'
          ] }
        ]
      },
      {
        title: '4. Moving the frogs',
        blocks: [
          'Every player must move on their turn – except the turn they skip because of the swamp.',
          'Basic jump: the frog jumps to one neighboring field horizontally, vertically or diagonally.',
          'Besides the basic jump, a frog can be moved by the board (whirlpool, trampoline), by a spell or by another player.'
        ]
      },
      {
        title: '5. Board fields',
        blocks: [
          { table: [
            ['Field', 'Effect'],
            ['START', 'Frogs start here. At the start of the game or when returning to start, the player chooses any free start field.'],
            ['Shore, Lily pad', 'An ordinary field with no special effect.'],
            ['Water', 'Open water without a lily pad. A frog that jumps in immediately returns to any free START.'],
            ['Whirlpool', 'The frog is immediately carried 2 fields in the direction of one of the arrows, chosen by the player.'],
            ['Trampoline', 'The black circle in an orange frame on the shore. The frog immediately moves 3 fields in the direction of the chosen arrow along the shore – onto the neighboring Mushroom.'],
            ['Mushroom', 'The player takes the top spell card. When the deck runs out, the discarded cards are shuffled and returned to play.'],
            ['Swamp', 'The dark swamps on the shore next to the Mushrooms and STARTs. The player loses their next turn: they neither roll the dice nor jump. If a frog falls into the swamp before its jump (e.g. after the Water Goblin), it also loses the rest of the turn.'],
            ['Big lily pad', 'Fields 4-4, 4-6, 4-8, 6-4, 6-8, 8-4, 8-6, 8-8. A grand leap can only start from these.'],
            ['Magic Lily', 'The winning field in the middle of the lake (6-6). It can only be reached by a grand leap.']
          ] }
        ]
      },
      {
        title: '6. Credits and insects',
        blocks: [
          { table: [
            ['Insect', 'Value'],
            ['Fly', '1 credit'],
            ['Firefly', '1 credit – or a firefly attack'],
            ['Dragonfly', '2 credits']
          ] },
          'Credits can be gained, spent, stolen or lost according to the rules and the effects of spells. At the bank, a dragonfly can be exchanged for 2 flies and 2 flies for a dragonfly at any time.',
          'Firefly attack: at any time, a player may return their firefly to the bank and take 1 credit from another player (receiving it as a fly from the bank). The attacked player hands in insects worth 1 credit – changing a dragonfly if necessary.'
        ]
      },
      {
        title: '7. The grand leap to the Magic Lily',
        blocks: [
          'You can only win on the Magic Lily with a grand leap, made from one of the eight big lily pads.',
          'The price of the grand leap is set before the game. The recommended price is 10 credits; choose a lower price for a quick game, a higher one for a more challenging or team game.',
          'The grand leap replaces the basic jump: a player standing on a big lily pad with enough credits pays the price to the bank and lands on the Magic Lily.',
          'In the digital version the Magic Lily starts to glow at that moment – just click (tap) it.'
        ]
      },
      {
        title: '8. Head jump',
        blocks: [
          'If a player jumps onto a field occupied by another player:',
          { list: [
            'they take 1 credit from them,',
            'then they slide to any neighboring field.'
          ] },
          'This slide may cause another interaction with another player.',
          { list: [
            'You may jump on the same player at most once per turn – you may neither jump nor slide onto a field with a frog that has already been jumped on this turn.',
            'Two frogs may never stand on the same field at the end of a turn.',
            'If the attacked frog leaps away with Croakrobatics (or Frogslayer sends it to START), the field becomes free: the attacker stays there, does not slide and the field takes effect.'
          ] }
        ]
      },
      {
        title: '9. Spells',
        blocks: [
          'Spells can be used at any time during the game unless their effect says otherwise. Every spell can be used once; after use the card is discarded. A player gets a spell card on a Mushroom field and announces aloud which spell they got. Passive spells (Bubble, Helmet, Floaties, Croakrobatics) are used at the moment the situation they react to happens.',
          { table: [
            ['Spell', 'Effect'],
            ['Heron ×1', 'Strikes a 5 × 5 area. Players hit return to START – including the caster, if standing in the area. The caster collects all insects in the area.'],
            ['Pike ×2', 'Strikes a 3 × 3 area. Players hit return to START – including the caster, if standing in the area. The caster collects all insects in the area.'],
            ['Hurricane ×1', 'Everyone passes their spell cards one player clockwise.'],
            ['Typhoon ×1', 'Everyone passes their spell cards one player counter-clockwise.'],
            ['Black Hand ×2', 'Take 1 insect from any player.'],
            ['Black Magic ×2', 'Take 1 spell card from any player (blindly).'],
            ['Shooting Tongue ×2', 'Collect the insects from one neighboring field.'],
            ['Bubble ×2 (passive)', 'Protects you once from a Pike or Heron attack.'],
            ['Helmet ×2 (passive)', 'Protects you once from losing a credit when another player jumps on your head.'],
            ['Golden Fly ×2', 'Take 1 fly from the bank.'],
            ['Glowing Firefly ×2', 'Take 1 firefly from the bank.'],
            ['Rainbow Dragonfly ×1', 'Take 1 dragonfly from the bank.'],
            ['Swap ×2', 'Swap places with the player you point at.'],
            ['Floaties ×2 (passive)', 'When a Whirlpool is about to carry you away, you may stay on your field.'],
            ['Croakrobatics ×2 (passive)', 'When another player jumps on your head, you may leap 1 field anywhere (not onto another frog, even into water) and avoid the consequences. The field you land on counts like after any jump: you collect its insects, water sends you to START, whirlpools and trampolines carry you, a mushroom gives you a spell, the swamp holds you. The attacker stays on the freed field and cannot jump on you again this turn.'],
            ['Kraken ×1', 'All other players pay 1 credit to the bank.'],
            ['Eco Disaster ×1', 'All insects on the board vanish. Insects already owned by players stay.'],
            ['Frogslayer ×4', 'Every frog whose head you jump on until the end of this turn gives you 1 credit, as with any head jump, and then goes back to START.']
          ] },
          'Careful: the Heron and the Pike also hit the player who cast them, if that player stands in the area.'
        ]
      },
      {
        title: '10. Fair play',
        blocks: [
          'So that everyone has a chance, these recommended rules apply:',
          { list: [
            'A roll of the dice decides who starts, and players choose their start fields in reverse turn order.',
            'Playing on for places: the game does not end with the first winner – the others may play on for the next places.',
            'Action at any time: anyone can step into another player’s turn with a firefly or a spell – the leading frog is never safe. Whoever calls an Action pauses the game for up to 10 seconds (until the action is done) so that everyone can cast in peace.',
            'Time limit (optional): whoever does not decide in time gets a decision from frog instinct.'
          ] }
        ]
      },
      {
        title: '11. Winning',
        blocks: [
          'The winner is the first player who:',
          { list: [
            'collects enough credits,',
            'makes a grand leap from a big lily pad,',
            'lands on the Magic Lily.'
          ] },
          'Playing on for places: whenever someone lands on the Magic Lily, the players decide whether the others play on for the next places (C), start a new game (N) or quit (Q). A frog that has finished no longer takes part – it does not play, cannot be attacked and cannot cast spells. When only one frog is left in the lake, it takes the last place and the game ends.',
          'The results show, for frogs that have finished, their credits just before paying for the grand leap. Below the standings are the game statistics: number of rounds, how many flies, fireflies and dragonflies arrived, how often the Water Goblin appeared, and for each player the spells and insects collected, the spells and fireflies used and the distance jumped in fields.'
        ]
      },
      {
        title: '12. Digital version – controls',
        blocks: [
          'Jumps and the targets of whirlpools, trampolines and spells are chosen by clicking (tapping) the highlighted fields. Grand leap = click the glowing Magic Lily. A player to attack can be chosen in the scoreboard or right on the board. At the start every player chooses their frog (avatar).',
          { table: [
            ['Key', 'Function'],
            ['Space', 'Action – pauses the game for up to 10 s and opens the menu of fireflies and spells (again = close and continue)'],
            ['Enter', 'Roll the dice / next player'],
            ['C', 'After a landing on the Magic Lily: continue – play on for places'],
            ['S', 'Sound effects on / off'],
            ['M', 'Background music on / off'],
            ['R', 'Complete rules'],
            ['N', 'New game'],
            ['Q', 'Quit the game (back to the menu)'],
            ['Esc', 'Close a window / cancel the current action']
          ] },
          'The scoreboard puts frogs that have finished at the top (in order of arrival), the others by credits; on a tie the player who reached the score later is higher, and on a further tie the alphabet decides.',
          'The game is played on one device: one player against computer frogs, or several players taking turns at the device.'
        ]
      }
    ],
    outro: ['Have a hoppy time!', 'Frog Lake®']
  };

  FL.RULES_ALL = { cs: RULES_CS, en: RULES_EN };
  FL.RULES = FL.RULES_ALL[FL.LANG === 'en' ? 'en' : 'cs'];

  const esc = s => String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  FL.rulesHtml = function (lang) {
    const R = lang ? FL.RULES_ALL[lang] : FL.RULES;
    const block = b => {
      if (typeof b === 'string') return `<p>${esc(b)}</p>`;
      if (b.list) return '<ul>' + b.list.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
      if (b.table) {
        const [head, ...rows] = b.table;
        return '<table class="rules-table"><thead><tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') +
          '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>';
      }
      return '';
    };
    return `<div class="rules"><h1>${esc(R.title)} <small>${esc(R.version)}</small></h1>` +
      R.intro.map(p => `<p class="lead">${esc(p)}</p>`).join('') +
      R.sections.map(s => `<h2>${esc(s.title)}</h2>` + s.blocks.map(block).join('')).join('') +
      R.outro.map(p => `<p class="outro">${esc(p)}</p>`).join('') + '</div>';
  };

  FL.rulesText = function (lang) {
    const R = lang ? FL.RULES_ALL[lang] : FL.RULES;
    const out = [R.title + ' (' + R.version + ')', ''];
    R.intro.forEach(p => out.push(p));
    R.sections.forEach(s => {
      out.push('', s.title.toUpperCase());
      s.blocks.forEach(b => {
        if (typeof b === 'string') out.push(b);
        else if (b.list) b.list.forEach(i => out.push('* ' + i));
        else if (b.table) b.table.slice(1).forEach(r => out.push('- ' + r[0] + ': ' + r.slice(1).join(' ')));
      });
    });
    out.push('');
    R.outro.forEach(p => out.push(p));
    return out.join('\n') + '\n';
  };
})();
