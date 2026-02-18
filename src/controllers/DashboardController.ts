import { Request, Response } from 'express';
import { subMonths, startOfMonth } from 'date-fns';
import { prisma } from '../../lib/prisma.js';
import { EquipmentStatus, MaintenanceStatus } from '../../generated/prisma/index.js';

export class DashboardController {

    async getDashboardData(req: Request, res: Response) {
        const { companyId } = req.params;

        if (!companyId) {
            return res.status(400).json({ message: 'El ID de la compañía es requerido.' });
        }

        try {
            const today = new Date();
            const startOfCurrentMonth = startOfMonth(today);
            const startOfPreviousMonth = startOfMonth(subMonths(today, 1));

            const calculatePercentageChange = (current: number, previous: number): number => {
                if (previous === 0) return current > 0 ? 100 : 0;
                const change = ((current - previous) / previous) * 100;
                return parseFloat(change.toFixed(2));
            };

            // --- KPIs ---

            const totalEquipmentsCurrent = await prisma.equipment.count({ where: { companyId } });
            const totalEquipmentsPrevious = await prisma.equipment.count({
                where: { companyId, createdAt: { lt: startOfCurrentMonth } },
            });

            const pendingMaintenancesCurrent = await prisma.maintenance.count({
                where: { companyId, status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] } },
            });
            const pendingMaintenancesPrevious = await prisma.maintenance.count({
                where: {
                    companyId,
                    status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] },
                    createdAt: { lt: startOfCurrentMonth },
                },
            });

            const activeEquipmentsCurrent = await prisma.equipment.count({
                where: { companyId, status: EquipmentStatus.ACTIVE },
            });
            const activeEquipmentsPrevious = await prisma.equipment.count({
                where: { companyId, status: EquipmentStatus.ACTIVE, createdAt: { lt: startOfCurrentMonth } },
            });

            const activeUsersCurrent = await prisma.user.count({
                where: {
                    companies: { some: { companyId } },
                    isActive: true,
                },
            });
            const activeUsersPrevious = await prisma.user.count({
                where: {
                    companies: { some: { companyId } },
                    isActive: true,
                    createdAt: { lt: startOfCurrentMonth },
                },
            });

            // --- Inventario por Categoría ---

            const laptopsCount = await prisma.equipment.count({
                where: { companyId, type: { equals: 'Laptop', mode: 'insensitive' } }
            });
            const desktopsCount = await prisma.equipment.count({
                where: { companyId, type: { equals: 'Desktop', mode: 'insensitive' } }
            });
            const mobilesCount = await prisma.equipment.count({
                where: { companyId, type: { equals: 'Móvil', mode: 'insensitive' } }
            });

            // --- Actividad Reciente ---

            const completedMaintenances = await prisma.maintenance.findMany({
                where: { companyId, status: MaintenanceStatus.COMPLETED },
                orderBy: { completionDate: 'desc' },
                take: 5,
                include: { equipment: true },
            });

            const newEquipments = await prisma.equipment.findMany({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });

            const newScheduledMaintenances = await prisma.maintenance.findMany({
                where: { companyId, status: MaintenanceStatus.SCHEDULED },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { equipment: true },
            });

            // ✅ Cambiado: assignedToPersonId y assignedToPerson en lugar de assignedToUserId/assignedToUser
            const assignedEquipments = await prisma.equipment.findMany({
                where: { companyId, assignedToPersonId: { not: null } },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                include: {
                    assignedToPerson: {
                        include: {
                            department: true,
                        }
                    }
                },
            });

            const recentActivity = [
                ...completedMaintenances.map(m => ({
                    type: 'Mantenimiento completado',
                    description: `${m.equipment.brand} ${m.equipment.model}`,
                    date: m.completionDate,
                    icon: 'check',
                })),
                ...newEquipments.map(e => ({
                    type: 'Nuevo equipo agregado',
                    description: `${e.brand} ${e.model}`,
                    date: e.createdAt,
                    icon: 'plus',
                })),
                ...newScheduledMaintenances.map(m => ({
                    type: `${m.equipment.type} requiere mantenimiento`,
                    description: `${m.equipment.brand} ${m.equipment.model}`,
                    date: m.createdAt,
                    icon: 'warning',
                })),
                // ✅ Cambiado: assignedToPerson en lugar de assignedToUser.person
                ...assignedEquipments.map(e => ({
                    type: `${e.type} asignada a ${e.assignedToPerson?.fullName || 'persona'}`,
                    description: `Departamento: ${e.assignedToPerson?.department?.name || 'No especificado'}`,
                    date: e.updatedAt,
                    icon: 'user',
                }))
            ]
                .sort((a, b) => {
                    const dateA = a.date ?? new Date(0);
                    const dateB = b.date ?? new Date(0);
                    return dateB.getTime() - dateA.getTime();
                })
                .slice(0, 5);

            // --- Respuesta Final ---
            const dashboardData = {
                kpi: {
                    totalEquipments: {
                        count: totalEquipmentsCurrent,
                        change: calculatePercentageChange(totalEquipmentsCurrent, totalEquipmentsPrevious),
                    },
                    pendingMaintenances: {
                        count: pendingMaintenancesCurrent,
                        change: calculatePercentageChange(pendingMaintenancesCurrent, pendingMaintenancesPrevious),
                    },
                    activeEquipments: {
                        count: activeEquipmentsCurrent,
                        change: calculatePercentageChange(activeEquipmentsCurrent, activeEquipmentsPrevious),
                    },
                    activeUsers: {
                        count: activeUsersCurrent,
                        change: calculatePercentageChange(activeUsersCurrent, activeUsersPrevious),
                    },
                },
                inventoryByCategory: [
                    { name: 'Laptops', count: laptopsCount },
                    { name: 'Desktops', count: desktopsCount },
                    { name: 'Móviles', count: mobilesCount },
                ],
                recentActivity,
            };

            res.status(200).json(dashboardData);

        } catch (error) {
            console.error("Error al obtener los datos del dashboard:", error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    }
}