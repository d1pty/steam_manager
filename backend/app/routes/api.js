const express = require('express');
const router = express.Router();
const { logInAccountWithDelay } = require('../steam/login');
const { getBroadcastFunction } = require('../ws/websocket');
const { sendTrades } = require('../steam/trade');
const { logOffAccount, getTwoFactorCode } = require('../steam/login');
const { clients, communities, managers, accountStatus } = require('../steam/clients');
const { insertAccount, deleteAccount, getAllAccounts, getAccountById, getItemDistribution, getAllPricedItems } = require('../db/accountModel');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

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

  try {
    await sendTrades(accounts, tradeUrl);
    res.status(200).json({ message: 'Обмены отправлены' });
  } catch (err) {
    console.error('Ошибка отправки обменов:', err);
    res.status(500).json({ error: 'Ошибка при отправке обменов' });
  }
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

    const mafilesDir = path.join(__dirname, '..', 'db', 'mafiles');
    if (!fs.existsSync(mafilesDir)) {
      fs.mkdirSync(mafilesDir, { recursive: true });
    }

    const safeUsername = username.replace(/[<>:"/\\|?*]/g, '_');
    const mafilePath = path.join(mafilesDir, `${safeUsername}.maFile`);
    fs.writeFileSync(mafilePath, maFileContent, 'utf8');
    const newAccountId = `${Date.now()}`;
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
    const account = getAccountById(accountId);
    const username = account?.username;

    deleteAccount(accountId);

    delete clients[accountId];
    delete communities[accountId];
    delete managers[accountId];
    delete accountStatus[accountId];

    if (username) {
      const safeUsername = username.replace(/[<>:"/\\|?*]/g, '_');
      const mafilePath = path.join(__dirname, '..', 'db', 'mafiles', `${safeUsername}.maFile`);
      if (fs.existsSync(mafilePath)) {
        fs.unlinkSync(mafilePath);
      }
    }

    const broadcastStatus = getBroadcastFunction();
    broadcastStatus(accountStatus);

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

  logOffAccount(accountId);

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

  if (accountStatus[accountId] && accountStatus[accountId].status === 'Вход выполнен') {
    return res.status(400).json({ error: 'Аккаунт уже вошел' });
  }
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

router.get('/export-accounts', async (req, res) => {
  try {
    const accounts = getAllAccounts();

    if (!accounts.length) {
      return res.status(400).json({ error: 'Нет аккаунтов для экспорта' });
    }

    const mafilesDir = path.join(__dirname, '..', 'db', 'mafiles');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="accounts_export.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);

    const accsContent = accounts.map(acc => `${acc.username}:${acc.password}`).join('\n');
    archive.append(accsContent, { name: 'accs.txt' });

    for (const acc of accounts) {
      const mafilePath = path.join(mafilesDir, `${acc.username}.maFile`);
      if (fs.existsSync(mafilePath)) {
        archive.file(mafilePath, { name: `${acc.username}.maFile` });
      }
    }

    await archive.finalize();

  } catch (err) {
    console.error('Ошибка при экспорте аккаунтов:', err);
    res.status(500).json({ error: 'Ошибка при экспорте аккаунтов' });
  }
});

router.post('/import-accounts', (req, res) => {
  try {
    const { accounts, maFiles } = req.body;
    if (!Array.isArray(accounts) || !Array.isArray(maFiles)) {
      return res.status(400).json({ error: 'Неверный формат запроса' });
    }

    const accountsMap = new Map();
    accounts.forEach(acc => {
      if (acc.username && acc.password) {
        accountsMap.set(acc.username, acc.password);
      }
    });

    const mafilesDir = path.join(__dirname, '..', 'db', 'mafiles');
    if (!fs.existsSync(mafilesDir)) {
      fs.mkdirSync(mafilesDir, { recursive: true });
    }

    const broadcastStatus = getBroadcastFunction();
    const newIds = [];
    let skippedCount = 0;

    for (const content of maFiles) {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        skippedCount++;
        continue;
      }

      const login = parsed.account_name;
      const shared = parsed.shared_secret;
      const identity = parsed.identity_secret;
      if (!login || !shared || !identity || !accountsMap.has(login)) {
        skippedCount++;
        continue;
      }

      const safe = login.replace(/[<>:"/\\|?*]/g, '_');
      const filepath = path.join(mafilesDir, `${safe}.maFile`);
      fs.writeFileSync(filepath, content, 'utf8');

      const password = accountsMap.get(login);
      const newId = Date.now().toString();
      insertAccount(newId, { username: login, password, shared, lolka: identity });
      accountStatus[newId] = { username: login, status: 'Ожидание входа', avatar: '' };
      newIds.push(newId);
    }

    res.json({ ok: true, added: newIds.length, skipped: skippedCount });

    setImmediate(async () => {
      for (const id of newIds) {
        await logInAccountWithDelay(id, broadcastStatus);
      }
      broadcastStatus(accountStatus);
    });

  } catch (err) {
    console.error('Ошибка в /import-accounts:', err);
    res.status(500).json({ error: 'Серверная ошибка при импорте' });
  }
});

router.get('/item-distribution', (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const rawData = getItemDistribution(startDate, endDate);

    const result = rawData.map(item => ({
      name: item.item_name,
      value: item.count,
    }));

    res.json(result);
  } catch (err) {
    console.error('Ошибка при получении распределения предметов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
router.get('/average-weekly-price', (req, res) => {
  try {
    const rawData = getAllPricedItems();
    res.json(rawData);
  } catch (err) {
    console.error('Ошибка при получении всех предметов с ценами:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
module.exports = router;
