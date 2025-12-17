import { Router } from 'express'
import { AnnualSoftwareExpenseController } from '../controllers/AnnualSoftwareExpenseController.js'

const ExpenseRoute = Router()
const controller = new AnnualSoftwareExpenseController()

ExpenseRoute.post('/create', controller.create.bind(controller))
ExpenseRoute.get('/getAll', controller.getAll.bind(controller))
ExpenseRoute.get('/get/:id', controller.getById.bind(controller))
ExpenseRoute.put('/edit/:id', controller.edit.bind(controller))
ExpenseRoute.delete('/delete/:id', controller.delete.bind(controller))

export default ExpenseRoute
