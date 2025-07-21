// src/server.ts
import express from 'express';
import path from 'path';

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

const homeController = {
    getIndex: (req: express.Request, res: express.Response) => {
        res.render('index', { title: 'Mi Aplicación MVC', message: '¡Bienvenido a la página de inicio!' });
    },
    getAbout: (req: express.Request, res: express.Response) => {
        res.render('about', { appName: 'FlowApi MVC' });
    }
};

app.get('/', homeController.getIndex);
app.get('/about', homeController.getAbout);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  console.log(`Página de inicio: http://localhost:${port}`);
  console.log(`Página Acerca de: http://localhost:${port}/about`);
});