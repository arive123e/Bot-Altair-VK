require('dotenv').config(); // 🔐 Загружаем переменные из .env

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ====== Глобальные переменные ======
const token = process.env.TELEGRAM_BOT_TOKEN;
const SUPPORT_CHAT_ID = -4778492984; // chat_id группы поддержки

if (!token) {
  console.error('❌ Ошибка: не указан TELEGRAM_BOT_TOKEN в .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const replyContext = {}; // Кому отвечает магистр поддержки

// =========================
// 1. СТАРТ, ПОРТАЛ, ПРИВЕТСТВИЕ
// =========================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const tgId = msg.from.id;

  // 🪄 Ссылка на портал авторизации VK ID с передачей tg_id
  const vkAuthUrl = `https://fokusnikaltair.xyz/vkid-auth.html?tg_id=${tgId}`;

  const welcomeText = `Абра-кадабра и немного кода 🧙‍♂️
  
Ты только что призвал Фокусника Альтаира — теперь твои VK-новости сами переползают в Telegram по волшебству, а не по прихоти алгоритмов.

Забудь про унылые бесконечные ленты, ведь у тебя есть личный маг, который сортирует новости по щелчку пальцев (и клику на портал).

Магия не работает без твоего участия — активируй портал и начни колдовать ✨ 
`;

  bot.sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Сотворить заклинание перехода 🌀', url: vkAuthUrl }],
        [{ text: 'Магическая безопасность 🔐', callback_data: 'privacy' }]
      ]
    }
  });

  console.log(`📨 Отправлена ссылка авторизации пользователю ${tgId}`);
});

// =========================
// 2. ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ
// =========================

bot.on('callback_query', async (query) => {
  // --- Магическая безопасность (политика) ---
  if (query.data === 'privacy') {
    const privacyText = `Ваша приватность — под надёжной защитой магии и современных технологий 🛡
Данные используются только для отправки новостей из выбранных вами VK-групп. 
Токены хранятся на сервере, не передаются третьим лицам.

Полная политика конфиденциальности:
https://api.fokusnikaltair.xyz/privacy.html`;

    await bot.sendMessage(query.message.chat.id, privacyText, {
      disable_web_page_preview: true
    });
    await bot.answerCallbackQuery(query.id);
    return;
  }
  // --- Блок для будущей логики callback-кнопок по группам, ленте, подписке и т.д. ---
  // if (query.data.startsWith('group_')) { ... }
});

// =========================
// 3. ОСНОВНАЯ ЛОГИКА (группы, лента, подписка, будущие функции)
// =========================

// Добавляй обработку групп, новостных лент и т.д. здесь.

// Например:
/*
bot.on('callback_query', async (query) => {
  if (query.data.startsWith('group_')) {
    // Обработка выбора групп, отправка ленты и прочее
  }
});
*/

// =========================
// 4. ПОДДЕРЖКА, ВОПРОСЫ, ЧАТЫ
// =========================

// --- Кнопка /support или "Связаться с магистром" ---
bot.onText(/\/support/, (msg) => {
  bot.sendMessage(msg.chat.id,
    "Если у тебя есть вопрос, пожелание или что-то не работает — просто опиши проблему в следующем сообщении! Магистр прочитает и обязательно ответит. Твой Telegram ник останется скрыт, а магическая поддержка уже рядом! ✉️"
  );
});

// --- Ответить пользователю из группы поддержки ---
bot.on('callback_query', async (query) => {
  if (query.data.startsWith('reply_')) {
    const userId = query.data.split('_')[1];
    // Сохраняем, кому будет следующий ответ этого магистра
    replyContext[query.from.id] = userId;
    // Подтверждение для магистра в группе
    await bot.sendMessage(
      query.message.chat.id,
      `✍️ Напишите свой ответ для пользователя (ID: ${userId}), отправьте следующим сообщением прямо в этот чат.`
    );
    await bot.answerCallbackQuery(query.id, { text: 'Жду вашего ответа!' });
    return;
  }
});

// --- Обработка ВСЕХ сообщений (и вопросы, и ответы магистра) ---
bot.on('message', (msg) => {
  // 1. Если ожидаем твой ответ и сообщение пришло из группы поддержки — пересылаем пользователю:
  if (replyContext[msg.from.id] && msg.chat.id === SUPPORT_CHAT_ID) {
    const targetUserId = replyContext[msg.from.id];

    bot.sendMessage(
      targetUserId,
      `🧙 Магистр бота отвечает:\n${msg.text}`
    );

    bot.sendMessage(
      msg.chat.id,
      "✅ Ответ отправлен пользователю!"
    );

    // Очищаем контекст для следующего ответа
    delete replyContext[msg.from.id];
    return; // Завершаем выполнение, чтобы не сработал следующий блок
  }

  // 2. Если сообщение не из группы поддержки, не команда и не от бота — пересылаем в поддержку:
  if (
    msg.chat.id === SUPPORT_CHAT_ID ||
    (msg.text && msg.text.startsWith('/')) ||
    msg.from.is_bot
  ) return;

  // Пересылаем в группу поддержки с кнопкой "Ответить"
  bot.sendMessage(SUPPORT_CHAT_ID,
    `🧙 Вопрос от @${msg.from.username || msg.from.id} (ID: ${msg.from.id}):\n${msg.text}`, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "Ответить",
            callback_data: `reply_${msg.from.id}`
          }]
        ]
      }
    }
  );
});

/*
 === (5) Остальное: Fallback и сервисные штуки, если нужны ===
 Например, обработка неизвестных команд:
bot.onText(/./, (msg) => { обработка неизвестных команд, если нужно
});
*/

