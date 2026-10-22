import type { LanguageCode } from "./localization";

export const UI_COPY_EXTRA_KEYS = [
  "play", "mistakes", "defaultTempo", "techniqueClick", "raiseTempoAfterClean", "stop", "repeat", "markClean",
  "needsWork", "missed", "roundHistory", "previousExercise", "nextExercise", "noExerciseAvailable", "advanced",
  "record", "listening", "redo", "ready", "getReady", "loops", "remaining", "seconds", "minutes"
] as const;
export type UiCopyExtraKey = (typeof UI_COPY_EXTRA_KEYS)[number];

const rows: Record<LanguageCode, string> = {
  en: "Play|Mistakes|Default tempo|Technique click|Raise tempo after a clean round|Stop|Repeat|Mark clean|Needs work|Missed|Round history|Previous exercise|Next exercise|No exercise available|Advanced|Record|Listening…|Redo|Ready|Get ready|Loops|remaining|seconds|minutes",
  es: "Reproducir|Errores|Tempo predeterminado|Clic de técnica|Aumentar el tempo tras una ronda limpia|Detener|Repetir|Marcar como limpio|Necesita mejorar|Fallado|Historial de rondas|Ejercicio anterior|Ejercicio siguiente|No hay ejercicios disponibles|Avanzado|Grabar|Escuchando…|Repetir|Listo|Prepárate|Vueltas|restantes|segundos|minutos",
  fr: "Lire|Erreurs|Tempo par défaut|Clic de technique|Accélérer après une manche sans erreur|Arrêter|Répéter|Marquer comme réussi|À travailler|Manqué|Historique des manches|Exercice précédent|Exercice suivant|Aucun exercice disponible|Avancé|Enregistrer|Écoute…|Refaire|Prêt|Préparez-vous|Boucles|restantes|secondes|minutes",
  de: "Abspielen|Fehler|Standardtempo|Technik-Klick|Tempo nach einer fehlerfreien Runde erhöhen|Stoppen|Wiederholen|Fehlerfrei markieren|Noch üben|Verpasst|Rundenverlauf|Vorherige Übung|Nächste Übung|Keine Übung verfügbar|Fortgeschritten|Aufnehmen|Hört zu…|Wiederholen|Bereit|Mach dich bereit|Durchläufe|übrig|Sekunden|Minuten",
  it: "Riproduci|Errori|Tempo predefinito|Clic della tecnica|Aumenta il tempo dopo un turno pulito|Ferma|Ripeti|Segna come pulito|Da migliorare|Saltato|Cronologia turni|Esercizio precedente|Esercizio successivo|Nessun esercizio disponibile|Avanzato|Registra|In ascolto…|Rifai|Pronto|Preparati|Cicli|rimanenti|secondi|minuti",
  pt: "Reproduzir|Erros|Ritmo padrão|Clique da técnica|Aumentar o ritmo após uma rodada sem erros|Parar|Repetir|Marcar como correto|Precisa melhorar|Perdido|Histórico de rodadas|Exercício anterior|Próximo exercício|Nenhum exercício disponível|Avançado|Gravar|Ouvindo…|Refazer|Pronto|Prepare-se|Ciclos|restantes|segundos|minutos",
  nl: "Afspelen|Fouten|Standaardtempo|Techniekklik|Tempo verhogen na een foutloze ronde|Stoppen|Herhalen|Foutloos markeren|Nog oefenen|Gemist|Rondegeschiedenis|Vorige oefening|Volgende oefening|Geen oefening beschikbaar|Gevorderd|Opnemen|Luistert…|Opnieuw|Klaar|Maak je klaar|Rondes|resterend|seconden|minuten",
  pl: "Odtwórz|Błędy|Tempo domyślne|Klik techniki|Zwiększ tempo po bezbłędnej rundzie|Zatrzymaj|Powtórz|Oznacz jako czyste|Do poprawy|Pominięte|Historia rund|Poprzednie ćwiczenie|Następne ćwiczenie|Brak dostępnych ćwiczeń|Zaawansowany|Nagraj|Słuchanie…|Powtórz|Gotowe|Przygotuj się|Pętle|pozostało|sekundy|minuty",
  ru: "Играть|Ошибки|Темп по умолчанию|Щелчок техники|Увеличивать темп после раунда без ошибок|Стоп|Повторить|Отметить как чисто|Нужно поработать|Пропущено|История раундов|Предыдущее упражнение|Следующее упражнение|Нет доступных упражнений|Продвинутый|Записать|Слушаю…|Повторить|Готово|Приготовьтесь|Циклы|осталось|секунды|минуты",
  uk: "Відтворити|Помилки|Темп за замовчуванням|Клік техніки|Збільшувати темп після раунду без помилок|Зупинити|Повторити|Позначити як чисто|Потрібно попрацювати|Пропущено|Історія раундів|Попередня вправа|Наступна вправа|Немає доступних вправ|Просунутий|Записати|Слухаю…|Повторити|Готово|Приготуйся|Цикли|залишилося|секунди|хвилини",
  tr: "Çal|Hatalar|Varsayılan tempo|Teknik tıklaması|Temiz turdan sonra tempoyu artır|Durdur|Tekrarla|Temiz olarak işaretle|Üzerinde çalışılmalı|Kaçırıldı|Tur geçmişi|Önceki egzersiz|Sonraki egzersiz|Kullanılabilir egzersiz yok|İleri|Kaydet|Dinleniyor…|Yeniden yap|Hazır|Hazırlan|Döngüler|kaldı|saniye|dakika",
  ar: "تشغيل|أخطاء|الإيقاع الافتراضي|نقرة التقنية|ارفع الإيقاع بعد جولة بلا أخطاء|إيقاف|تكرار|علّمها نظيفة|تحتاج إلى تدريب|فاتت|سجل الجولات|التمرين السابق|التمرين التالي|لا توجد تمارين متاحة|متقدم|تسجيل|جارٍ الاستماع…|أعِد|جاهز|استعد|دورات|متبقية|ثوانٍ|دقائق",
  he: "הפעלה|טעויות|קצב ברירת מחדל|נקישת טכניקה|העלה את הקצב אחרי סבב נקי|עצירה|חזרה|סימון כנקי|צריך תרגול|הוחמץ|היסטוריית סבבים|התרגיל הקודם|התרגיל הבא|אין תרגילים זמינים|מתקדם|הקלטה|מקשיב…|נסה שוב|מוכן|התכוננו|לולאות|נותרו|שניות|דקות",
  hi: "चलाएँ|गलतियाँ|डिफ़ॉल्ट गति|तकनीक क्लिक|साफ़ राउंड के बाद गति बढ़ाएँ|रोकें|दोहराएँ|साफ़ चिह्नित करें|और अभ्यास चाहिए|छूट गया|राउंड इतिहास|पिछला अभ्यास|अगला अभ्यास|कोई अभ्यास उपलब्ध नहीं|उन्नत|रिकॉर्ड करें|सुन रहा है…|फिर करें|तैयार|तैयार हो जाएँ|लूप|बाकी|सेकंड|मिनट",
  bn: "চালান|ভুল|ডিফল্ট গতি|কৌশল ক্লিক|ভুলহীন রাউন্ডের পর গতি বাড়ান|থামুন|আবার করুন|নির্ভুল চিহ্নিত করুন|আরও অনুশীলন দরকার|মিস হয়েছে|রাউন্ডের ইতিহাস|আগের অনুশীলন|পরের অনুশীলন|কোনো অনুশীলন নেই|উন্নত|রেকর্ড|শুনছে…|আবার করুন|প্রস্তুত|প্রস্তুত হন|লুপ|বাকি|সেকেন্ড|মিনিট",
  ur: "چلائیں|غلطیاں|طے شدہ رفتار|تکنیک کلک|صاف راؤنڈ کے بعد رفتار بڑھائیں|روکیں|دہرائیں|صاف نشان لگائیں|مزید مشق درکار|رہ گیا|راؤنڈ کی سرگزشت|پچھلی مشق|اگلی مشق|کوئی مشق دستیاب نہیں|اعلیٰ|ریکارڈ کریں|سن رہا ہے…|دوبارہ کریں|تیار|تیار ہو جائیں|چکر|باقی|سیکنڈ|منٹ",
  id: "Putar|Kesalahan|Tempo default|Klik teknik|Naikkan tempo setelah ronde bersih|Hentikan|Ulangi|Tandai bersih|Perlu latihan|Terlewat|Riwayat ronde|Latihan sebelumnya|Latihan berikutnya|Tidak ada latihan tersedia|Lanjutan|Rekam|Mendengarkan…|Ulangi|Siap|Bersiap|Putaran|tersisa|detik|menit",
  vi: "Phát|Lỗi|Nhịp độ mặc định|Tiếng nhịp kỹ thuật|Tăng nhịp độ sau vòng không lỗi|Dừng|Lặp lại|Đánh dấu chuẩn|Cần luyện thêm|Bỏ lỡ|Lịch sử vòng|Bài tập trước|Bài tập tiếp theo|Không có bài tập|Nâng cao|Ghi âm|Đang nghe…|Làm lại|Sẵn sàng|Chuẩn bị|Vòng lặp|còn lại|giây|phút",
  th: "เล่น|ข้อผิดพลาด|จังหวะเริ่มต้น|เสียงคลิกเทคนิค|เพิ่มจังหวะหลังจบรอบโดยไม่มีข้อผิดพลาด|หยุด|ทำซ้ำ|ทำเครื่องหมายว่าดี|ควรฝึกเพิ่ม|พลาด|ประวัติรอบ|แบบฝึกก่อนหน้า|แบบฝึกถัดไป|ไม่มีแบบฝึก|ขั้นสูง|บันทึก|กำลังฟัง…|ทำอีกครั้ง|พร้อม|เตรียมตัว|รอบ|เหลือ|วินาที|นาที",
  ja: "再生|ミス|標準テンポ|テクニッククリック|ミスのないラウンド後にテンポを上げる|停止|繰り返す|成功として記録|要練習|ミス|ラウンド履歴|前の練習|次の練習|練習がありません|上級|録音|聞き取り中…|やり直す|準備完了|準備してください|ループ|残り|秒|分",
  ko: "재생|실수|기본 템포|기술 클릭|실수 없는 라운드 후 템포 올리기|중지|반복|성공으로 표시|더 연습 필요|놓침|라운드 기록|이전 연습|다음 연습|연습 없음|고급|녹음|듣는 중…|다시 하기|준비 완료|준비하세요|반복|남음|초|분",
  "zh-CN": "播放|错误|默认速度|技巧节拍|无失误回合后提高速度|停止|重复|标记为干净|需要改进|错过|回合记录|上一个练习|下一个练习|没有可用练习|高级|录制|正在聆听…|重做|准备就绪|准备好|循环|剩余|秒|分钟",
  "zh-TW": "播放|錯誤|預設速度|技巧節拍|無失誤回合後提高速度|停止|重複|標記為乾淨|需要改進|錯過|回合記錄|上一個練習|下一個練習|沒有可用練習|進階|錄製|正在聆聽…|重做|準備就緒|準備好|循環|剩餘|秒|分鐘"
};

export const UI_COPY_EXTRA: Record<LanguageCode, Record<UiCopyExtraKey, string>> = Object.fromEntries(
  Object.entries(rows).map(([locale, row]) => {
    const values = row.split("|");
    if (values.length !== UI_COPY_EXTRA_KEYS.length) throw new Error(`Extra UI localization count mismatch for ${locale}`);
    return [locale, Object.fromEntries(UI_COPY_EXTRA_KEYS.map((key, index) => [key, values[index]]))];
  })
) as Record<LanguageCode, Record<UiCopyExtraKey, string>>;
