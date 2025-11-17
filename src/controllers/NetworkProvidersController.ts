// src/controllers/NetworkProvidersController.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
const prisma = new PrismaClient();


export class NetworkProvidersController {

  async create(req: Request, res: Response) {
    try {
      const { name, providerIp, dnsGateway, speed, cost, notes, meshDevices, switchDevices, companyId } = req.body; // NUEVO: companyId

      // Validación de campos obligatorios
      if (!name || name.trim() === '') {
          return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
      }
      if (!companyId || companyId.trim() === '') { // NUEVO: Validación de companyId
          return res.status(400).json({ error: 'La compañía es obligatoria para el proveedor.' });
      }

      const newProvider = await prisma.networkProvider.create({
        data: {
          name,
          providerIp: providerIp || null,
          dnsGateway: dnsGateway || null,
          speed: speed || null,
          cost: cost !== undefined && cost !== null ? parseFloat(cost) : 0,
          notes: notes || null,
          meshDevices: meshDevices || null,
          switchDevices: switchDevices || null,
          company: { connect: { id: companyId } }, // NUEVO: Conectar a la compañía
        },
      });

      res.status(201).json(newProvider);
    } catch (error: any) {
      console.error('Error creating network provider:', error);
      if (error.code === 'P2002') { // Error de restricción única
          return res.status(409).json({ error: `Conflicto: El proveedor con nombre '${req.body.name}' ya existe.` });
      }
      if (error.code === 'P2025') { // Si el companyId no existe
          return res.status(400).json({ error: 'La compañía especificada no existe.', details: error.message });
      }
      res.status(500).json({ error: 'Error interno del servidor al crear el proveedor.', details: error.message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const providers = await prisma.networkProvider.findMany({
        include: {
          company: { // NUEVO: Incluir la compañía en el getAll
            select: { id: true, name: true }
          },
          // Opcional: Si quieres contar las redes asociadas en la lista, descomenta esto
          // networks: {
          //   select: { id: true }
          // }
        }
      });
      res.status(200).json(providers);
    } catch (error: any) {
      console.error('Error fetching network providers:', error);
      res.status(500).json({ error: 'Error interno del servidor al obtener los proveedores.', details: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const provider = await prisma.networkProvider.findUnique({
        where: { id },
        include: {
          company: { // NUEVO: Incluir la compañía en el getById
            select: { id: true, name: true }
          },
          networks: { // Incluye las redes asociadas para este proveedor específico
            select: { id: true, name: true, ipAddress: true, deviceType: true, status: true } // Selecciona campos relevantes
          }
        },
      });

      if (!provider) {
        return res.status(404).json({ error: 'Proveedor de red no encontrado.' });
      }

      res.status(200).json(provider);
    } catch (error: any) {
      console.error('Error fetching network provider by ID:', error);
      res.status(500).json({ error: 'Error interno del servidor al obtener el proveedor.', details: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, providerIp, dnsGateway, speed, cost, notes, meshDevices, switchDevices, companyId } = req.body; // NUEVO: companyId

      // Validación básica
      if (!name || name.trim() === '') {
          return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
      }
      // companyId podría no ser obligatorio en una actualización si no quieres que se cambie cada vez
      // Pero si se envía, valida que exista
      if (companyId && companyId.trim() === '') {
          return res.status(400).json({ error: 'La ID de compañía no puede ser vacía si se proporciona.' });
      }


      const updatedProvider = await prisma.networkProvider.update({
        where: { id },
        data: {
          name,
          providerIp: providerIp || null,
          dnsGateway: dnsGateway || null,
          speed: speed || null,
          cost: cost !== undefined && cost !== null ? parseFloat(cost) : undefined,
          notes: notes || null,
          meshDevices: meshDevices || null,
          switchDevices: switchDevices || null,
          company: companyId ? { connect: { id: companyId } } : undefined, // NUEVO: Conectar solo si companyId se proporciona
        },
      });

      res.status(200).json(updatedProvider);
    } catch (error: any) {
      console.error('Error updating network provider:', error);
      if (error.code === 'P2025') {
          // Puede ser el proveedor no encontrado o la compañía no encontrada
          if (error.meta?.cause?.includes('Company') || error.meta?.cause?.includes('company')) {
              return res.status(400).json({ error: 'La compañía especificada no existe.', details: error.message });
          }
          return res.status(404).json({ error: 'Proveedor de red no encontrado.' });
      }
      if (error.code === 'P2002') { // Error de restricción única
          return res.status(409).json({ error: `Conflicto: El proveedor con nombre '${req.body.name}' ya existe.` });
      }
      res.status(500).json({ error: 'Error interno del servidor al actualizar el proveedor.', details: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.networkProvider.delete({
        where: { id },
      });

      res.status(204).send(); // No Content
    } catch (error: any) {
      console.error('Error deleting network provider:', error);
      if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Proveedor de red no encontrado.' });
      }
      if (error.code === 'P2003') { // ForeignKeyConstraintViolation
          return res.status(409).json({ error: 'No se puede eliminar el proveedor porque tiene dispositivos de red asociados o está referenciado por una compañía. Desasócialos primero.' });
      }
      res.status(500).json({ error: 'Error interno del servidor al eliminar el proveedor.', details: error.message });
    }
  }
}