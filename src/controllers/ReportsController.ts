// src/controllers/ReportController.ts

import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { MaintenanceStatus } from '../../generated/prisma/enums';

/**
 * @class ReportController
 * @description Maneja la lógica para obtener los datos detallados para los reportes filtrados por compañía.
 */
export class ReportController {
  private prisma = prisma;
  /**
   * Inventario completo filtrado por compañía.
   */
  private async getFullInventoryReport(companyId: string) {
    return this.prisma.equipment.findMany({
      where: { companyId },
      orderBy: { type: 'asc' },
      include: {
        company: { select: { name: true } },
        assignedToUser: {
          select: {
            username: true,
            person: { select: { fullName: true } },
          },
        },
      },
    });
  }

  /**
   * Costos de mantenimiento filtrados por compañía.
   */
  private async getMaintenanceCostsReport(companyId: string) {
    return this.prisma.maintenance.findMany({
      where: {
        companyId,
        status: MaintenanceStatus.COMPLETED,
        cost: { gt: 0 },
      },
      orderBy: { completionDate: 'desc' },
      include: {
        equipment: {
          select: { serialNumber: true, type: true, brand: true, model: true },
        },
        assignedToUser: {
          select: {
            username: true,
            person: { select: { fullName: true } },
          },
        },
      },
    });
  }

  /**
   * Equipos asignados filtrados por compañía.
   */
  private async getUserAssignmentsReport(companyId: string) {
    return this.prisma.equipment.findMany({
      where: {
        companyId,
        assignedToUserId: { not: null },
      },
      orderBy: {
        assignedToUser: {
          person: {
            department: { name: 'asc' },
          },
        },
      },
      include: {
        assignedToUser: {
          select: {
            username: true,
            email: true,
            person: {
              include: { department: true },
            },
          },
        },
      },
    });
  }

  /**
   * Historial de mantenimientos filtrado por compañía.
   */
  private async getFullMaintenanceHistory(companyId: string) {
    return this.prisma.maintenance.findMany({
      where: { companyId },
      orderBy: { scheduledDate: 'desc' },
      include: {
        equipment: {
          select: { serialNumber: true, type: true },
        },
        assignedToUser: {
          select: {
            username: true,
            person: { select: { fullName: true } },
          },
        },
        company: { select: { name: true } },
      },
    });
  }

  /**
   * Garantías por vencer — desactivado porque no existe warrantyEndDate.
   */
  private async getExpiringWarrantiesReport() {
    return [];
  }

  /**
   * Rendimiento de IT — mantenimientos completados últimos 30 días, filtrados por compañía.
   */
  private async getItPerformanceReport(companyId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.maintenance.findMany({
      where: {
        companyId,
        status: MaintenanceStatus.COMPLETED,
        completionDate: { gte: thirtyDaysAgo },
      },
      orderBy: { completionDate: 'desc' },
      include: {
        equipment: { select: { serialNumber: true, type: true } },
        assignedToUser: { select: { username: true } },
      },
    });
  }

  /**
   * @method getAllReports
   * @description Obtiene todos los reportes del dashboard filtrados por empresa.
   */
  public getAllReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        res.status(400).json({ message: "Debe enviar el companyId en los parámetros." });
        return;
      }

      const [
        inventory,
        maintenanceCosts,
        userAssignments,
        maintenanceHistory,
        expiringWarranties,
        itPerformance,
      ] = await Promise.all([
        this.getFullInventoryReport(companyId),
        this.getMaintenanceCostsReport(companyId),
        this.getUserAssignmentsReport(companyId),
        this.getFullMaintenanceHistory(companyId),
        this.getExpiringWarrantiesReport(),
        this.getItPerformanceReport(companyId),
      ]);

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
      res.status(500).json({
        message: 'Error al obtener los datos para los reportes.',
      });
    }
  };
}
