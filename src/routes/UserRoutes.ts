// src/auth/auth.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/UsersController.js';

const userController = new UserController();
const UserRouter = Router();

UserRouter.get('/getAll', userController.getAll.bind(userController));
UserRouter.get('/profile/:id', userController.getProfile.bind(userController));
UserRouter.get('/full', userController.getAllWithPerson.bind(userController));


export default UserRouter;