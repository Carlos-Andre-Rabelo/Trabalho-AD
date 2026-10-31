import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const port = env.PORT;
app.listen(port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 RU Metrics Backend iniciado com sucesso!`);
  console.log(`📡 Porta: ${port}`);
  console.log(`🌐 Ambiente: ${env.NODE_ENV}`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/api-docs`);
  console.log(`=======================================================`);
});
