const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./bank.db');

// Инициализация базы данных
db.serialize(() => {
  // Таблица пользователей с паспортными данными
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      passport_series TEXT NOT NULL,
      passport_number TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      place_of_birth TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      balance REAL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_admin INTEGER DEFAULT 0
    )
  `);

  // Таблица карт (с полными данными)
  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_number TEXT UNIQUE NOT NULL,
      card_holder TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      cvv TEXT NOT NULL,
      is_blocked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Таблица кредитных заявок
  db.run(`
    CREATE TABLE IF NOT EXISTS loan_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      purpose TEXT,
      status TEXT DEFAULT 'pending',
      admin_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      processed_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (processed_by) REFERENCES users(id)
    )
  `);

  // Таблица активных кредитов
  db.run(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      debt_amount REAL NOT NULL,
      interest_rate REAL DEFAULT 0.1,
      monthly_payment REAL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES loan_applications(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Таблица транзакций
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

  // Таблица истории получателей (для быстрых переводов)
  db.run(`
    CREATE TABLE IF NOT EXISTS frequent_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      times_used INTEGER DEFAULT 1,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id),
      UNIQUE(user_id, recipient_id)
    )
  `);

  // Создаем администратора
  db.get("SELECT COUNT(*) as count FROM users WHERE is_admin = 1", (err, row) => {
    if (row && row.count === 0) {
      const salt = bcrypt.genSaltSync(10);
      db.run(`
        INSERT INTO users (
          username, password, full_name, passport_series, passport_number,
          date_of_birth, place_of_birth, address, phone, email, balance, is_admin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'admin', bcrypt.hashSync('Admin123', salt), 'Администратор',
        '0001', '00000001', '1990-01-01', 'Столица', 'Центральный округ 1',
        '+0000000000', 'admin@bank.gov', 0, 1
      ]);
      console.log('✅ Администратор создан: admin / Admin123');
    }
  });
});

const dbFunctions = {
  // Регистрация с паспортными данными
  registerUser: (data, callback) => {
    const {
      username, password, full_name, passport_series, passport_number,
      date_of_birth, place_of_birth, address, phone, email
    } = data;
    
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    
    db.run(`
      INSERT INTO users (
        username, password, full_name, passport_series, passport_number,
        date_of_birth, place_of_birth, address, phone, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      username, hashedPassword, full_name, passport_series, passport_number,
      date_of_birth, place_of_birth, address, phone, email
    ], function(err) {
      callback(err, this?.lastID);
    });
  },
  
  // Создание карты при регистрации
  createInitialCard: (userId, fullName, callback) => {
    const generateCardNumber = () => {
      const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const part3 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      return `${part1}-${part2}-${part3}`;
    };
    
    const generateCVV = () => Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    const expiryDate = () => {
      const date = new Date();
      const year = date.getFullYear() + 3;
      return `12/${year.toString().slice(-2)}`;
    };
    
    const cardNumber = generateCardNumber();
    const cvv = generateCVV();
    const expiry = expiryDate();
    const cardHolder = fullName.toUpperCase();
    
    db.run(`
      INSERT INTO cards (user_id, card_number, card_holder, expiry_date, cvv)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, cardNumber, cardHolder, expiry, cvv], callback);
  },
  
  // Получить пользователя по ID
  getUserById: (id, callback) => {
    db.get(`
      SELECT id, username, full_name, passport_series, passport_number,
             date_of_birth, place_of_birth, address, phone, email,
             balance, is_admin, created_at
      FROM users WHERE id = ?
    `, [id], callback);
  },
  
  // Получить пользователя по username
  getUserByUsername: (username, callback) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], callback);
  },
  
  // Получить карты пользователя (макс 4)
  getUserCards: (userId, callback) => {
    db.all("SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC", [userId], callback);
  },
  
  // Проверить лимит карт
  canCreateCard: (userId, callback) => {
    db.get("SELECT COUNT(*) as count FROM cards WHERE user_id = ?", [userId], (err, result) => {
      callback(err, result ? result.count < 4 : true);
    });
  },
  
  // Создать новую карту
  createCard: (userId, fullName, callback) => {
    const generateCardNumber = () => {
      const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const part3 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      return `${part1}-${part2}-${part3}`;
    };
    
    const generateCVV = () => Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const expiryDate = () => {
      const date = new Date();
      const year = date.getFullYear() + 3;
      return `12/${year.toString().slice(-2)}`;
    };
    
    const cardNumber = generateCardNumber();
    const cvv = generateCVV();
    const expiry = expiryDate();
    const cardHolder = fullName.toUpperCase();
    
    db.run(`
      INSERT INTO cards (user_id, card_number, card_holder, expiry_date, cvv)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, cardNumber, cardHolder, expiry, cvv], callback);
  },
  
  // Получить всех пользователей (без списка клиентов)
  getUsersForTransfer: (currentUserId, callback) => {
    db.all(`
      SELECT DISTINCT u.id, u.username, u.full_name
      FROM users u
      INNER JOIN frequent_recipients fr ON u.id = fr.recipient_id
      WHERE fr.user_id = ? AND u.id != ?
      ORDER BY fr.last_used DESC
    `, [currentUserId, currentUserId], callback);
  },
  
  // Добавить получателя в историю
  addFrequentRecipient: (userId, recipientId, callback) => {
    db.run(`
      INSERT INTO frequent_recipients (user_id, recipient_id, times_used, last_used)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, recipient_id) DO UPDATE SET
        times_used = times_used + 1,
        last_used = CURRENT_TIMESTAMP
    `, [userId, recipientId], callback);
  },
  
  // Выполнить перевод
  transfer: (fromUserId, toUserId, amount, description, callback) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      db.get("SELECT balance FROM users WHERE id = ? AND balance >= ?", [fromUserId, amount], (err, user) => {
        if (!user) {
          db.run("ROLLBACK");
          callback(new Error("Недостаточно средств"));
          return;
        }
        
        db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [amount, fromUserId]);
        db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, toUserId]);
        db.run(`
          INSERT INTO transactions (from_user_id, to_user_id, amount, description)
          VALUES (?, ?, ?, ?)
        `, [fromUserId, toUserId, amount, description]);
        
        db.run("COMMIT");
        dbFunctions.addFrequentRecipient(fromUserId, toUserId);
        callback(null, { success: true });
      });
    });
  },
  
  // Получить историю транзакций
  getUserTransactions: (userId, limit = 50, callback) => {
    db.all(`
      SELECT t.*, u1.full_name as from_name, u2.full_name as to_name
      FROM transactions t
      LEFT JOIN users u1 ON t.from_user_id = u1.id
      LEFT JOIN users u2 ON t.to_user_id = u2.id
      WHERE t.from_user_id = ? OR t.to_user_id = ?
      ORDER BY t.created_at DESC LIMIT ?
    `, [userId, userId, limit], callback);
  },
  
  // Создать кредитную заявку
  createLoanApplication: (userId, amount, purpose, callback) => {
    db.run(`
      INSERT INTO loan_applications (user_id, amount, purpose)
      VALUES (?, ?, ?)
    `, [userId, amount, purpose], callback);
  },
  
  // Получить все кредитные заявки (для админа)
  getPendingLoanApplications: (callback) => {
    db.all(`
      SELECT la.*, u.full_name, u.username
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      WHERE la.status = 'pending'
      ORDER BY la.created_at ASC
    `, callback);
  },
  
  // Одобрить кредит
  approveLoan: (applicationId, adminId, callback) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      db.get("SELECT * FROM loan_applications WHERE id = ? AND status = 'pending'", [applicationId], (err, app) => {
        if (!app) {
          db.run("ROLLBACK");
          callback(new Error("Заявка не найдена или уже обработана"));
          return;
        }
        
        const debtAmount = app.amount * 1.1;
        const monthlyPayment = debtAmount / 12;
        
        db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [app.amount, app.user_id]);
        db.run(`
          INSERT INTO loans (application_id, user_id, amount, debt_amount, monthly_payment)
          VALUES (?, ?, ?, ?, ?)
        `, [applicationId, app.user_id, app.amount, debtAmount, monthlyPayment]);
        
        db.run(`
          UPDATE loan_applications SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ?
          WHERE id = ?
        `, [adminId, applicationId]);
        
        db.run("COMMIT");
        callback(null, { success: true, amount: app.amount });
      });
    });
  },
  
  // Отклонить кредит
  rejectLoan: (applicationId, adminId, comment, callback) => {
    db.run(`
      UPDATE loan_applications SET status = 'rejected', admin_comment = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
      WHERE id = ? AND status = 'pending'
    `, [comment, adminId, applicationId], function(err) {
      callback(err, this?.changes);
    });
  },
  
  // Получить активный кредит пользователя
  getActiveLoan: (userId, callback) => {
    db.get(`
      SELECT * FROM loans WHERE user_id = ? AND is_active = 1
    `, [userId], callback);
  },
  
  // Погасить кредит
  repayLoan: (userId, callback) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      db.get("SELECT * FROM loans WHERE user_id = ? AND is_active = 1", [userId], (err, loan) => {
        if (!loan) {
          db.run("ROLLBACK");
          callback(new Error("Нет активного кредита"));
          return;
        }
        
        db.get("SELECT balance FROM users WHERE id = ? AND balance >= ?", [userId, loan.debt_amount], (err, user) => {
          if (!user) {
            db.run("ROLLBACK");
            callback(new Error("Недостаточно средств для погашения кредита"));
            return;
          }
          
          db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [loan.debt_amount, userId]);
          db.run("UPDATE loans SET is_active = 0 WHERE id = ?", [loan.id]);
          
          db.run("COMMIT");
          callback(null, { success: true, amount: loan.debt_amount });
        });
      });
    });
  },
  
  // Админ: начислить деньги
  adminAddMoney: (adminId, userId, amount, callback) => {
    db.get("SELECT is_admin FROM users WHERE id = ?", [adminId], (err, admin) => {
      if (!admin || !admin.is_admin) {
        callback(new Error("Доступ запрещен"));
        return;
      }
      
      db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId], callback);
    });
  },
  
  // Заблокировать карту
  blockCard: (cardId, adminId, callback) => {
    db.get("SELECT is_admin FROM users WHERE id = ?", [adminId], (err, admin) => {
      if (!admin || !admin.is_admin) {
        callback(new Error("Доступ запрещен"));
        return;
      }
      
      db.run("UPDATE cards SET is_blocked = 1 WHERE id = ?", [cardId], callback);
    });
  },
  
  // Получить статистику пользователя
  getUserStats: (userId, callback) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT CASE WHEN from_user_id = ? THEN to_user_id END) as unique_recipients,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN from_user_id = ? THEN amount ELSE 0 END) as total_sent,
        SUM(CASE WHEN to_user_id = ? THEN amount ELSE 0 END) as total_received
      FROM transactions
      WHERE from_user_id = ? OR to_user_id = ?
    `, [userId, userId, userId, userId, userId], callback);
  }
};

module.exports = dbFunctions;
