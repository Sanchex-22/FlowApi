import { Router } from 'express'
import { AnnualSoftwareExpenseController } from '../controllers/AnnualSoftwareExpenseController.js'

const ExpenseRoute = Router()
const controller = new AnnualSoftwareExpenseController()

// ===============================
// Crear Gasto
// ===============================
ExpenseRoute.post(
  '/create',
  controller.create.bind(controller)
)

// ===============================
// Obtener Gastos
// ===============================
ExpenseRoute.get(
  '/getAll',
  controller.getAll.bind(controller)
)

ExpenseRoute.get(
  '/get/:id',
  controller.getById.bind(controller)
)

// ===============================
// Editar Gasto
// ===============================
ExpenseRoute.put(
  '/update/:id',
  controller.edit.bind(controller)
)

// ===============================
// Eliminar Gasto
// ===============================
ExpenseRoute.delete(
  '/delete/:id',
  controller.delete.bind(controller)
)

// ===============================
// Asignar Persona Existente
// ===============================
// ✅ NUEVO: Asignar una Person existente a un gasto
// Body: { personId: "person-uuid" }
ExpenseRoute.post(
  '/assign-existing-person/:expenseId',
  controller.assignExistingPersonToExpense.bind(controller)
)

// ===============================
// Crear y Asignar Nueva Persona
// ===============================
// ✅ NUEVO: Crear una nueva Person y asignarla al gasto
// Body: { firstName, lastName, contactEmail?, phoneNumber?, departmentId?, position? }
ExpenseRoute.post(
  '/assigned-persons/create-and-assign/:expenseId',
  controller.createAndAssignNewPersonToExpense.bind(controller)
)

// ===============================
// Desasignar Persona
// ===============================
// ✅ ACTUALIZADO: Desasignar una Person de un gasto
// Body: { expenseId: "expense-uuid" }
ExpenseRoute.delete(
  '/assigned-persons/delete/:personId',
  controller.removeAssignedPersonFromExpense.bind(controller)
)

export default ExpenseRoute