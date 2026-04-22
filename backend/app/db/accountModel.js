const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

const createAccountsTable = () => {
  const stmt = db.prepare(
    `
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      shared TEXT NOT NULL,
      lolka TEXT NOT NULL
    )
    `
  );
  stmt.run();
};

const createSentItemsTable = () => {
  const stmt = db.prepare(`
    CREATE TABLE IF NOT EXISTS sent_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      game_id TEXT,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      sent_at INTEGER NOT NULL,
      sold_at INTEGER
    )
  `);
  stmt.run();
};

const initDatabase = () => {
  createAccountsTable();
  createSentItemsTable();
};

const getAllAccounts = () => {
  const stmt = db.prepare('SELECT * FROM accounts');
  return stmt.all();
};

const getAccountById = (accountId) => {
  const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
  return stmt.get(accountId);
};

const existsAccount = (username) => {
  const stmt = db.prepare(
    'SELECT 1 FROM accounts WHERE username = ?'
  );
  const row = stmt.get(username);
  return !!row;
};

const insertAccount = (id, account) => {
  if (existsAccount(account.username)) {
    return false;
  }
  const stmt = db.prepare(
    `
    INSERT INTO accounts (id, username, password, shared, lolka)
    VALUES (?, ?, ?, ?, ?)
    `
  );
  stmt.run(id, account.username, account.password, account.shared, account.lolka);
  return true;
};

const deleteAccount = (accountId) => {
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  stmt.run(accountId);
};

const insertSentItem = (username, item) => {
  const checkStmt = db.prepare(`
    SELECT id FROM sent_items
    WHERE username = ? AND item_name = ? AND sent_at = ?
  `);
  const existing = checkStmt.get(username, item.item_name, item.sent_at);

  if (existing) {
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO sent_items (username, game_id, item_name, quantity, price, sent_at, sold_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertStmt.run(
    username,
    item.game_id || null,
    item.item_name,
    item.quantity,
    item.price ?? 0,
    item.sent_at,
    item.sold_at || null
  );
};

const getSentItemsByUsername = (username) => {
  const stmt = db.prepare('SELECT * FROM sent_items WHERE username = ?');
  return stmt.all(username);
};

const markItemSoldByName = (itemName, soldAtDate, price) => {
  const stmt = db.prepare(`
    SELECT id FROM sent_items
    WHERE item_name = ?
      AND sold_at IS NULL
    ORDER BY sent_at ASC
    LIMIT 1
  `);
  const item = stmt.get(itemName);

  if (!item) return false;

  const updateStmt = db.prepare(`
    UPDATE sent_items
    SET sold_at = ?, price = ?
    WHERE id = ?
  `);
  updateStmt.run(soldAtDate, price, item.id);

  return true;
};

const getItemDistribution = (startDate, endDate) => {
  let query = `
    SELECT 
      item_name, 
      COUNT(*) AS count,
      SUM(price) AS total_price
    FROM sent_items
  `;

  const params = [];

  if (startDate && endDate) {
    query += ` WHERE sent_at BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  query += ` GROUP BY item_name`;

  const stmt = db.prepare(query);
  return stmt.all(...params);
};
const getAllPricedItems = () => {
  const stmt = db.prepare(`
    SELECT
      item_name,
      price,
      sent_at
    FROM sent_items
    WHERE price != 0.0
      AND sold_at IS NOT NULL
  `);
  return stmt.all();
};

module.exports = {
  initDatabase,
  getAllAccounts,
  getAccountById,
  insertAccount,
  deleteAccount,
  insertSentItem,
  getSentItemsByUsername,
  markItemSoldByName,
  getItemDistribution,
  getAllPricedItems
};
