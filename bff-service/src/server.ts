import { createServer } from './app';
import { PORT } from './config';

const server = createServer();

server.listen(PORT, () => {
  console.log(`BFF Service is listening on port ${PORT}`);
});
