const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============= API ЭНДПОИНТЫ =============

// Регистрация нового пользователя
app.post('/api/register', (req, res) => {
  const { username, password, full_name } = req.body;
  
  if (!username || !password || !full_name) {
    return res.json({ success: false, message: 'Заполните все поля' });
  }
  
  if (username.length < 3) {
    return res.json({ success: false, message: 'Имя пользователя должно быть минимум 3 символа' });
  }
  
  if (password.length < 3) {
    return res.json({ success: false, message: 'Пароль должен быть минимум 3 символа' });
  }
  
  db.createUser(username, password, full_name, (err, userId) => {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        res.json({ success: false, message: 'Пользователь с таким именем уже существует' });
      } else {
        res.json({ success: false, message: 'Ошибка регистрации' });
      }
    } else {
      res.json({ 
        success: true, 
        user_id: userId,
        message: 'Регистрация успешна! Теперь войдите в систему.'
      });
    }
  });
});

// Вход в систему
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.getUserByUsername(username, (err, user) => {
    if (err || !user) {
      return res.json({ success: false, message: 'Неверное имя пользователя или пароль' });
    }
    
    const isValidPassword = bcrypt.compareSync(password, user.password);
    
    if (!isValidPassword) {
      return res.json({ success: false, message: 'Неверное имя пользователя или пароль' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        balance: user.balance,
        created_at: user.created_at
      }
    });
  });
});

// Получить информацию о пользователе (с картами и кредитами)
app.get('/api/user/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  db.getUserById(userId, (err, user) => {
    if (err || !user) {
      return res.json({ success: false, message: 'Пользователь не найден' });
    }
    
    db.getUserCards(userId, (err, cards) => {
      db.getActiveLoan(userId, (err, loan) => {
        res.json({
          success: true,
          user: user,
          cards: cards || [],
          activeLoan: loan || null
        });
      });
    });
  });
});

// Получить всех пользователей
app.get('/api/users', (req, res) => {
  db.getAllUsers((err, users) => {
    if (err) {
      res.json([]);
    } else {
      res.json(users);
    }
  });
});

// Создать новую карту
app.post('/api/create-card', (req, res) => {
  const { user_id } = req.body;
  
  db.createCard(user_id, (err, cardId, cardNumber) => {
    if (err) {
      res.json({ success: false, message: 'Ошибка создания карты' });
    } else {
      res.json({ success: true, card_id: cardId, card_number: cardNumber });
    }
  });
});

// Блокировка/разблокировка карты
app.post('/api/toggle-card', (req, res) => {
  const { card_id, is_blocked, admin_id } = req.body;
  
  // Только администратор (id=1) может блокировать карты
  if (admin_id !== 1) {
    return res.json({ success: false, message: 'Только администратор может управлять картами' });
  }
  
  db.toggleCardBlock(card_id, is_blocked, (err) => {
    if (err) {
      res.json({ success: false, message: 'Ошибка' });
    } else {
      res.json({ success: true });
    }
  });
});

// Сделать перевод
app.post('/api/transfer', (req, res) => {
  const { from_user_id, to_user_id, amount, description } = req.body;
  
  if (!to_user_id || !amount || amount <= 0) {
    return res.json({ success: false, message: 'Укажите получателя и сумму' });
  }
  
  if (from_user_id === to_user_id) {
    return res.json({ success: false, message: 'Нельзя перевести самому себе' });
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
  const limit = parseInt(req.query.limit) || 50;
  
  db.getUserTransactions(userId, limit, (err, transactions) => {
    if (err) {
      res.json([]);
    } else {
      res.json(transactions);
    }
  });
});

// Взять кредит
app.post('/api/take-loan', (req, res) => {
  const { user_id, amount } = req.body;
  
  if (!amount || amount <= 0 || amount > 10000) {
    return res.json({ success: false, message: 'Сумма кредита должна быть от 1 до 10,000' });
  }
  
  db.takeLoan(user_id, amount, (err, result) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ 
        success: true, 
        message: `Кредит выдан! Получено: ${result.amount} ⭐. Долг с процентами: ${result.debtAmount.toFixed(2)} ⭐`,
        loan: result
      });
    }
  });
});

// Погасить кредит
app.post('/api/repay-loan', (req, res) => {
  const { user_id } = req.body;
  
  db.repayLoan(user_id, (err, result) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, message: `Кредит погашен! Сумма: ${result.amount.toFixed(2)} ⭐` });
    }
  });
});

// Админ: начислить деньги
app.post('/api/admin-add-money', (req, res) => {
  const { admin_id, user_id, amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.json({ success: false, message: 'Укажите сумму' });
  }
  
  db.adminAddMoney(admin_id, user_id, amount, (err, changes) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else if (changes === 0) {
      res.json({ success: false, message: 'Пользователь не найден' });
    } else {
      res.json({ success: true, message: `Начислено ${amount} ⭐ пользователю` });
    }
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║     🏦 ОНЛАЙН БАНК МИКРОНАЦИИ             ║
  ║     Сервер запущен на порту ${PORT}         ║
  ║     http://localhost:${PORT}                ║
  ╚════════════════════════════════════════════╝
  `);
});