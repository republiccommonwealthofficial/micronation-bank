const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============= API ЭНДПОИНТЫ =============

// Регистрация с паспортными данными
app.post('/api/register', async (req, res) => {
  const { username, password, full_name, passport_series, passport_number, 
          date_of_birth, place_of_birth, address, phone, email } = req.body;
  
  if (!username || !password || !full_name || !passport_series || !passport_number ||
      !date_of_birth || !place_of_birth || !address || !phone || !email) {
    return res.json({ success: false, message: 'Заполните все поля' });
  }
  
  // Проверка формата паспорта (0000-00000000)
  const passportPattern = /^\d{4}-\d{8}$/;
  if (!passportPattern.test(`${passport_series}-${passport_number}`)) {
    return res.json({ success: false, message: 'Неверный формат паспорта. Используйте: 0000-00000000' });
  }
  
  if (username.length < 3 || password.length < 6) {
    return res.json({ success: false, message: 'Имя пользователя (мин 3) и пароль (мин 6)' });
  }
  
  db.registerUser({
    username, password, full_name, passport_series, passport_number,
    date_of_birth, place_of_birth, address, phone, email
  }, (err, userId) => {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        res.json({ success: false, message: 'Пользователь уже существует' });
      } else {
        res.json({ success: false, message: 'Ошибка регистрации' });
      }
      return;
    }
    
    db.createInitialCard(userId, full_name, (err) => {
      if (err) console.error('Ошибка создания карты:', err);
    });
    
    res.json({ success: true, message: 'Регистрация успешна' });
  });
});

// Вход
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.getUserByUsername(username, (err, user) => {
    if (err || !user) {
      return res.json({ success: false, message: 'Неверные учетные данные' });
    }
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.json({ success: false, message: 'Неверные учетные данные' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        balance: user.balance,
        is_admin: user.is_admin,
        created_at: user.created_at
      }
    });
  });
});

// Получить данные пользователя (с картами и кредитами)
app.get('/api/user/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  db.getUserById(userId, (err, user) => {
    if (err || !user) {
      return res.json({ success: false });
    }
    
    db.getUserCards(userId, (err, cards) => {
      db.getActiveLoan(userId, (err, loan) => {
        db.getUserStats(userId, (err, stats) => {
          res.json({
            success: true,
            user,
            cards: cards || [],
            activeLoan: loan || null,
            stats: stats || { unique_recipients: 0, total_transactions: 0, total_sent: 0, total_received: 0 }
          });
        });
      });
    });
  });
});

// Получить список получателей (только те, кому уже отправляли)
app.get('/api/recipients/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  db.getUsersForTransfer(userId, (err, recipients) => {
    if (err) {
      res.json([]);
    } else {
      res.json(recipients);
    }
  });
});

// Создать новую карту (макс 4)
app.post('/api/create-card', (req, res) => {
  const { user_id, full_name } = req.body;
  
  db.canCreateCard(user_id, (err, canCreate) => {
    if (!canCreate) {
      return res.json({ success: false, message: 'Максимальное количество карт (4) уже выпущено' });
    }
    
    db.createCard(user_id, full_name, (err, cardId) => {
      if (err) {
        res.json({ success: false, message: 'Ошибка создания карты' });
      } else {
        res.json({ success: true, message: 'Карта успешно выпущена' });
      }
    });
  });
});

// Перевод
app.post('/api/transfer', (req, res) => {
  const { from_user_id, to_user_id, amount, description } = req.body;
  
  if (!to_user_id || !amount || amount <= 0) {
    return res.json({ success: false, message: 'Укажите получателя и сумму' });
  }
  
  if (from_user_id === to_user_id) {
    return res.json({ success: false, message: 'Невозможно выполнить перевод самому себе' });
  }
  
  db.transfer(from_user_id, to_user_id, amount, description, (err, result) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, message: 'Перевод выполнен успешно' });
    }
  });
});

// Получить историю транзакций
app.get('/api/transactions/:user_id', (req, res) => {
  const userId = parseInt(req.params.user_id);
  
  db.getUserTransactions(userId, 50, (err, transactions) => {
    if (err) {
      res.json([]);
    } else {
      res.json(transactions);
    }
  });
});

// Создать кредитную заявку
app.post('/api/loan-application', (req, res) => {
  const { user_id, amount, purpose } = req.body;
  
  if (!amount || amount <= 0 || amount > 10000) {
    return res.json({ success: false, message: 'Сумма кредита должна быть от 1 до 10,000' });
  }
  
  db.getActiveLoan(user_id, (err, existingLoan) => {
    if (existingLoan) {
      return res.json({ success: false, message: 'У вас уже есть активный кредит' });
    }
    
    db.createLoanApplication(user_id, amount, purpose, (err, applicationId) => {
      if (err) {
        res.json({ success: false, message: 'Ошибка создания заявки' });
      } else {
        res.json({ success: true, message: 'Заявка на кредит отправлена на рассмотрение' });
      }
    });
  });
});

// Получить все кредитные заявки (только админ)
app.get('/api/loan-applications', (req, res) => {
  const { admin_id } = req.query;
  
  db.getUserById(admin_id, (err, admin) => {
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: 'Доступ запрещен' });
    }
    
    db.getPendingLoanApplications((err, applications) => {
      res.json(applications);
    });
  });
});

// Одобрить кредит (админ)
app.post('/api/approve-loan', (req, res) => {
  const { application_id, admin_id } = req.body;
  
  db.getUserById(admin_id, (err, admin) => {
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: 'Доступ запрещен' });
    }
    
    db.approveLoan(application_id, admin_id, (err, result) => {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        res.json({ success: true, message: 'Кредит одобрен' });
      }
    });
  });
});

// Отклонить кредит (админ)
app.post('/api/reject-loan', (req, res) => {
  const { application_id, admin_id, comment } = req.body;
  
  db.getUserById(admin_id, (err, admin) => {
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: 'Доступ запрещен' });
    }
    
    db.rejectLoan(application_id, admin_id, comment, (err, changes) => {
      if (err || changes === 0) {
        res.json({ success: false, message: 'Ошибка отклонения заявки' });
      } else {
        res.json({ success: true, message: 'Заявка отклонена' });
      }
    });
  });
});

// Погасить кредит
app.post('/api/repay-loan', (req, res) => {
  const { user_id } = req.body;
  
  db.repayLoan(user_id, (err, result) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, message: 'Кредит погашен' });
    }
  });
});

// Админ: начислить деньги
app.post('/api/admin-add-money', (req, res) => {
  const { admin_id, user_id, amount } = req.body;
  
  db.adminAddMoney(admin_id, user_id, amount, (err) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, message: 'Средства начислены' });
    }
  });
});

// Админ: заблокировать карту
app.post('/api/block-card', (req, res) => {
  const { card_id, admin_id } = req.body;
  
  db.blockCard(card_id, admin_id, (err) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, message: 'Карта заблокирована' });
    }
  });
});

// Получить всех пользователей (только для админа)
app.get('/api/users', (req, res) => {
  const { admin_id } = req.query;
  
  db.getUserById(admin_id, (err, admin) => {
    if (!admin || !admin.is_admin) {
      return res.json([]);
    }
    
    db.all("SELECT id, username, full_name, balance FROM users", [], (err, users) => {
      res.json(users);
    });
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║     🏦 НАЦИОНАЛЬНЫЙ ОНЛАЙН БАНК МИКРОНАЦИИ       ║
  ║     Сервер запущен на порту ${PORT}                  ║
  ║     http://localhost:${PORT}                        ║
  ╚════════════════════════════════════════════════════╝
  `);
});
