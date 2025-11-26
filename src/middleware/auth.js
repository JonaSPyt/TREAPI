// Middleware de autenticação simples
// Adicione no app.js antes das rotas

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  
  // Token definido no .env
  const validToken = process.env.API_TOKEN || 'seu-token-secreto-aqui';
  
  if (!token || token !== `Bearer ${validToken}`) {
    return res.status(401).json({ error: 'Acesso negado. Token inválido.' });
  }
  
  next();
};

// Use em rotas que precisam de autenticação
// app.get('/tombamentos', authenticateToken, async (req, res) => {
//   ...
// });

module.exports = { authenticateToken };
