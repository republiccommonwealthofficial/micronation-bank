const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Создаём и подключаем базу данных
const db = new sqlite3.Database('./bank.db');

// Инициализация базы данных - создаём все таблицы
db.serialize(() => {
  // 1. Таблица пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      balance REAL DEFAULT 1000.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Таблица карт
  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_number TEXT UNIQUE NOT NULL,
      is_blocked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. Таблица транзакций (история переводов)
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'completed',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    )
  `);

  // 4. Таблица кредитов
  db.run(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      debt_amount REAL NOT NULL,
      interest_rate REAL DEFAULT 0.1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 5. Создаём тестового администратора, если пользователей нет
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row && row.count === 0) {
      // Создаём тестовых пользователей с хешированными паролями
      const salt = bcrypt.genSaltSync(10);
      
      const testUsers = [
        { username: 'president', password: bcrypt.hashSync('123', salt), full_name: 'Президент', balance: 10000 },
        { username: 'minister', password: bcrypt.hashSync('123', salt), full_name: 'Министр финансов', balance: 5000 },
        { username: 'citizen1', password: bcrypt.hashSync('123', salt), full_name: 'Гражданин Иванов', balance: 1000 },
        { username: 'citizen2', password: bcrypt.hashSync('123', salt), full_name: 'Гражданин Петров', balance: 1000 }
      ];

      testUsers.forEach(user => {
        db.run(
          "INSERT INTO users (username, password, full_name, balance) VALUES (?, ?, ?, ?)",
          [user.username, user.password, user.full_name, user.balance],
          function(err) {
            if (!err) {
              // Создаём по одной карте для каждого тестового пользователя
              const cardNumber = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
              db.run("INSERT INTO cards (user_id, card_number) VALUES (?, ?)", [this.lastID, cardNumber]);
            }
          }
        );
      });
      
      console.log('✅ Созданы тестовые пользователи:');
      console.log('   president / 123 - Администратор');
      console.log('   minister / 123 - Министр');
      console.log('   citizen1 / 123 - Гражданин');
      console.log('   citizen2 / 123 - Гражданин');
    }
  });
});

// Функции для работы с базой данных
const dbFunctions = {
  // Получить пользователя по ID
  getUserById: (id, callback) => {
    db.get("SELECT id, username, full_name, balance, created_at FROM users WHERE id = ?", [id], callback);
  },
  
  // Получить пользователя по имени
  getUserByUsername: (username, callback) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], callback);
  },
  
  // Создать нового пользователя
  createUser: (username, password, full_name, callback) => {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    
    db.run(
      "INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)",
      [username, hashedPassword, full_name],
      function(err) {
        if (!err && this.lastID) {
          // Автоматически создаём карту для нового пользователя
          const cardNumber = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
          db.run("INSERT INTO cards (user_id, card_number) VALUES (?, ?)", [this.lastID, cardNumber]);
        }
        callback(err, this?.lastID);
      }
    );
  },
  
  // Получить всех пользователей (для списка переводов)
  getAllUsers: (callback) => {
    db.all("SELECT id, username, full_name, balance FROM users ORDER BY full_name", callback);
  },
  
  // Получить карты пользователя
  getUserCards: (userId, callback) => {
    db.all("SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC", [userId], callback);
  },
  
  // Создать новую карту
  createCard: (userId, callback) => {
    const cardNumber = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
    db.run(
      "INSERT INTO cards (user_id, card_number) VALUES (?, ?)",
      [userId, cardNumber],
      function(err) {
        callback(err, this?.lastID, cardNumber);
      }
    );
  },
  
  // Блокировка/разблокировка карты
  toggleCardBlock: (cardId, isBlocked, callback) => {
    db.run(
      "UPDATE cards SET is_blocked = ? WHERE id = ?",
      [isBlocked ? 1 : 0, cardId],
      callback
    );
  },
  
  // Выполнить перевод
  transfer: (fromUserId, toUserId, amount, description, callback) => {
    // Используем транзакцию для безопасности
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Проверяем наличие активных карт у отправителя
      db.get(
        "SELECT COUNT(*) as active_cards FROM cards WHERE user_id = ? AND is_blocked = 0",
        [fromUserId],
        (err, result) => {
          if (err || result.active_cards === 0) {
            db.run("ROLLBACK");
            callback(new Error("Нет активных карт для совершения перевода"));
            return;
          }
          
          // Снимаем деньги
          db.run(
            "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
            [amount, fromUserId, amount],
            function(err) {
              if (err || this.changes === 0) {
                db.run("ROLLBACK");
                callback(new Error("Недостаточно средств"));
                return;
              }
              
              // Добавляем деньги получателю
              db.run(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                [amount, toUserId],
                function(err) {
                  if (err) {
                    db.run("ROLLBACK");
                    callback(err);
                    return;
                  }
                  
                  // Записываем транзакцию
                  db.run(
                    "INSERT INTO transactions (from_user_id, to_user_id, amount, description) VALUES (?, ?, ?, ?)",
                    [fromUserId, toUserId, amount, description || 'Перевод между пользователями'],
                    function(err) {
                      if (err) {
                        db.run("ROLLBACK");
                        callback(err);
                        return;
                      }
                      
                      db.run("COMMIT");
                      callback(null, { success: true, transactionId: this.lastID });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  },
  
  // Получить историю транзакций пользователя
  getUserTransactions: (userId, limit = 50, callback) => {
    db.all(`
      SELECT 
        t.*,
        u1.full_name as from_name,
        u2.full_name as to_name
      FROM transactions t
      LEFT JOIN users u1 ON t.from_user_id = u1.id
      LEFT JOIN users u2 ON t.to_user_id = u2.id
      WHERE t.from_user_id = ? OR t.to_user_id = ?
      ORDER BY t.created_at DESC
      LIMIT ?
    `, [userId, userId, limit], callback);
  },
  
  // Взять кредит
  takeLoan: (userId, amount, callback) => {
    const interestRate = 0.1;
    const debtAmount = amount * (1 + interestRate);
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Проверяем активные кредиты
      db.get(
        "SELECT * FROM loans WHERE user_id = ? AND is_active = 1",
        [userId],
        (err, activeLoan) => {
          if (activeLoan) {
            db.run("ROLLBACK");
            callback(new Error("У вас уже есть активный кредит"));
            return;
          }
          
          // Выдаём кредит
          db.run(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [amount, userId],
            function(err) {
              if (err) {
                db.run("ROLLBACK");
                callback(err);
                return;
              }
              
              // Записываем кредит
              db.run(
                "INSERT INTO loans (user_id, amount, debt_amount, interest_rate) VALUES (?, ?, ?, ?)",
                [userId, amount, debtAmount, interestRate],
                function(err) {
                  if (err) {
                    db.run("ROLLBACK");
                    callback(err);
                    return;
                  }
                  
                  db.run("COMMIT");
                  callback(null, { loanId: this.lastID, amount, debtAmount });
                }
              );
            }
          );
        }
      );
    });
  },
  
  // Погасить кредит
  repayLoan: (userId, callback) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      db.get(
        "SELECT * FROM loans WHERE user_id = ? AND is_active = 1",
        [userId],
        (err, loan) => {
          if (!loan) {
            db.run("ROLLBACK");
            callback(new Error("Нет активного кредита"));
            return;
          }
          
          db.get(
            "SELECT balance FROM users WHERE id = ?",
            [userId],
            (err, user) => {
              if (user.balance < loan.debt_amount) {
                db.run("ROLLBACK");
                callback(new Error(`Недостаточно средств. Нужно: ${loan.debt_amount}`));
                return;
              }
              
              // Списываем деньги
              db.run(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                [loan.debt_amount, userId],
                function(err) {
                  if (err) {
                    db.run("ROLLBACK");
                    callback(err);
                    return;
                  }
                  
                  // Закрываем кредит
                  db.run(
                    "UPDATE loans SET is_active = 0, paid_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [loan.id],
                    function(err) {
                      if (err) {
                        db.run("ROLLBACK");
                        callback(err);
                        return;
                      }
                      
                      db.run("COMMIT");
                      callback(null, { success: true, amount: loan.debt_amount });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  },
  
  // Получить активный кредит пользователя
  getActiveLoan: (userId, callback) => {
    db.get(
      "SELECT * FROM loans WHERE user_id = ? AND is_active = 1",
      [userId],
      callback
    );
  },
  
  // Админ: начислить деньги
  adminAddMoney: (adminId, userId, amount, callback) => {
    // Проверяем, что админ (id = 1)
    if (adminId !== 1) {
      callback(new Error("Только администратор может начислять деньги"));
      return;
    }
    
    db.run(
      "UPDATE users SET balance = balance + ? WHERE id = ?",
      [amount, userId],
      function(err) {
        if (!err && this.changes > 0) {
          // Записываем системную транзакцию
          db.run(
            "INSERT INTO transactions (from_user_id, to_user_id, amount, description) VALUES (?, ?, ?, ?)",
            [adminId, userId, amount, "Административное начисление"]
          );
        }
        callback(err, this?.changes);
      }
    );
  }
};

module.exports = dbFunctions;