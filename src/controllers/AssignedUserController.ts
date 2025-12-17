import { Request, Response } from "express"
import { prisma } from "../../lib/prisma.js"

export class AssignedUserController {
  // ===============================
  // Crear
  // ===============================
async create(req: Request, res: Response) {
  try {
    const { name, lastName, email, department, expenseId } = req.body
    console.log("AssignedUserController.create - expenseId:", req.body)
    if (!name || !lastName || !expenseId) {
      return res.status(400).json({
        error: "Nombre, apellido y gasto son obligatorios.",
      })
    }

    const exists = await prisma.annualSoftwareExpense.findUnique({
      where: { id: expenseId },
    })

    if (!exists) {
      return res.status(404).json({
        error: "Gasto anual no encontrado.",
      })
    }

    const user = await prisma.assignedUser.create({
      data: {
        name,
        lastName,
        email: email || null,
        department: department || null,
        expenseId, // ✅ AQUÍ
      },
    })

    return res.status(201).json(user)
  } catch (error) {
    console.error("CREATE AssignedUser:", error)
    return res.status(500).json({
      error: "Error al crear usuario asignado.",
    })
  }
}


  // ===============================
  // Eliminar
  // ===============================
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      if (!id) {
        return res.status(400).json({ error: "ID inválido." })
      }

      await prisma.assignedUser.delete({
        where: { id },
      })

      return res.status(200).json({
        message: "Usuario asignado eliminado.",
      })
    } catch (error) {
      console.error("DELETE AssignedUser:", error)
      return res.status(500).json({
        error: "Error al eliminar usuario asignado.",
      })
    }
  }
}
