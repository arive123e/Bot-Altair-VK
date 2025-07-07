require('dotenv').config(); // 🔐 Загружаем переменные из .env

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// 🤖 Получаем токен Telegram-бота из переменной окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const SUPPORT_CHAT_ID = -4927632033; // chat_id группы поддержки


if (!token) {
  console.error('❌ Ошибка: не указан TELEGRAM_BOT_TOKEN в .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  console.log('Сообщение из чата:', msg.chat.id, '| Имя чата:', msg.chat.title || '', '| Тип:', msg.chat.type);
});


// Контекст для ответов (кто-кому отвечает)
const replyContext = {};

// 🎯 Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const tgId = msg.from.id;

  // 🪄 Ссылка на портал авторизации VK ID с передачей tg_id
  const vkAuthUrl = `https://fokusnikaltair.xyz/vkid-auth.html?tg_id=${tgId}`;

  const welcomeText = `Абра-кадабра и немного кода 🧙‍♂️
  
Ты только что призвал Фокусника Альтаира - теперь твои VK-новости сами переползают в Telegram по волшебству, а не по прихоти алгоритмов.

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

// 👇 Обработка команды /support (или кнопка "Связаться с магистром бота")
bot.onText(/\/support/, (msg) => {
  bot.sendMessage(msg.chat.id, "Если у тебя есть вопрос, пожелание или что-то не работает — просто опиши проблему в следующем сообщении! Магистр прочитает и обязательно ответит. Твой Telegram ник останется скрыт, а магическая поддержка уже рядом! ✉️");
});

// 👇 Пересылка сообщений пользователя в группу поддержки с кнопкой "Ответить"
bot.on('message', (msg) => {
  // Игнорируем сообщения из самой группы поддержки, команды и сообщения от бота
  if (
    msg.chat.id === SUPPORT_CHAT_ID ||
    (msg.text && msg.text.startsWith('/')) ||
    msg.from.is_bot
  ) return;

  // Пересылаем в группу поддержки
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

// 👇 [ИЗМЕНЕНО] — ОДИН обработчик inline-кнопок (privacy и reply)
bot.on('callback_query', async (query) => {
  // 🔄 NEW: Обработка "Магическая безопасность"
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

  // Обработка кнопки "Ответить"
  if (query.data.startsWith('reply_')) {
    const userId = query.data.split('_')[1];

    // Сохраняем, кому будет следующий ответ этого магистра
    replyContext[query.from.id] = userId;

    // Бот пишет магистру в личку (Telegram!)
    await bot.sendMessage(
      query.from.id, 
      `✍️ Напишите свой ответ для пользователя (ID: ${userId}), отправьте следующим сообщением.`
    );

    await bot.answerCallbackQuery(query.id, { text: 'Жду вашего ответа!' });
    return;
  }
});

// 👇 Передача ответа магистра пользователю
bot.on('message', (msg) => {
  // Если есть ожидающий ответа контекст и это личка магистра
  if (replyContext[msg.from.id] && msg.chat.type === 'private') {
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
  }
});
