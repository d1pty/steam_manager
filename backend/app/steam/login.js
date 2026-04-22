const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamID = require('steamid');
const { clients, communities, managers, accountStatus } = require('./clients');
const { loadInventoryAfterLogin } = require('./inventory');
const { getAllAccounts, getAccountById } = require('../db/accountModel');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Инициализируем статус всех аккаунтов перед входом
 */
const initializeAccounts = () => {
  const accounts = getAllAccounts();
  accounts.forEach(account => {
    accountStatus[account.id] = {
      username: account.username,
      status: 'Ожидание входа',
      avatar: '',
    };
  });
};

/**
 * Логин одного аккаунта с задержкой и ожиданием результата
 * Возвращает промис, резолвящийся после loggedOn или error
 */
const logInAccountWithDelay = (botId, broadcastStatus) => {
  return new Promise(async resolve => {
    const account = getAccountById(botId);
    if (!account) {
      accountStatus[botId] = accountStatus[botId] || {};
      accountStatus[botId].status = 'Аккаунт не найден';
      broadcastStatus(accountStatus);
      return resolve();
    }

    // Ждём перед логином, чтобы не стартовать все одновременно
    const LOGIN_DELAY_MS = 3000;
    await delay(LOGIN_DELAY_MS);

    const client = new SteamUser();
    const community = new SteamCommunity();
    const manager = new TradeOfferManager({
      steam: client,
      community,
      language: 'en',
      useAccessToken: true,
    });

    clients[botId] = client;
    communities[botId] = community;
    managers[botId] = manager;

    const logOnOptions = {
      accountName: account.username,
      password: account.password,
      twoFactorCode: SteamTotp.generateAuthCode(account.shared),
    };

    accountStatus[botId] = accountStatus[botId] || {};
    accountStatus[botId].status = 'Логин...';
    broadcastStatus(accountStatus);

    // Подписываемся на одноразовые события
    client.once('loggedOn', () => {
      accountStatus[botId].status = 'Вход выполнен';
      broadcastStatus(accountStatus);

      // Получаем аватар
      community.getSteamUser(new SteamID(client.steamID.toString()), (err, user) => {
        accountStatus[botId].avatar = err
          ? 'http://localhost:3001/images/defaultAvatar.jpg'
          : user.getAvatarURL();
        broadcastStatus(accountStatus);
      });

      client.setPersona(SteamUser.EPersonaState.Online);
      resolve();
    });

    client.once('error', err => {
      const msg = getErrorStatusMessage(err.eresult);
      accountStatus[botId] = accountStatus[botId] || {};
      accountStatus[botId].status = msg;
      broadcastStatus(accountStatus);
      resolve();
    });

    client.logOn(logOnOptions);
  });
};

/**
 * Вход всех аккаунтов последовательно
 */
const logInAccounts = async broadcastStatus => {
  const accounts = getAllAccounts();
  for (const account of accounts) {
    await logInAccountWithDelay(account.id, broadcastStatus);
  }
  // По окончании рассылаем финальный статус
  broadcastStatus(accountStatus);
};

const logOffAccount = botId => {
  const client = clients[botId];
  if (client) {
    client.logOff();
    accountStatus[botId] = accountStatus[botId] || {};
    accountStatus[botId].status = 'Отключен';
  }
};

const CodeInterval = 30;

const getTwoFactorCode = botId => {
  const account = getAccountById(botId);
  if (account) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeRemaining = CodeInterval - (currentTimestamp % CodeInterval);
    const twoFactorCode = SteamTotp.generateAuthCode(account.shared);
    return { twoFactorCode, timeRemaining };
  }
  return null;
};

/**
 * Перевод кода ошибки в понятное сообщение
 */
const getErrorStatusMessage = eresult => {
  switch (eresult) {
    case SteamUser.EResult.InvalidPassword:
      return 'Неверный пароль';
    case SteamUser.EResult.AccountLogonDenied:
      return 'Требуется 2FA код';
    default:
      return 'Ошибка при входе';
  }
};

module.exports = {
  initializeAccounts,
  logInAccounts,
  logInAccountWithDelay,
  logOffAccount,
  accountStatus,
  getTwoFactorCode,
};
