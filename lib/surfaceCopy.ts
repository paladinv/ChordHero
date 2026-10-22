import type { LanguageCode } from "./localization";

export const SURFACE_COPY_KEYS = ["chartBuilderTitle", "chartBuilderIntro", "chordLibraryTitle", "chordLibraryIntro"] as const;
export type SurfaceCopyKey = (typeof SURFACE_COPY_KEYS)[number];

const rows: Record<LanguageCode, readonly string[]> = {
  en: ["Build a useful chart, then print only what you need.", "Generate theory or song charts, hear each shape, optimize transitions, and save an ordered practice sheet.", "Chord library", "Find a shape, hear it, and focus on one task at a time."],
  es: ["Crea una tabla útil e imprime solo lo que necesites.", "Genera tablas de teoría o canciones, escucha cada acorde, mejora las transiciones y guarda una hoja de práctica ordenada.", "Biblioteca de acordes", "Encuentra una posición, escúchala y céntrate en una tarea cada vez."],
  fr: ["Créez un tableau utile et n’imprimez que l’essentiel.", "Créez des tableaux de théorie ou de chansons, écoutez chaque position, optimisez les transitions et enregistrez une fiche ordonnée.", "Bibliothèque d’accords", "Trouvez une position, écoutez-la et concentrez-vous sur une tâche à la fois."],
  de: ["Erstelle ein hilfreiches Diagramm und drucke nur, was du brauchst.", "Erstelle Theorie- oder Songdiagramme, höre jeden Griff an, verbessere Übergänge und speichere ein sortiertes Übungsblatt.", "Akkordbibliothek", "Finde einen Griff, höre ihn an und konzentriere dich auf eine Aufgabe nach der anderen."],
  it: ["Crea una tabella utile e stampa solo ciò che serve.", "Crea tabelle teoriche o per brani, ascolta ogni posizione, ottimizza i passaggi e salva una scheda di pratica ordinata.", "Libreria accordi", "Trova una posizione, ascoltala e concentrati su un compito alla volta."],
  pt: ["Crie uma tabela útil e imprima somente o necessário.", "Gere tabelas de teoria ou músicas, ouça cada posição, otimize as transições e salve uma folha de prática organizada.", "Biblioteca de acordes", "Encontre uma posição, ouça e concentre-se em uma tarefa por vez."],
  nl: ["Maak een handig schema en druk alleen af wat je nodig hebt.", "Maak theorie- of nummerschema’s, beluister elke greep, verbeter overgangen en bewaar een geordend oefenblad.", "Akkoordenbibliotheek", "Zoek een greep, beluister hem en focus op één taak tegelijk."],
  pl: ["Utwórz przydatny diagram i drukuj tylko to, czego potrzebujesz.", "Twórz diagramy teorii lub utworów, odsłuchuj chwyty, usprawniaj przejścia i zapisuj uporządkowaną kartę ćwiczeń.", "Biblioteka akordów", "Znajdź chwyt, odsłuchaj go i skup się na jednym zadaniu naraz."],
  ru: ["Создайте удобную схему и распечатайте только нужное.", "Создавайте схемы теории или песен, слушайте аккорды, улучшайте переходы и сохраняйте упорядоченный лист упражнений.", "Библиотека аккордов", "Найдите аппликатуру, прослушайте её и сосредоточьтесь на одной задаче за раз."],
  uk: ["Створіть корисну схему й друкуйте лише потрібне.", "Створюйте схеми теорії чи пісень, слухайте акорди, покращуйте переходи та зберігайте впорядкований аркуш вправ.", "Бібліотека акордів", "Знайдіть аплікатуру, прослухайте її та зосередьтеся на одному завданні за раз."],
  tr: ["İşe yarar bir akor tablosu oluşturun, yalnızca gerekeni yazdırın.", "Teori veya şarkı tabloları oluşturun, şekilleri dinleyin, geçişleri iyileştirin ve sıralı bir çalışma sayfası kaydedin.", "Akor kitaplığı", "Bir şekil bulun, dinleyin ve her seferinde tek bir göreve odaklanın."],
  ar: ["أنشئ مخططًا مفيدًا واطبع ما تحتاج إليه فقط.", "أنشئ مخططات للنظرية أو الأغاني، واستمع إلى كل شكل، وحسّن الانتقالات، واحفظ ورقة تدريب مرتبة.", "مكتبة الأوتار", "اعثر على شكل، واستمع إليه، وركّز على مهمة واحدة في كل مرة."],
  he: ["צרו תרשים שימושי והדפיסו רק את מה שצריך.", "צרו תרשימי תאוריה או שירים, האזינו לכל צורה, שפרו מעברים ושמרו דף תרגול מסודר.", "ספריית אקורדים", "מצאו צורה, האזינו לה והתמקדו במשימה אחת בכל פעם."],
  hi: ["उपयोगी चार्ट बनाएँ और केवल ज़रूरी चीज़ें प्रिंट करें।", "थ्योरी या गीत के चार्ट बनाएँ, हर शेप सुनें, बदलाव बेहतर करें और क्रमबद्ध अभ्यास शीट सहेजें।", "कॉर्ड लाइब्रेरी", "एक शेप खोजें, उसे सुनें और एक समय में एक काम पर ध्यान दें।"],
  bn: ["কাজের চার্ট তৈরি করুন, প্রয়োজনীয় অংশটুকুই প্রিন্ট করুন।", "থিওরি বা গানের চার্ট তৈরি করুন, প্রতিটি শেপ শুনুন, পরিবর্তন উন্নত করুন এবং সাজানো অনুশীলনপত্র সংরক্ষণ করুন।", "কর্ড লাইব্রেরি", "একটি শেপ খুঁজুন, শুনুন এবং একবারে একটি কাজে মন দিন।"],
  ur: ["مفید چارٹ بنائیں اور صرف ضروری چیز پرنٹ کریں۔", "نظریے یا گانے کے چارٹ بنائیں، ہر شکل سنیں، تبدیلیاں بہتر کریں اور ترتیب وار مشقی شیٹ محفوظ کریں۔", "کورڈ لائبریری", "ایک شکل تلاش کریں، سنیں اور ایک وقت میں ایک کام پر توجہ دیں۔"],
  id: ["Buat bagan yang berguna dan cetak hanya yang diperlukan.", "Buat bagan teori atau lagu, dengarkan setiap bentuk, optimalkan perpindahan, dan simpan lembar latihan yang terurut.", "Pustaka akor", "Temukan bentuk, dengarkan, dan fokus pada satu tugas setiap kali."],
  vi: ["Tạo sơ đồ hữu ích và chỉ in phần bạn cần.", "Tạo sơ đồ lý thuyết hoặc bài hát, nghe từng thế bấm, tối ưu chuyển hợp âm và lưu phiếu luyện tập có thứ tự.", "Thư viện hợp âm", "Tìm một thế bấm, nghe thử và tập trung vào từng nhiệm vụ."],
  th: ["สร้างแผนผังที่มีประโยชน์และพิมพ์เฉพาะสิ่งที่ต้องการ", "สร้างแผนผังทฤษฎีหรือเพลง ฟังแต่ละรูปแบบ ปรับการเปลี่ยนคอร์ด และบันทึกใบฝึกที่เรียงลำดับแล้ว", "คลังคอร์ด", "ค้นหารูปแบบ ฟัง แล้วฝึกทีละงาน"],
  ja: ["使いやすいコード表を作り、必要なものだけ印刷できます。", "理論や曲のコード表を作成し、フォームを試聴し、チェンジを整え、順序付きの練習シートを保存します。", "コードライブラリ", "フォームを探して音を聴き、一度に一つの課題に集中しましょう。"],
  ko: ["유용한 차트를 만들고 필요한 것만 인쇄하세요.", "이론 또는 곡 차트를 만들고 각 운지를 들어 본 뒤 전환을 다듬고 정렬된 연습지를 저장하세요.", "코드 라이브러리", "운지를 찾고 들어 보며 한 번에 하나의 과제에 집중하세요."],
  "zh-CN": ["制作实用的和弦图，只打印需要的内容。", "生成乐理或歌曲和弦图，试听每种指法，优化转换，并保存排序后的练习表。", "和弦库", "找到一种指法，试听它，一次专注完成一项任务。"],
  "zh-TW": ["製作實用的和弦圖，只列印需要的內容。", "產生樂理或歌曲和弦圖，試聽每種指法，最佳化轉換，並儲存排序後的練習表。", "和弦庫", "找到一種指法，試聽它，一次專注完成一項任務。"]
};

export const SURFACE_COPY: Record<LanguageCode, Record<SurfaceCopyKey, string>> = Object.fromEntries(
  Object.entries(rows).map(([locale, values]) => [locale, Object.fromEntries(SURFACE_COPY_KEYS.map((key, index) => [key, values[index]]))])
) as Record<LanguageCode, Record<SurfaceCopyKey, string>>;
