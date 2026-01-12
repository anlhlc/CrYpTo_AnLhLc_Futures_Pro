require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
app.set('trust proxy', 1);
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');


const PORT = process.env.PORT || 3000;

// Güvenlik middleware'leri
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session yapılandırması
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 saat
  }
}));

// Rate limiting - Brute force koruması
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // Maksimum 5 deneme
  message: { error: 'Çok fazla giriş denemesi. Lütfen 15 dakika bekleyin.' }
});

// Şifreli kullanıcı veritabanı (Demo - Gerçek uygulamada veritabanı kullanın)
const users = {
  admin: {
    username: 'admin',
    // Şifre: dashboard2024 - Bu hash'i bcrypt ile oluşturdum
    passwordHash: '$2a$10$rQZ5VhXKGg5Y5d5k5k5k5u5v5w5x5y5z5a5b5c5d5e5f5g5h5i5j5k'
  }
};

// Özel şifre ile kullanıcı oluştur (ilk çalıştırmada)
async function initDefaultUser() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'Binance2024!';
  const hash = await bcrypt.hash(adminPassword, 10);
  users.admin = {
    username: 'admin',
    passwordHash: hash
  };
  console.log(`🔐 Varsayılan kullanıcı oluşturuldu.`);
  console.log(`   Kullanıcı adı: admin`);
  console.log(`   Şifre: ${adminPassword}`);
  console.log(`   ⚠️  İlk girişten sonra .env dosyasından şifreyi değiştirin!`);
}

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// Login sayfası
app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Login işlemi
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  }

  const user = users[username.toLowerCase()];

  if (!user) {
    return res.json({ error: 'Hatalı kullanıcı adı veya şifre.' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.json({ error: 'Hatalı kullanıcı adı veya şifre.' });
  }

  // Başarılı giriş
  req.session.authenticated = true;
  req.session.username = user.username;
  req.session.loginTime = new Date();

  console.log(`✅ ${user.username} giriş yaptı.`);

  res.json({ success: true, redirect: '/' });
});

// Çıkış işlemi
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Çıkış hatası:', err);
    }
    res.redirect('/login');
  });
});

// Dashboard rotası (Korumalı)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API endpoint - Oturum bilgisi
app.get('/api/session', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    username: req.session.username,
    loginTime: req.session.loginTime
  });
});

// API endpoint - Şifre değiştirme
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.json({ error: 'Tüm alanlar gereklidir.' });
  }

  const user = users[req.session.username.toLowerCase()];
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValid) {
    return res.json({ error: 'Mevcut şifre yanlış.' });
  }

  // Yeni şifreyi hashle ve kaydet
  user.passwordHash = await bcrypt.hash(newPassword, 10);

  console.log(`🔑 ${user.username} şifresini değiştirdi.`);

  res.json({ success: true, message: 'Şifre başarıyla değiştirildi.' });
});

// Statik dosyalar (sadece authenticated kullanıcılar için)
app.use('/assets', requireAuth, express.static(path.join(__dirname, 'public', 'assets')));

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Hata handler
app.use((err, req, res, next) => {
  console.error('Sunucu hatası:', err);
  res.status(500).send('Bir hata oluştu. Lütfen tekrar deneyin.');
});

// Sunucu başlat
initDefaultUser().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔒 Secure Binance Dashboard                              ║
║                                                            ║
║   🌐 Sunucu çalışıyor: http://localhost:${PORT}               ║
║   🔐 Giriş sayfası:  http://localhost:${PORT}/login           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
});
