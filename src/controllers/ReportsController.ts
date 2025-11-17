// src/controllers/ReportController.ts

import { PrismaClient, MaintenanceStatus } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * @class ReportController
 * @description Maneja la lógica para obtener los datos detallados para los reportes.
 */
export class ReportController {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Obtiene el listado completo de inventario, con detalles y ordenado por tipo.
   */
  private async getFullInventoryReport() {
    return this.prisma.equipment.findMany({
      orderBy: {
        type: 'asc',
      },
      include: {
        company: { select: { name: true } },
        assignedToUser: { select: { username: true, person: { select: { fullName: true } } } },
      },
    });
  }

  /**
   * Obtiene la lista de todos los mantenimientos completados con sus costos y detalles.
   */
  private async getMaintenanceCostsReport() {
    return this.prisma.maintenance.findMany({
      where: {
        status: MaintenanceStatus.COMPLETED,
        cost: {
          gt: 0, // Solo mantenimientos que tuvieron un costo
        },
      },
      orderBy: {
        completionDate: 'desc',
      },
      include: {
        equipment: { select: { serialNumber: true, type: true, brand: true, model: true } },
        assignedToUser: { select: { username: true, person: { select: { fullName: true } } } },
      },
    });
  }

  /**
   * Obtiene la lista de todos los equipos asignados, incluyendo detalles del usuario, persona y departamento.
   */
  private async getUserAssignmentsReport() {
    return this.prisma.equipment.findMany({
      where: {
        assignedToUserId: {
          not: null,
        },
      },
      orderBy: {
        assignedToUser: {
          person: {
            department: {
              name: 'asc'
            }
          }
        }
      },
      include: {
        assignedToUser: {
          select: {
            username: true,
            email: true,
            person: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Obtiene el historial completo de mantenimientos, ordenado por fecha.
   */
  private async getFullMaintenanceHistory() {
    return this.prisma.maintenance.findMany({
      orderBy: {
        scheduledDate: 'desc',
      },
      include: {
        equipment: { select: { serialNumber: true, type: true } },
        assignedToUser: { select: { username: true, person: { select: { fullName: true } } } },
        company: { select: { name: true } },
      },
    });
  }

  /**
   * Obtiene la lista de equipos cuya garantía vence en los próximos 90 días.
   * REQUIERE el campo `warrantyEndDate` en el modelo `Equipment`.
   */
  private async getExpiringWarrantiesReport() {
    const today = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);

    // The Prisma schema for Equipment may not include a `warrantyEndDate` field
    // in the generated types. To avoid TypeScript errors while still querying
    // by that field when present in the database, build the filter and
    // order objects as `any`.
    const where: any = {
      warrantyEndDate: {
        gte: today, // Mayor o igual que hoy
        lte: ninetyDaysFromNow, // Menor o igual que en 90 días
      },
    };

    const orderBy: any = {
      warrantyEndDate: 'asc',
    };

    return this.prisma.equipment.findMany({
      where,
      orderBy,
    });
  }

  /**
   * Obtiene la lista de mantenimientos completados en los últimos 30 días como métrica de rendimiento.
   */
  private async getItPerformanceReport() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.maintenance.findMany({
      where: {
        status: MaintenanceStatus.COMPLETED,
        completionDate: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        completionDate: 'desc',
      },
      include: {
        equipment: { select: { serialNumber: true, type: true } },
        assignedToUser: { select: { username: true } },
      },
    });
  }

  /**
   * @method getAllReports
   * @description Punto de entrada para obtener todos los reportes con datos detallados.
   */
  public getAllReports = async (req: Request, res: Response): Promise<void> => {
    try {
      // Ejecutar todas las consultas en paralelo
      const [
        inventory,
        maintenanceCosts,
        userAssignments,
        maintenanceHistory,
        expiringWarranties,
        itPerformance,
      ] = await Promise.all([
        this.getFullInventoryReport(),
        this.getMaintenanceCostsReport(),
        this.getUserAssignmentsReport(),
        this.getFullMaintenanceHistory(),
        this.getExpiringWarrantiesReport(),
        this.getItPerformanceReport(),
      ]);

      // Estructurar la respuesta final con los datos completos
      const reports = {
        inventoryReport: {
          title: 'Listado de Inventario',
          type: 'Inventario',
          data: inventory,
        },
        maintenanceCostsReport: {
          title: 'Detalle de Costos de Mantenimiento',
          type: 'Financiero',
          data: maintenanceCosts,
        },
        userAssignmentsReport: {
          title: 'Listado de Asignaciones de Equipos',
          type: 'Usuarios',
          data: userAssignments,
        },
        maintenanceHistoryReport: {
          title: 'Historial Completo de Mantenimientos',
          type: 'Mantenimiento',
          data: maintenanceHistory,
        },
        warrantyReport: {
          title: 'Equipos con Garantía por Vencer',
          type: 'Inventario',
          data: expiringWarranties,
        },
        itPerformanceReport: {
          title: 'Mantenimientos Completados (Últimos 30 días)',
          type: 'Rendimiento',
          data: itPerformance,
        },
      };

      res.status(200).json(reports);
    } catch (error) {
      console.error('Error al obtener los datos para los reportes:', error);
      res.status(500).json({ message: 'Error al obtener los datos para los reportes.' });
    }
  };
}