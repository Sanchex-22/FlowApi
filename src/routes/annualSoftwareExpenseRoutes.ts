// import { Router } from 'express' // Ya está
// import { AnnualSoftwareExpenseController } from '../controllers/AnnualSoftwareExpenseController.js' // Ya está

import { Router } from "express"
import { AnnualSoftwareExpenseController } from "../controllers/AnnualSoftwareExpenseController.js"

const ExpenseRoute = Router()
const controller = new AnnualSoftwareExpenseController()

ExpenseRoute.post('/create', controller.create.bind(controller))
ExpenseRoute.get('/getAll', controller.getAll.bind(controller))
ExpenseRoute.get('/get/:id', controller.getById.bind(controller))
ExpenseRoute.put('/edit/:id', controller.edit.bind(controller))
ExpenseRoute.delete('/delete/:id', controller.delete.bind(controller))

// ============== NUEVAS RUTAS DE ASIGNACIÓN/DESASIGNACIÓN =============

// Ruta para asignar un usuario EXISTENTE a un gasto
// El frontend usa: /api/annual-software-expense/assign-existing-user/:expenseId
ExpenseRoute.post(
  '/assign-existing-user/:expenseId',
  controller.assignExistingUserToExpense.bind(controller)
)

// Ruta para CREAR y asignar un NUEVO usuario a un gasto
// El frontend usa: /api/annual-software-expense/assigned-users/create (pero ahora con :expenseId en URL)
// Renombramos la ruta para ser más específica y consistente con la operación
ExpenseRoute.post(
  '/assigned-users/create-and-assign/:expenseId', // Ruta más clara para crear Y asignar
  controller.createAndAssignNewUserToExpense.bind(controller)
)


// Ruta para desasignar un usuario de un gasto (eliminar la conexión)
// El frontend usa: /api/annual-software-expense/assigned-users/delete/:userId
ExpenseRoute.delete(
  '/assigned-users/delete/:userId',
  controller.removeAssignedUserFromExpense.bind(controller)
)

// =====================================================================

export default ExpenseRoute