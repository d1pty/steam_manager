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

/**
 * Загружает инвентарь для любого приложения
 * @param {string} botId 
 * @param {number} appId 
 * @param {number|string} contextId 
 * @param {function} cb (err, inventory)
 */
const loadInventory = (botId, appId, contextId, cb) => {
  const manager = managers[botId];
  if (!manager) {
    return cb(new Error(`Менеджер с botId=${botId} не найден`));
  }
  manager.loadInventory(appId, contextId, true, (err, inventory) => {
    cb(err, inventory);
  });
};

module.exports = {loadInventory, loadInventoryAfterLogin };
