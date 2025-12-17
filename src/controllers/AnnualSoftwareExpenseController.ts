import { Request, Response } from "express"
import { prisma } from "../../lib/prisma.js"
import {
  ExpenseStatus,
  SoftwareCategory,
  PaymentFrequency,
} from "../../generated/prisma/enums.js"

export class AnnualSoftwareExpenseController {
  // ===============================
  // Helpers
  // ===============================
  private isValidEnum<T>(value: any, enumObj: T): boolean {
    return Object.values(enumObj as any).includes(value)
  }

  private toNumber(value: any, fallback = 0): number {
    const n = Number(value)
    return isNaN(n) ? fallback : n
  }

  private parseDate(value: any): Date | null {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  // ===============================
  // Crear
  // ===============================
  async create(req: Request, res: Response) {
    try {
      const {
        applicationName,
        provider,
        category,
        status,
        annualCost,
        numberOfUsers,
        costPerUser,
        renewalDate,
        paymentFrequency,
        additionalNotes,
        assignedUsers,
      } = req.body

      // Obligatorios
      if (
        !applicationName ||
        !provider ||
        !category ||
        !status ||
        !paymentFrequency
      ) {
        return res.status(400).json({
          error: "Campos obligatorios faltantes.",
        })
      }

      // Enums
      if (!this.isValidEnum(status, ExpenseStatus)) {
        return res.status(400).json({
          error: `Estado inválido: ${status}`,
        })
      }

      if (!this.isValidEnum(category, SoftwareCategory)) {
        return res.status(400).json({
          error: `Categoría inválida: ${category}`,
        })
      }

      if (!this.isValidEnum(paymentFrequency, PaymentFrequency)) {
        return res.status(400).json({
          error: `Frecuencia de pago inválida: ${paymentFrequency}`,
        })
      }

      // Fecha
      const parsedDate = this.parseDate(renewalDate)
      if (!parsedDate) {
        return res.status(400).json({
          error: "Fecha de renovación inválida.",
        })
      }

      const expense = await prisma.annualSoftwareExpense.create({
        data: {
          applicationName,
          provider,
          category,
          status,
          annualCost: this.toNumber(annualCost),
          numberOfUsers: this.toNumber(numberOfUsers),
          costPerUser: this.toNumber(costPerUser),
          renewalDate: parsedDate,
          paymentFrequency,
          additionalNotes: additionalNotes || null,
          assignedUsers: assignedUsers || null,
        },
      })

      return res.status(201).json(expense)
    } catch (error) {
      console.error("CREATE AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: "Error interno al crear el gasto.",
      })
    }
  }

  // ===============================
  // Obtener todos
  // ===============================
  async getAll(req: Request, res: Response) {
    try {
      const expenses = await prisma.annualSoftwareExpense.findMany({
        orderBy: { createdAt: "desc" },
      })

      return res.status(200).json(expenses)
    } catch (error) {
      console.error("GET ALL AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: "Error al obtener los gastos.",
      })
    }
  }

  // ===============================
  // Obtener por ID
  // ===============================
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params

      if (!id) {
        return res.status(400).json({ error: "ID inválido." })
      }

      const expense = await prisma.annualSoftwareExpense.findUnique({
        where: { id },
      })

      if (!expense) {
        return res.status(404).json({
          error: "Gasto anual de software no encontrado.",
        })
      }

      return res.status(200).json(expense)
    } catch (error) {
      console.error("GET BY ID AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: "Error al obtener el gasto.",
      })
    }
  }

  // ===============================
  // Editar
  // ===============================
async edit(req: Request, res: Response) {
  try {
    const { id } = req.params
    const {
      applicationName,
      provider,
      category,
      status,
      annualCost,
      numberOfUsers,
      costPerUser,
      renewalDate,
      paymentFrequency,
      additionalNotes,
      assignedUsers,
    } = req.body

    if (!id) {
      return res.status(400).json({ error: "ID inválido." })
    }

    const exists = await prisma.annualSoftwareExpense.findUnique({
      where: { id },
    })

    if (!exists) {
      return res.status(404).json({
        error: "Gasto anual de software no encontrado.",
      })
    }

    if (status && !this.isValidEnum(status, ExpenseStatus)) {
      return res.status(400).json({ error: `Estado inválido: ${status}` })
    }

    if (category && !this.isValidEnum(category, SoftwareCategory)) {
      return res.status(400).json({ error: `Categoría inválida: ${category}` })
    }

    if (
      paymentFrequency &&
      !this.isValidEnum(paymentFrequency, PaymentFrequency)
    ) {
      return res.status(400).json({
        error: "Frecuencia de pago inválida.",
      })
    }

    // ✅ FECHA SEGURA PARA PRISMA
    let parsedDate: Date | undefined = undefined
    if (renewalDate) {
      const d = new Date(renewalDate)
      if (isNaN(d.getTime())) {
        return res.status(400).json({
          error: "Fecha de renovación inválida.",
        })
      }
      parsedDate = d
    }

    const updatedExpense = await prisma.annualSoftwareExpense.update({
      where: { id },
      data: {
        applicationName,
        provider,
        category,
        status,
        annualCost:
          annualCost !== undefined
            ? this.toNumber(annualCost)
            : undefined,
        numberOfUsers:
          numberOfUsers !== undefined
            ? this.toNumber(numberOfUsers)
            : undefined,
        costPerUser:
          costPerUser !== undefined
            ? this.toNumber(costPerUser)
            : undefined,
        renewalDate: parsedDate, // ✅ NUNCA null
        paymentFrequency,
        additionalNotes,
        assignedUsers,
      },
    })

    return res.status(200).json(updatedExpense)
  } catch (error) {
    console.error("EDIT AnnualSoftwareExpense:", error)
    return res.status(500).json({
      error: "Error al actualizar el gasto.",
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

      const exists = await prisma.annualSoftwareExpense.findUnique({
        where: { id },
      })

      if (!exists) {
        return res.status(404).json({
          error: "Gasto anual de software no encontrado.",
        })
      }

      await prisma.annualSoftwareExpense.delete({
        where: { id },
      })

      return res.status(200).json({
        message: "Gasto anual de software eliminado correctamente.",
      })
    } catch (error) {
      console.error("DELETE AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: "Error al eliminar el gasto.",
      })
    }
  }
}
