// Product-title signals only: no invented specs, review claims, savings or stock.
// Copy is deliberately short for two-column mobile cards. No upstream calls.
const rules=[
 {kind:'powerbank',match:/行動電源|power\s*bank/i,headline:'外出多一份電力備援，不必全程依賴插座。',features:[
  [/自帶線|內建(?:充電)?線|附帶充電線|built.in cable/i,'自帶線設計，外出少帶一條獨立線材。'],
  [/(?:10000|20000|30000)\s*mAh/i,'標示電池容量，可依外出時間選擇；實際可充次數依裝置而異。'],
  [/磁吸|magsafe/i,'磁吸設計，適合搭配相容的裝置或配件。']]},
 {kind:'charger',match:/充電器|充電頭|charger/i,headline:'依裝置需求挑選充電配件，讓日常補電更方便。',features:[
  [/多孔|雙孔|三孔|四孔|[2-6]\s*(?:孔|ports?)|[2-4]C[1-3]A/i,'多孔設計，能減少攜帶多個充電器；先核對同時輸出。'],
  [/氮化鎵|\bGaN\b/i,'氮化鎵是常見的高功率密度設計，重視攜帶體積時值得比較。'],
  [/\b(?:PD|PPS)\b/i,'標示快充協議，方便對照手機或筆電的相容需求。'],
  [/(?:65|67|100|120|140|160|200|240)\s*W\b/i,'標示較高輸出功率，可優先核對筆電等裝置的充電需求。']]},
 {kind:'cable',match:/充電線|傳輸線|HDMI.*線|線材|cable/i,headline:'補足日常充電或連接需求，依使用裝置挑對線材。',features:[
  [/編織|braided/i,'編織外層，適合重視線材觸感與日常整理的人。'],
  [/(?:2|3|5)\s*(?:公尺|米|m\b)/i,'較長的線材，插座與使用位置有距離時更好安排。'],
  [/(?:60|100|140|240)\s*W\b/i,'標示線材功率，可對照裝置與充電器的額定需求。']]},
 {kind:'airfryer',match:/氣炸鍋/i,headline:'想在家做炸烤料理，少一道準備油鍋的步驟。',features:[
  [/可拆|可分離/i,'可拆式設計，料理後更方便分開清潔。'],
  [/(?:[5-9]|1[0-9])(?:\.\d+)?\s*(?:L\b|公升)/i,'較大標示容量，適合需要一次準備較多食材時比較。']]},
 {kind:'mouse',match:/無線滑鼠|藍牙滑鼠|wireless mouse/i,headline:'桌面少一條線，辦公或帶著筆電移動更方便。',features:[
  [/靜音/i,'標示靜音設計，適合希望減少按鍵聲的工作環境。'],
  [/可充電|充電式/i,'充電式設計，省去頻繁更換一次性電池的需求。']]},
 {kind:'keyboard',match:/無線鍵盤|藍牙鍵盤/i,headline:'減少桌面線材，方便調整打字位置。',features:[
  [/多裝置|多設備/i,'多裝置設計，適合需要在相容設備間切換的人。'],
  [/折疊|摺疊/i,'可折疊設計，外出攜帶時更好收納。']]},
 {kind:'stand',match:/筆電支架|手機支架|平板支架|筆記型電腦支架/i,headline:'把裝置放在更合適的位置，桌面使用更順手。',features:[
  [/可調|角度調整|升降/i,'可調設計，可依桌面空間與觀看習慣調整。'],
  [/折疊|摺疊/i,'折疊設計，不使用時方便收納。']]},
 {kind:'hub',match:/集線器|擴充基座|USB.*hub/i,headline:'連接多種周邊時，可減少反覆插拔裝置。',features:[
  [/HDMI/i,'標示 HDMI 介面，可核對外接螢幕相容性。'],
  [/讀卡|SD卡|microSD/i,'標示讀卡功能，適合需要傳輸記憶卡資料的使用情境。']]},
 {kind:'tissue',match:/衛生紙|廚房紙巾|廚房用紙/i,headline:'家庭日常消耗品，適合一起核對包裝數量與每包成本。',features:[
  [/箱購|整箱|箱裝|[1-9]\d+\s*包/i,'多包裝適合固定用量的家庭集中補貨。'],
  [/抽取式/i,'抽取式設計，放在桌面或常用位置方便取用。']]},
 {kind:'detergent',match:/洗衣精|洗碗精|洗衣膠囊|洗衣球|洗碗錠/i,headline:'日常清潔用品，依使用頻率及每次用量選購更實際。',features:[
  [/補充包/i,'補充包適合已有相容容器的人，減少重複購買瓶身的需求。'],
  [/濃縮/i,'濃縮配方可依標示用量比較每次使用成本。'],
  [/洗衣膠囊|洗衣球|洗碗錠/i,'單顆或錠狀設計，依產品建議用量取用。']]},
 {kind:'storage',match:/收納箱|收納盒|整理箱|保鮮盒|便當盒/i,headline:'把常用物品分開整理，拿取與收納更有條理。',features:[
  [/透明/i,'透明設計，找東西時不用每次打開容器確認。'],
  [/可堆疊|疊放|堆疊式/i,'可堆疊設計，適合想利用垂直收納空間的人。'],
  [/分隔|分格/i,'分隔設計，方便將不同物品分開放置。']]},
 {kind:'bottle',match:/保溫瓶|保溫杯|保溫壺/i,headline:'通勤或外出可自備飲品，減少臨時找杯子的麻煩。',features:[
  [/大容量|(?:1000|1200|1500)\s*ml\b|1\s*公升/i,'較大標示容量，適合需要攜帶較多飲品的情境。'],
  [/提把|提手|手提/i,'提把設計，外出拿取與攜帶更方便。']]},
 {kind:'diaper',match:/嬰兒尿布|紙尿褲|拉拉褲/i,headline:'依孩子體型及每天用量選購，方便安排家庭補貨。',features:[
  [/拉拉褲|褲型/i,'褲型設計，適合需要站立更換的使用情境。'],
  [/箱購|整箱|箱裝/i,'整箱包裝適合用量穩定時集中補貨。']]},
 {kind:'wipes',match:/濕紙巾|濕巾/i,headline:'放在外出包或家中常用位置，需要擦拭時方便取用。',features:[
  [/獨立包裝|單片包裝/i,'獨立包裝，外出時可依需求攜帶少量。'],
  [/加蓋|掀蓋/i,'有蓋設計，取用後方便重新閉合。']]},
 {kind:'bag',match:/垃圾袋|清潔袋|保鮮袋/i,headline:'依容器尺寸或日常用量選購，方便家庭固定補貨。',features:[
  [/抽繩|束口/i,'抽繩或束口設計，收口時更方便操作。'],
  [/手提/i,'手提設計，方便拿取與搬運。']]},
 {kind:'hanger',match:/衣架|衣褲架/i,headline:'依衣物種類整理衣櫃，日常拿取更順手。',features:[
  [/防滑/i,'標示防滑設計，適合希望減少衣物滑落的人。'],
  [/多層/i,'多層設計，適合需要集中整理多件衣物時比較。']]},
 {kind:'extension',match:/延長線|電源線組/i,headline:'插座位置不順手時，可依設備需求規劃供電位置。',features:[
  [/獨立開關/i,'獨立開關設計，方便分別控制對應插孔。'],
  [/USB/i,'標示 USB 介面，可核對日常充電裝置的需求。']]},
 {kind:'travel',match:/旅行轉接頭|旅行轉接器|萬用轉接插頭|國際轉接/i,headline:'出國前先配對目的地插座，減少抵達後臨時找轉接頭的麻煩。',features:[]},
 {kind:'vacuum',match:/掃地機器人|掃拖機器人/i,headline:'將部分日常地面清潔交給機器，減少重複掃地的工作。',features:[
  [/掃拖/i,'掃拖設計，適合希望同時安排掃地與拖地的人。']]},
 {kind:'filter',match:/濾水壺|濾芯/i,headline:'依現有設備型號選擇相容濾水用品，方便規劃更換週期。',features:[]},
 {kind:'toothbrush',match:/牙刷|刷頭/i,headline:'依日常清潔習慣選購，方便準備定期更換的備品。',features:[
  [/替換刷頭|替換頭/i,'適合已有相容牙刷主機、需要補充刷頭的人。']]},
 {kind:'dehumidifier',match:/除濕盒|除濕袋|除濕桶/i,headline:'衣櫃或收納空間需要吸濕時，可依空間與用量挑選。',features:[]}
];
// Avoid interpreting accessory/bundle/negative titles as a positive specification.
const ambiguous=/不含|不支援|不適用|非原裝|僅供|空瓶|保護套|保護殼|收納包|維修|零件|適用於|專用於|展示品|二手|另購|選購配件|替換配件/i;
export function productBenefits(product){
 const title=typeof product?.productName==='string'?product.productName.normalize('NFKC').trim():'';
 if(!title||title.length>200||ambiguous.test(title))return null;
 // Multiple different product classes can mean a bundle or an accessory: avoid guessing.
 const matches=rules.filter(r=>r.match.test(title));
 // A power bank may explicitly mention built-in charging cable, so prioritize the power bank only in that case.
 let rule=matches.length===1?matches[0]:null;
 if(matches.length===2&&matches.some(r=>r.kind==='powerbank')&&matches.some(r=>r.kind==='cable')&&/自帶線|內建(?:充電)?線/.test(title))rule=matches.find(r=>r.kind==='powerbank');
 if(!rule)return null;
 const advantages=rule.features.filter(([pattern])=>pattern.test(title)).slice(0,2).map(([,copy])=>copy);
 return {headline:rule.headline,advantages};
}
