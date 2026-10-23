// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: exclamation-triangle;

/*
 * City Unrest — a phone widget that estimates the current level of civil
 * unrest in a city from open-source news reporting.
 *
 * Runs in Scriptable (iOS). Set the widget's "Parameter" to a city, e.g.
 *   Paris
 *   Portland | Oregon                  (second part narrows ambiguous names)
 *   Portland | Oregon | United States  (third part: country for the MFA check)
 *
 * Sources (no API keys needed):
 *   - GDELT DOC 2.0 API: 7-day volume of unrest coverage mentioning the city
 *   - Google News RSS:   last-24h headlines, scored for severity, from the
 *                        city's local-language edition and in English
 *   - Singapore MFA:     the country's travel advisory / notice, and whether
 *                        it names the city
 *
 * The score is a rough signal, not ground truth. Always check the headlines.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const CONFIG = {
  defaultCity: "Paris",
  // Also read news in the city's local language (e.g. French for Paris).
  localNews: true,
  // Translate foreign-language headlines into English (via Google Translate).
  translate: true,
  // Minutes before iOS is asked to refresh the widget (iOS may delay it).
  refreshMinutes: 30,
  requestTimeoutSeconds: 15,
};

// Search terms, unrest words in 21 languages, Google News editions and city
// names. Copied from data/unrest-data.json by scripts/sync-data.js; edit that
// file, not this block.
// BEGIN GENERATED DATA
const DATA = {"international":"US:en","languages":{"en":{"match":"word","query":["protest","protesters","riot","clashes","unrest","curfew","\"tear gas\"","demonstrators","strike","looting"],"terms":{"1":["protest","protests","protested","protesting","protesters","protestors","demonstration","demonstrations","demonstrators","marchers","strike","strikes","general strike","walkout","blockade","blockades","rally","rallies","sit-in","picket","boycott","shutdown","hartal","bandh","unions","dissent"],"2":["riot","riots","rioting","rioters","clash","clashes","clashed","tear gas","teargas","looting","looted","looters","arson","set fire","torched","violent","violence","injured","wounded","arrested","arrests","detained","rubber bullets","water cannon","barricade","barricades","unrest","crackdown","mob","stampede","molotov","vandalism","uprising","insurrection"],"3":["killed","dead","deaths","death toll","shooting","shot dead","gunfire","gunmen","explosion","bombing","martial law","state of emergency","curfew","coup","massacre","live ammunition","troops deployed","army deployed","lynching"]},"calm":["peaceful","peacefully","calm returns","called off","ends","ended"]},"fr":{"match":"prefix","query":["manifestation","manifestants","émeutes","affrontements","\"gaz lacrymogène\"","grève","\"couvre-feu\"","heurts","pillages"],"terms":{"1":["manifestation","manifestant","grève","grévistes","rassemblement","blocage","cortège","mobilisation","intersyndicale","boycott","sit-in"],"2":["émeute","affrontement","heurts","lacrymogène","pillage","pillé","incendi","violence","violent","blessé","interpell","arrestation","canon à eau","barricade","troubles","répression","casseurs","molotov","saccag","insurrection","soulèvement"],"3":["tué","morts","décès","fusillade","coups de feu","explosion","attentat","loi martiale","état d'urgence","couvre-feu","coup d'état","massacre","balles réelles","armée déployée"]},"calm":["pacifique","dans le calme","annulé"]},"es":{"match":"prefix","query":["protesta","manifestación","manifestantes","disturbios","enfrentamientos","\"gas lacrimógeno\"","huelga","\"toque de queda\"","saqueos"],"terms":{"1":["protesta","manifestación","manifestante","marcha","huelga","paro nacional","bloqueo","cacerolazo","movilización","boicot","plantón"],"2":["disturbio","enfrentamiento","choques","lacrimógeno","saqueo","saquea","incendi","violen","herido","detenid","arrestad","cañón de agua","barricada","represión","vandalismo","levantamiento","insurrección","estallido"],"3":["muert","fallecid","asesinad","tiroteo","disparos","balacera","explosión","atentado","ley marcial","estado de excepción","estado de emergencia","toque de queda","golpe de estado","masacre","militariz"]},"calm":["pacífic","en calma","desconvoca"]},"pt":{"match":"prefix","query":["protesto","manifestação","manifestantes","confronto","tumulto","\"gás lacrimogêneo\"","greve","\"toque de recolher\"","saques"],"terms":{"1":["protesto","manifestação","manifestante","passeata","greve","bloqueio","mobilização","boicote","panelaço","ocupação"],"2":["tumulto","distúrbio","confronto","lacrimog","saque","saquea","incêndi","incendi","violên","violent","ferido","detid","barricada","repressão","vandalismo","revolta","quebra-quebra"],"3":["mortos","morte","assassinad","tiroteio","disparos","baleado","explosão","atentado","lei marcial","estado de emergência","estado de sítio","toque de recolher","golpe de estado","massacre","chacina"]},"calm":["pacífic","tranquil","suspens"]},"de":{"match":"prefix","query":["Protest","Demonstration","Demonstranten","Ausschreitungen","Krawalle","Tränengas","Streik","Unruhen","Ausgangssperre"],"terms":{"1":["Protest","Demonstration","Demonstrant","Kundgebung","Streik","Warnstreik","Blockade","Mahnwache","Boykott","Großdemo"],"2":["Krawall","Ausschreitung","Zusammenstöße","Zusammenstoß","Tränengas","Plünder","Brandstift","angezündet","Gewalt","gewaltsam","verletzt","Festnahme","festgenommen","Wasserwerfer","Barrikade","Unruhen","Randale","Aufstand"],"3":["getötet","Tote","Todesopfer","erschossen","Schüsse","Schießerei","Explosion","Anschlag","Kriegsrecht","Ausnahmezustand","Ausgangssperre","Putsch","Massaker"]},"calm":["friedlich","abgesagt","ruhig"]},"it":{"match":"prefix","query":["protesta","manifestazione","manifestanti","scontri","corteo","sciopero","lacrimogeni","coprifuoco","disordini"],"terms":{"1":["protest","manifestazione","manifestant","corteo","sciopero","presidio","sit-in","mobilitazione","boicott"],"2":["scontri","guerriglia","lacrimogen","saccheggi","incendi","violen","ferit","arrest","idranti","barricat","disordini","tafferugli","rivolta","molotov","devastazion"],"3":["morti","morto","uccis","sparatoria","spari","esplosione","attentato","legge marziale","stato di emergenza","coprifuoco","colpo di stato","strage","massacro"]},"calm":["pacific","senza incidenti","revocat"]},"ru":{"match":"prefix","query":["протест","митинг","беспорядки","столкновения","забастовка","демонстрация","задержаны","\"комендантский час\""],"terms":{"1":["протест","митинг","демонстрац","демонстрант","забастов","стачк","пикет","акция протеста","шестви","бойкот","перекры"],"2":["беспоряд","столкновен","слезоточив","мародер","поджог","подожгли","насили","ранен","пострадав","задержан","арест","водомет","баррикад","волнени","разгон","бунт","восстани","погром"],"3":["погиб","убит","жертв","стрельб","расстрел","взрыв","теракт","военное положение","чрезвычайное положение","режим ЧС","комендантский час","переворот","резн"]},"calm":["мирн","спокойн","отменен"]},"uk":{"match":"prefix","query":["протест","мітинг","заворушення","сутички","страйк","демонстрація","затримані","\"комендантська година\""],"terms":{"1":["протест","мітинг","демонстрац","страйк","пікет","акція протесту","бойкот","перекри"],"2":["заворушен","сутичк","зіткнен","сльозогінн","мародер","підпал","насильств","поранен","постраждал","затриман","арешт","водомет","барикад","бунт","повстан","погром"],"3":["загин","вбит","убит","жертв","стрілянин","вибух","теракт","воєнний стан","надзвичайний стан","комендантська година","переворот"]},"calm":["мирн","спокійн","скасова"]},"tr":{"match":"prefix","query":["protesto","eylem","gösteri","çatışma","\"biber gazı\"","gözaltı","grev","\"sokağa çıkma yasağı\""],"terms":{"1":["protesto","eylem","gösteri","yürüyüş","grev","miting","boykot","oturma eylemi","direniş"],"2":["çatışma","arbede","biber gazı","göz yaşartıcı","yağma","kundak","ateşe ver","şiddet","yaralan","gözaltı","tutuklan","tazyikli su","barikat","isyan","ayaklanma","provokas"],"3":["öldü","hayatını kaybet","öldürül","silahlı saldırı","ateş açıl","patlama","bombalı","sıkıyönetim","olağanüstü hal","sokağa çıkma yasağı","darbe","katliam"]},"calm":["barışçıl","sakin","iptal"]},"ar":{"match":"substring","query":["احتجاجات","مظاهرات","اشتباكات","شغب","متظاهرين","\"حظر التجول\"","إضراب","\"الغاز المسيل للدموع\""],"terms":{"1":["احتجاج","مظاهرة","مظاهرات","تظاهرة","متظاهر","محتجين","المحتجين","إضراب","اعتصام","وقفة احتجاجية","عصيان مدني"],"2":["شغب","اشتباكات","اشتباك","الغاز المسيل","نهب","إحراق","عنف","جرحى","اعتقال","خراطيم المياه","اضطرابات","قمع","انتفاضة","فوضى"],"3":["قتلى","قتيل","مقتل","مصرع","إطلاق نار","إطلاق النار","انفجار","تفجير","الأحكام العرفية","حالة الطوارئ","حظر التجول","حظر تجول","انقلاب","مجزرة","الرصاص الحي"]},"calm":["سلمي","الهدوء","إلغاء"]},"he":{"match":"substring","query":["הפגנה","מפגינים","מחאה","מהומות","עימותים","שביתה","\"גז מדמיע\""],"terms":{"1":["הפגנה","הפגנות","מפגינים","מחאה","מחאת","שביתה","עצרת","צעדה","חסימת","חסמו"],"2":["מהומות","עימותים","עימות","גז מדמיע","ביזה","הצתה","הציתו","אלימות","פצועים","נפצעו","נעצרו","מעצרים","תותח מים"],"3":["נהרגו","נהרג","הרוגים","יריות","פיצוץ","פיגוע","מצב חירום","הפיכה","טבח"]},"calm":["בשקט","בוטל"]},"id":{"match":"prefix","query":["demo","\"unjuk rasa\"","demonstrasi","kerusuhan","ricuh","bentrok","\"gas air mata\"","mogok"],"terms":{"1":["demonstrasi","unjuk rasa","aksi demo","pengunjuk rasa","massa aksi","mogok","blokade","long march","boikot"],"2":["kerusuhan","ricuh","bentrok","gas air mata","penjarahan","dijarah","dibakar","pembakaran","kekerasan","terluka","luka-luka","ditangkap","diamankan","water cannon","barikade","anarkis","huru-hara","amuk"],"3":["tewas","meninggal","korban jiwa","penembakan","ditembak","ledakan","bom","darurat militer","keadaan darurat","jam malam","kudeta","pembantaian"]},"calm":["damai","kondusif","batal"]},"th":{"match":"substring","query":["ประท้วง","ชุมนุม","ม็อบ","ปะทะ","จลาจล","\"แก๊สน้ำตา\"","\"สลายการชุมนุม\""],"terms":{"1":["ประท้วง","ชุมนุม","เดินขบวน","นัดหยุดงาน","ม็อบ","ปิดถนน","คว่ำบาตร"],"2":["จลาจล","ปะทะ","แก๊สน้ำตา","ปล้นสะดม","เผา","ความรุนแรง","บาดเจ็บ","จับกุม","ควบคุมตัว","รถฉีดน้ำ","สลายการชุมนุม","ความไม่สงบ","กระสุนยาง"],"3":["เสียชีวิต","ยิง","ระเบิด","กฎอัยการศึก","ภาวะฉุกเฉิน","เคอร์ฟิว","รัฐประหาร","สังหาร"]},"calm":["อย่างสงบ","อย่างสันติ","ยกเลิก"]},"vi":{"match":"word","query":["\"biểu tình\"","\"bạo loạn\"","\"đụng độ\"","\"đình công\"","\"hơi cay\"","\"giới nghiêm\""],"terms":{"1":["biểu tình","tuần hành","đình công","phong tỏa","tẩy chay","tụ tập"],"2":["bạo loạn","đụng độ","hơi cay","cướp phá","đốt phá","bạo lực","bị thương","bắt giữ","vòi rồng","bất ổn","trấn áp","nổi dậy"],"3":["thiệt mạng","tử vong","chết","nổ súng","xả súng","vụ nổ","đánh bom","thiết quân luật","tình trạng khẩn cấp","giới nghiêm","đảo chính","thảm sát"]},"calm":["ôn hòa","hủy bỏ"]},"ja":{"match":"substring","query":["デモ","抗議","暴動","衝突","催涙ガス","ストライキ","戒厳令"],"terms":{"1":["抗議","デモ","集会","ストライキ","座り込み","封鎖","ボイコット"],"2":["暴動","衝突","催涙","略奪","放火","暴力","負傷","逮捕","拘束","放水","バリケード","騒乱","弾圧","蜂起"],"3":["死亡","死者","殺害","銃撃","発砲","爆発","爆弾","戒厳令","非常事態","夜間外出禁止","外出禁止令","クーデター","虐殺"]},"calm":["平和的","沈静","中止"]},"ko":{"match":"substring","query":["시위","집회","폭동","충돌","파업","최루탄","계엄"],"terms":{"1":["시위","집회","파업","농성","행진","봉쇄","보이콧","규탄"],"2":["폭동","충돌","최루탄","최루가스","약탈","방화","폭력","부상자","체포","연행","물대포","바리케이드","소요","진압","봉기"],"3":["사망","숨져","숨진","총격","발포","폭발","폭탄","계엄","비상사태","통행금지","쿠데타","학살"]},"calm":["평화적","평화롭게","취소"]},"zh":{"match":"substring","query":["抗議","抗议","示威","遊行","游行","衝突","冲突","罷工","罢工","催淚","催泪"],"terms":{"1":["抗議","抗议","示威","遊行","游行","集會","集会","罷工","罢工","靜坐","静坐","杯葛","抵制"],"2":["暴動","暴动","暴亂","暴乱","衝突","冲突","催淚","催泪","搶劫","抢劫","縱火","纵火","暴力","受傷","受伤","逮捕","拘捕","水炮","水砲","騷亂","骚乱","鎮壓","镇压","起義","起义"],"3":["死亡","喪生","丧生","罹難","遇难","槍擊","枪击","開槍","开枪","爆炸","戒嚴","戒严","緊急狀態","紧急状态","宵禁","政變","政变","屠殺","屠杀"]},"calm":["和平","平靜","平静","取消"]},"hi":{"match":"prefix","query":["प्रदर्शन","हिंसा","झड़प","दंगा","हड़ताल","\"आंसू गैस\"","कर्फ्यू","पथराव"],"terms":{"1":["प्रदर्शन","प्रदर्शनकारी","विरोध प्रदर्शन","धरना","हड़ताल","रैली","बहिष्कार","चक्का जाम"],"2":["दंगा","दंगे","हिंसा","हिंसक","झड़प","आंसू गैस","लूटपाट","आगजनी","घायल","गिरफ्तार","हिरासत","वाटर कैनन","बवाल","उपद्रव","पथराव","लाठीचार्ज","अशांति"],"3":["मौत","मारे गए","हत्या","गोलीबारी","फायरिंग","विस्फोट","धमाका","मार्शल लॉ","आपातकाल","कर्फ्यू","तख्तापलट","नरसंहार"]},"calm":["शांतिपूर्ण","रद्द"]},"el":{"match":"prefix","query":["διαδήλωση","διαδηλωτές","επεισόδια","απεργία","δακρυγόνα","συλλαλητήριο"],"terms":{"1":["διαδήλωσ","διαδηλωτ","συλλαλητήρι","απεργ","κινητοποιήσ","κατάληψ","μποϊκοτάζ"],"2":["επεισόδι","συμπλοκ","δακρυγόνα","λεηλασί","εμπρησμ","βία","τραυματ","συλλήψ","συνελήφθ","αύρα","οδόφραγμ","ταραχ","μολότοφ","εξέγερσ"],"3":["νεκρ","σκοτώθηκ","πυροβολισμ","έκρηξη","βόμβα","στρατιωτικός νόμος","κατάσταση έκτακτης ανάγκης","απαγόρευση κυκλοφορίας","πραξικόπημα","σφαγή"]},"calm":["ειρηνικ","ήρεμ","ακυρώθηκ"]},"pl":{"match":"prefix","query":["protest","demonstracja","manifestacja","zamieszki","starcia","strajk","\"gaz łzawiący\""],"terms":{"1":["protest","demonstracj","demonstrant","manifestacj","strajk","pikiet","blokad","bojkot"],"2":["zamieszki","starci","gaz łzawiący","grabież","podpal","przemoc","ranny","ranni","zatrzyman","aresztowan","armatki wodn","barykad","rozruch","niepokoje","powstani"],"3":["zginęł","zabit","ofiar","strzelanin","wybuch","eksplozj","zamach","stan wojenny","stan wyjątkowy","godzina policyjna","przewrót","masakr"]},"calm":["pokojow","spokojn","odwołan"]},"nl":{"match":"prefix","query":["protest","demonstratie","betoging","rellen","traangas","staking","onrust","avondklok"],"terms":{"1":["protest","demonstratie","demonstrant","betoging","betoger","staking","blokkade","boycot","manifestatie"],"2":["rellen","relschoppers","ongeregeldheden","botsing","traangas","plunder","brandstichting","in brand gestoken","geweld","gewond","gearresteerd","aanhouding","opgepakt","waterkanon","barricade","onrust","opstand"],"3":["doden","gedood","omgekomen","schietpartij","beschoten","explosie","aanslag","staat van beleg","noodtoestand","avondklok","staatsgreep","bloedbad"]},"calm":["vreedzaam","rustig","afgelast"]}},"editions":{"US:en":{"hl":"en-US","gl":"US","lang":"en"},"GB:en":{"hl":"en-GB","gl":"GB","lang":"en"},"IE:en":{"hl":"en-IE","gl":"IE","lang":"en"},"AU:en":{"hl":"en-AU","gl":"AU","lang":"en"},"NZ:en":{"hl":"en-NZ","gl":"NZ","lang":"en"},"CA:en":{"hl":"en-CA","gl":"CA","lang":"en"},"IN:en":{"hl":"en-IN","gl":"IN","lang":"en"},"KE:en":{"hl":"en-KE","gl":"KE","lang":"en"},"NG:en":{"hl":"en-NG","gl":"NG","lang":"en"},"ZA:en":{"hl":"en-ZA","gl":"ZA","lang":"en"},"GH:en":{"hl":"en-GH","gl":"GH","lang":"en"},"UG:en":{"hl":"en-UG","gl":"UG","lang":"en"},"TZ:en":{"hl":"en-TZ","gl":"TZ","lang":"en"},"ZW:en":{"hl":"en-ZW","gl":"ZW","lang":"en"},"PK:en":{"hl":"en-PK","gl":"PK","lang":"en"},"BD:en":{"hl":"en-BD","gl":"BD","lang":"en"},"PH:en":{"hl":"en-PH","gl":"PH","lang":"en"},"SG:en":{"hl":"en-SG","gl":"SG","lang":"en"},"MY:en":{"hl":"en-MY","gl":"MY","lang":"en"},"ET:en":{"hl":"en-ET","gl":"ET","lang":"en"},"IL:en":{"hl":"en-IL","gl":"IL","lang":"en"},"FR:fr":{"hl":"fr","gl":"FR","lang":"fr"},"BE:fr":{"hl":"fr","gl":"BE","lang":"fr"},"CH:fr":{"hl":"fr-CH","gl":"CH","lang":"fr"},"CA:fr":{"hl":"fr-CA","gl":"CA","lang":"fr"},"MA:fr":{"hl":"fr","gl":"MA","lang":"fr"},"SN:fr":{"hl":"fr","gl":"SN","lang":"fr"},"DE:de":{"hl":"de","gl":"DE","lang":"de"},"AT:de":{"hl":"de-AT","gl":"AT","lang":"de"},"CH:de":{"hl":"de-CH","gl":"CH","lang":"de"},"ES:es":{"hl":"es","gl":"ES","lang":"es"},"US:es-419":{"hl":"es-419","gl":"US","lang":"es"},"MX:es-419":{"hl":"es-419","gl":"MX","lang":"es"},"AR:es-419":{"hl":"es-419","gl":"AR","lang":"es"},"CO:es-419":{"hl":"es-419","gl":"CO","lang":"es"},"CL:es-419":{"hl":"es-419","gl":"CL","lang":"es"},"PE:es-419":{"hl":"es-419","gl":"PE","lang":"es"},"VE:es-419":{"hl":"es-419","gl":"VE","lang":"es"},"CU:es-419":{"hl":"es-419","gl":"CU","lang":"es"},"BR:pt-419":{"hl":"pt-BR","gl":"BR","lang":"pt"},"PT:pt-150":{"hl":"pt-PT","gl":"PT","lang":"pt"},"IT:it":{"hl":"it","gl":"IT","lang":"it"},"RU:ru":{"hl":"ru","gl":"RU","lang":"ru"},"UA:uk":{"hl":"uk","gl":"UA","lang":"uk"},"TR:tr":{"hl":"tr","gl":"TR","lang":"tr"},"EG:ar":{"hl":"ar","gl":"EG","lang":"ar"},"SA:ar":{"hl":"ar","gl":"SA","lang":"ar"},"AE:ar":{"hl":"ar","gl":"AE","lang":"ar"},"LB:ar":{"hl":"ar","gl":"LB","lang":"ar"},"IL:he":{"hl":"he","gl":"IL","lang":"he"},"ID:id":{"hl":"id","gl":"ID","lang":"id"},"TH:th":{"hl":"th","gl":"TH","lang":"th"},"VN:vi":{"hl":"vi","gl":"VN","lang":"vi"},"JP:ja":{"hl":"ja","gl":"JP","lang":"ja"},"KR:ko":{"hl":"ko","gl":"KR","lang":"ko"},"TW:zh-Hant":{"hl":"zh-TW","gl":"TW","lang":"zh"},"HK:zh-Hant":{"hl":"zh-HK","gl":"HK","lang":"zh"},"CN:zh-Hans":{"hl":"zh-CN","gl":"CN","lang":"zh"},"IN:hi":{"hl":"hi","gl":"IN","lang":"hi"},"GR:el":{"hl":"el","gl":"GR","lang":"el"},"PL:pl":{"hl":"pl","gl":"PL","lang":"pl"},"NL:nl":{"hl":"nl","gl":"NL","lang":"nl"},"BE:nl":{"hl":"nl","gl":"BE","lang":"nl"}},"countries":{"united states":["US:en"],"united kingdom":["GB:en"],"ireland":["IE:en"],"australia":["AU:en"],"new zealand":["NZ:en"],"canada":["CA:en"],"india":["IN:hi","IN:en"],"kenya":["KE:en"],"nigeria":["NG:en"],"south africa":["ZA:en"],"ghana":["GH:en"],"uganda":["UG:en"],"tanzania":["TZ:en"],"zimbabwe":["ZW:en"],"pakistan":["PK:en"],"bangladesh":["BD:en"],"philippines":["PH:en"],"singapore":["SG:en"],"malaysia":["MY:en"],"ethiopia":["ET:en"],"israel":["IL:he","IL:en"],"france":["FR:fr"],"belgium":["BE:fr","BE:nl"],"switzerland":["CH:de"],"morocco":["MA:fr","EG:ar"],"senegal":["SN:fr"],"algeria":["FR:fr","EG:ar"],"tunisia":["FR:fr","EG:ar"],"cote d ivoire":["FR:fr"],"haiti":["FR:fr"],"democratic republic of the congo":["FR:fr"],"madagascar":["FR:fr"],"new caledonia":["FR:fr"],"germany":["DE:de"],"austria":["AT:de"],"spain":["ES:es"],"mexico":["MX:es-419"],"argentina":["AR:es-419"],"colombia":["CO:es-419"],"chile":["CL:es-419"],"peru":["PE:es-419"],"venezuela":["VE:es-419"],"cuba":["CU:es-419"],"ecuador":["US:es-419"],"bolivia":["US:es-419"],"uruguay":["US:es-419"],"brazil":["BR:pt-419"],"portugal":["PT:pt-150"],"angola":["PT:pt-150"],"mozambique":["PT:pt-150"],"italy":["IT:it"],"russia":["RU:ru"],"ukraine":["UA:uk"],"turkiye":["TR:tr"],"egypt":["EG:ar"],"saudi arabia":["SA:ar"],"united arab emirates":["AE:ar"],"lebanon":["LB:ar"],"jordan":["EG:ar"],"syria":["LB:ar"],"iraq":["EG:ar"],"qatar":["SA:ar"],"kuwait":["SA:ar"],"oman":["SA:ar"],"yemen":["SA:ar"],"libya":["EG:ar"],"sudan":["EG:ar"],"indonesia":["ID:id"],"thailand":["TH:th"],"viet nam":["VN:vi"],"japan":["JP:ja"],"korea":["KR:ko"],"taiwan":["TW:zh-Hant"],"hong kong":["HK:zh-Hant"],"china":["CN:zh-Hans"],"greece":["GR:el"],"poland":["PL:pl"],"netherlands":["NL:nl"]},"aliases":{"usa":"united states","us":"united states","america":"united states","uk":"united kingdom","britain":"united kingdom","great britain":"united kingdom","england":"united kingdom","scotland":"united kingdom","wales":"united kingdom","turkey":"turkiye","south korea":"korea","ivory coast":"cote d ivoire","czech republic":"czechia","burma":"myanmar","holland":"netherlands","uae":"united arab emirates","drc":"democratic republic of the congo","east timor":"timor leste","vietnam":"viet nam","laos":"lao"},"cities":{"paris":{"country":"france"},"lyon":{"country":"france"},"marseille":{"country":"france"},"london":{"country":"united kingdom"},"manchester":{"country":"united kingdom"},"birmingham":{"country":"united kingdom"},"glasgow":{"country":"united kingdom"},"belfast":{"country":"united kingdom"},"dublin":{"country":"ireland"},"berlin":{"country":"germany"},"hamburg":{"country":"germany"},"munich":{"country":"germany","names":["München"]},"frankfurt":{"country":"germany"},"madrid":{"country":"spain"},"barcelona":{"country":"spain"},"lisbon":{"country":"portugal","names":["Lisboa"]},"rome":{"country":"italy","names":["Roma"]},"milan":{"country":"italy","names":["Milano"]},"naples":{"country":"italy","names":["Napoli"]},"athens":{"country":"greece","names":["Αθήνα","Αθήνας"]},"amsterdam":{"country":"netherlands","editions":["NL:nl"]},"brussels":{"country":"belgium","names":["Bruxelles","Brussel"],"editions":["BE:fr"]},"vienna":{"country":"austria","names":["Wien"]},"zurich":{"country":"switzerland","names":["Zürich"]},"geneva":{"country":"switzerland","names":["Genève"],"editions":["CH:fr"]},"stockholm":{"country":"sweden"},"oslo":{"country":"norway"},"copenhagen":{"country":"denmark"},"helsinki":{"country":"finland"},"warsaw":{"country":"poland","names":["Warszawa","Warszawie"]},"prague":{"country":"czechia"},"budapest":{"country":"hungary"},"bucharest":{"country":"romania"},"belgrade":{"country":"serbia"},"sofia":{"country":"bulgaria"},"kyiv":{"country":"ukraine","names":["Київ","Києві","Києва","Киев"]},"kiev":{"country":"ukraine","names":["Київ","Києві","Києва","Киев"]},"moscow":{"country":"russia","names":["Москва","Москве","Москвы","Москву"]},"st petersburg":{"country":"russia","names":["Петербург","Петербурге"]},"tbilisi":{"country":"georgia"},"yerevan":{"country":"armenia"},"baku":{"country":"azerbaijan"},"istanbul":{"country":"turkiye","names":["İstanbul"]},"ankara":{"country":"turkiye"},"tel aviv":{"country":"israel","names":["תל אביב"]},"jerusalem":{"country":"israel","names":["ירושלים"]},"beirut":{"country":"lebanon","names":["بيروت"]},"amman":{"country":"jordan"},"damascus":{"country":"syria","names":["دمشق"]},"baghdad":{"country":"iraq","names":["بغداد"]},"tehran":{"country":"iran"},"riyadh":{"country":"saudi arabia","names":["الرياض"]},"jeddah":{"country":"saudi arabia","names":["جدة"]},"dubai":{"country":"united arab emirates","names":["دبي"]},"abu dhabi":{"country":"united arab emirates","names":["أبوظبي","أبو ظبي"]},"doha":{"country":"qatar","names":["الدوحة"]},"kuwait city":{"country":"kuwait"},"muscat":{"country":"oman","names":["مسقط"]},"sanaa":{"country":"yemen","names":["صنعاء"]},"cairo":{"country":"egypt","names":["القاهرة"]},"alexandria":{"country":"egypt","names":["الإسكندرية"]},"tunis":{"country":"tunisia","names":["تونس"]},"algiers":{"country":"algeria","names":["Alger","الجزائر"]},"tripoli":{"country":"libya","names":["طرابلس"]},"casablanca":{"country":"morocco","names":["الدار البيضاء"]},"rabat":{"country":"morocco","names":["الرباط"]},"khartoum":{"country":"sudan","names":["الخرطوم"]},"addis ababa":{"country":"ethiopia"},"nairobi":{"country":"kenya"},"mombasa":{"country":"kenya"},"kampala":{"country":"uganda"},"kigali":{"country":"rwanda"},"dar es salaam":{"country":"tanzania"},"lagos":{"country":"nigeria"},"abuja":{"country":"nigeria"},"accra":{"country":"ghana"},"dakar":{"country":"senegal"},"abidjan":{"country":"cote d ivoire","names":["Abidjan"]},"kinshasa":{"country":"democratic republic of the congo","names":["Kinshasa"]},"luanda":{"country":"angola"},"johannesburg":{"country":"south africa"},"cape town":{"country":"south africa"},"durban":{"country":"south africa"},"pretoria":{"country":"south africa"},"harare":{"country":"zimbabwe"},"maputo":{"country":"mozambique"},"antananarivo":{"country":"madagascar"},"new york":{"country":"united states"},"washington":{"country":"united states"},"los angeles":{"country":"united states"},"chicago":{"country":"united states"},"san francisco":{"country":"united states"},"seattle":{"country":"united states"},"boston":{"country":"united states"},"miami":{"country":"united states"},"atlanta":{"country":"united states"},"minneapolis":{"country":"united states"},"houston":{"country":"united states"},"toronto":{"country":"canada"},"montreal":{"country":"canada","names":["Montréal"],"editions":["CA:fr"]},"vancouver":{"country":"canada"},"ottawa":{"country":"canada"},"mexico city":{"country":"mexico","names":["Ciudad de México","CDMX"]},"guadalajara":{"country":"mexico"},"havana":{"country":"cuba","names":["La Habana"]},"port-au-prince":{"country":"haiti","names":["Port-au-Prince"]},"bogota":{"country":"colombia","names":["Bogotá"]},"medellin":{"country":"colombia","names":["Medellín"]},"caracas":{"country":"venezuela"},"quito":{"country":"ecuador"},"lima":{"country":"peru"},"la paz":{"country":"bolivia"},"santiago":{"country":"chile"},"buenos aires":{"country":"argentina"},"sao paulo":{"country":"brazil","names":["São Paulo"]},"rio de janeiro":{"country":"brazil"},"brasilia":{"country":"brazil","names":["Brasília"]},"montevideo":{"country":"uruguay"},"karachi":{"country":"pakistan"},"lahore":{"country":"pakistan"},"islamabad":{"country":"pakistan"},"kabul":{"country":"afghanistan"},"delhi":{"country":"india","names":["दिल्ली"]},"new delhi":{"country":"india","names":["नई दिल्ली","दिल्ली"]},"mumbai":{"country":"india","names":["मुंबई"]},"kolkata":{"country":"india","names":["कोलकाता"]},"chennai":{"country":"india","names":["चेन्नई"]},"bangalore":{"country":"india","names":["बेंगलुरु"]},"bengaluru":{"country":"india","names":["बेंगलुरु"]},"hyderabad":{"country":"india","names":["हैदराबाद"]},"dhaka":{"country":"bangladesh"},"colombo":{"country":"sri lanka"},"kathmandu":{"country":"nepal"},"male":{"country":"maldives"},"yangon":{"country":"myanmar"},"mandalay":{"country":"myanmar"},"bangkok":{"country":"thailand","names":["กรุงเทพ"]},"chiang mai":{"country":"thailand","names":["เชียงใหม่"]},"phnom penh":{"country":"cambodia"},"vientiane":{"country":"lao"},"hanoi":{"country":"viet nam","names":["Hà Nội"]},"ho chi minh city":{"country":"viet nam","names":["TP.HCM","Hồ Chí Minh","Sài Gòn"]},"kuala lumpur":{"country":"malaysia"},"johor bahru":{"country":"malaysia"},"penang":{"country":"malaysia"},"jakarta":{"country":"indonesia"},"bali":{"country":"indonesia"},"denpasar":{"country":"indonesia"},"surabaya":{"country":"indonesia"},"manila":{"country":"philippines"},"cebu":{"country":"philippines"},"davao":{"country":"philippines"},"hong kong":{"country":"hong kong","names":["香港"]},"taipei":{"country":"taiwan","names":["台北","臺北"]},"beijing":{"country":"china","names":["北京"]},"shanghai":{"country":"china","names":["上海"]},"guangzhou":{"country":"china","names":["广州","廣州"]},"shenzhen":{"country":"china","names":["深圳"]},"chengdu":{"country":"china","names":["成都"]},"tokyo":{"country":"japan","names":["東京"]},"osaka":{"country":"japan","names":["大阪"]},"seoul":{"country":"korea","names":["서울"]},"busan":{"country":"korea","names":["부산"]},"ulaanbaatar":{"country":"mongolia"},"sydney":{"country":"australia"},"melbourne":{"country":"australia"},"brisbane":{"country":"australia"},"perth":{"country":"australia"},"auckland":{"country":"new zealand"},"wellington":{"country":"new zealand"},"port moresby":{"country":"papua new guinea"},"noumea":{"country":"new caledonia"},"suva":{"country":"fiji"}},"countryNames":{"afghanistan":["afghanistan","afghan","afghans","taliban"],"albania":["albania","albanian"],"algeria":["algeria","algerian"],"angola":["angola","angolan"],"argentina":["argentina","argentine","argentinian"],"armenia":["armenia","armenian"],"australia":["australia","australian"],"austria":["austria","austrian"],"azerbaijan":["azerbaijan","azerbaijani"],"bahrain":["bahrain","bahraini"],"bangladesh":["bangladesh","bangladeshi"],"belarus":["belarus","belarusian"],"belgium":["belgium","belgian"],"bolivia":["bolivia","bolivian"],"bosnia":["bosnia","bosnian"],"brazil":["brazil","brazilian","brasil"],"bulgaria":["bulgaria","bulgarian"],"burkina faso":["burkina faso","burkinabe"],"cambodia":["cambodia","cambodian"],"cameroon":["cameroon","cameroonian"],"canada":["canada","canadian"],"chile":["chile","chilean"],"china":["china","chinese","beijing's"],"colombia":["colombia","colombian"],"cote d ivoire":["ivory coast","ivorian","cote d'ivoire"],"croatia":["croatia","croatian"],"cuba":["cuba","cuban"],"cyprus":["cyprus","cypriot"],"czechia":["czechia","czech republic","czech"],"democratic republic of the congo":["congo","congolese","drc"],"denmark":["denmark","danish"],"ecuador":["ecuador","ecuadorian","ecuadorean"],"egypt":["egypt","egyptian"],"el salvador":["el salvador","salvadoran"],"eritrea":["eritrea","eritrean"],"estonia":["estonia","estonian"],"ethiopia":["ethiopia","ethiopian"],"fiji":["fiji","fijian"],"finland":["finland","finnish"],"france":["france","french"],"gabon":["gabon","gabonese"],"georgia":["georgian"],"germany":["germany","german"],"ghana":["ghana","ghanaian"],"greece":["greece","greek"],"guatemala":["guatemala","guatemalan"],"guinea":["guinea","guinean"],"haiti":["haiti","haitian"],"honduras":["honduras","honduran"],"hong kong":["hong kong"],"hungary":["hungary","hungarian"],"india":["india","indian"],"indonesia":["indonesia","indonesian"],"iran":["iran","iranian"],"iraq":["iraq","iraqi"],"ireland":["ireland","irish"],"israel":["israel","israeli","israelis"],"italy":["italy","italian"],"jamaica":["jamaica","jamaican"],"japan":["japan","japanese"],"jordan":["jordanian"],"kazakhstan":["kazakhstan","kazakh"],"kenya":["kenya","kenyan"],"korea":["south korea","korea","korean","north korea"],"kosovo":["kosovo"],"kuwait":["kuwait","kuwaiti"],"kyrgyzstan":["kyrgyzstan","kyrgyz"],"lao":["laos"],"latvia":["latvia","latvian"],"lebanon":["lebanon","lebanese"],"libya":["libya","libyan"],"lithuania":["lithuania","lithuanian"],"madagascar":["madagascar","malagasy"],"malawi":["malawi","malawian"],"malaysia":["malaysia","malaysian"],"maldives":["maldives","maldivian"],"mali":["mali","malian"],"mexico":["mexico","mexican"],"moldova":["moldova","moldovan"],"mongolia":["mongolia","mongolian"],"morocco":["morocco","moroccan"],"mozambique":["mozambique","mozambican"],"myanmar":["myanmar","burma","burmese"],"nepal":["nepal","nepali","nepalese"],"netherlands":["netherlands","dutch","holland"],"new caledonia":["new caledonia"],"new zealand":["new zealand"],"nicaragua":["nicaragua","nicaraguan"],"niger":["niger","nigerien"],"nigeria":["nigeria","nigerian"],"norway":["norway","norwegian"],"oman":["oman","omani"],"pakistan":["pakistan","pakistani"],"palestinian territories":["palestine","palestinian","palestinians","gaza","west bank"],"panama":["panama","panamanian"],"papua new guinea":["papua new guinea"],"paraguay":["paraguay","paraguayan"],"peru":["peru","peruvian"],"philippines":["philippines","filipino","philippine"],"poland":["poland","polish"],"portugal":["portugal","portuguese"],"qatar":["qatar","qatari"],"romania":["romania","romanian"],"russia":["russia","russian","russians","kremlin"],"rwanda":["rwanda","rwandan"],"saudi arabia":["saudi arabia","saudi"],"senegal":["senegal","senegalese"],"serbia":["serbia","serbian"],"singapore":["singapore","singaporean"],"slovakia":["slovakia","slovak"],"somalia":["somalia","somali"],"south africa":["south africa","south african"],"south sudan":["south sudan"],"spain":["spain","spanish"],"sri lanka":["sri lanka","sri lankan"],"sudan":["sudan","sudanese"],"sweden":["sweden","swedish"],"switzerland":["switzerland","swiss"],"syria":["syria","syrian"],"taiwan":["taiwan","taiwanese"],"tajikistan":["tajikistan","tajik"],"tanzania":["tanzania","tanzanian"],"thailand":["thailand"],"timor leste":["timor-leste","east timor"],"togo":["togo","togolese"],"tunisia":["tunisia","tunisian"],"turkiye":["turkiye","türkiye","turkish"],"uganda":["uganda","ugandan"],"ukraine":["ukraine","ukrainian"],"united arab emirates":["united arab emirates","uae","emirati"],"united kingdom":["united kingdom","britain","british","uk"],"united states":["united states","u.s.","american","americans","white house","trump administration"],"uruguay":["uruguay","uruguayan"],"uzbekistan":["uzbekistan","uzbek"],"venezuela":["venezuela","venezuelan","venezuelans"],"viet nam":["vietnam","viet nam","vietnamese"],"yemen":["yemen","yemeni","houthi","houthis"],"zambia":["zambia","zambian"],"zimbabwe":["zimbabwe","zimbabwean"]},"notForeign":["male","lima","la paz","santiago","sofia"]};
// END GENERATED DATA

const LEVELS = [
  { min: 75, name: "Severe", color: "#FF3B30" },
  { min: 55, name: "High", color: "#FF9500" },
  { min: 35, name: "Elevated", color: "#FFCC00" },
  { min: 15, name: "Low", color: "#A3D65C" },
  { min: 0, name: "Calm", color: "#34C759" },
];

// Singapore Ministry of Foreign Affairs country travel pages.
const MFA_BASE = "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/";

// MFA advice levels, most serious first.
const MFA_LEVELS = {
  "defer-all": { label: "Defer all travel", color: "#FF3B30", rank: 4 },
  "defer-non-essential": { label: "Defer non-essential travel", color: "#FF9500", rank: 3 },
  caution: { label: "Exercise caution", color: "#FFCC00", rank: 2 },
  notice: { label: "Travel notice", color: "#FFCC00", rank: 1 },
  none: { label: "No advisory", color: "#34C759", rank: 0 },
  unreadable: { label: "Check MFA page", color: "#8E8E93", rank: -1 },
};

// ---------------------------------------------------------------------------
// Core logic (pure functions; also used by the tests and the command-line tool)
// ---------------------------------------------------------------------------

// Only plain web links may be opened. Feed data is untrusted, and other
// schemes (shortcuts://, file:, javascript:) could do more than open a page.
function safeUrl(u) {
  const s = String(u || "").trim();
  return /^https?:\/\/[^\s"<>]+$/i.test(s) ? s : "";
}

// MFA links must point at MFA's own site.
function isMfaUrl(u) {
  return /^https:\/\/(www\.)?mfa\.gov\.sg\//i.test(safeUrl(u));
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// Lowercase without accents, so "Bogotá" matches "BOGOTA". Only Latin, Greek
// and Cyrillic accents are removed; marks that other scripts need are kept.
function fold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function cityInfo(city) {
  return DATA.cities[fold(city).trim()] || null;
}

// "City", "City | context" or "City | context | country".
// The city may list other spellings after "/", e.g. "Moscow / Москва".
// The country (for the MFA check and local news) is the third part, else
// the second part, else looked up from the built-in city list.
function parseParam(raw) {
  const text = String(raw || "").trim() || CONFIG.defaultCity;
  const [cityPart, context, country] = text.split("|").map((s) => s.trim());
  const [city, ...names] = (cityPart || CONFIG.defaultCity).split("/").map((s) => s.trim()).filter(Boolean);
  const c = city || CONFIG.defaultCity;
  const info = cityInfo(c);
  return {
    city: c,
    names,
    context: context || "",
    country: country || context || (info ? info.country : ""),
  };
}

// Every spelling to search for: the city, the user's extra names, built-in local names.
function allNames(city, names = []) {
  const info = cityInfo(city);
  const out = [city, ...names, ...((info && info.names) || [])];
  return out.filter((n, i) => out.findIndex((m) => fold(m) === fold(n)) === i);
}

// Google News editions to read: the city's or country's local editions
// (up to two), plus the international English edition when none is English.
function editionsFor(city, country, localNews = CONFIG.localNews) {
  const info = cityInfo(city);
  let local = [];
  if (localNews) {
    local = (info && info.editions) || DATA.countries[mfaCountryName(country)] || [];
    local = local.filter((e) => DATA.editions[e]).slice(0, 2);
  }
  const hasEnglish = local.some((e) => DATA.editions[e].lang === "en");
  return hasEnglish ? local : [...local, DATA.international];
}

function quoteTerm(s) {
  return `"${s.replace(/"/g, "")}"`;
}

function cityQuery(names) {
  return names.length > 1 ? `(${names.map(quoteTerm).join(" OR ")})` : quoteTerm(names[0]);
}

function newsQuery(names, context, lang) {
  const terms = DATA.languages[lang].query;
  return `${cityQuery(names)}${context ? " " + quoteTerm(context) : ""} (${terms.join(" OR ")})`;
}

// GDELT translates foreign-language news, so English names and terms cover all languages.
function gdeltTimelineUrl(city, context) {
  return (
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=timelinevolraw&format=json" +
    "&timespan=7d&timelinesmooth=0&query=" + encodeURIComponent(newsQuery([city], context, "en"))
  );
}

function gdeltArticlesUrl(city, context) {
  return (
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json" +
    "&timespan=24h&maxrecords=75&sort=datedesc&query=" + encodeURIComponent(newsQuery([city], context, "en"))
  );
}

function editionParams(ceid) {
  const e = DATA.editions[ceid];
  return `&hl=${e.hl}&gl=${e.gl}&ceid=${ceid}`;
}

// English-language editions search the English name; local editions search all spellings.
function editionNames(names, ceid) {
  return DATA.editions[ceid].lang === "en" ? names.slice(0, 1) : names;
}

function googleNewsRssUrl(names, context, ceid) {
  const q = newsQuery(editionNames(names, ceid), context, DATA.editions[ceid].lang) + " when:1d";
  return "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + editionParams(ceid);
}

function googleNewsWebUrl(names, context, ceid = DATA.international) {
  const q = newsQuery(editionNames(names, ceid), context, DATA.editions[ceid].lang) + " when:1d";
  return "https://news.google.com/search?q=" + encodeURIComponent(q) + editionParams(ceid);
}

// GDELT dates look like 20261022T101500Z.
function parseGdeltDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/.exec(String(s || ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tagText(xml, tag) {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return m ? decodeEntities(m[1]) : "";
}

// Minimal RSS parser (Scriptable has no DOMParser).
function parseRss(xml) {
  const items = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    let title = tagText(body, "title");
    let source = tagText(body, "source");
    // Google News titles end with " - Source Name".
    if (source && title.endsWith(" - " + source)) {
      title = title.slice(0, -(" - " + source).length).trim();
    } else if (!source) {
      const i = title.lastIndexOf(" - ");
      if (i > 0) {
        source = title.slice(i + 3).trim();
        title = title.slice(0, i).trim();
      }
    }
    const pub = Date.parse(tagText(body, "pubDate"));
    items.push({
      title,
      source: source || "Unknown",
      url: safeUrl(tagText(body, "link")),
      date: isNaN(pub) ? null : new Date(pub),
    });
  }
  return items;
}

function parseGdeltArticles(json) {
  const list = (json && json.articles) || [];
  return list.map((a) => ({
    title: decodeEntities(a.title),
    source: a.domain || "Unknown",
    url: safeUrl(a.url),
    date: parseGdeltDate(a.seendate),
  }));
}

// Turns a GDELT raw volume timeline into last-24h vs. prior-6-day numbers.
function summarizeTimeline(json, now) {
  const series = (json && json.timeline && json.timeline[0] && json.timeline[0].data) || [];
  if (!series.length) return null;
  const nowMs = now.getTime();
  const DAY = 24 * 3600 * 1000;
  const daily = [0, 0, 0, 0, 0, 0, 0]; // oldest .. newest (last 24h)
  for (const point of series) {
    const d = parseGdeltDate(point.date);
    if (!d) continue;
    const ageDays = Math.floor((nowMs - d.getTime()) / DAY);
    if (ageDays < 0 || ageDays > 6) continue;
    daily[6 - ageDays] += Number(point.value) || 0;
  }
  const last24h = daily[6];
  const baseline = daily.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  return { last24h, baseline, daily };
}

// ---- Singapore MFA travel advisories ----

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mfaCountryName(country) {
  const n = normalizeName(country);
  return DATA.aliases[n] || n;
}

function mfaCountryUrl(country) {
  return MFA_BASE + mfaCountryName(country).replace(/ /g, "-") + "/";
}

function htmlToText(html) {
  let h = String(html || "");
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(h) || /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(h);
  if (main) h = main[1];
  return decodeEntities(
    h
      .replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Finds the country's travel page among the links on MFA's index page.
function findMfaCountryLink(indexHtml, country) {
  const want = mfaCountryName(country);
  const re = /<a\b[^>]*href="([^"]*travel-advisories-notices-and-visa-information\/([a-z0-9-]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
  let best = null;
  let m;
  while ((m = re.exec(indexHtml))) {
    const slug = m[2].replace(/-/g, " ");
    const text = normalizeName(decodeEntities(m[3].replace(/<[^>]+>/g, " ")));
    let score = 0;
    if (text === want || slug === want) score = 3;
    else if (new RegExp(`(^| )${escapeRegex(want)}( |$)`).test(slug + " | " + text)) score = 2;
    if (score > (best ? best.score : 0)) {
      const href = /^https?:/i.test(m[1]) ? m[1] : "https://www.mfa.gov.sg" + (m[1].startsWith("/") ? "" : "/") + m[1];
      if (isMfaUrl(href)) best = { score, url: href };
    }
  }
  return best ? best.url : null;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`\\b(\\d{1,2}) (${MONTHS}) (20\\d\\d)\\b`, "gi");

function parseMfaPage(html, city, url) {
  const text = htmlToText(html);
  const result = { status: "unreadable", date: null, summary: "", mentionsCity: false, cityNote: "", url };
  if (text.length < 200) return result;

  const sentences = text.replace(/([.!?])\s+/g, "$1\n").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const rules = [
    ["defer-all", /\bdefer all travel\b/i],
    ["defer-non-essential", /\bdefer (all )?non-essential travel\b/i],
    ["caution", /\b(exercise|remain|stay|be)( extra| heightened| increased| high degree of)? (caution|vigilant|vigilance|alert)\b|\bavoid (large )?(crowds|gatherings|protests|demonstrations)\b/i],
    ["notice", /\btravel notice\b/i],
  ];
  let hit = null;
  for (const [status, re] of rules) {
    const s = sentences.find((x) => re.test(x));
    if (s) {
      hit = { status, sentence: s };
      break;
    }
  }
  result.status = hit ? hit.status : "none";
  if (hit) result.summary = hit.sentence.length > 220 ? hit.sentence.slice(0, 217) + "…" : hit.sentence;
  result.leave = /\b(leave|leaving|depart|departing)\b[^.]{0,80}\b(as soon as possible|immediately|while (it is )?still possible|commercial)/i.test(text);

  // Date: the last date before the advisory sentence, else the first on the page.
  const at = hit ? text.indexOf(hit.sentence) : text.length;
  const dates = [...text.matchAll(DATE_RE)];
  const before = dates.filter((d) => d.index <= at);
  const d = before.length ? before[before.length - 1] : dates[0];
  if (d) result.date = `${d[1]} ${d[2][0].toUpperCase()}${d[2].slice(1).toLowerCase()} ${d[3]}`;

  const cityRe = new RegExp(`(^|[^a-z])${escapeRegex(city.toLowerCase())}([^a-z]|$)`, "i");
  const citySentence = sentences.find((s) => cityRe.test(s));
  result.mentionsCity = !!citySentence;
  if (citySentence) result.cityNote = citySentence.length > 220 ? citySentence.slice(0, 217) + "…" : citySentence;
  return result;
}

async function checkMfa({ city, country, fetchText }) {
  if (!country) return { status: "unreadable", error: "No country set", url: MFA_BASE };
  let url = mfaCountryUrl(country);
  let html;
  try {
    html = await fetchText(url);
  } catch (e) {
    // The guessed address failed; look the country up on the index page.
    const index = await fetchText(MFA_BASE);
    url = findMfaCountryLink(index, country);
    if (!url) throw new Error(`"${country}" not found on MFA site`);
    html = await fetchText(url);
  }
  return parseMfaPage(html, city, url);
}

function mfaInfo(mfa) {
  if (!mfa) return null;
  const lvl = MFA_LEVELS[mfa.status] || MFA_LEVELS.unreadable;
  return { ...lvl, short: mfa.date ? mfa.date.replace(/ 20\d\d$/, "").replace(/^(\d+ \w{3})\w*$/, "$1") : "" };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Letters and the marks attached to them; anything else separates words.
const LETTER = "[\\p{L}\\p{M}\\p{N}]";

// How a term must sit in a headline:
//   word      whole word (English, Vietnamese)
//   prefix    start of a word, any ending (inflected languages)
//   substring anywhere (Chinese, Japanese, Thai, Korean, Arabic, Hebrew)
function termRegex(term, mode) {
  const t = escapeRegex(fold(term));
  if (mode === "substring") return new RegExp(t, "u");
  if (mode === "prefix") return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${t}`, "u");
  return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${t}(?!${LETTER})`, "u");
}

const MATCHERS = {};
function matchersFor(lang) {
  if (!MATCHERS[lang]) {
    const L = DATA.languages[lang] || DATA.languages.en;
    MATCHERS[lang] = {
      terms: ["3", "2", "1"].flatMap((w) =>
        L.terms[w].map((term) => ({ term, weight: Number(w), re: termRegex(term, L.match) }))
      ),
      calm: L.calm.map((t) => termRegex(t, L.match)),
    };
  }
  return MATCHERS[lang];
}

// Rates a headline by its most severe term, in its own language and English.
function rateHeadline(title, lang = "en") {
  const text = fold(title);
  const langs = lang === "en" ? ["en"] : [lang, "en"];
  let severity = 0;
  const matched = [];
  for (const l of langs) {
    for (const p of matchersFor(l).terms) {
      if (p.re.test(text)) {
        matched.push(p.term);
        severity = Math.max(severity, p.weight);
      }
    }
  }
  if (severity <= 1 && langs.some((l) => matchersFor(l).calm.some((re) => re.test(text)))) severity *= 0.5;
  return { severity, matched };
}

// Scripts written without spaces between words, or with attached prefixes.
const NO_SPACE_SCRIPT = /[֐-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;

function mentionsAny(title, names) {
  const text = fold(title);
  return names.some((n) => termRegex(n, NO_SPACE_SCRIPT.test(n) ? "substring" : "prefix").test(text));
}

// ---- Headlines about other countries ----
// A city's name also turns up in stories about elsewhere, e.g. a capital
// standing for its government ("Brasília condemns the crackdown in Caracas").
// Headlines naming a foreign country, its people or one of its cities are
// skipped. Names of the watched city and its own country are blanked out
// first, so "Papua New Guinea" isn't read as "Guinea".

const FOREIGN = {};

function nameRegex(name, flags = "u") {
  return new RegExp(termRegex(name, NO_SPACE_SCRIPT.test(name) ? "substring" : "word").source, flags);
}

function foreignMatchers(country, names) {
  const own = mfaCountryName(country || "");
  const key = own + "|" + names.map(fold).join("/");
  if (!FOREIGN[key]) {
    const ownTerms = [...(DATA.countryNames[own] || []), ...names];
    const ownFolded = new Set([...ownTerms, ...(DATA.notForeign || [])].map(fold));
    const terms = [];
    for (const [c, list] of Object.entries(DATA.countryNames)) if (c !== own) terms.push(...list);
    for (const [city, info] of Object.entries(DATA.cities)) {
      if (info.country !== own) terms.push(city, ...(info.names || []));
    }
    FOREIGN[key] = {
      own: ownTerms.map((t) => nameRegex(t, "gu")),
      foreign: [...new Set(terms.filter((t) => !ownFolded.has(fold(t))))].map((t) => nameRegex(t)),
    };
  }
  return FOREIGN[key];
}

function mentionsForeign(title, country, names) {
  const m = foreignMatchers(country, names);
  let text = fold(title);
  for (const re of m.own) text = text.replace(re, " ");
  return m.foreign.some((re) => re.test(text));
}

function normalizeTitle(t) {
  return fold(t).replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// Keeps recent headlines that name the city and no other country, removes
// duplicates, rates each; most severe first. `names` are the city's spellings.
function prepareHeadlines(items, names, now, country = "") {
  if (typeof names === "string") names = [names];
  const cutoff = now.getTime() - 24 * 3600 * 1000;
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.title) continue;
    if (it.date && it.date.getTime() < cutoff) continue;
    const key = normalizeTitle(it.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // The news search also matches articles that only name the city in the body.
    if (!mentionsAny(it.title, names)) continue;
    if (mentionsForeign(it.title, country, names)) continue;
    const rating = rateHeadline(it.title, it.lang || "en");
    if (rating.severity === 0) continue;
    out.push({ ...it, ...rating, weight: rating.severity });
  }
  out.sort((a, b) => b.severity - a.severity || (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  return out;
}

function levelFor(score) {
  return LEVELS.find((l) => score >= l.min);
}

// GDELT's coverage count includes articles that only mention the city in
// passing, and it wobbles from hour to hour. So it only adds to the score
// when there's at least one headline about the city, or when the news
// feeds couldn't be read (newsOk false) and it's all there is.
function scoreReport(headlines, volume, newsOk = true) {
  const sevSum = headlines.reduce((s, h) => s + h.weight, 0);
  const severeCount = headlines.filter((h) => h.severity >= 3).length;
  const headlinePts = 50 * (1 - Math.exp(-sevSum / 15));
  let score;
  if (newsOk && !headlines.length) {
    score = 0;
  } else if (volume) {
    const ratio = volume.last24h / Math.max(volume.baseline, 1);
    const spikePts = 30 * clamp((ratio - 1) / 3, 0, 1);
    const volumePts = 20 * (1 - Math.exp(-volume.last24h / 60));
    score = headlinePts + spikePts + volumePts;
  } else {
    score = headlinePts * 1.6; // headlines only: max 80
  }
  if (severeCount >= 3) score = Math.max(score, 55);
  return Math.round(clamp(score, 0, 100));
}

// An official "defer travel" advisory sets a minimum score, higher when it names the city.
function applyMfaFloor(score, mfa) {
  if (!mfa) return score;
  if (mfa.status === "defer-all") return Math.max(score, mfa.mentionsCity ? 55 : 35);
  if (mfa.status === "defer-non-essential" && mfa.mentionsCity) return Math.max(score, 35);
  return score;
}

async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// fetchText(url) -> Promise<string>. Injected so this runs in Scriptable and Node.
// ---- Headline translation ----

// Google Translate's free web endpoint (the one translate.google.com uses).
// Unofficial: if it fails or changes, headlines are shown untranslated.
const TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=";
const TRANSLATE_BATCH_CHARS = 1500;

// The reply is [[[translated, original, ...], ...], ...]; joins the translated parts.
function parseTranslation(json) {
  if (!Array.isArray(json) || !Array.isArray(json[0])) throw new Error("unexpected reply");
  return json[0].map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : "")).join("");
}

// Adds `translated` to non-English headlines. `cache` (original -> English)
// carries translations between refreshes so each headline is sent only once.
// Returns { headlines, cache, error }.
async function translateHeadlines(headlines, fetchText, cache = {}) {
  const known = new Map(Object.entries(cache || {}));
  const todo = [...new Set(headlines.filter((h) => h.lang && h.lang !== "en" && !known.has(h.title)).map((h) => h.title))];
  const batches = [];
  for (const t of todo) {
    const last = batches[batches.length - 1];
    if (last && last.join("\n").length + t.length < TRANSLATE_BATCH_CHARS) last.push(t);
    else batches.push([t]);
  }
  let error = null;
  for (const batch of batches) {
    try {
      const q = batch.map((t) => t.replace(/\s*\n\s*/g, " ")).join("\n");
      const reply = String(await fetchText(TRANSLATE_URL + encodeURIComponent(q)));
      // Google answers a web page instead of data when it's limiting requests.
      if (!reply.trim().startsWith("[")) throw new Error("service unavailable, showing originals");
      const lines = parseTranslation(JSON.parse(reply))
        .split("\n")
        .map((l) => l.trim());
      if (lines.length !== batch.length) throw new Error("reply didn't match the headlines");
      batch.forEach((t, i) => known.set(t, lines[i]));
    } catch (e) {
      error = "Translate: " + ((e && e.message) || e);
      break;
    }
  }
  const out = headlines.map((h) => {
    const t = known.get(h.title);
    return t && fold(t) !== fold(h.title) ? { ...h, translated: t } : h;
  });
  const keep = {};
  for (const h of out) if (known.has(h.title)) keep[h.title] = known.get(h.title);
  return { headlines: out, cache: keep, error };
}

// "[Translated] ..." for translated headlines, else the headline as written.
function displayTitle(h) {
  return h.translated ? "[Translated] " + h.translated : h.title;
}

async function buildReport({
  city, names = [], context = "", country = "", localNews = CONFIG.localNews,
  translate = CONFIG.translate, translations = {}, fetchText, now = new Date(),
}) {
  const errors = [];
  const spellings = allNames(city, names);
  const editions = editionsFor(city, country, localNews);
  const [timelineRes, mfaRes, ...feedRes] = await Promise.all([
    settle(fetchText(gdeltTimelineUrl(city, context)).then((t) => JSON.parse(t))),
    country ? settle(checkMfa({ city, country, fetchText })) : Promise.resolve({ ok: true, value: null }),
    ...editions.map((ceid) => settle(fetchText(googleNewsRssUrl(spellings, context, ceid)))),
  ]);

  let mfa = mfaRes.value || null;
  if (!mfaRes.ok) {
    errors.push("MFA: " + mfaRes.error);
    mfa = { status: "unreadable", error: mfaRes.error, url: MFA_BASE };
  }

  let volume = null;
  if (timelineRes.ok) volume = summarizeTimeline(timelineRes.value, now);
  else errors.push("GDELT: " + timelineRes.error);

  let items = [];
  feedRes.forEach((res, i) => {
    const ceid = editions[i];
    if (res.ok) items.push(...parseRss(res.value).map((it) => ({ ...it, lang: DATA.editions[ceid].lang })));
    else errors.push(`Google News (${ceid}): ` + res.error);
  });

  let newsOk = feedRes.some((r) => r.ok);
  // Fall back to GDELT's article list if every Google News feed failed.
  if (!newsOk) {
    const art = await settle(fetchText(gdeltArticlesUrl(city, context)).then((t) => JSON.parse(t)));
    if (art.ok) items = parseGdeltArticles(art.value);
    else errors.push("GDELT articles: " + art.error);
    newsOk = art.ok;
  }

  if (!volume && !items.length && errors.length) {
    throw new Error("No sources reachable. " + errors.join("; "));
  }

  let headlines = prepareHeadlines(items, spellings, now, country);
  let translationCache = {};
  if (translate) {
    const t = await translateHeadlines(headlines.slice(0, 15), fetchText, translations);
    // The English translation shows foreign names the original wording hid.
    const kept = t.headlines.filter((h) => !h.translated || !mentionsForeign(h.translated, country, spellings));
    headlines = [...kept, ...headlines.slice(15)];
    translationCache = t.cache;
    if (t.error) errors.push(t.error);
  }
  const score = applyMfaFloor(scoreReport(headlines, volume, newsOk), mfa);
  const level = levelFor(score);
  const sources = new Set(headlines.map((h) => h.source)).size;

  return {
    city,
    names,
    context,
    score,
    level: level.name,
    color: level.color,
    reports: headlines.length,
    sources,
    headlines: headlines.slice(0, 10),
    translations: translationCache,
    volume,
    country,
    editions,
    mfa,
    errors,
    link: googleNewsWebUrl(spellings, context),
    generatedAt: now.toISOString(),
  };
}

// Compares the current score with one from at least 3 hours earlier.
function trendFrom(history, report) {
  const t = new Date(report.generatedAt).getTime();
  const older = history.filter((h) => t - h.t >= 3 * 3600 * 1000);
  const ref = older.length ? older[older.length - 1] : null;
  if (!ref) return { arrow: "", delta: 0 };
  const delta = report.score - ref.score;
  if (delta >= 8) return { arrow: "▲", delta };
  if (delta <= -8) return { arrow: "▼", delta };
  return { arrow: "▶", delta };
}

// ---------------------------------------------------------------------------
// Scriptable widget
// ---------------------------------------------------------------------------

const IS_SCRIPTABLE = typeof ListWidget !== "undefined" && typeof Script !== "undefined";

async function scriptableFetch(url) {
  const req = new Request(url);
  req.timeoutInterval = CONFIG.requestTimeoutSeconds;
  req.headers = { "User-Agent": "Mozilla/5.0 (iPhone) CityUnrestWidget/1.0" };
  const text = await req.loadString();
  const status = req.response && req.response.statusCode;
  if (status && status >= 400) throw new Error("HTTP " + status);
  return text;
}

function cacheStore(city) {
  const fm = FileManager.local();
  const dir = fm.joinPath(fm.documentsDirectory(), "city-unrest");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  const file = fm.joinPath(dir, fold(city).replace(/[^\p{L}\p{N}]+/gu, "-") + ".json");
  return {
    load() {
      try {
        return fm.fileExists(file) ? JSON.parse(fm.readString(file)) : null;
      } catch (e) {
        return null;
      }
    },
    save(data) {
      fm.writeString(file, JSON.stringify(data));
    },
  };
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const h = Math.round(mins / 60);
  return h < 48 ? h + "h" : Math.round(h / 24) + "d";
}

function formatTime(iso) {
  const df = new DateFormatter();
  df.useNoDateStyle();
  df.useShortTimeStyle();
  return df.string(new Date(iso));
}

function sparkline(daily, color, width, height) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const max = Math.max(1, ...daily);
  const gap = 4;
  const barW = (width - gap * (daily.length - 1)) / daily.length;
  daily.forEach((v, i) => {
    const h = Math.max(2, (v / max) * height);
    ctx.setFillColor(i === daily.length - 1 ? new Color(color) : new Color("#FFFFFF", 0.35));
    const path = new Path();
    path.addRoundedRect(new Rect(i * (barW + gap), height - h, barW, h), 2, 2);
    ctx.addPath(path);
    ctx.fillPath();
  });
  return ctx.getImage();
}

function addText(stack, text, size, opts = {}) {
  const t = stack.addText(text);
  t.font = opts.bold ? Font.boldSystemFont(size) : opts.medium ? Font.mediumSystemFont(size) : Font.systemFont(size);
  t.textColor = opts.color ? new Color(opts.color, opts.alpha == null ? 1 : opts.alpha) : Color.white();
  if (opts.lines) t.lineLimit = opts.lines;
  t.minimumScaleFactor = opts.scale || 0.7;
  return t;
}

function addScoreBlock(stack, report, trend, stale) {
  const top = stack.addStack();
  top.centerAlignContent();
  addText(top, report.city.toUpperCase(), 12, { bold: true, alpha: 0.85, color: "#FFFFFF", lines: 1 });
  top.addSpacer();
  if (trend.arrow) addText(top, trend.arrow, 12, { color: report.color });

  stack.addSpacer(2);
  addText(stack, String(report.score), 40, { bold: true, color: report.color, lines: 1 });
  addText(stack, report.level.toUpperCase(), 14, { bold: true, color: report.color, lines: 1 });
  stack.addSpacer();
  addMfaLine(stack, report);
  addText(stack, `${report.reports} reports · ${report.sources} sources`, 10, { alpha: 0.75, color: "#FFFFFF", lines: 1 });
  addText(stack, (stale ? "⚠︎ cached " : "Updated ") + formatTime(report.generatedAt), 10, {
    alpha: 0.6,
    color: stale ? "#FFCC00" : "#FFFFFF",
    lines: 1,
  });
}

// One line such as "SG MFA: Defer all travel · 10 Jun". Tapping opens the MFA page.
function addMfaLine(stack, report) {
  const info = mfaInfo(report.mfa);
  if (!info) return;
  const row = stack.addStack();
  row.centerAlignContent();
  if (isMfaUrl(report.mfa.url)) row.url = report.mfa.url;
  // The flag and date only mean something when there is an advisory or notice.
  const active = info.rank >= 1;
  const city = active && report.mfa.mentionsCity ? " ⚑" : "";
  const date = active && info.short ? " · " + info.short : "";
  addText(row, "SG MFA: ", 10, { bold: true, alpha: 0.75, color: "#FFFFFF", lines: 1 });
  addText(row, info.label + city + date, 10, {
    bold: true,
    color: info.color,
    lines: 1,
    scale: 0.6,
  });
}

// " · FR" for headlines that aren't in English.
function langTag(h) {
  return h.lang && h.lang !== "en" ? " · " + h.lang.toUpperCase() : "";
}

function addHeadline(stack, h, size) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.topAlignContent();
  if (safeUrl(h.url)) row.url = h.url;
  const dotColor = h.severity >= 3 ? "#FF3B30" : h.severity >= 2 ? "#FF9500" : "#FFCC00";
  addText(row, "● ", size - 2, { color: dotColor });
  const col = row.addStack();
  col.layoutVertically();
  addText(col, displayTitle(h), size, { medium: true, lines: 2, scale: 0.85 });
  const meta = h.source + (h.date ? " · " + timeAgo(h.date) : "") + langTag(h);
  addText(col, meta, size - 2, { alpha: 0.55, color: "#FFFFFF", lines: 1 });
}

function buildWidget(report, trend, stale) {
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();
  w.url = report.link;
  w.refreshAfterDate = new Date(Date.now() + CONFIG.refreshMinutes * 60000);

  // Lock screen widgets
  if (family === "accessoryInline") {
    const info = mfaInfo(report.mfa);
    const mfa = info && info.rank >= 1 ? ` · MFA: ${info.label}` : "";
    w.addText(`${report.city}: ${report.level} (${report.score})${trend.arrow ? " " + trend.arrow : ""}${mfa}`);
    return w;
  }
  if (family === "accessoryCircular") {
    const s = w.addStack();
    s.layoutVertically();
    s.centerAlignContent();
    const n = s.addText(String(report.score));
    n.font = Font.boldSystemFont(20);
    n.centerAlignText();
    const l = s.addText(report.level.slice(0, 4).toUpperCase());
    l.font = Font.systemFont(9);
    l.centerAlignText();
    return w;
  }
  if (family === "accessoryRectangular") {
    const t = w.addText(`${report.city} · ${report.level} ${report.score} ${trend.arrow}`);
    t.font = Font.boldSystemFont(13);
    const info = mfaInfo(report.mfa);
    const showMfa = info && info.rank >= 2;
    if (showMfa) {
      const m = w.addText("SG MFA: " + info.label + (report.mfa.mentionsCity ? " ⚑" : ""));
      m.font = Font.mediumSystemFont(11);
    }
    const top = report.headlines[0];
    const h = w.addText(top ? displayTitle(top) : "No unrest reports in last 24h");
    h.font = Font.systemFont(11);
    h.lineLimit = showMfa ? 1 : 2;
    return w;
  }

  const bg = new LinearGradient();
  bg.colors = [new Color("#1C1C1E"), new Color(report.color, 0.35)];
  bg.locations = [0.35, 1];
  bg.startPoint = new Point(0, 0);
  bg.endPoint = new Point(1, 1);
  w.backgroundGradient = bg;
  w.setPadding(14, 14, 14, 14);

  if (family === "small") {
    addScoreBlock(w, report, trend, stale);
    return w;
  }

  const main = w.addStack();
  main.layoutHorizontally();
  const left = main.addStack();
  left.layoutVertically();
  left.size = new Size(family === "large" ? 0 : 110, 0);
  addScoreBlock(left, report, trend, stale);

  if (family === "medium") {
    main.addSpacer(10);
    const right = main.addStack();
    right.layoutVertically();
    if (!report.headlines.length) {
      addText(right, "No unrest-related reports in the last 24 hours.", 12, { alpha: 0.7, color: "#FFFFFF" });
    }
    report.headlines.slice(0, 3).forEach((h, i) => {
      if (i) right.addSpacer(5);
      addHeadline(right, h, 11);
    });
    right.addSpacer();
    return w;
  }

  // Large
  if (report.mfa && report.mfa.summary) {
    w.addSpacer(8);
    const box = w.addStack();
    box.layoutVertically();
    if (isMfaUrl(report.mfa.url)) box.url = report.mfa.url;
    addText(box, report.mfa.mentionsCity && report.mfa.cityNote ? report.mfa.cityNote : report.mfa.summary, 10, {
      alpha: 0.8,
      color: "#FFFFFF",
      lines: 2,
      scale: 0.85,
    });
  }
  if (report.volume) {
    w.addSpacer(8);
    addText(w, "Unrest coverage, last 7 days", 10, { alpha: 0.6, color: "#FFFFFF" });
    w.addSpacer(3);
    const img = w.addImage(sparkline(report.volume.daily, report.color, 300, 28));
    img.imageSize = new Size(300, 28);
  }
  w.addSpacer(8);
  if (!report.headlines.length) {
    addText(w, "No unrest-related reports in the last 24 hours.", 12, { alpha: 0.7, color: "#FFFFFF" });
  }
  report.headlines.slice(0, 5).forEach((h, i) => {
    if (i) w.addSpacer(5);
    addHeadline(w, h, 12);
  });
  w.addSpacer();
  return w;
}

function errorWidget(message) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#1C1C1E");
  addText(w, "City Unrest", 13, { bold: true });
  w.addSpacer(4);
  addText(w, message, 11, { alpha: 0.7, color: "#FFFFFF", lines: 6 });
  return w;
}

async function showInApp(report, trend) {
  const table = new UITable();
  table.showSeparators = true;
  const head = new UITableRow();
  head.height = 70;
  head.isHeader = true;
  head.addText(
    `${report.city}: ${report.level} (${report.score}/100) ${trend.arrow}`,
    `${report.reports} reports from ${report.sources} sources · ${formatTime(report.generatedAt)}` +
      (report.editions ? ` · news in ${[...new Set(report.editions.map((e) => DATA.editions[e].lang.toUpperCase()))].join(", ")}` : "")
  );
  table.addRow(head);
  for (const h of report.headlines) {
    const row = new UITableRow();
    const original = h.translated ? `\nOriginal: ${h.title}` : "";
    row.height = h.translated ? 96 : 74;
    row.addText(displayTitle(h), `${h.source}${h.date ? " · " + timeAgo(h.date) : ""}${langTag(h)} · ${h.matched.join(", ")}${original}`).titleFont =
      Font.mediumSystemFont(14);
    row.dismissOnSelect = false;
    row.onSelect = () => Safari.open(safeUrl(h.url) || report.link);
    table.addRow(row);
  }
  if (report.mfa) {
    const info = mfaInfo(report.mfa);
    const row = new UITableRow();
    row.height = 110;
    const detail = [
      report.mfa.date ? "Updated " + report.mfa.date : "",
      report.mfa.mentionsCity ? `Mentions ${report.city}: ${report.mfa.cityNote}` : `Does not mention ${report.city}`,
      report.mfa.summary,
      report.mfa.error || "",
    ]
      .filter(Boolean)
      .join("\n");
    const cell = row.addText(`Singapore MFA (${report.country}): ${info.label}`, detail);
    cell.titleColor = new Color(info.color);
    cell.subtitleFont = Font.systemFont(12);
    row.dismissOnSelect = false;
    row.onSelect = () => Safari.open(isMfaUrl(report.mfa.url) ? report.mfa.url : MFA_BASE);
    table.addRow(row);
  }
  if (report.errors.length) {
    const row = new UITableRow();
    row.addText("Some sources failed", report.errors.join("\n"));
    table.addRow(row);
  }
  await table.present();
}

async function main() {
  let param = args.widgetParameter;
  if (config.runsInApp && !param) {
    const a = new Alert();
    a.title = "City Unrest";
    a.message = "Which city? Optionally add context and country: Portland | Oregon | United States. Add local spellings after /, e.g. Moscow / Москва";
    a.addTextField("City", CONFIG.defaultCity);
    a.addAction("Check");
    a.addCancelAction("Cancel");
    if ((await a.presentAlert()) === -1) return;
    param = a.textFieldValue(0);
  }
  const { city, names, context, country } = parseParam(param);
  const cache = cacheStore([city, context, country].filter(Boolean).join("-"));
  const cached = cache.load() || { history: [] };

  let report;
  let stale = false;
  try {
    report = await buildReport({
      city, names, context, country,
      translations: (cached.report && cached.report.translations) || {},
      fetchText: scriptableFetch,
      now: new Date(),
    });
  } catch (e) {
    if (!cached.report) {
      const w = errorWidget("Couldn't load reports. " + e.message);
      if (config.runsInWidget) Script.setWidget(w);
      else await w.presentMedium();
      return;
    }
    report = cached.report;
    stale = true;
  }

  const history = cached.history || [];
  const trend = trendFrom(history, report);
  if (!stale) {
    history.push({ t: new Date(report.generatedAt).getTime(), score: report.score });
    cache.save({ report, history: history.slice(-96) });
  }

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(report, trend, stale));
  } else {
    await showInApp(report, trend);
  }
}

if (IS_SCRIPTABLE) {
  await main();
  Script.complete();
} else if (typeof module !== "undefined") {
  module.exports = {
    CONFIG,
    parseParam,
    parseRss,
    parseGdeltArticles,
    parseGdeltDate,
    summarizeTimeline,
    rateHeadline,
    prepareHeadlines,
    scoreReport,
    levelFor,
    trendFrom,
    buildReport,
    gdeltTimelineUrl,
    DATA,
    fold,
    allNames,
    editionsFor,
    mentionsAny,
    mentionsForeign,
    normalizeTitle,
    parseMfaPage,
    findMfaCountryLink,
    mfaCountryUrl,
    checkMfa,
    applyMfaFloor,
    translateHeadlines,
    parseTranslation,
    displayTitle,
    htmlToText,
    safeUrl,
    isMfaUrl,
    googleNewsRssUrl,
  };
}
