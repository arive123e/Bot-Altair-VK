require('dotenv').config(); // 🔐 Загружаем переменные из .env

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

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
  const vkAuthUrl = `https://fokusnikaltair.xyz/vkid-auth.html?tg_id=${tgId}`;

  const welcomeText = `Абра-кадабра и немного кода 🧙‍♂️

Ты только что призвал Фокусника Альтаира — теперь твои VK-новости сами переползают в Telegram по волшебству, а не по прихоти алгоритмов.

Забудь про унылые бесконечные ленты, ведь у тебя есть личный маг, который сортирует новости по щелчку пальцев (и клику на портал).

Магия не работает без твоего участия — активируй портал и начни колдовать ✨ 
`;

  // 1. Приветственное сообщение с inline-кнопками
  bot.sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Сотворить заклинание перехода 🌀', url: vkAuthUrl }],
        [{ text: 'Магическая безопасность 🔐', callback_data: 'privacy' }]
      ]
    }
  });

  // 2. Сразу после этого — reply-клавиатура "Завершить переход🔱"
 const sentWaitMsg = await bot.sendMessage(chatId, "Подожди, магия настраивается ✨", {
    reply_markup: {
      keyboard: [
        ['Завершить переход🔱']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
  replyContext[tgId + '_waitMsg'] = sentWaitMsg.message_id;

  console.log(`📨 Отправлена ссылка авторизации пользователю ${tgId}`);
});

// =========================
// 2. ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ и callback'и
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

  // --- Ответить пользователю из группы поддержки ---
  if (query.data.startsWith('reply_')) {
    const userId = query.data.split('_')[1];
    replyContext[query.from.id] = userId;
    await bot.sendMessage(
      query.message.chat.id,
      `✍️ Напишите свой ответ для пользователя (ID: ${userId}), отправьте следующим сообщением прямо в этот чат.`
    );
    await bot.answerCallbackQuery(query.id, { text: 'Жду вашего ответа!' });
    return;
  }
});

// =========================
// 3. ОСНОВНАЯ ЛОГИКА (reply-кнопки)
// =========================

bot.on('message', async (msg) => {
  // 1. Завершить переход
  if (msg.text === 'Завершить переход🔱') {
    // Удаляем предыдущее сообщение "Подожди, магия настраивается ✨"
    const waitMsgId = replyContext[msg.from.id + '_waitMsg'];
    if (waitMsgId) {
      try { await bot.deleteMessage(msg.chat.id, waitMsgId); } catch(e){}
      delete replyContext[msg.from.id + '_waitMsg'];
    }

    const res = await axios.get(`https://api.fokusnikaltair.xyz/users/check?tg_id=${msg.from.id}`);
    if (res.data.success) {
      // Сообщение о квесте + кнопка "Групписо призывус! 📜"
      await bot.sendMessage(msg.chat.id, 
        `<b>💫 Ура! Квест пройден.</b> - добро пожаловать в наш уютный мир новостей.\n\nОсталось последнее заклинание: призвать любимые группы и получать магические вести прямо сюда.`,
        { parse_mode: 'HTML' }
      );
      await bot.sendMessage(msg.chat.id, " ", {
        reply_markup: {
          keyboard: [
            ['Групписо призывус! 📜']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else {
      await bot.sendMessage(msg.chat.id, 
        `<b>Упс, заклинание сегодня не в духе 😔</b>\n\nПереход пока не удался, но не переживай — такое бывает даже у самых опытных магов!\n\nПопробуй ещё раз или дай магистру знать, если чары не слушаются. 🧙‍♂️✨`,
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
      );
    }
    return;
  }


  // 2. Групписо призывус!
  if (msg.text === 'Групписо призывус! 📜') {
    await bot.sendMessage(msg.chat.id, 
      `<b>✨ Послание от стражей портала</b>\nБесплатно открыто до 3 групп — для особо жадных до магии у нас есть подписка, с ней границы расширяются!\nВсе новости, картинки и видео приходят только из открытых групп VK.\n\nЕсли что-то не видно — значит, магия чуть-чуть устала и не смогла пройти защиту чар.`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    return;
  }

  // --- Поддержка: ответы магистра ---
  if (replyContext[msg.from.id] && msg.chat.id === SUPPORT_CHAT_ID) {
    const targetUserId = replyContext[msg.from.id];
    bot.sendMessage(targetUserId, `🧙 Магистр бота отвечает:\n${msg.text}`);
    bot.sendMessage(msg.chat.id, "✅ Ответ отправлен пользователю!");
    delete replyContext[msg.from.id];
    return;
  }

  // --- Поддержка: новые вопросы пользователя ---
  if (
    msg.chat.id === SUPPORT_CHAT_ID ||
    (msg.text && msg.text.startsWith('/')) ||
    msg.from.is_bot
  ) return;

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

// --- Поддержка /support ---
bot.onText(/\/support/, (msg) => {
  bot.sendMessage(msg.chat.id,
    "Если у тебя есть вопрос, пожелание или что-то не работает — просто опиши проблему в следующем сообщении! Магистр прочитает и обязательно ответит. Твой Telegram ник останется скрыт, а магическая поддержка уже рядом! ✉️"
  );
});
