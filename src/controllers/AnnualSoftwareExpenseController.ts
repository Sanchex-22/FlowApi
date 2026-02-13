import { Request, Response } from "express"
import prisma from "../../lib/prisma.js"
import { ExpenseStatus, PaymentFrequency, SoftwareCategory, UserRole } from "../../generated/prisma/index.js"

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

  private async recalculateExpenseCosts(expenseId: string) {
    const expense = await prisma.annualSoftwareExpense.findUnique({
      where: { id: expenseId },
      include: { assignedUsers: true },
    })

    if (!expense) {
      throw new Error(
        `Gasto con ID ${expenseId} no encontrado para recalcular costos.`
      )
    }

    const newNumberOfUsers = expense.assignedUsers.length
    const newAnnualCost = expense.annualCost

    const newCostPerUser =
      newNumberOfUsers > 0 ? newAnnualCost / newNumberOfUsers : 0

    await prisma.annualSoftwareExpense.update({
      where: { id: expenseId },
      data: {
        numberOfUsers: newNumberOfUsers,
        costPerUser: newCostPerUser,
      },
    })
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
        assignedUserIds,
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

          assignedUsers: assignedUserIds?.length
            ? {
                connect: assignedUserIds.map((id: string) => ({ id })),
              }
            : undefined,
        },
        include: {
          assignedUsers: {
            include: {
              person: {
                include: {
                  department: true, // ✅ INCLUIR DEPARTMENT desde Person
                },
              },
            },
          },
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
  // Obtener todos
  // ===============================
  async getAll(req: Request, res: Response) {
    try {
      const expenses = await prisma.annualSoftwareExpense.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assignedUsers: {
            include: {
              person: {
                include: {
                  department: true, // ✅ INCLUIR DEPARTMENT desde Person
                },
              },
            },
          },
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
  // Obtener por ID
  // ===============================
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params

      const expense = await prisma.annualSoftwareExpense.findUnique({
        where: { id },
        include: {
          assignedUsers: {
            include: {
              person: {
                include: {
                  department: true, // ✅ INCLUIR DEPARTMENT desde Person
                },
              },
            },
          },
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
        renewalDate,
        paymentFrequency,
        additionalNotes,
        assignedUserIds,
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
          annualCost: annualCost !== undefined ? this.toNumber(annualCost) : undefined,
          renewalDate: renewalDate ? this.parseDate(renewalDate) : undefined,
          paymentFrequency,
          additionalNotes,

          assignedUsers:
            assignedUserIds !== undefined
              ? {
                  set: assignedUserIds.map((id: string) => ({ id })),
                }
              : undefined,
        },
        include: {
          assignedUsers: {
            include: {
              person: {
                include: {
                  department: true, // ✅ INCLUIR DEPARTMENT desde Person
                },
              },
            },
          },
        },
      })

      // Recalcular costos después de editar
      await this.recalculateExpenseCosts(id)

      // Devolver el gasto actualizado con costos recalculados
      const finalExpense = await prisma.annualSoftwareExpense.findUnique({
        where: { id },
        include: {
          assignedUsers: {
            include: {
              person: {
                include: {
                  department: true, // ✅ INCLUIR DEPARTMENT desde Person
                },
              },
            },
          },
        },
      })

      return res.status(200).json(finalExpense)
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

  // ===============================
  // Eliminar Usuario Asignado
  // ===============================
  async removeAssignedUserFromExpense(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const { expenseId } = req.body

      if (!expenseId || !userId) {
        return res.status(400).json({
          error: "IDs de gasto y usuario son obligatorios para desasignar.",
        })
      }

      await prisma.annualSoftwareExpense.update({
        where: { id: expenseId },
        data: {
          assignedUsers: {
            disconnect: { id: userId },
          },
        },
      })

      await this.recalculateExpenseCosts(expenseId)

      return res.status(200).json({
        message: "Usuario desasignado correctamente.",
      })
    } catch (error: any) {
      console.error("REMOVE ASSIGNED USER FROM EXPENSE:", error)
      if (error.code === "P2025") {
        return res.status(404).json({
          error: "Usuario o Gasto no encontrado para desasignar.",
        })
      }
      return res.status(500).json({
        error: error.message || "Error al desasignar usuario.",
      })
    }
  }

  // ===============================
  // Asignar Usuario Existente
  // ===============================
  async assignExistingUserToExpense(req: Request, res: Response) {
    try {
      const { expenseId } = req.params
      const { userId } = req.body

      if (!userId || !expenseId) {
        return res.status(400).json({
          error: "IDs de usuario y gasto son obligatorios.",
        })
      }

      const existingExpense = await prisma.annualSoftwareExpense.findUnique({
        where: { id: expenseId },
        include: { assignedUsers: { where: { id: userId } } },
      })

      if ((existingExpense?.assignedUsers ?? []).length > 0) {
        return res.status(409).json({
          error: "El usuario ya está asignado a este gasto.",
        })
      }

      await prisma.annualSoftwareExpense.update({
        where: { id: expenseId },
        data: {
          assignedUsers: {
            connect: { id: userId },
          },
        },
      })

      await this.recalculateExpenseCosts(expenseId)

      const newlyAssignedUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          person: {
            include: {
              department: true, // ✅ INCLUIR DEPARTMENT desde Person
            },
          },
        },
      })

      if (!newlyAssignedUser) {
        return res.status(404).json({
          error: "Usuario asignado no encontrado después de la operación.",
        })
      }

      return res.status(200).json(newlyAssignedUser)
    } catch (error: any) {
      console.error("ASSIGN EXISTING USER TO EXPENSE:", error)
      if (error.code === "P2025") {
        return res.status(404).json({
          error: "Usuario o Gasto no encontrado.",
        })
      }
      return res.status(500).json({
        error: error.message || "Error al asignar usuario existente al gasto.",
      })
    }
  }

  // ===============================
  // Crear y Asignar Nuevo Usuario
  // ===============================
  async createAndAssignNewUserToExpense(req: Request, res: Response) {
    try {
      const { expenseId } = req.params
      const { name, lastName, email, departmentId } = req.body

      if (!name || !lastName || !expenseId) {
        return res.status(400).json({
          error: "Nombre, apellido y ID de gasto son obligatorios.",
        })
      }

      // 1. Crear el nuevo usuario
      const newUser = await prisma.user.create({
        data: {
          name,
          lastName,
          username: `${name.toLowerCase()}.${lastName.toLowerCase()}`,
          email: email || `${name.toLowerCase()}.${lastName.toLowerCase()}@noemail.com`,
          password: "default_hashed_password",
          role: UserRole.USER,
        },
      })

      // 2. Crear Person con departmentId si se proporciona
      if (departmentId) {
        await prisma.person.create({
          data: {
            userId: newUser.id,
            firstName: name,
            lastName: lastName,
            fullName: `${name} ${lastName}`,
            departmentId: departmentId,
            userCode: `USER_${newUser.id.substring(0, 8)}`,
          },
        })
      }

      // 3. Conectarlo al gasto
      await prisma.annualSoftwareExpense.update({
        where: { id: expenseId },
        data: {
          assignedUsers: {
            connect: { id: newUser.id },
          },
        },
      })

      // 4. Recalcular costos
      await this.recalculateExpenseCosts(expenseId)

      return res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        lastName: newUser.lastName,
        email: newUser.email,
      })
    } catch (error: any) {
      console.error("CREATE AND ASSIGN NEW USER TO EXPENSE:", error)
      return res.status(500).json({
        error: error.message || "Error al crear y asignar nuevo usuario.",
      })
    }
  }
}