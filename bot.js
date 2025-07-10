require('dotenv').config(); // 🔐 Загружаем переменные из .env

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const MAX_GROUPS_FREE = 3; // сколько групп выбрать бесплатно
const userSelectedGroups = {};

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

bot.onText(/\/start/, async (msg) => { // <--- вот здесь добавь async
  const chatId = msg.chat.id;
  const tgId = msg.from.id;
  const vkAuthUrl = `https://fokusnikaltair.xyz/vkid-auth.html?tg_id=${tgId}`;

  const welcomeText = `Абра-кадабра и немного кода 🧙‍♂️

Ты только что призвал Фокусника Альтаира - теперь твои VK-новости сами переползают в Telegram по волшебству, а не по прихоти алгоритмов.

Забудь про унылые бесконечные ленты, ведь у тебя есть личный маг, который сортирует новости по щелчку пальцев (и клику на портал).

Магия не работает без твоего участия - активируй портал и начни колдовать ✨ 
`;

  // 1. Приветственное сообщение с inline-кнопками
  await bot.sendMessage(chatId, welcomeText, {
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
    const privacyText = `Ваша приватность - под надёжной защитой магии и современных технологий 🛡
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

    // --- Обработка выбора групп пользователя (инлайн кнопки) ---
  if (query.data.startsWith('select_group:')) {
    const [_, groupId, page] = query.data.split(':');
    const userId = query.from.id;
    const groupIdNum = Number(groupId);

    // Получаем список уже выбранных групп (или пустой)
    if (!userSelectedGroups[userId]) userSelectedGroups[userId] = [];
    const selected = userSelectedGroups[userId];

     // --- ПРАВИЛЬНО: здесь получаешь allGroups и selectMsgId!
    const allGroups = userSelectedGroups[userId + '_all'] || [];
    const selectMsgId = userSelectedGroups[userId + '_selectMsgId'];

     // Логика выбора
    if (selected.includes(groupIdNum)) {
      userSelectedGroups[userId] = selected.filter(id => id !== groupIdNum);
    } else {
      if (selected.length >= MAX_GROUPS_FREE) {
  await bot.answerCallbackQuery(query.id, { 
    text: '✨ О, сила магии ещё не столь велика!\nМожно выбрать только 3 группы - остальные скоро будут доступны.', 
    show_alert: true 
  });
  return;
}
      userSelectedGroups[userId].push(groupIdNum);
    }
    
    // Обновляем инлайн-кнопки
    await showGroupSelection(bot, query.message.chat.id, userId, allGroups, Number(page), selectMsgId);
    await bot.answerCallbackQuery(query.id);
    return;
  }

  // --- Пагинация групп ---
  if (query.data.startsWith('groups_prev:') || query.data.startsWith('groups_next:')) {
    const isPrev = query.data.startsWith('groups_prev:');
    const page = Number(query.data.split(':')[1]);
    const userId = query.from.id;
    const allGroups = userSelectedGroups[userId + '_all'] || [];
    const selectMsgId = userSelectedGroups[userId + '_selectMsgId'];
    await showGroupSelection(bot, query.message.chat.id, userId, allGroups, Number(page), selectMsgId);
  }

  // --- "Готово" ---
if (query.data === 'groups_done') {
  const selectedGroups = userSelectedGroups[query.from.id] || [];
  if (selectedGroups.length) {
    const allGroups = userSelectedGroups[query.from.id + '_all'] || [];
    const selectedGroupsNames = selectedGroups
      .map(id => {
        const group = allGroups.find(g => g.id === id);
        return group ? (group.name || group.screen_name || `ID${id}`) : `ID${id}`;
      });
    await bot.sendMessage(query.message.chat.id,
      `<b>Группы выбраны! ⚡️</b>\nСовсем скоро лента наполнится магией именно для тебя.\n\nЖди новости из:\n${selectedGroupsNames.map(name => `🔸${name}`).join('\n')}`,
      { parse_mode: 'HTML' }
    );
  } else {
    await bot.sendMessage(query.message.chat.id,
      'Ты ничего не выбрал — но всегда можно вернуться 😉'
    );
  }
  await bot.answerCallbackQuery(query.id);
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
        `<b>💫 Ура! Квест пройден.</b>  \nДобро пожаловать в наш уютный мир новостей.\n\nОсталось последнее заклинание: призвать любимые группы и получать магические вести прямо сюда.`,
        { parse_mode: 'HTML' }
      );
      const sentGroupWaitMsg = await bot.sendMessage(msg.chat.id, "Готовь заклинание!", {
  reply_markup: {
    keyboard: [
      ['Групписо призывус! 📜']
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
});
replyContext[msg.from.id + '_groupWaitMsg'] = sentGroupWaitMsg.message_id;
    } else {
      await bot.sendMessage(msg.chat.id, 
        `<b>Упс, заклинание сегодня не в духе 😔</b>\n\nПереход пока не удался, но не переживай - такое бывает даже у самых опытных магов!\n\nПопробуй ещё раз или дай магистру знать, если чары не слушаются. 🧙‍♂️✨`,
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
      );
    }
    return;
  }


 // 2. Групписо призывус!
if (msg.text === 'Групписо призывус! 📜') {
  // Удаляем сообщение "Готовь заклинание!"
  const groupWaitMsgId = replyContext[msg.from.id + '_groupWaitMsg'];
  if (groupWaitMsgId) {
    try { await bot.deleteMessage(msg.chat.id, groupWaitMsgId); } catch(e){}
    delete replyContext[msg.from.id + '_groupWaitMsg'];
  }

  // 2.1 Отправляем послание
  await bot.sendMessage(msg.chat.id, 
    `<b>✨ Послание от стражей портала</b>\nВсе новости, картинки и видео приходят только из открытых групп VK.\n\nЕсли что-то не видно - значит, магия чуть-чуть устала и не смогла пройти защиту чар.`,
    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
  );

  // 2.2 Запрашиваем группы с бэкенда
  try {
    const res = await axios.get(`https://api.fokusnikaltair.xyz/users/groups?tg_id=${msg.from.id}`);
    if (!res.data.success || !res.data.groups || !Array.isArray(res.data.groups)) {
      await bot.sendMessage(msg.chat.id, 'Магия не смогла найти ни одной группы. Попробуйте позже или напишите в поддержку!');
      return;
    }

    // Сохраняем все группы пользователя
    userSelectedGroups[msg.from.id] = [];

    // Вызываем функцию, которая покажет кнопки с группами (по 10 штук, первая страница)
    await showGroupSelection(bot, msg.chat.id, msg.from.id, res.data.groups, 0, null);

  } catch (e) {
    await bot.sendMessage(msg.chat.id, 'Что-то пошло не так при получении групп 😥');
  }
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
    "Если у тебя есть вопрос, пожелание или что-то не работает - просто опиши проблему в следующем сообщении! Магистр прочитает и обязательно ответит. Твой Telegram ник останется скрыт, а магическая поддержка уже рядом! ✉️"
  );
});

async function showGroupSelection(bot, chatId, userId, allGroups, page = 0, messageId = null) {
  const MAX_GROUPS_PER_PAGE = 10;
  const selected = userSelectedGroups[userId] || [];
  const start = page * MAX_GROUPS_PER_PAGE;
  const pageGroups = allGroups.slice(start, start + MAX_GROUPS_PER_PAGE);

  const inline_keyboard = pageGroups.map((group, idx) => {
    const isSelected = selected.includes(group.id);
    const groupNumber = start + idx + 1;
    return [{
      text: (isSelected ? '✅ ' : '') + `${groupNumber}. ` + (group.name || group.screen_name || `ID${group.id}`),
      callback_data: `select_group:${group.id}:${page}`
    }];
  });

  // Кнопки пагинации
  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️', callback_data: `groups_prev:${page - 1}` });
  navButtons.push({ text: '✅ Готово', callback_data: 'groups_done' });
  if (allGroups.length > start + MAX_GROUPS_PER_PAGE) navButtons.push({ text: '➡️', callback_data: `groups_next:${page + 1}` });
  inline_keyboard.push(navButtons);

  // --- Сохраняем allGroups и msgId для пользователя! ---
  userSelectedGroups[userId + '_all'] = allGroups;

  const total = allGroups.length;
  const text = `🦄 У тебя аж <b>${total}</b> магических групп!\nКакой сегодня у нас настрой? Котики? Новости? Тык-тык — выбирай!`;

  if (messageId) {
    // Если messageId передан — редактируем сообщение!
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard }
    });
  } else {
    // Иначе отправляем новое сообщение (при первом запуске)
    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard }
    });
    // --- Сохраняем ID сообщения для дальнейших редактирований ---
    userSelectedGroups[userId + '_selectMsgId'] = sent.message_id;
  }
}
