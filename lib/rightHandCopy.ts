import type { LanguageCode } from "./localization";

export const RIGHT_HAND_COPY_KEYS = [
  "strummingDescription", "plectrumDescription", "fingerpickingDescription",
  "beginnerDescription", "intermediateDescription", "expertDescription"
] as const;
export type RightHandCopyKey = (typeof RIGHT_HAND_COPY_KEYS)[number];

const rows: Record<LanguageCode, readonly string[]> = {
  en: [
    "Build a relaxed, even groove with downstrokes, upstrokes, accents, and mutes.",
    "Train string accuracy, alternate picking, crossing, and fast flatpick control.",
    "Coordinate thumb and fingers through arpeggios, pinches, independence, and syncopation.",
    "Steady motion and clean contact", "Syncopation and string changes", "Speed, accents, and independence"
  ],
  es: [
    "Desarrolla un ritmo relajado y uniforme con golpes hacia abajo y arriba, acentos y silencios.",
    "Entrena la precisión entre cuerdas, la púa alternada, los cruces y el control rápido de la púa.",
    "Coordina el pulgar y los dedos con arpegios, pellizcos, independencia y síncopas.",
    "Movimiento constante y contacto limpio", "Síncopas y cambios de cuerda", "Velocidad, acentos e independencia"
  ],
  fr: [
    "Construisez un rythme détendu et régulier avec des coups vers le bas et le haut, des accents et des silences.",
    "Travaillez la précision entre les cordes, l’aller-retour, les changements de corde et le contrôle rapide du médiator.",
    "Coordonnez le pouce et les doigts avec arpèges, pincements, indépendance et syncopes.",
    "Mouvement régulier et attaque nette", "Syncopes et changements de corde", "Vitesse, accents et indépendance"
  ],
  de: [
    "Entwickle einen lockeren, gleichmäßigen Groove mit Abschlägen, Aufschlägen, Akzenten und gedämpften Schlägen.",
    "Übe Saitengenauigkeit, Wechselschlag, Saitenwechsel und schnelle Kontrolle des Plektrums.",
    "Koordiniere Daumen und Finger mit Arpeggien, Doppelgriffen, Unabhängigkeit und Synkopen.",
    "Gleichmäßige Bewegung und sauberer Anschlag", "Synkopen und Saitenwechsel", "Tempo, Akzente und Unabhängigkeit"
  ],
  it: [
    "Costruisci un groove rilassato e regolare con pennate in giù e in su, accenti e stoppate.",
    "Allena la precisione sulle corde, la pennata alternata, i cambi di corda e il controllo rapido del plettro.",
    "Coordina pollice e dita con arpeggi, pizzichi, indipendenza e sincopi.",
    "Movimento regolare e attacco pulito", "Sincopi e cambi di corda", "Velocità, accenti e indipendenza"
  ],
  pt: [
    "Crie um groove relaxado e constante com batidas para baixo e para cima, acentos e abafamentos.",
    "Treine a precisão nas cordas, a palhetada alternada, as trocas de corda e o controle rápido da palheta.",
    "Coordene polegar e dedos com arpejos, pinças, independência e síncopes.",
    "Movimento constante e ataque limpo", "Síncopes e mudanças de corda", "Velocidade, acentos e independência"
  ],
  nl: [
    "Bouw een ontspannen, gelijkmatige groove op met neer- en opwaartse slagen, accenten en dempingen.",
    "Train snaarnauwkeurigheid, alternate picking, snaarwissels en snelle plectrumcontrole.",
    "Coördineer duim en vingers met arpeggio’s, knijpen, onafhankelijkheid en syncopen.",
    "Gelijkmatige beweging en zuivere aanslag", "Syncopen en snaarwissels", "Snelheid, accenten en onafhankelijkheid"
  ],
  pl: [
    "Zbuduj swobodny, równy rytm, łącząc uderzenia w dół i w górę, akcenty oraz tłumienia.",
    "Ćwicz precyzję strun, kostkowanie naprzemienne, zmiany strun i szybką kontrolę kostki.",
    "Koordynuj kciuk i palce, ćwicząc arpeggia, chwytanie, niezależność i synkopy.",
    "Równy ruch i czyste uderzenie", "Synkopy i zmiany strun", "Szybkość, akcenty i niezależność"
  ],
  ru: [
    "Создайте свободный ровный ритм с ударами вниз и вверх, акцентами и приглушением.",
    "Тренируйте точность по струнам, переменный штрих, переходы между струнами и контроль медиатора на скорости.",
    "Координируйте большой палец и остальные пальцы в арпеджио, щипках, независимых движениях и синкопах.",
    "Ровное движение и чистый контакт", "Синкопы и переходы между струнами", "Скорость, акценты и независимость"
  ],
  uk: [
    "Створюйте невимушений рівний ритм ударами вниз і вгору, акцентами та приглушеннями.",
    "Тренуйте точність по струнах, змінний штрих, переходи між струнами й швидкий контроль медіатора.",
    "Координуйте великий та інші пальці в арпеджіо, щипках, незалежних рухах і синкопах.",
    "Рівний рух і чистий дотик", "Синкопи й переходи між струнами", "Швидкість, акценти й незалежність"
  ],
  tr: [
    "Aşağı ve yukarı vuruşları, vurguları ve susturmaları kullanarak rahat ve dengeli bir ritim kurun.",
    "Tel doğruluğunu, alternate pena vuruşunu, tel geçişlerini ve hızlı pena kontrolünü çalışın.",
    "Arpejler, çift sesler, bağımsızlık ve senkoplarla başparmak ve parmaklarınızı eşgüdümleyin.",
    "Dengeli hareket ve temiz temas", "Senkop ve tel değişimleri", "Hız, vurgu ve bağımsızlık"
  ],
  ar: [
    "ابنِ إيقاعًا مريحًا ومتوازنًا بضربات إلى الأسفل والأعلى، مع التأكيدات وكتم الأوتار.",
    "درّب دقة العزف على الأوتار والعزف المتناوب وتبديل الأوتار والتحكم السريع بالريشة.",
    "نسّق حركة الإبهام والأصابع عبر الأربيجيو والقرص واستقلالية الأصابع والإيقاعات المتزامنة.",
    "حركة ثابتة ولمس نظيف", "إيقاعات متزامنة وتبديل الأوتار", "السرعة والتأكيدات والاستقلالية"
  ],
  he: [
    "בנו גרוב נינוח ואחיד עם פריטות למטה ולמעלה, הדגשות והשתקות.",
    "תרגלו דיוק במעבר בין מיתרים, פריטה לסירוגין, חציית מיתרים ושליטה מהירה במפרט.",
    "תאמו בין האגודל לאצבעות באמצעות ארפג'יו, צביטות, עצמאות וסינקופות.",
    "תנועה יציבה ומגע נקי", "סינקופות ומעברים בין מיתרים", "מהירות, הדגשות ועצמאות"
  ],
  hi: [
    "नीचे और ऊपर की स्ट्रमिंग, ज़ोर और म्यूट का उपयोग करके सहज, स्थिर ताल बनाएँ।",
    "तारों पर सटीकता, बारी-बारी से पिकिंग, तार बदलना और तेज़ पिक नियंत्रण का अभ्यास करें।",
    "आर्पेजियो, पिंच, उँगलियों की स्वतंत्रता और सिंकोपेशन के साथ अंगूठे और उँगलियों का तालमेल बनाएँ।",
    "स्थिर गति और साफ़ स्पर्श", "सिंकोपेशन और तार बदलना", "गति, ज़ोर और स्वतंत्रता"
  ],
  bn: [
    "নিচে ও ওপরে স্ট্রাম, জোর এবং মিউট ব্যবহার করে স্বচ্ছন্দ, সমান ছন্দ তৈরি করুন।",
    "তার নির্ভুলতা, পালাক্রমে পিকিং, তার বদল এবং দ্রুত পিক নিয়ন্ত্রণ অনুশীলন করুন।",
    "আর্পেজিও, পিঞ্চ, আঙুলের স্বাধীনতা ও সিনকোপেশনের মাধ্যমে বুড়ো আঙুল ও আঙুলের সমন্বয় করুন।",
    "স্থির গতি ও পরিষ্কার স্পর্শ", "সিনকোপেশন ও তার বদল", "গতি, জোর ও স্বাধীনতা"
  ],
  ur: [
    "نیچے اور اوپر کی اسٹرمنگ، زور اور تاروں کو خاموش کر کے پُرسکون، یکساں ردھم بنائیں۔",
    "تاروں کی درستگی، باری باری پکنگ، تار بدلنے اور تیز پلیکٹرم کنٹرول کی مشق کریں۔",
    "آرپیجیو، چٹکی، انگلیوں کی آزادی اور سنکوپیشن سے انگوٹھے اور انگلیوں میں ہم آہنگی پیدا کریں۔",
    "یکساں حرکت اور صاف رابطہ", "سنکوپیشن اور تاروں کی تبدیلی", "رفتار، زور اور آزادی"
  ],
  id: [
    "Bangun groove santai dan merata dengan genjrengan turun-naik, aksen, dan mute.",
    "Latih ketepatan senar, petikan bergantian, perpindahan senar, dan kendali pick yang cepat.",
    "Koordinasikan ibu jari dan jari melalui arpeggio, pinch, kemandirian jari, dan sinkopasi.",
    "Gerakan stabil dan sentuhan bersih", "Sinkopasi dan perpindahan senar", "Kecepatan, aksen, dan kemandirian"
  ],
  vi: [
    "Tạo nhịp điệu thoải mái, đều đặn bằng cách quạt xuống, quạt lên, nhấn và chặn tiếng.",
    "Luyện độ chính xác khi chuyển dây, cách gảy luân phiên, đổi dây và điều khiển miếng gảy nhanh.",
    "Phối hợp ngón cái và các ngón qua rải hợp âm, bấm chụm, độc lập ngón và đảo phách.",
    "Chuyển động đều và tiếp xúc sạch", "Đảo phách và đổi dây", "Tốc độ, nhấn nhịp và độc lập"
  ],
  th: [
    "สร้างจังหวะที่ผ่อนคลายและสม่ำเสมอด้วยการตีลง ตีขึ้น เน้นจังหวะ และปิดเสียงสาย",
    "ฝึกความแม่นยำของสาย การดีดสลับ การข้ามสาย และการควบคุมปิ๊กอย่างรวดเร็ว",
    "ประสานนิ้วโป้งและนิ้วอื่นผ่านอาร์เปจิโอ การดีดสองสาย ความเป็นอิสระของนิ้ว และซิงโคเปชัน",
    "การเคลื่อนไหวสม่ำเสมอและสัมผัสสะอาด", "ซิงโคเปชันและการเปลี่ยนสาย", "ความเร็ว การเน้นจังหวะ และความเป็นอิสระ"
  ],
  ja: [
    "ダウンとアップ、アクセント、ミュートを使って、力みのない安定したグルーヴを作ります。",
    "弦の正確さ、オルタネイトピッキング、弦移動、速いピックさばきを鍛えます。",
    "アルペジオ、ピンチ、指の独立、シンコペーションを通して親指と指を連動させます。",
    "安定した動きときれいなタッチ", "シンコペーションと弦移動", "スピード、アクセント、独立性"
  ],
  ko: [
    "다운·업 스트로크, 악센트, 뮤트를 사용해 편안하고 고른 그루브를 만드세요.",
    "줄 정확도, 얼터네이트 피킹, 줄 이동, 빠른 피크 조절을 연습하세요.",
    "아르페지오, 핀치, 손가락 독립, 싱코페이션을 통해 엄지와 손가락을 조화롭게 움직이세요.",
    "안정된 움직임과 깨끗한 터치", "싱코페이션과 줄 이동", "속도, 악센트, 독립성"
  ],
  "zh-CN": [
    "用下扫、上扫、重音和闷音练出放松、均匀的律动。",
    "训练弦间准确度、交替拨弦、换弦以及快速控制拨片的能力。",
    "通过琶音、双音拨弦、手指独立和切分节奏协调拇指与其他手指。",
    "动作稳定，触弦干净", "切分节奏与换弦", "速度、重音与独立性"
  ],
  "zh-TW": [
    "運用下刷、上刷、重音與悶音，培養放鬆而穩定的律動。",
    "訓練弦間準確度、交替撥弦、換弦以及快速控制撥片的能力。",
    "透過琶音、雙音撥弦、手指獨立與切分節奏協調拇指和其他手指。",
    "動作穩定，觸弦乾淨", "切分節奏與換弦", "速度、重音與獨立性"
  ]
};

export const RIGHT_HAND_COPY: Record<LanguageCode, Record<RightHandCopyKey, string>> = Object.fromEntries(
  Object.entries(rows).map(([locale, row]) => {
    if (row.length !== RIGHT_HAND_COPY_KEYS.length) throw new Error(`Right-hand localization count mismatch for ${locale}`);
    return [locale, Object.fromEntries(RIGHT_HAND_COPY_KEYS.map((key, index) => [key, row[index]]))];
  })
) as Record<LanguageCode, Record<RightHandCopyKey, string>>;
