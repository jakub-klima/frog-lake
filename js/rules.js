/* Žabí jezero – kompletní pravidla (verze 2)
 *
 * Jediný zdroj textu pravidel: ve hře je ukáže klávesa R a skript
 * `node tools/export-rules.js` z něj vygeneruje soubor `game rules.txt`
 * pro deskovou verzi. Pravidla obou verzí jsou tedy vždy stejná.
 *
 * Blok je buď odstavec (řetězec), nebo { list: [...] }, nebo { table: [[...], ...] }.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});

  FL.RULES = {
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
          'Hráč, který uvízl v bahně, svůj tah vynechá – nehází kostkami ani neskáče.'
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
          'Každý hráč se ve svém tahu musí pohnout – vyjma tahu, který vynechává kvůli bahnu.',
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
            ['Bahno', 'Tmavé bažinaté plochy na břehu vedle Hub a STARTů. Hráč ztrácí svůj následující tah: nehází kostkami ani neskáče. Zapadne-li do bahna ještě před svým skokem (např. po Vodníkovi), přichází i o zbytek tahu.'],
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
            'Uskočí-li napadený Kvákrobatikou (nebo ho Žabiják pošle na START), pole se uvolní: útočník na něm zůstane a nesklouzává.'
          ] }
        ]
      },
      {
        title: '9. Kouzla',
        blocks: [
          'Kouzla lze používat kdykoli během hry, pokud jejich účinek neurčuje jinak. Každé kouzlo je jednorázové; po použití se karta odhodí. Kartu kouzla hráč získá na poli Houba a nahlas oznámí, které kouzlo získal. Pasivní kouzla (Bublina, Helma, Plováky, Kvákrobatika) se použijí ve chvíli, kdy nastane situace, na kterou reagují.',
          { table: [
            ['Kouzlo', 'Účinek'],
            ['Volavka ×1', 'Útok zasáhne oblast 5 × 5 polí. Zasažení hráči se vrátí na START. Sesílající získá veškerý hmyz z oblasti.'],
            ['Štika ×2', 'Útok zasáhne oblast 3 × 3 polí. Zasažení hráči se vrátí na START. Sesílající získá veškerý hmyz z oblasti.'],
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
            ['Kvákrobatika ×2 (pasivní)', 'Když ti jiný hráč skáče na hlavu, můžeš uskočit o 1 pole kamkoli (ne do vody, ne na jinou žábu) a vyhnout se následkům. Útočník zůstane na uvolněném poli a znovu na tebe v tomto tahu skočit nemůže.'],
            ['Kraken ×1', 'Všichni ostatní hráči odevzdají 1 kredit do banku.'],
            ['Eko katastrofa ×1', 'Veškerý hmyz na herním plánu zmizí. Hmyz, který už vlastní hráči, zůstává.'],
            ['Žabiják ×4', 'Každá žába, na jejíž hlavu do konce tohoto tahu skočíš, se vrací na START.']
          ] },
          'Volavka a Štika nezasahují hráče, který je seslal.'
        ]
      },
      {
        title: '10. Fér hra',
        blocks: [
          'Aby měl šanci každý, používají se tato doporučená pravidla:',
          { list: [
            'Kostka rozhoduje, kdo začne, a startovní pole si hráči vybírají v opačném pořadí tahů.',
            'Dohrávání na pořadí: hra nekončí prvním vítězem – ostatní mohou hrát dál o další místa.',
            'Akce kdykoli: světluškou nebo kouzlem může kdokoli zasáhnout i do cizího tahu – vedoucí žába se nikdy necítí v bezpečí.',
            'Časový limit (volitelný, hlavně pro online hru): kdo se nerozhodne včas, za toho rozhodne žabí intuice.'
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
          'Dohrávání na pořadí: kdykoli někdo doskočí na Kouzelný leknín, hráči se rozhodnou, zda ostatní pokračují o další místa (C), začnou novou hru (N), nebo hru opustí (Q). Žába v cíli už do hry nezasahuje – nehraje, nelze na ni útočit a nemůže kouzlit. Když v jezeře zůstane poslední žába, bere poslední místo a hra končí.'
        ]
      },
      {
        title: '12. Digitální verze – ovládání',
        blocks: [
          'Skoky, cíle vírů, trampolín i kouzel se vybírají kliknutím (ťuknutím) na zvýrazněná pole. Veleskok = klik na zářící Kouzelný leknín. Hráče pro útok lze vybrat v tabulce i přímo na plánu. Na začátku si každý hráč vybere svou žábu (avatara).',
          { table: [
            ['Klávesa', 'Funkce'],
            ['Mezerník', 'Akce – použít světlušku nebo kouzlo (otevřít / zavřít nabídku)'],
            ['Enter', 'Hodit kostkami / další hráč'],
            ['C', 'Po doskoku na Kouzelný leknín: pokračovat – dohrát na pořadí'],
            ['S', 'Zvukové efekty zap / vyp'],
            ['M', 'Podkladová hudba zap / vyp'],
            ['R', 'Kompletní pravidla'],
            ['N', 'Nová hra'],
            ['Q', 'Opustit hru'],
            ['Esc', 'Zavřít okno / zrušit rozehranou akci']
          ] },
          'Tabulka skóre řadí nahoru žáby, které už jsou v cíli (podle pořadí doskoku), ostatní podle kreditů; při shodě je výš ten, kdo skóre dosáhl později, a při další shodě rozhoduje abeceda.',
          'Hra na více zařízeních: přes Wi-Fi bez serveru (hostitel pozve ostatní QR kódem) nebo online přes herní server.'
        ]
      }
    ],
    outro: ['Příjemnou žábavu!', 'Žabí jezero®']
  };

  const esc = s => String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  FL.rulesHtml = function () {
    const R = FL.RULES;
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

  FL.rulesText = function () {
    const R = FL.RULES;
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
