const geminateTokens = [
    // ሀ (ha) series
    { input: ["hhä"], internal: "hhä", output: "ሀ፟" },
    { input: ["hhu"], internal: "hhu", output: "ሁ፟" },
    { input: ["hhi"], internal: "hhi", output: "ሂ፟" },
    { input: ["hha"], internal: "hha", output: "ሃ፟" },
    { input: ["hhe"], internal: "hhe", output: "ሄ፟" },
    { input: ["hh", "hhə"], internal: "hh", output: "ህ፟" },
    { input: ["hho"], internal: "hho", output: "ሆ፟" },
    // ለ (la) series
    { input: ["llä"], internal: "llä", output: "ለ፟" },
    { input: ["llu"], internal: "llu", output: "ሉ፟" },
    { input: ["lli"], internal: "lli", output: "ሊ፟" },
    { input: ["lla"], internal: "lla", output: "ላ፟" },
    { input: ["lle"], internal: "lle", output: "ሌ፟" },
    { input: ["ll", "llə"], internal: "ll", output: "ል፟" },
    { input: ["llo"], internal: "llo", output: "ሎ፟" },
    // ሐ (ḥa) series
    { input: ["ḥḥä"], internal: "ḥḥä", output: "ሐ፟" },
    { input: ["ḥḥu"], internal: "ḥḥu", output: "ሑ፟" },
    { input: ["ḥḥi"], internal: "ḥḥi", output: "ሒ፟" },
    { input: ["ḥḥa"], internal: "ḥḥa", output: "ሓ፟" },
    { input: ["ḥḥe"], internal: "ḥḥe", output: "ሔ፟" },
    { input: ["ḥḥ", "ḥḥə"], internal: "ḥḥ", output: "ሕ፟" },
    { input: ["ḥḥo"], internal: "ḥḥo", output: "ሖ፟" },
    // መ (ma) series
    { input: ["mmä"], internal: "mmä", output: "መ፟" },
    { input: ["mmu"], internal: "mmu", output: "ሙ፟" },
    { input: ["mmi"], internal: "mmi", output: "ሚ፟" },
    { input: ["mma"], internal: "mma", output: "ማ፟" },
    { input: ["mme"], internal: "mme", output: "ሜ፟" },
    { input: ["mm", "mmə"], internal: "mm", output: "ም፟" },
    { input: ["mmo"], internal: "mmo", output: "ሞ፟" },
    // ሠ (śa) series
    { input: ["śśä"], internal: "śśä", output: "ሠ፟" },
    { input: ["śśu"], internal: "śśu", output: "ሡ፟" },
    { input: ["śśi"], internal: "śśi", output: "ሢ፟" },
    { input: ["śśa"], internal: "śśa", output: "ሣ፟" },
    { input: ["śśe"], internal: "śśe", output: "ሤ፟" },
    { input: ["śś", "śśə"], internal: "śś", output: "ሥ፟" },
    { input: ["śśo"], internal: "śśo", output: "ሦ፟" },
    // ረ (ra) series
    { input: ["rrä"], internal: "rrä", output: "ረ፟" },
    { input: ["rru"], internal: "rru", output: "ሩ፟" },
    { input: ["rri"], internal: "rri", output: "ሪ፟" },
    { input: ["rra"], internal: "rra", output: "ራ፟" },
    { input: ["rre"], internal: "rre", output: "ሬ፟" },
    { input: ["rr", "rrə"], internal: "rr", output: "ር፟" },
    { input: ["rro"], internal: "rro", output: "ሮ፟" },
    // ሰ (sa) series
    { input: ["ssä"], internal: "ssä", output: "ሰ፟" },
    { input: ["ssu"], internal: "ssu", output: "ሱ፟" },
    { input: ["ssi"], internal: "ssi", output: "ሲ፟" },
    { input: ["ssa"], internal: "ssa", output: "ሳ፟" },
    { input: ["sse"], internal: "sse", output: "ሴ፟" },
    { input: ["ss", "ssə"], internal: "ss", output: "ስ፟" },
    { input: ["sso"], internal: "sso", output: "ሶ፟" },
    // ቀ (qa) series
    { input: ["qqä"], internal: "qqä", output: "ቀ፟" },
    { input: ["qqu"], internal: "qqu", output: "ቁ፟" },
    { input: ["qqi"], internal: "qqi", output: "ቂ፟" },
    { input: ["qqa"], internal: "qqa", output: "ቃ፟" },
    { input: ["qqe"], internal: "qqe", output: "ቄ፟" },
    { input: ["qq", "qqə"], internal: "qq", output: "ቅ፟" },
    { input: ["qqo"], internal: "qqo", output: "ቆ፟" },
    // ቈ (qʷa) series - labialized
    { input: ["qqʷä"], internal: "qqʷä", output: "ቈ፟" },
    { input: ["qqʷi"], internal: "qqʷi", output: "ቊ፟" },
    { input: ["qqʷa"], internal: "qqʷa", output: "ቋ፟" },
    { input: ["qqʷe"], internal: "qqʷe", output: "ቌ፟" },
    { input: ["qqʷ"], internal: "qqʷ", output: "ቍ፟" },
    // በ (ba) series
    { input: ["bbä"], internal: "bbä", output: "በ፟" },
    { input: ["bbu"], internal: "bbu", output: "ቡ፟" },
    { input: ["bbi"], internal: "bbi", output: "ቢ፟" },
    { input: ["bba"], internal: "bba", output: "ባ፟" },
    { input: ["bbe"], internal: "bbe", output: "ቤ፟" },
    { input: ["bb", "bbə"], internal: "bb", output: "ብ፟" },
    { input: ["bbo"], internal: "bbo", output: "ቦ፟" },
    // ተ (ta) series
    { input: ["ttä"], internal: "ttä", output: "ተ፟" },
    { input: ["ttu"], internal: "ttu", output: "ቱ፟" },
    { input: ["tti"], internal: "tti", output: "ቲ፟" },
    { input: ["tta"], internal: "tta", output: "ታ፟" },
    { input: ["tte"], internal: "tte", output: "ቴ፟" },
    { input: ["tt", "ttə"], internal: "tt", output: "ት፟" },
    { input: ["tto"], internal: "tto", output: "ቶ፟" },
    // ኀ (ḫa) series
    { input: ["ḫḫä"], internal: "ḫḫä", output: "ኀ፟" },
    { input: ["ḫḫu"], internal: "ḫḫu", output: "ኁ፟" },
    { input: ["ḫḫi"], internal: "ḫḫi", output: "ኂ፟" },
    { input: ["ḫḫa"], internal: "ḫḫa", output: "ኃ፟" },
    { input: ["ḫḫe"], internal: "ḫḫe", output: "ኄ፟" },
    { input: ["ḫḫ", "ḫḫə"], internal: "ḫḫ", output: "ኅ፟" },
    { input: ["ḫḫo"], internal: "ḫḫo", output: "ኆ፟" },
    // ኈ (ḫʷa) series - labialized
    { input: ["ḫḫʷä"], internal: "ḫḫʷä", output: "ኈ፟" },
    { input: ["ḫḫʷi"], internal: "ḫḫʷi", output: "ኊ፟" },
    { input: ["ḫḫʷa"], internal: "ḫḫʷa", output: "ኋ፟" },
    { input: ["ḫḫʷe"], internal: "ḫḫʷe", output: "ኌ፟" },
    { input: ["ḫḫʷ"], internal: "ḫḫʷ", output: "ኍ፟" },
    // ነ (na) series
    { input: ["nnä"], internal: "nnä", output: "ነ፟" },
    { input: ["nnu"], internal: "nnu", output: "ኑ፟" },
    { input: ["nni"], internal: "nni", output: "ኒ፟" },
    { input: ["nna"], internal: "nna", output: "ና፟" },
    { input: ["nne"], internal: "nne", output: "ኔ፟" },
    { input: ["nn", "nnə"], internal: "nn", output: "ን፟" },
    { input: ["nno"], internal: "nno", output: "ኖ፟" },
    // አ (ʾa) series
    { input: ["ʾʾä"], internal: "ʾʾä", output: "አ፟" },
    { input: ["ʾʾu"], internal: "ʾʾu", output: "ኡ፟" },
    { input: ["ʾʾi"], internal: "ʾʾi", output: "ኢ፟" },
    { input: ["ʾʾa"], internal: "ʾʾa", output: "ኣ፟" },
    { input: ["ʾʾe"], internal: "ʾʾe", output: "ኤ፟" },
    { input: ["ʾʾ", "ʾʾə"], internal: "ʾʾ", output: "እ፟" },
    { input: ["ʾʾo"], internal: "ʾʾo", output: "ኦ፟" },
    // ከ (ka) series
    { input: ["kkä"], internal: "kkä", output: "ከ፟" },
    { input: ["kku"], internal: "kku", output: "ኩ፟" },
    { input: ["kki"], internal: "kki", output: "ኪ፟" },
    { input: ["kka"], internal: "kka", output: "ካ፟" },
    { input: ["kke"], internal: "kke", output: "ኬ፟" },
    { input: ["kk", "kkə"], internal: "kk", output: "ክ፟" },
    { input: ["kko"], internal: "kko", output: "ኮ፟" },
    // ኰ (kʷa) series - labialized
    { input: ["kkʷä"], internal: "kkʷä", output: "ኰ፟" },
    { input: ["kkʷi"], internal: "kkʷi", output: "ኲ፟" },
    { input: ["kkʷa"], internal: "kkʷa", output: "ኳ፟" },
    { input: ["kkʷe"], internal: "kkʷe", output: "ኴ፟" },
    { input: ["kkʷ"], internal: "kkʷ", output: "ኵ፟" },
    // ወ (wa) series
    { input: ["wwä"], internal: "wwä", output: "ወ፟" },
    { input: ["wwu"], internal: "wwu", output: "ዉ፟" },
    { input: ["wwi"], internal: "wwi", output: "ዊ፟" },
    { input: ["wwa"], internal: "wwa", output: "ዋ፟" },
    { input: ["wwe"], internal: "wwe", output: "ዌ፟" },
    { input: ["ww", "wwə"], internal: "ww", output: "ው፟" },
    { input: ["wwo"], internal: "wwo", output: "ዎ፟" },
    // ዐ (ʿa) series
    { input: ["ʿʿä"], internal: "ʿʿä", output: "ዐ፟" },
    { input: ["ʿʿu"], internal: "ʿʿu", output: "ዑ፟" },
    { input: ["ʿʿi"], internal: "ʿʿi", output: "ዒ፟" },
    { input: ["ʿʿa"], internal: "ʿʿa", output: "ዓ፟" },
    { input: ["ʿʿe"], internal: "ʿʿe", output: "ዔ፟" },
    { input: ["ʿʿ", "ʿʿə"], internal: "ʿʿ", output: "ዕ፟" },
    { input: ["ʿʿo"], internal: "ʿʿo", output: "ዖ፟" },
    // ዘ (za) series
    { input: ["zzä"], internal: "zzä", output: "ዘ፟" },
    { input: ["zzu"], internal: "zzu", output: "ዙ፟" },
    { input: ["zzi"], internal: "zzi", output: "ዚ፟" },
    { input: ["zza"], internal: "zza", output: "ዛ፟" },
    { input: ["zze"], internal: "zze", output: "ዜ፟" },
    { input: ["zz", "zzə"], internal: "zz", output: "ዝ፟" },
    { input: ["zzo"], internal: "zzo", output: "ዞ፟" },
    // የ (ya) series
    { input: ["yyä"], internal: "yyä", output: "የ፟" },
    { input: ["yyu"], internal: "yyu", output: "ዩ፟" },
    { input: ["yyi"], internal: "yyi", output: "ዪ፟" },
    { input: ["yya"], internal: "yya", output: "ያ፟" },
    { input: ["yye"], internal: "yye", output: "ዬ፟" },
    { input: ["yy", "yyə"], internal: "yy", output: "ይ፟" },
    { input: ["yyo"], internal: "yyo", output: "ዮ፟" },
    // ደ (da) series
    { input: ["ddä"], internal: "ddä", output: "ደ፟" },
    { input: ["ddu"], internal: "ddu", output: "ዱ፟" },
    { input: ["ddi"], internal: "ddi", output: "ዲ፟" },
    { input: ["dda"], internal: "dda", output: "ዳ፟" },
    { input: ["dde"], internal: "dde", output: "ዴ፟" },
    { input: ["dd", "ddə"], internal: "dd", output: "ድ፟" },
    { input: ["ddo"], internal: "ddo", output: "ዶ፟" },
    // ገ (ga) series
    { input: ["ggä"], internal: "ggä", output: "ገ፟" },
    { input: ["ggu"], internal: "ggu", output: "ጉ፟" },
    { input: ["ggi"], internal: "ggi", output: "ጊ፟" },
    { input: ["gga"], internal: "gga", output: "ጋ፟" },
    { input: ["gge"], internal: "gge", output: "ጌ፟" },
    { input: ["gg", "ggə"], internal: "gg", output: "ግ፟" },
    { input: ["ggo"], internal: "ggo", output: "ጎ፟" },
    // ጐ (gʷa) series - labialized
    { input: ["ggʷä"], internal: "ggʷä", output: "ጐ፟" },
    { input: ["ggʷi"], internal: "ggʷi", output: "ጒ፟" },
    { input: ["ggʷa"], internal: "ggʷa", output: "ጓ፟" },
    { input: ["ggʷe"], internal: "ggʷe", output: "ጔ፟" },
    { input: ["ggʷ"], internal: "ggʷ", output: "ጕ፟" },
    // ጠ (ṭa) series
    { input: ["ṭṭä"], internal: "ṭṭä", output: "ጠ፟" },
    { input: ["ṭṭu"], internal: "ṭṭu", output: "ጡ፟" },
    { input: ["ṭṭi"], internal: "ṭṭi", output: "ጢ፟" },
    { input: ["ṭṭa"], internal: "ṭṭa", output: "ጣ፟" },
    { input: ["ṭṭe"], internal: "ṭṭe", output: "ጤ፟" },
    { input: ["ṭṭ", "ṭṭə"], internal: "ṭṭ", output: "ጥ፟" },
    { input: ["ṭṭo"], internal: "ṭṭo", output: "ጦ፟" },
    // ጰ (ṗa) series
    { input: ["ṗṗä"], internal: "ṗṗä", output: "ጰ፟" },
    { input: ["ṗṗu"], internal: "ṗṗu", output: "ጱ፟" },
    { input: ["ṗṗi"], internal: "ṗṗi", output: "ጲ፟" },
    { input: ["ṗṗa"], internal: "ṗṗa", output: "ጳ፟" },
    { input: ["ṗṗe"], internal: "ṗṗe", output: "ጴ፟" },
    { input: ["ṗṗ"], internal: "ṗṗ", output: "ጵ፟" },
    { input: ["ṗṗo"], internal: "ṗṗo", output: "ጶ፟" },
    // ጸ (ṣa) series
    { input: ["ṣṣä"], internal: "ṣṣä", output: "ጸ፟" },
    { input: ["ṣṣu"], internal: "ṣṣu", output: "ጹ፟" },
    { input: ["ṣṣi"], internal: "ṣṣi", output: "ጺ፟" },
    { input: ["ṣṣa"], internal: "ṣṣa", output: "ጻ፟" },
    { input: ["ṣṣe"], internal: "ṣṣe", output: "ጼ፟" },
    { input: ["ṣṣ", "ṣṣə"], internal: "ṣṣ", output: "ጽ፟" },
    { input: ["ṣṣo"], internal: "ṣṣo", output: "ጾ፟" },
    // ፀ (ḍa) series
    { input: ["ḍḍä"], internal: "ḍḍä", output: "ፀ፟" },
    { input: ["ḍḍu"], internal: "ḍḍu", output: "ፁ፟" },
    { input: ["ḍḍi"], internal: "ḍḍi", output: "ፂ፟" },
    { input: ["ḍḍa"], internal: "ḍḍa", output: "ፃ፟" },
    { input: ["ḍḍe"], internal: "ḍḍe", output: "ፄ፟" },
    { input: ["ḍḍ"], internal: "ḍḍ", output: "ፅ፟" },
    { input: ["ḍḍo"], internal: "ḍḍo", output: "ፆ፟" },
    // ፈ (fa) series
    { input: ["ffä"], internal: "ffä", output: "ፈ፟" },
    { input: ["ffu"], internal: "ffu", output: "ፉ፟" },
    { input: ["ffi"], internal: "ffi", output: "ፊ፟" },
    { input: ["ffa"], internal: "ffa", output: "ፋ፟" },
    { input: ["ffe"], internal: "ffe", output: "ፌ፟" },
    { input: ["ff", "ffə"], internal: "ff", output: "ፍ፟" },
    { input: ["ffo"], internal: "ffo", output: "ፎ፟" },
    // ፐ (pa) series
    { input: ["ppä"], internal: "ppä", output: "ፐ፟" },
    { input: ["ppu"], internal: "ppu", output: "ፑ፟" },
    { input: ["ppi"], internal: "ppi", output: "ፒ፟" },
    { input: ["ppa"], internal: "ppa", output: "ፓ፟" },
    { input: ["ppe"], internal: "ppe", output: "ፔ፟" },
    { input: ["pp", "ppə"], internal: "pp", output: "ፕ፟" },
    { input: ["ppo"], internal: "ppo", output: "ፖ፟" }
];
const tokens = [
    // ሀ (ha) series
    { input: ["hä"], internal: "hä", output: "ሀ" },
    { input: ["hu"], internal: "hu", output: "ሁ" },
    { input: ["hi"], internal: "hi", output: "ሂ" },
    { input: ["ha"], internal: "ha", output: "ሃ" },
    { input: ["he"], internal: "he", output: "ሄ" },
    { input: ["h", "hə"], internal: "h", output: "ህ" },
    { input: ["ho"], internal: "ho", output: "ሆ" },
    // ለ (la) series
    { input: ["lä"], internal: "lä", output: "ለ" },
    { input: ["lu"], internal: "lu", output: "ሉ" },
    { input: ["li"], internal: "li", output: "ሊ" },
    { input: ["la"], internal: "la", output: "ላ" },
    { input: ["le"], internal: "le", output: "ሌ" },
    { input: ["l", "lə"], internal: "l", output: "ል" },
    { input: ["lo"], internal: "lo", output: "ሎ" },
    // ሐ (ḥa) series
    { input: ["ḥä"], internal: "ḥä", output: "ሐ" },
    { input: ["ḥu"], internal: "ḥu", output: "ሑ" },
    { input: ["ḥi"], internal: "ḥi", output: "ሒ" },
    { input: ["ḥa"], internal: "ḥa", output: "ሓ" },
    { input: ["ḥe"], internal: "ḥe", output: "ሔ" },
    { input: ["ḥ", "ḥə"], internal: "ḥ", output: "ሕ" },
    { input: ["ḥo"], internal: "ḥo", output: "ሖ" },
    // መ (ma) series
    { input: ["mä"], internal: "mä", output: "መ" },
    { input: ["mu"], internal: "mu", output: "ሙ" },
    { input: ["mi"], internal: "mi", output: "ሚ" },
    { input: ["ma"], internal: "ma", output: "ማ" },
    { input: ["me"], internal: "me", output: "ሜ" },
    { input: ["m", "mə"], internal: "m", output: "ም" },
    { input: ["mo"], internal: "mo", output: "ሞ" },
    // ሠ (śa) series
    { input: ["śä"], internal: "śä", output: "ሠ" },
    { input: ["śu"], internal: "śu", output: "ሡ" },
    { input: ["śi"], internal: "śi", output: "ሢ" },
    { input: ["śa"], internal: "śa", output: "ሣ" },
    { input: ["śe"], internal: "śe", output: "ሤ" },
    { input: ["ś", "śə"], internal: "ś", output: "ሥ" },
    { input: ["śo"], internal: "śo", output: "ሦ" },
    // ረ (ra) series
    { input: ["rä"], internal: "rä", output: "ረ" },
    { input: ["ru"], internal: "ru", output: "ሩ" },
    { input: ["ri"], internal: "ri", output: "ሪ" },
    { input: ["ra"], internal: "ra", output: "ራ" },
    { input: ["re"], internal: "re", output: "ሬ" },
    { input: ["r", "rə"], internal: "r", output: "ር" },
    { input: ["ro"], internal: "ro", output: "ሮ" },
    // ሰ (sa) series
    { input: ["sä"], internal: "sä", output: "ሰ" },
    { input: ["su"], internal: "su", output: "ሱ" },
    { input: ["si"], internal: "si", output: "ሲ" },
    { input: ["sa"], internal: "sa", output: "ሳ" },
    { input: ["se"], internal: "se", output: "ሴ" },
    { input: ["s", "sə"], internal: "s", output: "ስ" },
    { input: ["so"], internal: "so", output: "ሶ" },
    // ቀ (qa) series
    { input: ["qä"], internal: "qä", output: "ቀ" },
    { input: ["qu"], internal: "qu", output: "ቁ" },
    { input: ["qi"], internal: "qi", output: "ቂ" },
    { input: ["qa"], internal: "qa", output: "ቃ" },
    { input: ["qe"], internal: "qe", output: "ቄ" },
    { input: ["q", "qə"], internal: "q", output: "ቅ" },
    { input: ["qo"], internal: "qo", output: "ቆ" },
    // ቈ (qʷa) series - labialized
    { input: ["qʷä"], internal: "qʷä", output: "ቈ" },
    { input: ["qʷi"], internal: "qʷi", output: "ቊ" },
    { input: ["qʷa"], internal: "qʷa", output: "ቋ" },
    { input: ["qʷe"], internal: "qʷe", output: "ቌ" },
    { input: ["qʷ"], internal: "qʷ", output: "ቍ" },
    // በ (ba) series
    { input: ["bä"], internal: "bä", output: "በ" },
    { input: ["bu"], internal: "bu", output: "ቡ" },
    { input: ["bi"], internal: "bi", output: "ቢ" },
    { input: ["ba"], internal: "ba", output: "ባ" },
    { input: ["be"], internal: "be", output: "ቤ" },
    { input: ["b", "bə"], internal: "b", output: "ብ" },
    { input: ["bo"], internal: "bo", output: "ቦ" },
    // ተ (ta) series
    { input: ["tä"], internal: "tä", output: "ተ" },
    { input: ["tu"], internal: "tu", output: "ቱ" },
    { input: ["ti"], internal: "ti", output: "ቲ" },
    { input: ["ta"], internal: "ta", output: "ታ" },
    { input: ["te"], internal: "te", output: "ቴ" },
    { input: ["t", "tə"], internal: "t", output: "ት" },
    { input: ["to"], internal: "to", output: "ቶ" },
    // ኀ (ḫa) series
    { input: ["ḫä"], internal: "ḫä", output: "ኀ" },
    { input: ["ḫu"], internal: "ḫu", output: "ኁ" },
    { input: ["ḫi"], internal: "ḫi", output: "ኂ" },
    { input: ["ḫa"], internal: "ḫa", output: "ኃ" },
    { input: ["ḫe"], internal: "ḫe", output: "ኄ" },
    { input: ["ḫ", "ḫə"], internal: "ḫ", output: "ኅ" },
    { input: ["ḫo"], internal: "ḫo", output: "ኆ" },
    // ኈ (ḫʷa) series - labialized
    { input: ["ḫʷä"], internal: "ḫʷä", output: "ኈ" },
    { input: ["ḫʷi"], internal: "ḫʷi", output: "ኊ" },
    { input: ["ḫʷa"], internal: "ḫʷa", output: "ኋ" },
    { input: ["ḫʷe"], internal: "ḫʷe", output: "ኌ" },
    { input: ["ḫʷ"], internal: "ḫʷ", output: "ኍ" },
    // ነ (na) series
    { input: ["nä"], internal: "nä", output: "ነ" },
    { input: ["nu"], internal: "nu", output: "ኑ" },
    { input: ["ni"], internal: "ni", output: "ኒ" },
    { input: ["na"], internal: "na", output: "ና" },
    { input: ["ne"], internal: "ne", output: "ኔ" },
    { input: ["n", "nə"], internal: "n", output: "ን" },
    { input: ["no"], internal: "no", output: "ኖ" },
    // አ (ʾa) series
    { input: ["ʾä"], internal: "ʾä", output: "አ" },
    { input: ["ʾu"], internal: "ʾu", output: "ኡ" },
    { input: ["ʾi"], internal: "ʾi", output: "ኢ" },
    { input: ["ʾa"], internal: "ʾa", output: "ኣ" },
    { input: ["ʾe"], internal: "ʾe", output: "ኤ" },
    { input: ["ʾ", "ʾə"], internal: "ʾ", output: "እ" },
    { input: ["ʾo"], internal: "ʾo", output: "ኦ" },
    // ከ (ka) series
    { input: ["kä"], internal: "kä", output: "ከ" },
    { input: ["ku"], internal: "ku", output: "ኩ" },
    { input: ["ki"], internal: "ki", output: "ኪ" },
    { input: ["ka"], internal: "ka", output: "ካ" },
    { input: ["ke"], internal: "ke", output: "ኬ" },
    { input: ["k", "kə"], internal: "k", output: "ክ" },
    { input: ["ko"], internal: "ko", output: "ኮ" },
    // ኰ (kʷa) series - labialized
    { input: ["kʷä"], internal: "kʷä", output: "ኰ" },
    { input: ["kʷi"], internal: "kʷi", output: "ኲ" },
    { input: ["kʷa"], internal: "kʷa", output: "ኳ" },
    { input: ["kʷe"], internal: "kʷe", output: "ኴ" },
    { input: ["kʷ"], internal: "kʷ", output: "ኵ" },
    // ወ (wa) series
    { input: ["wä"], internal: "wä", output: "ወ" },
    { input: ["wu"], internal: "wu", output: "ዉ" },
    { input: ["wi"], internal: "wi", output: "ዊ" },
    { input: ["wa"], internal: "wa", output: "ዋ" },
    { input: ["we"], internal: "we", output: "ዌ" },
    { input: ["w", "wə"], internal: "w", output: "ው" },
    { input: ["wo"], internal: "wo", output: "ዎ" },
    // ዐ (ʿa) series
    { input: ["ʿä"], internal: "ʿä", output: "ዐ" },
    { input: ["ʿu"], internal: "ʿu", output: "ዑ" },
    { input: ["ʿi"], internal: "ʿi", output: "ዒ" },
    { input: ["ʿa"], internal: "ʿa", output: "ዓ" },
    { input: ["ʿe"], internal: "ʿe", output: "ዔ" },
    { input: ["ʿ", "ʿə"], internal: "ʿ", output: "ዕ" },
    { input: ["ʿo"], internal: "ʿo", output: "ዖ" },
    // ዘ (za) series
    { input: ["zä"], internal: "zä", output: "ዘ" },
    { input: ["zu"], internal: "zu", output: "ዙ" },
    { input: ["zi"], internal: "zi", output: "ዚ" },
    { input: ["za"], internal: "za", output: "ዛ" },
    { input: ["ze"], internal: "ze", output: "ዜ" },
    { input: ["z", "zə"], internal: "z", output: "ዝ" },
    { input: ["zo"], internal: "zo", output: "ዞ" },
    // የ (ya) series
    { input: ["yä"], internal: "yä", output: "የ" },
    { input: ["yu"], internal: "yu", output: "ዩ" },
    { input: ["yi"], internal: "yi", output: "ዪ" },
    { input: ["ya"], internal: "ya", output: "ያ" },
    { input: ["ye"], internal: "ye", output: "ዬ" },
    { input: ["y", "yə"], internal: "y", output: "ይ" },
    { input: ["yo"], internal: "yo", output: "ዮ" },
    // ደ (da) series
    { input: ["dä"], internal: "dä", output: "ደ" },
    { input: ["du"], internal: "du", output: "ዱ" },
    { input: ["di"], internal: "di", output: "ዲ" },
    { input: ["da"], internal: "da", output: "ዳ" },
    { input: ["de"], internal: "de", output: "ዴ" },
    { input: ["d", "də"], internal: "d", output: "ድ" },
    { input: ["do"], internal: "do", output: "ዶ" },
    // ገ (ga) series
    { input: ["gä"], internal: "gä", output: "ገ" },
    { input: ["gu"], internal: "gu", output: "ጉ" },
    { input: ["gi"], internal: "gi", output: "ጊ" },
    { input: ["ga"], internal: "ga", output: "ጋ" },
    { input: ["ge"], internal: "ge", output: "ጌ" },
    { input: ["g", "gə"], internal: "g", output: "ግ" },
    { input: ["go"], internal: "go", output: "ጎ" },
    // ጐ (gʷa) series - labialized
    { input: ["gʷä"], internal: "gʷä", output: "ጐ" },
    { input: ["gʷi"], internal: "gʷi", output: "ጒ" },
    { input: ["gʷa"], internal: "gʷa", output: "ጓ" },
    { input: ["gʷe"], internal: "gʷe", output: "ጔ" },
    { input: ["gʷ"], internal: "gʷ", output: "ጕ" },
    // ጠ (ṭa) series
    { input: ["ṭä"], internal: "ṭä", output: "ጠ" },
    { input: ["ṭu"], internal: "ṭu", output: "ጡ" },
    { input: ["ṭi"], internal: "ṭi", output: "ጢ" },
    { input: ["ṭa"], internal: "ṭa", output: "ጣ" },
    { input: ["ṭe"], internal: "ṭe", output: "ጤ" },
    { input: ["ṭ", "ṭə"], internal: "ṭ", output: "ጥ" },
    { input: ["ṭo"], internal: "ṭo", output: "ጦ" },
    // ጰ (ṗa) series
    { input: ["ṗä"], internal: "ṗä", output: "ጰ" },
    { input: ["ṗu"], internal: "ṗu", output: "ጱ" },
    { input: ["ṗi"], internal: "ṗi", output: "ጲ" },
    { input: ["ṗa"], internal: "ṗa", output: "ጳ" },
    { input: ["ṗe"], internal: "ṗe", output: "ጴ" },
    { input: ["ṗ"], internal: "ṗ", output: "ጵ" },
    { input: ["ṗo"], internal: "ṗo", output: "ጶ" },
    // ጸ (ṣa) series
    { input: ["ṣä"], internal: "ṣä", output: "ጸ" },
    { input: ["ṣu"], internal: "ṣu", output: "ጹ" },
    { input: ["ṣi"], internal: "ṣi", output: "ጺ" },
    { input: ["ṣa"], internal: "ṣa", output: "ጻ" },
    { input: ["ṣe"], internal: "ṣe", output: "ጼ" },
    { input: ["ṣ", "ṣə"], internal: "ṣ", output: "ጽ" },
    { input: ["ṣo"], internal: "ṣo", output: "ጾ" },
    // ፀ (ḍa) series
    { input: ["ḍä"], internal: "ḍä", output: "ፀ" },
    { input: ["ḍu"], internal: "ḍu", output: "ፁ" },
    { input: ["ḍi"], internal: "ḍi", output: "ፂ" },
    { input: ["ḍa"], internal: "ḍa", output: "ፃ" },
    { input: ["ḍe"], internal: "ḍe", output: "ፄ" },
    { input: ["ḍ"], internal: "ḍ", output: "ፅ" },
    { input: ["ḍo"], internal: "ḍo", output: "ፆ" },
    // ፈ (fa) series
    { input: ["fä"], internal: "fä", output: "ፈ" },
    { input: ["fu"], internal: "fu", output: "ፉ" },
    { input: ["fi"], internal: "fi", output: "ፊ" },
    { input: ["fa"], internal: "fa", output: "ፋ" },
    { input: ["fe"], internal: "fe", output: "ፌ" },
    { input: ["f", "fə"], internal: "f", output: "ፍ" },
    { input: ["fo"], internal: "fo", output: "ፎ" },
    // ፐ (pa) series
    { input: ["pä"], internal: "pä", output: "ፐ" },
    { input: ["pu"], internal: "pu", output: "ፑ" },
    { input: ["pi"], internal: "pi", output: "ፒ" },
    { input: ["pa"], internal: "pa", output: "ፓ" },
    { input: ["pe"], internal: "pe", output: "ፔ" },
    { input: ["p", "pə"], internal: "p", output: "ፕ" },
    { input: ["po"], internal: "po", output: "ፖ" }
];
// Build lookup maps for regular tokens only
const geezInputToInternalToken = {};
const internalToOutput = {};
for (const token of tokens) {
    for (const inputForm of token.input) {
        geezInputToInternalToken[inputForm] = token.internal;
    }
    internalToOutput[token.internal] = token.output;
}
// Build lookup maps for tokens including geminates
const geezInputToInternalTokenWithGeminates = {};
const internalToOutputWithGeminates = {};
const allTokens = [...geminateTokens, ...tokens];
for (const token of allTokens) {
    for (const inputForm of token.input) {
        geezInputToInternalTokenWithGeminates[inputForm] = token.internal;
    }
    internalToOutputWithGeminates[token.internal] = token.output;
}
// Build tries
const geezTrie = constructTrie([...Object.keys(geezInputToInternalToken)]);
const geezTrieWithGeminates = constructTrie([...Object.keys(geezInputToInternalTokenWithGeminates)]);
// Trie implementation
function trieInsert(str, stringCursor, treeCursor) {
    if (stringCursor === str.length) {
        treeCursor.token = str;
        return;
    }
    const nextChar = str[stringCursor];
    if (nextChar === undefined)
        throw new Error("Logic error");
    if (treeCursor.children[nextChar] === undefined) {
        treeCursor.children[nextChar] = { token: null, children: {} };
    }
    trieInsert(str, stringCursor + 1, treeCursor.children[nextChar]);
}
function constructTrie(strs) {
    const root = { token: null, children: {} };
    for (const str of strs) {
        trieInsert(str, 0, root);
    }
    return root;
}
function getNextToken(str, trie, startingIndex) {
    let longestToken = null;
    let trieCursor = trie;
    for (let cursor = startingIndex; cursor < str.length; cursor++) {
        const c = str[cursor];
        if (c === undefined) {
            throw new Error("Logic error");
        }
        trieCursor = trieCursor.children[c];
        if (trieCursor === undefined) {
            return longestToken;
        }
        if (trieCursor.token !== null) {
            longestToken = trieCursor.token;
        }
    }
    return longestToken;
}
function maximumMunchTokenizeGeez(str, markGeminates) {
    // Select the appropriate trie and lookup map based on markGeminates
    const selectedTrie = markGeminates ? geezTrieWithGeminates : geezTrie;
    const selectedInputToInternal = markGeminates ? geezInputToInternalTokenWithGeminates : geezInputToInternalToken;
    let strCursor = 0;
    const out = [];
    while (strCursor < str.length) {
        const tokenStr = getNextToken(str, selectedTrie, strCursor);
        if (tokenStr === null) {
            out.push({ kind: "unparseable", value: str[strCursor] });
            strCursor += 1;
        }
        else {
            const token = selectedInputToInternal[tokenStr];
            if (token === undefined) {
                throw new Error(`Logic error: ${tokenStr} is in trie but is not a valid geez token`);
            }
            out.push({ kind: "token", token: token });
            strCursor += tokenStr.length;
        }
    }
    return out;
}
function renderGeez(token, markGeminates) {
    if (token.kind === "unparseable") {
        return token.value || "";
    }
    const internal = token.token;
    if (!internal)
        return "";
    // Select the appropriate output map based on markGeminates
    const selectedInternalToOutput = markGeminates ? internalToOutputWithGeminates : internalToOutput;
    return selectedInternalToOutput[internal] || "";
}
function preprocessLatin(str, markGeminates) {
    str = str.replaceAll("ṣ́", "ḍ").replaceAll("ś", "š").replaceAll("x", "ḫ");
    str = str.toLowerCase();
    const alts = {
        "ḳ": "q",
        "š": "ś",
        "'": "ʾ",
        "3": "ʿ",
        "ʕ": "ʿ",
        "kw": "kʷ",
        "gw": "gʷ",
        "ḳʷ": "qʷ",
        "qw": "qʷ",
        "ḫw": "ḫʷ",
        "xw": "ḫʷ",
        "ā": "a",
        "ē": "e"
    };
    let allKeys = Object.keys(alts);
    for (let i = 0; i < allKeys.length; i++) {
        str = str.replaceAll(allKeys[i], alts[allKeys[i]]);
    }
    if (!markGeminates) {
        let allConsonants = ["h", "l", "ḥ", "m", "ś", "r", "s", "q", "t", "ḫ", "n", "ʾ", "k", "w", "ʿ", "z", "y", "d", "g", "ṭ", "ṗ", "ṣ", "ḍ", "f", "p"];
        for (let i = 0; i < allConsonants.length; i++) {
            let C = allConsonants[i];
            str = str.replaceAll((C + C), C);
        }
    }
    return str;
}
export function transliterateGeez(str, markGeminates) {
    str = preprocessLatin(str, markGeminates);
    const tokens = maximumMunchTokenizeGeez(str, markGeminates);
    return tokens.map(token => renderGeez(token, markGeminates)).join("");
}
export let geezSpecialChars = ["ä", "ā", "ə", "ṭ", "ḍ", "ṣ", "š", "ḥ", "ʾ", "ʿ", "ṗ"];
export function GeezDiacriticify(str, isASCII) {
    if (isASCII) {
        let ASCII2DiacriticDict = {
            "A": "ā",
            "a": "ä",
            "E": "ə",
            "1": "ə",
            "H": "ḥ",
            "c": "š",
            "3": "ʿ",
            "'": "ʾ",
            "T": "ṭ",
            "P": "ṗ",
            "S": "ṣ",
            "D": "ḍ"
        };
        let allASCII = ["A", "a", "E", "1", "H", "c", "3", "'", "T", "P", "S", "D"];
        for (let i = 0; i < allASCII.length; i++) {
            let c = allASCII[i];
            str = str.replaceAll(c, ASCII2DiacriticDict[c]);
        }
    }
    return str;
}
//# sourceMappingURL=transcribe_geez.js.map