import express from 'express'; // Asegúrate de instalar 'express' y '@types/express' si lo usas
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('¡Servidor Express funcionando con TypeScript!');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});