const db = require('better-sqlite3')('accounts.db');

// Создаем таблицу, если она не существует
const createTable = () => {
  const stmt = db.prepare(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      shared TEXT NOT NULL,
      lolka TEXT NOT NULL
    )
  `);
  stmt.run();
};

// Получить все аккаунты
const getAllAccounts = () => {
  const stmt = db.prepare('SELECT * FROM accounts');
  return stmt.all();
};

// Получить аккаунт по ID
const getAccountById = (accountId) => {
  const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
  return stmt.get(accountId);
};

// Добавить новый аккаунт
const insertAccount = (id, account) => {
  const stmt = db.prepare(`
    INSERT INTO accounts (id, username, password, shared, lolka)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, account.username, account.password, account.shared, account.lolka);
};

// Удалить аккаунт
const deleteAccount = (accountId) => {
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  stmt.run(accountId);
};

module.exports = {
  createTable,
  getAllAccounts,
  getAccountById,
  insertAccount,
  deleteAccount,
};
