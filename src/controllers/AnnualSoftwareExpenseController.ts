import { Request, Response } from "express"
import prisma from "../../lib/prisma.js"
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

  private async recalculateExpenseCosts(expenseId: string) {
    const expense = await prisma.annualSoftwareExpense.findUnique({
      where: { id: expenseId },
      include: { assignedPersons: true },
    })

    if (!expense) {
      throw new Error(
        `Gasto con ID ${expenseId} no encontrado para recalcular costos.`
      )
    }

    const newNumberOfUsers = expense.assignedPersons.length
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
        assignedPersonIds,
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

          // ✅ MODIFICADO: Conectar a Person en lugar de User
          assignedPersons: assignedPersonIds?.length
            ? {
                connect: assignedPersonIds.map((id: string) => ({ id })),
              }
            : undefined,
        },
        include: {
          assignedPersons: {
            include: {
              department: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                }
              }
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
          // ✅ MODIFICADO: Incluir assignedPersons en lugar de assignedUsers
          assignedPersons: {
            include: {
              department: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                }
              }
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
          // ✅ MODIFICADO: Incluir assignedPersons en lugar de assignedUsers
          assignedPersons: {
            include: {
              department: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                }
              }
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
        assignedPersonIds,
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

          // ✅ MODIFICADO: Conectar a Person en lugar de User
          assignedPersons:
            assignedPersonIds !== undefined
              ? {
                  set: assignedPersonIds.map((id: string) => ({ id })),
                }
              : undefined,
        },
        include: {
          assignedPersons: {
            include: {
              department: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                }
              }
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
          assignedPersons: {
            include: {
              department: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                }
              }
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
  // Eliminar Persona Asignada
  // ===============================
  async removeAssignedPersonFromExpense(req: Request, res: Response) {
    try {
      const { personId } = req.params
      const { expenseId } = req.body

      if (!expenseId || !personId) {
        return res.status(400).json({
          error: "IDs de gasto y persona son obligatorios para desasignar.",
        })
      }

      await prisma.annualSoftwareExpense.update({
        where: { id: expenseId },
        data: {
          // ✅ MODIFICADO: Desconectar de assignedPersons
          assignedPersons: {
            disconnect: { id: personId },
          },
        },
      })

      await this.recalculateExpenseCosts(expenseId)

      return res.status(200).json({
        message: "Persona desasignada correctamente.",
      })
    } catch (error: any) {
      console.error("REMOVE ASSIGNED PERSON FROM EXPENSE:", error)
      if (error.code === "P2025") {
        return res.status(404).json({
          error: "Persona o Gasto no encontrado para desasignar.",
        })
      }
      return res.status(500).json({
        error: error.message || "Error al desasignar persona.",
      })
    }
  }

  // ===============================
  // Asignar Persona Existente
  // ===============================
  async assignExistingPersonToExpense(req: Request, res: Response) {
    try {
      const { expenseId } = req.params
      const { personId } = req.body

      if (!personId || !expenseId) {
        return res.status(400).json({
          error: "IDs de persona y gasto son obligatorios.",
        })
      }

      const existingExpense = await prisma.annualSoftwareExpense.findUnique({
        where: { id: expenseId },
        include: { assignedPersons: { where: { id: personId } } },
      })

      if ((existingExpense?.assignedPersons ?? []).length > 0) {
        return res.status(409).json({
          error: "La persona ya está asignada a este gasto.",
        })
      }

      await prisma.annualSoftwareExpense.update({
        where: { id: expenseId },
        data: {
          // ✅ MODIFICADO: Conectar a assignedPersons
          assignedPersons: {
            connect: { id: personId },
          },
        },
      })

      await this.recalculateExpenseCosts(expenseId)

      const newlyAssignedPerson = await prisma.person.findUnique({
        where: { id: personId },
        include: {
          department: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            }
          }
        },
      })

      if (!newlyAssignedPerson) {
        return res.status(404).json({
          error: "Persona asignada no encontrada después de la operación.",
        })
      }

      return res.status(200).json(newlyAssignedPerson)
    } catch (error: any) {
      console.error("ASSIGN EXISTING PERSON TO EXPENSE:", error)
      if (error.code === "P2025") {
        return res.status(404).json({
          error: "Persona o Gasto no encontrado.",
        })
      }
      return res.status(500).json({
        error: error.message || "Error al asignar persona existente al gasto.",
      })
    }
  }

  // ===============================
  // Crear y Asignar Nueva Persona
  // ===============================
  async createAndAssignNewPersonToExpense(req: Request, res: Response) {
    try {
      const { expenseId } = req.params
      const { firstName, lastName, contactEmail, phoneNumber, departmentId, position } = req.body

      if (!firstName || !lastName || !expenseId) {
        return res.status(400).json({
          error: "Nombre, apellido e ID de gasto son obligatorios.",
        })
      }

      // 1. Crear el User primero (necesario para Person)
      const newUser = await prisma.user.create({
        data: {
          username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
          email: contactEmail || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@noemail.com`,
          password: "default_hashed_password", // Hash esto en producción
          role: "USER",
        },
      })

      // 2. Crear Person vinculado al User
      const newPerson = await prisma.person.create({
        data: {
          userId: newUser.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          contactEmail: contactEmail || null,
          phoneNumber: phoneNumber || null,
          departmentId: departmentId || null,
          position: position || null,
          userCode: `USER_${newUser.id.substring(0, 8)}`,
          status: "Activo",
        },
        include: {
          department: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            }
          }
        },
      })

      // 3. Asignar la Person al Expense
      await prisma.annualSoftwareExpense.update({
        where: { id: expenseId },
        data: {
          assignedPersons: {
            connect: { id: newPerson.id },
          },
        },
      })

      // 4. Recalcular costos
      await this.recalculateExpenseCosts(expenseId)

      return res.status(201).json(newPerson)
    } catch (error: any) {
      console.error("CREATE AND ASSIGN NEW PERSON TO EXPENSE:", error)
      return res.status(500).json({
        error: error.message || "Error al crear y asignar nueva persona.",
      })
    }
  }
}