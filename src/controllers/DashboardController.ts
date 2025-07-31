import { Request, Response } from 'express';
import { PrismaClient, EquipmentStatus, MaintenanceStatus } from '@prisma/client';
import { subMonths, startOfMonth } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Agrega los datos para el dashboard principal de una compañía.
 */
export class DashboardController {

    async getDashboardData(req: Request, res: Response) {
        // En una aplicación real, el companyId vendría de la sesión del usuario o de un parámetro de la URL.
        // Para este ejemplo, usaremos un ID hardcodeado. Deberías encontrar el ID de "Empresa Principal S.A.".
        const { companyId } = req.params; // o req.user.companyId;

        if (!companyId) {
            return res.status(400).json({ message: 'El ID de la compañía es requerido.' });
        }

        try {
            // --- 1. Definición de Rangos de Fechas para comparativas ---
            const today = new Date();
            const startOfCurrentMonth = startOfMonth(today);
            const startOfPreviousMonth = startOfMonth(subMonths(today, 1));

            // --- 2. Cálculos para las Tarjetas de KPIs ---

            // Función auxiliar para calcular el cambio porcentual
            const calculatePercentageChange = (current: number, previous: number): number => {
                if (previous === 0) {
                    return current > 0 ? 100 : 0; // Evitar división por cero
                }
                const change = ((current - previous) / previous) * 100;
                return parseFloat(change.toFixed(2)); // Redondear a 2 decimales
            };

            // Total de Equipos
            const totalEquipmentsCurrent = await prisma.equipment.count({ where: { companyId } });
            const totalEquipmentsPrevious = await prisma.equipment.count({
                where: { companyId, createdAt: { lt: startOfCurrentMonth } },
            });

            // Mantenimientos Pendientes (SCHEDULED o IN_PROGRESS)
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

            // Equipos Activos
            const activeEquipmentsCurrent = await prisma.equipment.count({
                where: { companyId, status: EquipmentStatus.ACTIVE },
            });
            const activeEquipmentsPrevious = await prisma.equipment.count({
                where: { companyId, status: EquipmentStatus.ACTIVE, createdAt: { lt: startOfCurrentMonth } },
            });

            // Usuarios Activos
            const activeUsersCurrent = await prisma.user.count({ where: { companyId, isActive: true } });
            const activeUsersPrevious = await prisma.user.count({
                where: { companyId, isActive: true, createdAt: { lt: startOfCurrentMonth } },
            });

            // --- 3. Datos para el Inventario por Categoría ---

            const laptopsCount = await prisma.equipment.count({ where: { companyId, type: { equals: 'Laptop', mode: 'insensitive' } } });
            const desktopsCount = await prisma.equipment.count({ where: { companyId, type: { equals: 'Desktop', mode: 'insensitive' } } });
            const mobilesCount = await prisma.equipment.count({ where: { companyId, type: { equals: 'Móvil', mode: 'insensitive' } } });
            // Para impresoras y networking, consultamos el modelo Network
            const printersCount = await prisma.network.count({ where: { companyId, deviceType: 'PRINTER' } });
            const networkingCount = await prisma.network.count({ where: { companyId, deviceType: { not: 'PRINTER' } } });


            // --- 4. Datos para la Actividad Reciente ---

            // Obtenemos los últimos 5 eventos de diferentes tipos
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

            const assignedEquipments = await prisma.equipment.findMany({
                where: { companyId, assignedToUserId: { not: null } },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                include: {
                    assignedToUser: {
                        include: {
                            person: {
                                include: {
                                    department: true
                                }
                            }
                        }
                    }
                },
            });

            // Mapeamos y combinamos todas las actividades en un solo array
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
                ...assignedEquipments.map(e => ({
                    type: `${e.type} asignada a ${e.assignedToUser?.person?.fullName || 'usuario'}`,
                    description: `Departamento: ${e.assignedToUser?.person?.department?.name || 'No especificado'}`,
                    date: e.updatedAt,
                    icon: 'user',
                }))
            ]
                .sort((a, b) => {
                    const dateA = a.date ?? new Date(0); // fecha antigua por defecto
                    const dateB = b.date ?? new Date(0);
                    return dateB.getTime() - dateA.getTime();
                })
                // Ordenamos por fecha
                .slice(0, 5); // Tomamos los 5 más recientes en total


            // --- 5. Ensamblar la Respuesta Final ---
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
                    { name: 'Impresoras', count: printersCount },
                    { name: 'Networking', count: networkingCount },
                ],
                recentActivity,
            };

            res.status(200).json(dashboardData);

        } catch (error) {
            console.error("Error al obtener los datos del dashboard:", error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    };

}