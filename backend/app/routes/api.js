const express = require('express');
const router = express.Router();
const { logInAccountWithDelay } = require('../steam/login');
const { getBroadcastFunction } = require('../ws/websocket');
const { sendTrades } = require('../steam/trade');
const { logOffAccount, getTwoFactorCode } = require('../steam/login');
const { clients, communities, managers, accountStatus } = require('../steam/clients');
const { insertAccount,deleteAccount,getAllAccounts,getAccountById } = require('../db/accountModel');
router.get('/status', (req, res) => {
  const accounts = getAllAccounts();
  const status = accounts.map(account => ({
    id: account.id,
    username: account.username,
    status: accountStatus[account.id] ? accountStatus[account.id].status : 'Неизвестен',
    avatar: accountStatus[account.id] ? accountStatus[account.id].avatar : '',
  }));
  res.json(status);
});

router.post('/send-trade', async (req, res) => {
  const { accounts, tradeUrl } = req.body;

  if (!accounts || !tradeUrl) {
    return res.status(400).json({ error: 'Отсутствуют аккаунты или ссылка на обмен' });
  }

  await sendTrades(accounts, tradeUrl);
  res.status(200).json({ message: 'Обмены отправлены' });
});

router.post('/add-account', async (req, res) => {
  try {
    const { username, password, maFileContent } = req.body;

    if (!username || !password || !maFileContent) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    let maFileParsed = JSON.parse(maFileContent);
    const shared_secret = maFileParsed.shared_secret;
    const identity_secret = maFileParsed.identity_secret;

    if (!shared_secret || !identity_secret) {
      return res.status(400).json({ error: 'Неверный формат maFile' });
    }

    const newAccountId = `${Date.now()}`; // Генерируем уникальный ID
    insertAccount(newAccountId, {
      username,
      password,
      shared: shared_secret,
      lolka: identity_secret,
    });

    accountStatus[newAccountId] = {
      username,
      status: 'Инициализация...',
      avatar: '',
    };

    const broadcastStatus = getBroadcastFunction();
    logInAccountWithDelay(newAccountId, broadcastStatus);

    broadcastStatus(accountStatus);

    res.status(200).json({ message: 'Аккаунт успешно добавлен' });
  } catch (err) {
    console.error('Ошибка при добавлении аккаунта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
router.post('/delete-account', async (req, res) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Нет ID аккаунта для удаления' });
  }

  try {
    // Удаляем аккаунт из базы
    deleteAccount(accountId);

    // Убираем из активных клиентов, сообществ и менеджеров
    delete clients[accountId];
    delete communities[accountId];
    delete managers[accountId];
    delete accountStatus[accountId];

    // Обновляем статус на клиенте
    const broadcastStatus = getBroadcastFunction();
    broadcastStatus(accountStatus);

    // Возвращаем обновленный список аккаунтов из базы
    const updatedAccounts = getAllAccounts();

    res.status(200).json({
      message: 'Аккаунт успешно удален',
      accounts: updatedAccounts,
    });
  } catch (err) {
    console.error('Ошибка при удалении аккаунта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
router.post('/disable-account', async (req, res) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Нет ID аккаунта для отключения' });
  }

  if (!accountStatus[accountId]) {
    return res.status(404).json({ error: 'Аккаунт не найден' });
  }

  logOffAccount(accountId); // 👈 Выключаем аккаунт

  const broadcastStatus = getBroadcastFunction();
  broadcastStatus(accountStatus);

  res.status(200).json({ message: 'Аккаунт отключен', accountStatus });
});
router.post('/enable-account', async (req, res) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Нет ID аккаунта для включения' });
  }

  const account = getAccountById(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Аккаунт не найден' });
  }

  // Проверка статуса, если аккаунт уже вошел
  if (accountStatus[accountId] && accountStatus[accountId].status === 'Вход выполнен') {
    return res.status(400).json({ error: 'Аккаунт уже вошел' });
  }

  // Входим в аккаунт
  const broadcastStatus = getBroadcastFunction();
  accountStatus[accountId].status = 'Логин...';
  broadcastStatus(accountStatus);

  await logInAccountWithDelay(accountId, broadcastStatus);

  res.status(200).json({ message: 'Аккаунт включен', accountStatus });
});
router.get('/get-2fa-code', (req, res) => {
  const { accountId } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: 'Не указан ID аккаунта' });
  }

  const account = getAccountById(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Аккаунт не найден' });
  }

  const { twoFactorCode, timeRemaining } = getTwoFactorCode(accountId);

  res.status(200).json({ twoFactorCode, timeRemaining });
});
module.exports = router;
