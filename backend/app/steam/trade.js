const { managers, communities } = require('./clients');
const { getAccountById, insertSentItem } = require('../db/accountModel');

const sendTrades = async (accounts, tradeUrl) => {
  for (const botId of accounts) {
    const manager = managers[botId];
    const community = communities[botId];

    const account = getAccountById(botId);
    if (!manager || !community || !account) {
      console.log(`Аккаунт ${botId} не авторизован или отсутствует`);
      continue;
    }

    // Получаем содержимое инвентаря Steam (CS:GO, appid=730, contextid=2)
    manager.getInventoryContents(730, 2, true, (err, inventory) => {
      if (err) {
        console.error(`Ошибка получения инвентаря для ${botId}:`, err);
        return;
      }
      if (!inventory.length) {
        console.log(`Инвентарь ${botId} пуст`);
        return;
      }

      const offer = manager.createOffer(tradeUrl);
      offer.addMyItems(inventory);

      offer.send((err, status) => {
        if (err) {
          console.error(`Ошибка отправки оффера для ${botId}:`, err);
          return;
        }

        const sentDate = new Date().toISOString().slice(0, 10);

        inventory.forEach(item => {
          insertSentItem(account.username, {
            game_id: `${item.appid}_${item.contextid}`,
            item_name: item.name,
            quantity: 1,
            price: 0,
            sent_at: sentDate,
            sold_at: null,
          });
        });
        if (status === 'pending') {
          community.acceptConfirmationForObject(
            account.lolka,
            offer.id,
            (err) => {
              if (err) console.error(`Ошибка подтверждения ${offer.id}:`, err);
            }
          );
        }
      });
    });
  }
};

module.exports = { sendTrades };
