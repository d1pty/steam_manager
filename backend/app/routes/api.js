const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { logInAccountWithDelay } = require('../steam/login');
const { getBroadcastFunction } = require('../ws/websocket');
const { sendTrades } = require('../steam/trade');
const { accountStatus, logOffAccount, getTwoFactorCode } = require('../steam/login');
const config = require('../../configs/auth.json');

router.get('/status', (req, res) => {
  res.json(accountStatus);
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

    const mafilesDir = path.join(__dirname, '../../configs/mafiles');
    const authPath = path.join(__dirname, '../../configs/auth.json');
    const maFilePath = path.join(mafilesDir, `${username}.maFile`);

    if (!fs.existsSync(mafilesDir)) {
      fs.mkdirSync(mafilesDir, { recursive: true });
    }

    fs.writeFileSync(maFilePath, maFileContent);

    let authData = {};
    if (fs.existsSync(authPath)) {
      authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    }

    let maFileParsed = JSON.parse(maFileContent);
    const shared_secret = maFileParsed.shared_secret;
    const identity_secret = maFileParsed.identity_secret;

    if (!shared_secret || !identity_secret) {
      return res.status(400).json({ error: 'Неверный формат maFile' });
    }

    const id = Object.keys(authData).length.toString();
    authData[id] = {
      username,
      password,
      shared: shared_secret,
      lolka: identity_secret
    };

    fs.writeFileSync(authPath, JSON.stringify(authData, null, 2));

    const newAccountId = id;
    accountStatus[newAccountId] = {
      username,
      status: 'Инициализация...',
      avatar: ''
    };

    const broadcastStatus = getBroadcastFunction();
    logInAccountWithDelay(newAccountId, authData[newAccountId], broadcastStatus);

    // Отправляем обновлённые данные всем подключённым WebSocket клиентам
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

  const authPath = path.join(__dirname, '../../configs/auth.json');

  try {
    if (!fs.existsSync(authPath)) {
      return res.status(500).json({ error: 'Файл аккаунтов не найден' });
    }

    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));

    if (!authData[accountId]) {
      return res.status(404).json({ error: 'Аккаунт не найден' });
    }

    // Удаление аккаунта
    delete authData[accountId];
    fs.writeFileSync(authPath, JSON.stringify(authData, null, 2));

    // Очищаем и обновляем accountStatus
    Object.keys(accountStatus).forEach(key => delete accountStatus[key]);
    for (const [id, acc] of Object.entries(authData)) {
      accountStatus[id] = {
        username: acc.username,
        status: 'Ожидание входа',
        avatar: '',
      };
    }

    // Отправляем обновление всем подключённым WebSocket клиентам
    const broadcastStatus = getBroadcastFunction();
    broadcastStatus(accountStatus);

    res.status(200).json(accountStatus); // Возвращаем в том же виде, как GET /status
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

  if (!accountStatus[accountId]) {
    return res.status(404).json({ error: 'Аккаунт не найден' });
  }

  // Проверка статуса, если аккаунт уже вошел
  if (accountStatus[accountId].status === 'Вход выполнен') {
    return res.status(400).json({ error: 'Аккаунт уже вошел' });
  }

  // Входим в аккаунт
  const broadcastStatus = getBroadcastFunction();
  accountStatus[accountId].status = 'Логин...';
  broadcastStatus(accountStatus);

  // Вход в аккаунт
  await logInAccountWithDelay(accountId, config[accountId], broadcastStatus);

  res.status(200).json({ message: 'Аккаунт включен', accountStatus });
});
router.get('/get-2fa-code', (req, res) => {
  const { accountId } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: 'Не указан ID аккаунта' });
  }

  const { twoFactorCode, timeRemaining } = getTwoFactorCode(accountId);

  if (!twoFactorCode) {
    return res.status(404).json({ error: 'Аккаунт не найден' });
  }

  res.status(200).json({ twoFactorCode, timeRemaining });
});
module.exports = router;
