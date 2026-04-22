const express = require('express');
const router = express.Router();
const { logInAccountWithDelay } = require('../steam/login');
const { getBroadcastFunction } = require('../ws/websocket');
const { sendTrades } = require('../steam/trade');
const { logOffAccount, getTwoFactorCode } = require('../steam/login');
const { loadInventory } = require('../steam/inventory');
const { clients, communities, managers, accountStatus } = require('../steam/clients');
const { insertAccount, deleteAccount, getAllAccounts, getAccountById, getItemDistribution, getAllPricedItems, markItemSoldByName } = require('../db/accountModel');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const SteamTotp = require('steam-totp');
const moment = require('moment');
const request = require('request');

// Global inventory definitions
const inventoryConfigs = {
  csgo: { appId: 730, contextId: 2, label: 'CS:GO' },
  dota2: { appId: 570, contextId: 2, label: 'Dota 2' },
  steam: { appId: 753, contextId: 6, label: 'Steam Items' }
};

const API_TOKEN = 'API_TOKEN';

const STEAM_CURRENCY_MAP = {
  1: 'USD',
  2: 'GBP',
  3: 'EUR',
  7: 'CHF',
  8: 'RUB',
  9: 'JPY',
  10: 'NOK',
  11: 'IDR',
  12: 'MYR',
  13: 'PHP',
  14: 'SGD',
  15: 'THB',
  16: 'VND',
  17: 'KRW',
  18: 'UAH',
  19: 'MXN',
  20: 'CAD',
  21: 'AUD'
  // …add any others you need
};

function fetchRateToRUB(steamCode, cb) {
  request.get({
    uri: 'https://api.steam-currency.ru/v3/currency',
    headers: {
      accept: '*/*',
      'api-token': API_TOKEN
    },
    json: true
  }, (err, _resp, body) => {
    if (err) return cb(err);
    if (!body?.data) return cb(new Error('Bad currency API response'));

    // если валюта уже RUB
    if (steamCode === 'RUB') {
      return cb(null, 1);
    }

    const pair = body.data.find(x => x.currency_pair === `${steamCode}:RUB`);
    if (!pair) {
      return cb(new Error(`Pair ${steamCode}:RUB not found`));
    }

    cb(null, pair.close_price);
  });
}

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
    return res.status(400).json({ error: 'Нет ID аккаунта для выключения' });
  }

  if (!accountStatus[accountId]) {
    return res.status(404).json({ error: 'Аккаунт не найден' });
  }

  logOffAccount(accountId);

  const broadcastStatus = getBroadcastFunction();
  broadcastStatus(accountStatus);

  res.status(200).json({ message: 'Аккаунт выключен', accountStatus });
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

    for (const content of maFiles) {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        continue;
      }

      const login = parsed.account_name;
      const shared = parsed.shared_secret;
      const identity = parsed.identity_secret;
      if (!login || !shared || !identity || !accountsMap.has(login)) {
        continue;
      }

      const safe = login.replace(/[<>:"/\\|?*]/g, '_');
      const filepath = path.join(mafilesDir, `${safe}.maFile`);
      fs.writeFileSync(filepath, content, 'utf8');

      const password = accountsMap.get(login);
      const newId = Date.now().toString();
      const inserted = insertAccount(newId, { username: login, password, shared, lolka: identity });

      if (inserted) {
        accountStatus[newId] = { username: login, status: 'Ожидание входа', avatar: '' };
        newIds.push(newId);
      }
    }

    res.json({ ok: true, added: newIds.length });

    setImmediate(async () => {
      for (const id of newIds) {
        await logInAccountWithDelay(id, broadcastStatus);
      }
      broadcastStatus(accountStatus);
    });

  } catch (err) {
    console.error('Ошибка в /import-accounts:', err);
    res.status(500).json({ error: 'Серверная ошибка' });
  }
});

router.get('/item-distribution', (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const rawData = getItemDistribution(startDate, endDate);

    const result = rawData.map(item => ({
      name: item.item_name,
      value: item.count,
      totalPrice: item.total_price || 0,  // сумма стоимости, если null — 0
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

router.get('/pending-confirmations', (req, res) => {
  const { accountId } = req.query;
  if (!accountId) {
    return res.status(400).json({ error: 'Не указан accountId' });
  }

  const community = communities[accountId];
  if (!community) {
    return res.status(404).json({ error: 'Community не найден для этого accountId' });
  }

  const account = getAccountById(accountId);
  const { lolka } = account;
  if (!lolka) {
    return res.status(500).json({ error: 'Не найден identitySecret для подтверждений' });
  }

  // 1) Берём валюту бота
  const currencyId = clients[accountId].wallet?.currency;
  const steamCode = STEAM_CURRENCY_MAP[currencyId];
  if (!steamCode) {
    return res.status(500).json({ error: `Unsupported currencyId ${currencyId}` });
  }

  const time = SteamTotp.time();
  const key = SteamTotp.getConfirmationKey(lolka, time, 'conf');

  community.getConfirmations(time, key, (err, confirmations) => {
    if (err) {
      console.error(`Ошибка получения подтверждений для ${accountId}:`, err);
      return res.status(500).json({
        error: 'Не удалось получить список подтверждений',
        details: err.message
      });
    }

    // 2) Запрашиваем курс единицы Steam-валюты в рубли
    fetchRateToRUB(steamCode, (err, rateToRub) => {
      if (err) {
        console.error('Ошибка получения курса:', err);
        // Если не удалось получить курс, возвращаем без priceRub
        const simple = confirmations.map(conf => ({
          id: conf.id,
          title: conf.title,
          sending: conf.sending,
          icon: conf.icon,
          priceRub: null
        }));
        return res.json({ confirmations: simple });
      }

      // 3) Для каждой confirmation парсим число и конвертим
      const result = confirmations.map(conf => {
        const m = conf.title.match(/([\d]+[.,]\d{1,2})\s*[^0-9\s]?/); // захватываем число + валюту
        let priceRub = null;
        let updatedTitle = conf.title;

        if (m) {
          const num = parseFloat(m[1].replace(',', '.'));
          priceRub = Math.round(num * rateToRub * 100) / 100;
          const rubStr = `${priceRub.toFixed(2)}₽`;

          // Заменяем всю найденную подстроку (например, "58,96₴") на "123.45₽"
          updatedTitle = conf.title.replace(m[0], rubStr);
        }

        return {
          id: conf.id,
          title: updatedTitle,
          sending: conf.sending,
          icon: conf.icon,
          priceRub
        };
      });

      res.json({ confirmations: result });
    });
  });
});

router.post('/respond-confirmation', (req, res) => {
  const { accountId, confirmationId, accept } = req.body;

  if (!accountId || !confirmationId || typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'Отсутствует accountId, confirmationId или accept' });
  }

  const community = communities[accountId];
  if (!community) {
    return res.status(404).json({ error: 'Community не найден для этого accountId' });
  }

  const account = getAccountById(accountId);
  if (!account || !account.lolka) {
    return res.status(500).json({ error: 'Не найден identitySecret (lolka) для подтверждений' });
  }

  const identitySecret = account.lolka;
  const time = SteamTotp.time();
  const tag = accept ? 'allow' : 'cancel';
  const key = SteamTotp.getConfirmationKey(identitySecret, time, 'conf');

  community.getConfirmations(time, key, (err, confirmations) => {
    if (err) {
      console.error(`Ошибка при получении подтверждений для ${accountId}:`, err);
      return res.status(500).json({ error: 'Не удалось получить подтверждения', details: err.message });
    }

    const targetConfirmation = confirmations.find(c => c.id === confirmationId);
    if (!targetConfirmation) {
      return res.status(404).json({ error: 'Подтверждение с таким ID не найдено' });
    }
    const key = SteamTotp.getConfirmationKey(identitySecret, time, tag);
    targetConfirmation.respond(time, key, accept, (err) => {
      if (err) {
        console.error(`Ошибка при ${accept ? 'принятии' : 'отклонении'} подтверждения ${confirmationId}:`, err);
        return res.status(500).json({ error: 'Не удалось обработать подтверждение', details: err.message });
      }

      res.json({ success: true, message: `Подтверждение ${accept ? 'принято' : 'отклонено'}` });
    });
  });
});

router.get('/inventory/:botId', async (req, res) => {
  const { botId } = req.params;
  const appId = parseInt(req.query.appId, 10) || 730;
  const contextId = req.query.contextId || '2';

  loadInventory(botId, appId, contextId, (err, inventory) => {
    if (err) {
      console.error(`Ошибка загрузки инвентаря(${botId}, ${appId}: ${contextId}):`, err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ items: inventory || [] });
  });
});

router.get('/account/:botId/inventories', async (req, res) => {
  const { botId } = req.params;
  const testPromises = Object.entries(inventoryConfigs).map(
    ([key, { appId, contextId }]) =>
      new Promise((resolve) => {
        loadInventory(botId, appId, contextId, (err, inventory) => {
          if (err || !inventory || !inventory.length) {
            return resolve(null);
          }
          resolve({ key, label: inventoryConfigs[key].label, appId, contextId });
        });
      })
  );

  try {
    const results = await Promise.all(testPromises);
    const available = results.filter(Boolean);
    res.json({ inventories: available });
  } catch (e) {
    console.error('Ошибка проверки доступных инвентарей:', e);
    res.status(500).json({ error: e.message });
  }
});
router.get('/inventory/:botId/price', (req, res) => {
  const { botId } = req.params;
  const appId = parseInt(req.query.appId, 10) || 730;
  const marketHashName = req.query.market_hash_name;
  const currency = parseInt(req.query.currency, 10) || 5;

  if (!marketHashName) {
    return res.status(400).json({ error: 'market_hash_name is required' });
  }
  const community = communities[botId];
  if (!community) {
    return res.status(404).json({ error: `Steam client for bot ${botId} not found` });
  }

  community.request.get({
    uri: 'https://steamcommunity.com/market/priceoverview/',
    qs: { appid: appId, currency, market_hash_name: marketHashName },
    json: true
  }, (err, _resp, body) => {
    if (err) {
      console.error('PriceOverview error:', err);
      return res.status(500).json({ error: 'Failed to fetch price' });
    }
    if (!body || !body.success) {
      return res.status(502).json({ error: 'Steam returned unsuccessful priceoverview' });
    }
    res.json({ price: body });
  });
});

router.get('/inventory/:botId/history', (req, res) => {
  const { botId } = req.params;
  const appId = parseInt(req.query.appId, 10) || 730;
  const marketHashName = req.query.market_hash_name;
  if (!marketHashName) {
    return res.status(400).json({ error: 'market_hash_name is required' });
  }

  const community = communities[botId];
  if (!community) {
    return res.status(404).json({ error: `Steam client for bot ${botId} not found` });
  }

  const currencyId = clients[botId].wallet?.currency;
  const steamCode = STEAM_CURRENCY_MAP[currencyId];
  if (!steamCode) {
    return res.status(500).json({ error: `Unsupported currencyId ${currencyId}` });
  }

  community.request.get({
    uri: 'https://steamcommunity.com/market/pricehistory/',
    qs: { appid: appId, market_hash_name: marketHashName },
    json: true
  }, (err, _resp, body) => {
    if (err) {
      console.error(`Error fetching history:`, err);
      return res.status(500).json({ error: 'Failed to fetch price history' });
    }
    if (!body.success || !Array.isArray(body.prices)) {
      return res.json({ history: [] });
    }

    fetchRateToRUB(steamCode, (err, rateToRub) => {
      if (err) {
        console.error('Error fetching currency rate:', err);
        return res.status(500).json({ error: 'Failed to fetch currency rate' });
      }

      const now = moment.utc();
      const history = body.prices
        .map(([dateStr, priceNum]) => {
          const norm = dateStr.replace(/\u00A0/g, ' ');
          const ts = moment.utc(norm, 'MMM D YYYY HH:mm Z').valueOf();
          return { ts, price: parseFloat(priceNum) };
        })
        .filter(({ ts }) => now.diff(ts, 'days') <= 7)
        .map(({ ts, price }) => ({
          t: ts,
          y: Math.round(price * rateToRub * 100) / 100
        }));

      res.json({ history });
    });
  });
});


/// Переводим в «центы» для Steam API
function toSteamPrice(price) {
  return Math.round(price * 100);
}

router.post('/list-item', (req, res) => {
  const { accountId, item, price: priceRub, autoConfirm, statsEnabled } = req.body;
  if (!accountId || !item || typeof priceRub !== 'number') {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  const community = communities[accountId];
  if (!community) {
    return res.status(404).json({ error: 'Аккаунт не найден или не авторизован' });
  }

  const currencyId = clients[accountId].wallet?.currency;
  const steamCode = STEAM_CURRENCY_MAP[currencyId];
  if (!steamCode) {
    return res.status(500).json({ error: `Unsupported currencyId ${currencyId}` });
  }

  fetchRateToRUB(steamCode, (err, rateToRub) => {
    if (err) {
      console.error('Currency rate error:', err);
      return res.status(500).json({ error: 'Не удалось получить курс валюты' });
    }

    const priceInAccountCurrency = priceRub / rateToRub;
    const steamPrice = toSteamPrice(priceInAccountCurrency);

    const form = {
      sessionid: community.sessionID,
      currency: currencyId,
      appid: item.appid,
      contextid: item.contextid,
      assetid: item.id,
      amount: 1,
      price: steamPrice
    };
    const referer = `https://steamcommunity.com/market/listings/`
      + `${item.appid}/${encodeURIComponent(item.market_hash_name)}`;

    community.request.post({
      uri: 'https://steamcommunity.com/market/sellitem/',
      form,
      headers: { Referer: referer },
      json: true
    }, (err, _httpResp, body) => {
      const isSuccess = body && (body.success === 1 || body.success === true);
      if (err || !isSuccess) {
        console.error('Sell error:', err || body);
        return res.status(500).json({ error: 'Не удалось выставить лот' });
      }

      const listingId = body.id;
      const needsConfirmation = !!body.needs_mobile_confirmation;

      if (needsConfirmation && autoConfirm) {
        try {
          const account = getAccountById(accountId);
          const identitySecret = account.lolka;
          const t = SteamTotp.time();
          const confKey = SteamTotp.getConfirmationKey(identitySecret, t, 'conf');

          community.getConfirmations(t, confKey, (err, confs) => {
            if (err) throw err;
            const target = confs.find(c =>
              c.type === 3 && c.sending === item.name
            );
            if (!target) throw new Error('Не нашли confirmation');
            const allowKey = SteamTotp.getConfirmationKey(identitySecret, t, 'allow');
            target.respond(t, allowKey, true, err => {
              if (err) throw err;
              if (statsEnabled) {
                const soldAt = new Date().toISOString().split('T')[0];
                markItemSoldByName(item.name, soldAt, priceRub);
              }
              return res.json({ success: true, autoConfirmed: true });
            });
          });
        } catch (e) {
          console.error('Auto-confirm error:', e);
          return res.json({
            success: true,
            listingId,
            autoConfirmed: false,
            error: e.message
          });
        }
      } else {
        if (statsEnabled) {
          const soldAt = new Date().toISOString().split('T')[0];
          markItemSoldByName(item.name, soldAt, priceRub);
        }
        return res.json({
          success: true,
          listingId,
          needsMobileConfirmation: needsConfirmation
        });
      }
    });
  });
});
module.exports = router;
