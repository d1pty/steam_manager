const { managers, communities } = require('./clients');
const config = require('../../configs/auth.json');

const sendTrades = async (accounts, tradeUrl) => {
  for (const botId of accounts) {
    const manager = managers[botId];
    const community = communities[botId];
    const account = config[botId];

    if (!manager || !community || !account) {
      console.log(`Аккаунт ${botId} не авторизован или отсутствует`);
      continue;
    }

    manager.getInventoryContents(730, 2, true, (err, inventory) => {
      if (err || !inventory.length) return;

      const offer = manager.createOffer(tradeUrl);
      offer.addMyItems(inventory);
      offer.setMessage('Обмен от аккаунта бота');
      offer.send((err, status) => {
        if (err) return;
        if (status === 'pending') {
          community.acceptConfirmationForObject(account.lolka, offer.id, (err) => {
            if (err) console.error(`Ошибка подтверждения ${offer.id}:`, err);
          });
        }
      });
    });
  }
};

module.exports = { sendTrades };
