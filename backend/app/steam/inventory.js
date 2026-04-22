const { managers } = require('./clients');

const loadInventoryAfterLogin = (botId) => {
  const manager = managers[botId];
  if (!manager) return;

  const inventories = [{ appId: 730, contextId: 2 }];
  inventories.forEach(({ appId, contextId }) => {
    manager.loadInventory(appId, contextId, true, (err, inventory) => {
      if (err) {
        console.error(`Ошибка загрузки инвентаря (${botId}):`, err);
      }
    });
  });
};

module.exports = { loadInventoryAfterLogin };
