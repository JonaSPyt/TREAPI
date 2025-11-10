const { app } = require('./app');

const port = process.env.PORT || 3000;
const host = '0.0.0.0'; // Permite conexões de qualquer IP (importante para Flutter)

const server = app.listen(port, host, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Accessible at:`);
  console.log(`  - http://localhost:${port}`);
  console.log(`  - http://0.0.0.0:${port}`);
  
  // Tentar mostrar IP local
  try {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach(interfaceName => {
      networkInterfaces[interfaceName].forEach(iface => {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`  - http://${iface.address}:${port} ← Use este no Flutter!`);
        }
      });
    });
  } catch (e) {
    // ignore
  }
});

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err && (err.stack || err));
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
