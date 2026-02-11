import { Request, Response } from "express"
import { prisma } from "../../lib/prisma.js"
import { ExpenseStatus, PaymentFrequency, SoftwareCategory } from "../../generated/prisma/index.js"

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

  private parseDate(value: any): Date {
    const d = new Date(value)
    if (isNaN(d.getTime())) {
      throw new Error("Fecha inválida")
    }
    return d
  }

  // ===============================
  // Crear Gasto
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
      } = req.body

      if (
        !applicationName ||
        !provider ||
        !category ||
        !status ||
        !paymentFrequency ||
        !renewalDate
      ) {
        return res.status(400).json({
          error: "Campos obligatorios faltantes.",
        })
      }

      if (!this.isValidEnum(status, ExpenseStatus)) {
        return res.status(400).json({ error: "Estado inválido." })
      }

      if (!this.isValidEnum(category, SoftwareCategory)) {
        return res.status(400).json({ error: "Categoría inválida." })
      }

      if (!this.isValidEnum(paymentFrequency, PaymentFrequency)) {
        return res.status(400).json({ error: "Frecuencia inválida." })
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
          renewalDate: this.parseDate(renewalDate),
          paymentFrequency,
          additionalNotes: additionalNotes || null,
        },
      })

      return res.status(201).json(expense)
    } catch (error: any) {
      console.error("CREATE AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: error.message || "Error interno al crear el gasto.",
      })
    }
  }

  // ===============================
  // Obtener todos (con usuarios)
  // ===============================
  async getAll(req: Request, res: Response) {
    try {
      const expenses = await prisma.annualSoftwareExpense.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assignedUsers: true, // ✅ RELACIÓN
        },
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
  // Obtener por ID (con usuarios)
  // ===============================
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params

      const expense = await prisma.annualSoftwareExpense.findUnique({
        where: { id },
        include: {
          assignedUsers: true,
        },
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
  // Editar Gasto
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
      } = req.body

      const exists = await prisma.annualSoftwareExpense.findUnique({
        where: { id },
      })

      if (!exists) {
        return res.status(404).json({
          error: "Gasto anual de software no encontrado.",
        })
      }

      if (status && !this.isValidEnum(status, ExpenseStatus)) {
        return res.status(400).json({ error: "Estado inválido." })
      }

      if (category && !this.isValidEnum(category, SoftwareCategory)) {
        return res.status(400).json({ error: "Categoría inválida." })
      }

      if (
        paymentFrequency &&
        !this.isValidEnum(paymentFrequency, PaymentFrequency)
      ) {
        return res.status(400).json({ error: "Frecuencia inválida." })
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
          renewalDate: renewalDate
            ? this.parseDate(renewalDate)
            : undefined,
          paymentFrequency,
          additionalNotes,
        },
        include: {
          assignedUsers: true,
        },
      })

      return res.status(200).json(updatedExpense)
    } catch (error: any) {
      console.error("EDIT AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: error.message || "Error al actualizar el gasto.",
      })
    }
  }

  // ===============================
  // Eliminar Gasto
  // ===============================
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.annualSoftwareExpense.delete({
        where: { id },
      })

      return res.status(200).json({
        message: "Gasto anual eliminado correctamente.",
      })
    } catch (error) {
      console.error("DELETE AnnualSoftwareExpense:", error)
      return res.status(500).json({
        error: "Error al eliminar el gasto.",
      })
    }
  }
}
