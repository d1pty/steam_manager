const xlsx = require('xlsx');
const path = require('path');
const Database = require('better-sqlite3');

// Укажи путь к файлу .xlsx
const filePath = path.join(__dirname, 'steam.xlsx');
// Укажи путь к БД
const dbPath = path.join(__dirname, 'accounts.db');

// Подключение к БД
const db = new Database(dbPath);

// Функция импорта истории в БД
const importHistoryToDB = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const dbData = [];

  for (let colIndex = 1; colIndex < rows[0].length; colIndex++) {
    const username = rows[0][colIndex];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const cellValueRaw = rows[rowIndex][colIndex];
      if (!cellValueRaw) continue;

      // Убираем лишние кавычки и пробелы
      const cleaned = cellValueRaw.replace(/^"+|"+$/g, '').trim();
      const [itemName, dateStr] = cleaned.split('",').map(s => s.replace(/"/g, '').trim());

      if (!dateStr || !/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
        console.error(`Невалидная дата: ${dateStr}`);
        continue;
      }

      dbData.push({
        username,
        game_id: '730_2',
        item_name: itemName,
        quantity: 1,
        price: 0,
        sent_at: dateStr,
        sold_at: null,
      });
    }
  }

  console.log('Подготовленные данные для базы данных:\n');
  dbData.forEach((entry, i) => {
    console.log(`${i + 1}. ${entry.username} — ${entry.item_name} — ${entry.sent_at}`);
  });

  // --- Вставка в базу данных ---
  const insert = db.prepare(`
    INSERT INTO sent_items (username, game_id, item_name, quantity, price, sent_at, sold_at)
    VALUES (@username, @game_id, @item_name, @quantity, @price, @sent_at, @sold_at)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item);
    }
  });

  insertMany(dbData);

  console.log('✅ Данные успешно импортированы в базу!');
};

importHistoryToDB(filePath);
