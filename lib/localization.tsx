"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { HOME_CARD_COPY, PAGE_COPY } from "./pageCopy";
import type { HomeCardCopyKey, PageCopyKey } from "./pageCopy";
import { UI_COPY } from "./uiCopy";
import type { UiCopyKey } from "./uiCopy";
import { UI_COPY_EXTRA } from "./uiCopyExtra";
import type { UiCopyExtraKey } from "./uiCopyExtra";
import { FEATURE_COPY } from "./featureCopy";
import type { FeatureCopyKey } from "./featureCopy";
import { TRAINER_COPY } from "./trainerCopy";
import type { TrainerCopyKey } from "./trainerCopy";
import { SURFACE_COPY } from "./surfaceCopy";
import type { SurfaceCopyKey } from "./surfaceCopy";
import { TRAINER_UI_COPY } from "./trainerUiCopy";
import type { TrainerUiCopyKey } from "./trainerUiCopy";
import { RIGHT_HAND_COPY } from "./rightHandCopy";
import type { RightHandCopyKey } from "./rightHandCopy";

export const LANGUAGE_OPTIONS = [
  ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"],
  ["pt", "Português"], ["nl", "Nederlands"], ["pl", "Polski"], ["ru", "Русский"], ["uk", "Українська"],
  ["tr", "Türkçe"], ["ar", "العربية"], ["he", "עברית"], ["hi", "हिन्दी"], ["bn", "বাংলা"], ["ur", "اردو"],
  ["id", "Bahasa Indonesia"], ["vi", "Tiếng Việt"], ["th", "ไทย"], ["ja", "日本語"], ["ko", "한국어"],
  ["zh-CN", "简体中文"], ["zh-TW", "繁體中文"]
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number][0];
export type LocalePreference = LanguageCode | "auto";
export const LOCALE_STORAGE_KEY = "chord-hero:display-language:v1";
export const LANGUAGE_OPTIONS_LABELS: Record<LanguageCode, string> = Object.fromEntries(LANGUAGE_OPTIONS) as Record<LanguageCode, string>;

type Messages = {
  deviceLanguage: string; displayLanguage: string; home: string; dailyPlan: string; trainer: string;
  rightHand: string; songs: string; songBuilder: string; songLibrary: string; library: string; chordChart: string;
  about: string; accessibility: string; makeYours: string; close: string; reducedMotion: string; highContrast: string;
  colorBlindSafe: string; dyslexiaSpacing: string; leftHandedDemos: string; diagramSize: string; audio: string;
  muteAudio: string; haptics: string; installApp: string; offlineReady: string; offlinePending: string;
  license: string; settings: string; selectLanguage: string;
};
export type MessageKey = keyof Messages | "practice" | PageCopyKey | HomeCardCopyKey | UiCopyKey | UiCopyExtraKey | FeatureCopyKey | TrainerCopyKey | SurfaceCopyKey | TrainerUiCopyKey | RightHandCopyKey;
export const EXTRA_CATALOG: Record<LanguageCode, { practice: string }> = {
  en:{practice:"Practice"},es:{practice:"Práctica"},fr:{practice:"Pratique"},de:{practice:"Üben"},it:{practice:"Esercizio"},pt:{practice:"Prática"},nl:{practice:"Oefenen"},pl:{practice:"Ćwiczenia"},ru:{practice:"Практика"},uk:{practice:"Практика"},tr:{practice:"Alıştırma"},ar:{practice:"التدريب"},he:{practice:"תרגול"},hi:{practice:"अभ्यास"},bn:{practice:"অনুশীলন"},ur:{practice:"مشق"},id:{practice:"Latihan"},vi:{practice:"Luyện tập"},th:{practice:"ฝึกซ้อม"},ja:{practice:"練習"},ko:{practice:"연습"},"zh-CN":{practice:"练习"},"zh-TW":{practice:"練習"}
};

// Stable message keys keep the UI independent of persisted practice and content data.
export const CATALOG: Record<LanguageCode, Messages> = {
  en: {deviceLanguage:"Use device language",displayLanguage:"Display language",home:"Home",dailyPlan:"Daily Plan",trainer:"Trainer",rightHand:"Right Hand",songs:"Songs",songBuilder:"Song Builder",songLibrary:"Song Library",library:"Library",chordChart:"Chord Chart",about:"About",accessibility:"Accessibility",makeYours:"Make Chord Hero yours",close:"Close accessibility controls",reducedMotion:"Reduced motion",highContrast:"High contrast",colorBlindSafe:"Color-blind-safe heatmaps",dyslexiaSpacing:"Dyslexia-friendly spacing",leftHandedDemos:"Left-handed demos",diagramSize:"Diagram size",audio:"Audio",muteAudio:"Mute all practice audio",haptics:"Haptics where supported",installApp:"Install app",offlineReady:"Offline exercise cache ready.",offlinePending:"Offline cache activates when supported.",license:"License:",settings:"Settings",selectLanguage:"Choose display language"},
  es: {deviceLanguage:"Usar idioma del dispositivo",displayLanguage:"Idioma de visualización",home:"Inicio",dailyPlan:"Plan diario",trainer:"Entrenador",rightHand:"Mano derecha",songs:"Canciones",songBuilder:"Creador de canciones",songLibrary:"Biblioteca de canciones",library:"Biblioteca",chordChart:"Tabla de acordes",about:"Acerca de",accessibility:"Accesibilidad",makeYours:"Personaliza Chord Hero",close:"Cerrar controles de accesibilidad",reducedMotion:"Movimiento reducido",highContrast:"Alto contraste",colorBlindSafe:"Mapas seguros para daltonismo",dyslexiaSpacing:"Espaciado para dislexia",leftHandedDemos:"Demostraciones para zurdos",diagramSize:"Tamaño del diagrama",audio:"Audio",muteAudio:"Silenciar todo el audio de práctica",haptics:"Vibración cuando esté disponible",installApp:"Instalar aplicación",offlineReady:"La caché de ejercicios sin conexión está lista.",offlinePending:"La caché sin conexión se activa cuando sea compatible.",license:"Licencia:",settings:"Ajustes",selectLanguage:"Elige el idioma de visualización"},
  fr: {deviceLanguage:"Langue de l’appareil",displayLanguage:"Langue d’affichage",home:"Accueil",dailyPlan:"Programme quotidien",trainer:"Entraîneur",rightHand:"Main droite",songs:"Chansons",songBuilder:"Créateur de chansons",songLibrary:"Bibliothèque de chansons",library:"Bibliothèque",chordChart:"Tableau d’accords",about:"À propos",accessibility:"Accessibilité",makeYours:"Personnalisez Chord Hero",close:"Fermer les réglages d’accessibilité",reducedMotion:"Animations réduites",highContrast:"Contraste élevé",colorBlindSafe:"Cartes adaptées au daltonisme",dyslexiaSpacing:"Espacement adapté à la dyslexie",leftHandedDemos:"Démonstrations pour gauchers",diagramSize:"Taille du diagramme",audio:"Audio",muteAudio:"Couper tous les sons d’entraînement",haptics:"Retour haptique si disponible",installApp:"Installer l’application",offlineReady:"Le cache d’exercices hors ligne est prêt.",offlinePending:"Le cache hors ligne s’active si disponible.",license:"Licence :",settings:"Réglages",selectLanguage:"Choisir la langue d’affichage"},
  de: {deviceLanguage:"Gerätesprache verwenden",displayLanguage:"Anzeigesprache",home:"Startseite",dailyPlan:"Tagesplan",trainer:"Trainer",rightHand:"Rechte Hand",songs:"Songs",songBuilder:"Song-Editor",songLibrary:"Songbibliothek",library:"Bibliothek",chordChart:"Akkorddiagramm",about:"Über",accessibility:"Barrierefreiheit",makeYours:"Chord Hero anpassen",close:"Eingabehilfen schließen",reducedMotion:"Weniger Bewegung",highContrast:"Hoher Kontrast",colorBlindSafe:"Farbenblindengerechte Heatmaps",dyslexiaSpacing:"Dyslexiefreundlicher Abstand",leftHandedDemos:"Linkshänder-Demos",diagramSize:"Diagrammgröße",audio:"Audio",muteAudio:"Alle Übungstöne stummschalten",haptics:"Vibration, falls unterstützt",installApp:"App installieren",offlineReady:"Offline-Übungscache bereit.",offlinePending:"Offline-Cache wird aktiviert, sofern unterstützt.",license:"Lizenz:",settings:"Einstellungen",selectLanguage:"Anzeigesprache wählen"},
  it: {deviceLanguage:"Usa la lingua del dispositivo",displayLanguage:"Lingua di visualizzazione",home:"Home",dailyPlan:"Piano giornaliero",trainer:"Allenamento",rightHand:"Mano destra",songs:"Brani",songBuilder:"Crea brani",songLibrary:"Libreria brani",library:"Libreria",chordChart:"Tabella accordi",about:"Informazioni",accessibility:"Accessibilità",makeYours:"Personalizza Chord Hero",close:"Chiudi i controlli di accessibilità",reducedMotion:"Movimento ridotto",highContrast:"Contrasto elevato",colorBlindSafe:"Mappe adatte al daltonismo",dyslexiaSpacing:"Spaziatura per dislessia",leftHandedDemos:"Dimostrazioni per mancini",diagramSize:"Dimensione diagramma",audio:"Audio",muteAudio:"Disattiva tutti i suoni di esercitazione",haptics:"Feedback aptico se supportato",installApp:"Installa app",offlineReady:"Cache degli esercizi offline pronta.",offlinePending:"La cache offline si attiva se supportata.",license:"Licenza:",settings:"Impostazioni",selectLanguage:"Scegli la lingua di visualizzazione"},
  pt: {deviceLanguage:"Usar idioma do dispositivo",displayLanguage:"Idioma de exibição",home:"Início",dailyPlan:"Plano diário",trainer:"Treinador",rightHand:"Mão direita",songs:"Músicas",songBuilder:"Criador de músicas",songLibrary:"Biblioteca de músicas",library:"Biblioteca",chordChart:"Tabela de acordes",about:"Sobre",accessibility:"Acessibilidade",makeYours:"Personalize o Chord Hero",close:"Fechar controles de acessibilidade",reducedMotion:"Movimento reduzido",highContrast:"Alto contraste",colorBlindSafe:"Mapas seguros para daltonismo",dyslexiaSpacing:"Espaçamento para dislexia",leftHandedDemos:"Demonstrações para canhotos",diagramSize:"Tamanho do diagrama",audio:"Áudio",muteAudio:"Silenciar todo o áudio de prática",haptics:"Resposta tátil quando disponível",installApp:"Instalar aplicativo",offlineReady:"Cache de exercícios offline pronto.",offlinePending:"O cache offline será ativado quando compatível.",license:"Licença:",settings:"Configurações",selectLanguage:"Escolha o idioma de exibição"},
  nl: {deviceLanguage:"Apparaattaal gebruiken",displayLanguage:"Weergavetaal",home:"Start",dailyPlan:"Dagplan",trainer:"Trainer",rightHand:"Rechterhand",songs:"Nummers",songBuilder:"Nummers maken",songLibrary:"Nummersbibliotheek",library:"Bibliotheek",chordChart:"Akkoordschema",about:"Over",accessibility:"Toegankelijkheid",makeYours:"Pas Chord Hero aan",close:"Toegankelijkheidsinstellingen sluiten",reducedMotion:"Minder beweging",highContrast:"Hoog contrast",colorBlindSafe:"Kleurenblindvriendelijke heatmaps",dyslexiaSpacing:"Dyslexievriendelijke tussenruimte",leftHandedDemos:"Demo’s voor linkshandigen",diagramSize:"Diagramgrootte",audio:"Audio",muteAudio:"Alle oefenaudio dempen",haptics:"Trilfeedback indien ondersteund",installApp:"App installeren",offlineReady:"Offline oefencache gereed.",offlinePending:"Offline cache wordt ingeschakeld indien mogelijk.",license:"Licentie:",settings:"Instellingen",selectLanguage:"Weergavetaal kiezen"},
  pl: {deviceLanguage:"Użyj języka urządzenia",displayLanguage:"Język wyświetlania",home:"Strona główna",dailyPlan:"Plan dnia",trainer:"Trener",rightHand:"Prawa ręka",songs:"Utwory",songBuilder:"Kreator utworów",songLibrary:"Biblioteka utworów",library:"Biblioteka",chordChart:"Tabela akordów",about:"Informacje",accessibility:"Ułatwienia dostępu",makeYours:"Dostosuj Chord Hero",close:"Zamknij ustawienia dostępności",reducedMotion:"Ogranicz ruch",highContrast:"Wysoki kontrast",colorBlindSafe:"Mapy przyjazne daltonistom",dyslexiaSpacing:"Odstępy przyjazne dysleksji",leftHandedDemos:"Demonstracje dla leworęcznych",diagramSize:"Rozmiar diagramu",audio:"Dźwięk",muteAudio:"Wycisz dźwięki ćwiczeń",haptics:"Wibracje, jeśli obsługiwane",installApp:"Zainstaluj aplikację",offlineReady:"Pamięć ćwiczeń offline jest gotowa.",offlinePending:"Pamięć offline włączy się, jeśli jest obsługiwana.",license:"Licencja:",settings:"Ustawienia",selectLanguage:"Wybierz język wyświetlania"},
  ru: {deviceLanguage:"Использовать язык устройства",displayLanguage:"Язык интерфейса",home:"Главная",dailyPlan:"План на день",trainer:"Тренажёр",rightHand:"Правая рука",songs:"Песни",songBuilder:"Создание песен",songLibrary:"Библиотека песен",library:"Библиотека",chordChart:"Таблица аккордов",about:"О приложении",accessibility:"Специальные возможности",makeYours:"Настройте Chord Hero",close:"Закрыть настройки доступности",reducedMotion:"Уменьшить движение",highContrast:"Высокая контрастность",colorBlindSafe:"Тепловые карты для дальтоников",dyslexiaSpacing:"Интервалы для людей с дислексией",leftHandedDemos:"Уроки для левшей",diagramSize:"Размер диаграммы",audio:"Звук",muteAudio:"Отключить звук упражнений",haptics:"Вибрация, если поддерживается",installApp:"Установить приложение",offlineReady:"Кэш упражнений доступен офлайн.",offlinePending:"Офлайн-кэш включится при поддержке.",license:"Лицензия:",settings:"Настройки",selectLanguage:"Выберите язык интерфейса"},
  uk: {deviceLanguage:"Використовувати мову пристрою",displayLanguage:"Мова інтерфейсу",home:"Головна",dailyPlan:"План на день",trainer:"Тренажер",rightHand:"Права рука",songs:"Пісні",songBuilder:"Створення пісень",songLibrary:"Бібліотека пісень",library:"Бібліотека",chordChart:"Таблиця акордів",about:"Про застосунок",accessibility:"Спеціальні можливості",makeYours:"Налаштуйте Chord Hero",close:"Закрити налаштування доступності",reducedMotion:"Зменшити рух",highContrast:"Висока контрастність",colorBlindSafe:"Теплові мапи для дальтоніків",dyslexiaSpacing:"Інтервали для дислексії",leftHandedDemos:"Демонстрації для шульг",diagramSize:"Розмір діаграми",audio:"Звук",muteAudio:"Вимкнути звук вправ",haptics:"Вібрація за підтримки",installApp:"Установити застосунок",offlineReady:"Кеш вправ доступний офлайн.",offlinePending:"Офлайн-кеш увімкнеться за підтримки.",license:"Ліцензія:",settings:"Налаштування",selectLanguage:"Виберіть мову інтерфейсу"},
  tr: {deviceLanguage:"Cihaz dilini kullan",displayLanguage:"Görüntüleme dili",home:"Ana Sayfa",dailyPlan:"Günlük Plan",trainer:"Antrenör",rightHand:"Sağ El",songs:"Şarkılar",songBuilder:"Şarkı Oluşturucu",songLibrary:"Şarkı Kitaplığı",library:"Kitaplık",chordChart:"Akor Tablosu",about:"Hakkında",accessibility:"Erişilebilirlik",makeYours:"Chord Hero’yu kişiselleştir",close:"Erişilebilirlik denetimlerini kapat",reducedMotion:"Hareketi azalt",highContrast:"Yüksek kontrast",colorBlindSafe:"Renk körlüğüne uygun haritalar",dyslexiaSpacing:"Disleksi dostu aralıklar",leftHandedDemos:"Solak gösterimleri",diagramSize:"Diyagram boyutu",audio:"Ses",muteAudio:"Tüm çalışma sesini kapat",haptics:"Destekleniyorsa dokunsal geri bildirim",installApp:"Uygulamayı yükle",offlineReady:"Çevrimdışı alıştırma önbelleği hazır.",offlinePending:"Çevrimdışı önbellek destekleniyorsa etkinleşir.",license:"Lisans:",settings:"Ayarlar",selectLanguage:"Görüntüleme dilini seç"},
  ar: {deviceLanguage:"استخدام لغة الجهاز",displayLanguage:"لغة العرض",home:"الرئيسية",dailyPlan:"الخطة اليومية",trainer:"المدرّب",rightHand:"اليد اليمنى",songs:"الأغاني",songBuilder:"منشئ الأغاني",songLibrary:"مكتبة الأغاني",library:"المكتبة",chordChart:"مخطط الأوتار",about:"حول التطبيق",accessibility:"إمكانية الوصول",makeYours:"خصّص Chord Hero",close:"إغلاق إعدادات إمكانية الوصول",reducedMotion:"تقليل الحركة",highContrast:"تباين عالٍ",colorBlindSafe:"خرائط مناسبة لعمى الألوان",dyslexiaSpacing:"تباعد مناسب لعسر القراءة",leftHandedDemos:"عروض لليد اليسرى",diagramSize:"حجم المخطط",audio:"الصوت",muteAudio:"كتم كل أصوات التدريب",haptics:"اهتزاز عند توفر الدعم",installApp:"تثبيت التطبيق",offlineReady:"ذاكرة التمارين دون اتصال جاهزة.",offlinePending:"تُفعّل الذاكرة دون اتصال عند توفر الدعم.",license:"الترخيص:",settings:"الإعدادات",selectLanguage:"اختر لغة العرض"},
  he: {deviceLanguage:"שימוש בשפת המכשיר",displayLanguage:"שפת התצוגה",home:"דף הבית",dailyPlan:"תוכנית יומית",trainer:"מאמן",rightHand:"יד ימין",songs:"שירים",songBuilder:"יוצר שירים",songLibrary:"ספריית שירים",library:"ספרייה",chordChart:"תרשים אקורדים",about:"מידע",accessibility:"נגישות",makeYours:"התאמה אישית של Chord Hero",close:"סגירת הגדרות הנגישות",reducedMotion:"הפחתת תנועה",highContrast:"ניגודיות גבוהה",colorBlindSafe:"מפות ידידותיות לעיוורון צבעים",dyslexiaSpacing:"מרווחים מותאמים לדיסלקציה",leftHandedDemos:"הדגמות לשמאליים",diagramSize:"גודל התרשים",audio:"שמע",muteAudio:"השתקת כל צלילי האימון",haptics:"משוב רטט אם נתמך",installApp:"התקנת האפליקציה",offlineReady:"מטמון התרגול הלא מקוון מוכן.",offlinePending:"המטמון הלא מקוון יופעל אם תהיה תמיכה.",license:"רישיון:",settings:"הגדרות",selectLanguage:"בחירת שפת התצוגה"},
  hi: {deviceLanguage:"डिवाइस की भाषा इस्तेमाल करें",displayLanguage:"प्रदर्शन भाषा",home:"होम",dailyPlan:"दैनिक योजना",trainer:"प्रशिक्षक",rightHand:"दायाँ हाथ",songs:"गाने",songBuilder:"गीत निर्माता",songLibrary:"गीत लाइब्रेरी",library:"लाइब्रेरी",chordChart:"कॉर्ड चार्ट",about:"परिचय",accessibility:"सुलभता",makeYours:"Chord Hero को अपनी पसंद का बनाएँ",close:"सुलभता नियंत्रण बंद करें",reducedMotion:"कम गति",highContrast:"ज़्यादा कंट्रास्ट",colorBlindSafe:"कलर ब्लाइंड के अनुकूल हीटमैप",dyslexiaSpacing:"डिस्लेक्सिया-अनुकूल रिक्ति",leftHandedDemos:"बाएँ हाथ के प्रदर्शन",diagramSize:"आरेख का आकार",audio:"ऑडियो",muteAudio:"अभ्यास की सभी आवाज़ें म्यूट करें",haptics:"समर्थित होने पर कंपन",installApp:"ऐप इंस्टॉल करें",offlineReady:"ऑफ़लाइन अभ्यास कैश तैयार है।",offlinePending:"समर्थित होने पर ऑफ़लाइन कैश सक्रिय होगा।",license:"लाइसेंस:",settings:"सेटिंग",selectLanguage:"प्रदर्शन भाषा चुनें"},
  bn: {deviceLanguage:"ডিভাইসের ভাষা ব্যবহার করুন",displayLanguage:"প্রদর্শনের ভাষা",home:"হোম",dailyPlan:"দৈনিক পরিকল্পনা",trainer:"প্রশিক্ষক",rightHand:"ডান হাত",songs:"গান",songBuilder:"গান তৈরি",songLibrary:"গানের লাইব্রেরি",library:"লাইব্রেরি",chordChart:"কর্ড চার্ট",about:"সম্পর্কে",accessibility:"অ্যাক্সেসিবিলিটি",makeYours:"Chord Hero নিজের মতো সাজান",close:"অ্যাক্সেসিবিলিটি নিয়ন্ত্রণ বন্ধ করুন",reducedMotion:"গতি কমান",highContrast:"উচ্চ কনট্রাস্ট",colorBlindSafe:"বর্ণান্ধ-বান্ধব হিটম্যাপ",dyslexiaSpacing:"ডিসলেক্সিয়া-বান্ধব ব্যবধান",leftHandedDemos:"বাঁহাতিদের ডেমো",diagramSize:"ডায়াগ্রামের আকার",audio:"অডিও",muteAudio:"অনুশীলনের সব অডিও বন্ধ করুন",haptics:"সমর্থিত হলে কম্পন",installApp:"অ্যাপ ইনস্টল করুন",offlineReady:"অফলাইন অনুশীলনের ক্যাশ প্রস্তুত।",offlinePending:"সমর্থিত হলে অফলাইন ক্যাশ চালু হবে।",license:"লাইসেন্স:",settings:"সেটিংস",selectLanguage:"প্রদর্শনের ভাষা বেছে নিন"},
  ur: {deviceLanguage:"آلے کی زبان استعمال کریں",displayLanguage:"ڈسپلے کی زبان",home:"صفحۂ اول",dailyPlan:"روزانہ منصوبہ",trainer:"مشق",rightHand:"دایاں ہاتھ",songs:"گانے",songBuilder:"گانے بنائیں",songLibrary:"گانے کی لائبریری",library:"لائبریری",chordChart:"کورڈ چارٹ",about:"تعارف",accessibility:"رسائی",makeYours:"Chord Hero کو اپنی مرضی کا بنائیں",close:"رسائی کی ترتیبات بند کریں",reducedMotion:"حرکت کم کریں",highContrast:"زیادہ تضاد",colorBlindSafe:"رنگ شناسی کے لیے موزوں نقشے",dyslexiaSpacing:"ڈسلیکسیا کے لیے موزوں فاصلہ",leftHandedDemos:"بائیں ہاتھ کی مثالیں",diagramSize:"خاکے کا سائز",audio:"آڈیو",muteAudio:"مشق کی تمام آوازیں بند کریں",haptics:"دستیاب ہو تو ارتعاش",installApp:"ایپ انسٹال کریں",offlineReady:"آف لائن مشق کیش تیار ہے۔",offlinePending:"دستیاب ہونے پر آف لائن کیش فعال ہوگا۔",license:"لائسنس:",settings:"ترتیبات",selectLanguage:"ڈسپلے کی زبان منتخب کریں"},
  id: {deviceLanguage:"Gunakan bahasa perangkat",displayLanguage:"Bahasa tampilan",home:"Beranda",dailyPlan:"Rencana harian",trainer:"Pelatih",rightHand:"Tangan kanan",songs:"Lagu",songBuilder:"Pembuat lagu",songLibrary:"Pustaka lagu",library:"Pustaka",chordChart:"Bagan akor",about:"Tentang",accessibility:"Aksesibilitas",makeYours:"Sesuaikan Chord Hero",close:"Tutup kontrol aksesibilitas",reducedMotion:"Kurangi gerakan",highContrast:"Kontras tinggi",colorBlindSafe:"Peta untuk buta warna",dyslexiaSpacing:"Jarak ramah disleksia",leftHandedDemos:"Demo untuk kidal",diagramSize:"Ukuran diagram",audio:"Audio",muteAudio:"Bisukan semua audio latihan",haptics:"Getaran jika didukung",installApp:"Instal aplikasi",offlineReady:"Cache latihan offline siap.",offlinePending:"Cache offline aktif jika didukung.",license:"Lisensi:",settings:"Pengaturan",selectLanguage:"Pilih bahasa tampilan"},
  vi: {deviceLanguage:"Dùng ngôn ngữ thiết bị",displayLanguage:"Ngôn ngữ hiển thị",home:"Trang chủ",dailyPlan:"Kế hoạch hằng ngày",trainer:"Luyện tập",rightHand:"Tay phải",songs:"Bài hát",songBuilder:"Tạo bài hát",songLibrary:"Thư viện bài hát",library:"Thư viện",chordChart:"Sơ đồ hợp âm",about:"Giới thiệu",accessibility:"Trợ năng",makeYours:"Tùy chỉnh Chord Hero",close:"Đóng tùy chọn trợ năng",reducedMotion:"Giảm chuyển động",highContrast:"Độ tương phản cao",colorBlindSafe:"Bản đồ thân thiện với người mù màu",dyslexiaSpacing:"Khoảng cách hỗ trợ chứng khó đọc",leftHandedDemos:"Bản minh họa cho người thuận tay trái",diagramSize:"Kích thước sơ đồ",audio:"Âm thanh",muteAudio:"Tắt toàn bộ âm thanh luyện tập",haptics:"Rung nếu được hỗ trợ",installApp:"Cài đặt ứng dụng",offlineReady:"Bộ nhớ bài tập ngoại tuyến đã sẵn sàng.",offlinePending:"Bộ nhớ ngoại tuyến sẽ bật khi được hỗ trợ.",license:"Giấy phép:",settings:"Cài đặt",selectLanguage:"Chọn ngôn ngữ hiển thị"},
  th: {deviceLanguage:"ใช้ภาษาของอุปกรณ์",displayLanguage:"ภาษาที่แสดง",home:"หน้าหลัก",dailyPlan:"แผนรายวัน",trainer:"ฝึกซ้อม",rightHand:"มือขวา",songs:"เพลง",songBuilder:"สร้างเพลง",songLibrary:"คลังเพลง",library:"คลัง",chordChart:"แผนผังคอร์ด",about:"เกี่ยวกับ",accessibility:"การช่วยการเข้าถึง",makeYours:"ปรับแต่ง Chord Hero",close:"ปิดการตั้งค่าการช่วยการเข้าถึง",reducedMotion:"ลดการเคลื่อนไหว",highContrast:"คอนทราสต์สูง",colorBlindSafe:"แผนที่เหมาะกับผู้ตาบอดสี",dyslexiaSpacing:"ระยะห่างที่เหมาะกับผู้มีภาวะดิสเล็กเซีย",leftHandedDemos:"สาธิตสำหรับคนถนัดซ้าย",diagramSize:"ขนาดแผนผัง",audio:"เสียง",muteAudio:"ปิดเสียงฝึกซ้อมทั้งหมด",haptics:"การสั่นเมื่อรองรับ",installApp:"ติดตั้งแอป",offlineReady:"แคชแบบฝึกหัดออฟไลน์พร้อมแล้ว",offlinePending:"แคชออฟไลน์จะทำงานเมื่อรองรับ",license:"ใบอนุญาต:",settings:"การตั้งค่า",selectLanguage:"เลือกภาษาที่แสดง"},
  ja: {deviceLanguage:"端末の言語を使用",displayLanguage:"表示言語",home:"ホーム",dailyPlan:"毎日のプラン",trainer:"トレーナー",rightHand:"右手",songs:"曲",songBuilder:"ソングビルダー",songLibrary:"曲ライブラリ",library:"ライブラリ",chordChart:"コード表",about:"アプリについて",accessibility:"アクセシビリティ",makeYours:"Chord Heroをカスタマイズ",close:"アクセシビリティ設定を閉じる",reducedMotion:"視差効果を減らす",highContrast:"高コントラスト",colorBlindSafe:"色覚に配慮したヒートマップ",dyslexiaSpacing:"読みやすい文字間隔",leftHandedDemos:"左利き用デモ",diagramSize:"図のサイズ",audio:"オーディオ",muteAudio:"練習音をすべてミュート",haptics:"対応時に触覚フィードバック",installApp:"アプリをインストール",offlineReady:"オフライン練習キャッシュの準備ができました。",offlinePending:"対応している場合はオフラインキャッシュを有効にします。",license:"ライセンス:",settings:"設定",selectLanguage:"表示言語を選択"},
  ko: {deviceLanguage:"기기 언어 사용",displayLanguage:"표시 언어",home:"홈",dailyPlan:"일일 계획",trainer:"트레이너",rightHand:"오른손",songs:"곡",songBuilder:"곡 만들기",songLibrary:"곡 라이브러리",library:"라이브러리",chordChart:"코드 차트",about:"정보",accessibility:"접근성",makeYours:"Chord Hero 맞춤 설정",close:"접근성 설정 닫기",reducedMotion:"동작 줄이기",highContrast:"고대비",colorBlindSafe:"색맹 친화적 히트맵",dyslexiaSpacing:"난독증 친화적 간격",leftHandedDemos:"왼손잡이 데모",diagramSize:"다이어그램 크기",audio:"오디오",muteAudio:"모든 연습 오디오 음소거",haptics:"지원되는 경우 햅틱",installApp:"앱 설치",offlineReady:"오프라인 연습 캐시가 준비되었습니다.",offlinePending:"지원되는 경우 오프라인 캐시가 활성화됩니다.",license:"라이선스:",settings:"설정",selectLanguage:"표시 언어 선택"},
  "zh-CN": {deviceLanguage:"使用设备语言",displayLanguage:"显示语言",home:"主页",dailyPlan:"每日计划",trainer:"训练器",rightHand:"右手练习",songs:"歌曲",songBuilder:"歌曲编辑器",songLibrary:"歌曲库",library:"和弦库",chordChart:"和弦图表",about:"关于",accessibility:"无障碍功能",makeYours:"自定义 Chord Hero",close:"关闭无障碍控件",reducedMotion:"减少动态效果",highContrast:"高对比度",colorBlindSafe:"色盲友好热力图",dyslexiaSpacing:"阅读友好间距",leftHandedDemos:"左手演示",diagramSize:"图表大小",audio:"音频",muteAudio:"静音所有练习音频",haptics:"支持时启用触觉反馈",installApp:"安装应用",offlineReady:"离线练习缓存已就绪。",offlinePending:"支持时将启用离线缓存。",license:"许可证：",settings:"设置",selectLanguage:"选择显示语言"},
  "zh-TW": {deviceLanguage:"使用裝置語言",displayLanguage:"顯示語言",home:"首頁",dailyPlan:"每日計畫",trainer:"訓練器",rightHand:"右手練習",songs:"歌曲",songBuilder:"歌曲編輯器",songLibrary:"歌曲庫",library:"和弦庫",chordChart:"和弦圖表",about:"關於",accessibility:"無障礙功能",makeYours:"自訂 Chord Hero",close:"關閉無障礙控制項",reducedMotion:"減少動態效果",highContrast:"高對比",colorBlindSafe:"色盲友善熱力圖",dyslexiaSpacing:"閱讀友善間距",leftHandedDemos:"左手演示",diagramSize:"圖表大小",audio:"音訊",muteAudio:"靜音所有練習音訊",haptics:"支援時啟用觸覺回饋",installApp:"安裝應用程式",offlineReady:"離線練習快取已就緒。",offlinePending:"支援時將啟用離線快取。",license:"授權條款：",settings:"設定",selectLanguage:"選擇顯示語言"}
};

function getMessage(language: LanguageCode, key: MessageKey): string {
  if (key in RIGHT_HAND_COPY[language]) return RIGHT_HAND_COPY[language][key as RightHandCopyKey];
  if (key in TRAINER_UI_COPY[language]) return TRAINER_UI_COPY[language][key as TrainerUiCopyKey];
  if (key in UI_COPY_EXTRA[language]) return UI_COPY_EXTRA[language][key as UiCopyExtraKey];
  if (key in FEATURE_COPY[language]) return FEATURE_COPY[language][key as FeatureCopyKey];
  if (key in TRAINER_COPY[language]) return TRAINER_COPY[language][key as TrainerCopyKey];
  if (key in SURFACE_COPY[language]) return SURFACE_COPY[language][key as SurfaceCopyKey];
  if (key in UI_COPY[language]) return UI_COPY[language][key as UiCopyKey];
  if (key in PAGE_COPY[language]) return PAGE_COPY[language][key as PageCopyKey];
  if (key in HOME_CARD_COPY[language]) return HOME_CARD_COPY[language][key as HomeCardCopyKey];
  return key === "practice" ? EXTRA_CATALOG[language].practice : CATALOG[language][key as keyof Messages];
}

const MESSAGE_SOURCES: Array<Record<LanguageCode, Record<string, string>>> = [
  CATALOG as Record<LanguageCode, Record<string, string>>,
  Object.fromEntries(LANGUAGE_OPTIONS.map(([language]) => [language, EXTRA_CATALOG[language]])) as unknown as Record<LanguageCode, Record<string, string>>,
  PAGE_COPY as Record<LanguageCode, Record<string, string>>,
  HOME_CARD_COPY as Record<LanguageCode, Record<string, string>>,
  UI_COPY as Record<LanguageCode, Record<string, string>>,
  UI_COPY_EXTRA as Record<LanguageCode, Record<string, string>>,
  FEATURE_COPY as Record<LanguageCode, Record<string, string>>,
  TRAINER_COPY as Record<LanguageCode, Record<string, string>>,
  SURFACE_COPY as Record<LanguageCode, Record<string, string>>,
  TRAINER_UI_COPY as Record<LanguageCode, Record<string, string>>,
  RIGHT_HAND_COPY as Record<LanguageCode, Record<string, string>>
];

const ENGLISH_TEXT_KEYS = new Map<string, MessageKey>();
for (const source of MESSAGE_SOURCES) {
  for (const [key, text] of Object.entries(source.en)) {
    // Earlier entries follow the same priority as getMessage; retain the first match.
    if (!ENGLISH_TEXT_KEYS.has(text)) ENGLISH_TEXT_KEYS.set(text, key as MessageKey);
  }
}

/** Translate an exact, catalog-backed UI phrase. Unknown text stays untouched. */
export function translateCatalogText(language: LanguageCode, text: string): string {
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const phrase = text.slice(leading.length, text.length - trailing.length || undefined);
  const key = ENGLISH_TEXT_KEYS.get(phrase);
  return key ? `${leading}${getMessage(language, key)}${trailing}` : text;
}

export function normalizeLanguage(tag: string | undefined | null): LanguageCode {
  if (!tag) return "en";
  const normalized = tag.replace(/_/g, "-");
  if (/^zh-(tw|hk|mo|hant)(-|$)/i.test(normalized)) return "zh-TW";
  if (/^zh-(cn|sg|hans)(-|$)/i.test(normalized) || /^zh$/i.test(normalized)) return "zh-CN";
  const language = normalized.split("-")[0].toLowerCase();
  return LANGUAGE_OPTIONS.find(([code]) => code.toLowerCase() === language)?.[0] ?? "en";
}

export function detectLanguage(preferred: readonly string[]): LanguageCode {
  for (const tag of preferred) {
    const result = normalizeLanguage(tag);
    if (tag && (result !== "en" || /^en(?:-|$)/i.test(tag))) return result;
  }
  return "en";
}
export function isRightToLeft(language: LanguageCode) { return language === "ar" || language === "he" || language === "ur"; }

export type TranslationValues = Record<string, string | number>;
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
function interpolate(message: string, values: TranslationValues = {}) {
  return message.replace(/\{([a-zA-Z][\w]*)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function formatPlural(language: LanguageCode, count: number, forms: PluralForms, values: TranslationValues = {}) {
  const category = new Intl.PluralRules(language).select(count);
  return interpolate(forms[category] ?? forms.other, { count, ...values });
}

type LocaleContextValue = {
  language: LanguageCode; preference: LocalePreference; setPreference: (value: LocalePreference) => void;
  t: (key: MessageKey, values?: TranslationValues) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, maximumFractionDigits?: number) => string;
  formatDuration: (seconds: number) => string;
};
const LocaleContext = createContext<LocaleContextValue>({
  language: "en", preference: "auto", setPreference: () => undefined,
  t: (key, values) => interpolate(getMessage("en", key), values),
  formatDate: (date, options) => new Intl.DateTimeFormat("en", options).format(date),
  formatNumber: (number, options) => new Intl.NumberFormat("en", options).format(number),
  formatPercent: (number, maximumFractionDigits = 0) => new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits }).format(number),
  formatDuration: (seconds) => new Intl.NumberFormat("en", { style: "unit", unit: "second", unitDisplay: "short" }).format(seconds)
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>("auto");
  const [detected, setDetected] = useState<LanguageCode>("en");
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(LOCALE_STORAGE_KEY); } catch { /* Device language remains available without storage. */ }
    if (stored === "auto" || LANGUAGE_OPTIONS.some(([code]) => code === stored)) setPreferenceState(stored as LocalePreference);
    const updateDevice = () => setDetected(detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
    updateDevice();
    window.addEventListener("languagechange", updateDevice);
    return () => window.removeEventListener("languagechange", updateDevice);
  }, []);
  const setPreference = useCallback((value: LocalePreference) => {
    setPreferenceState(value);
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, value); } catch { /* Keep the live selection when storage is unavailable. */ }
  }, []);
  const language = preference === "auto" ? detected : preference;
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRightToLeft(language) ? "rtl" : "ltr";
  }, [language]);
  const value = useMemo(() => ({
    language, preference, setPreference,
    t: (key: MessageKey, values?: TranslationValues) => interpolate(getMessage(language, key), values),
    formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => formatDate(date, language, options),
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) => formatNumber(number, language, options),
    formatPercent: (number: number, maximumFractionDigits = 0) => formatPercent(number, language, maximumFractionDigits),
    formatDuration: (seconds: number) => formatDuration(seconds, language)
  }), [language, preference, setPreference]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }
export function formatDate(date: Date, language: LanguageCode, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat(language, options).format(date); }
export function formatNumber(value: number, language: LanguageCode, options?: Intl.NumberFormatOptions) { return new Intl.NumberFormat(language, options).format(value); }
export function formatPercent(value: number, language: LanguageCode, maximumFractionDigits = 0) { return new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits }).format(value); }
export function formatDuration(seconds: number, language: LanguageCode) { return new Intl.NumberFormat(language, { style: "unit", unit: "second", unitDisplay: "short" }).format(seconds); }
