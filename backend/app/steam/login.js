const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamID = require('steamid');
const config = require('../../configs/auth.json');
const { clients, communities, managers, accountStatus } = require('./clients');
const { loadInventoryAfterLogin } = require('./inventory');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initializeAccounts = () => {
  for (const botId in config) {
    const account = config[botId];
    accountStatus[botId] = {
      username: account.username,
      status: 'Ожидание входа',
      avatar: '',
    };
  }
};

const logInAccountWithDelay = async (botId, account, broadcastStatus) => {
  const delayBetweenLogins = 3000;
  await delay(delayBetweenLogins);
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

  accountStatus[botId].status = 'Логин...';
  broadcastStatus(accountStatus);

  client.logOn(logOnOptions);

  client.on('loggedOn', () => {
    accountStatus[botId].status = 'Вход выполнен';

    community.getSteamUser(new SteamID(client.steamID.toString()), (err, user) => {
      accountStatus[botId].avatar = err
        ? 'http://localhost:3001/images/defaultAvatar.jpg'
        : user.getAvatarURL();

      broadcastStatus(accountStatus);
    });

    client.setPersona(SteamUser.EPersonaState.Online);
  });

  client.on('webSession', async (sid, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
    await delay(2000);
    loadInventoryAfterLogin(botId);
  });

  client.on('error', (err) => {
    const message = getErrorStatusMessage(err.eresult);
    accountStatus[botId].status = message;
    broadcastStatus(accountStatus);
  });
};

const getErrorStatusMessage = (eresult) => {
  switch (eresult) {
    case SteamUser.EResult.InvalidPassword:
      return 'Неверный пароль';
    case SteamUser.EResult.AccountLogonDenied:
      return 'Требуется 2FA код';
    default:
      return 'Ошибка при входе';
  }
};

const logInAccounts = async (broadcastStatus) => {
  for (const botId in config) {
    await logInAccountWithDelay(botId, config[botId], broadcastStatus);
  }
};

const logOffAccount = (botId) => {
  const client = clients[botId];
  if (client) {
    client.logOff();
    accountStatus[botId].status = 'Отключен';
  }
};
const CodeInterval = 30; // Интервал обновления кода (30 секунд)

const getTwoFactorCode = (botId) => {
  const account = config[botId];
  if (account) {
    const currentTimestamp = Math.floor(Date.now() / 1000); // Текущее время в секундах
    const timeRemaining = CodeInterval - (currentTimestamp % CodeInterval); // Остаток времени до следующего обновления кода

    const twoFactorCode = SteamTotp.generateAuthCode(account.shared); // Генерация текущего 2FA кода
    return { twoFactorCode, timeRemaining }; // Отправляем код и оставшееся время
  }
  return null;
};

module.exports = {
  initializeAccounts,
  logInAccounts,
  logInAccountWithDelay,
  logOffAccount, // 👈 добавляем экспорт
  accountStatus,
  getTwoFactorCode,
};
