// src/controllers/NetworkProvidersController.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
export class NetworkProvidersController {

  async create(req: Request, res: Response) {
    try {
      const { name, providerIp, dnsGateway, speed, cost, notes, meshDevices, switchDevices, companyId } = req.body;

      // Validación de campos obligatorios
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
      }
      if (!companyId || companyId.trim() === '') {
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
          company: { connect: { id: companyId } },
        },
      });

      res.status(201).json(newProvider);
    } catch (error: any) {
      console.error('Error creating network provider:', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: `Conflicto: El proveedor con nombre '${req.body.name}' ya existe.` });
      }
      if (error.code === 'P2025') {
        return res.status(400).json({ error: 'La compañía especificada no existe.', details: error.message });
      }
      res.status(500).json({ error: 'Error interno del servidor al crear el proveedor.', details: error.message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const providers = await prisma.networkProvider.findMany({
        include: {
          company: {
            select: { id: true, name: true }
          },
        }
      });
      res.status(200).json(providers);
    } catch (error: any) {
      console.error('Error fetching network providers:', error);
      res.status(500).json({ error: 'Error interno del servidor al obtener los proveedores.', details: error.message });
    }
  }
  
  async getNetworkByCompanyCode(req: Request, res: Response) {
    const { companyId } = req.params;
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        res.status(404).json({ message: `Empresa con código ${companyId} no encontrada` });
        return;
      }
      const providers = await prisma.networkProvider.findMany({
        where: { companyId: company.id },
        include: {
          company: { select: { id: true, name: true }},
          networks: {
            select: { 
              id: true, 
              name: true, 
              ip: true,
              status: true,
              location: true,
              description: true,
              ssid: true,
              password: true
            }
          }
        }
      });
      res.status(200).json(providers);
    } catch (error: any) {
      console.error('Error fetching network providers by company code:', error);
      res.status(500).json({ error: 'Error interno del servidor al obtener los proveedores por código de compañía.', details: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const provider = await prisma.networkProvider.findUnique({
        where: { id },
        include: {
          company: {
            select: { id: true, name: true }
          },
          networks: {
            select: { 
              id: true, 
              name: true, 
              ip: true,
              status: true,
              location: true,
              description: true,
              ssid: true,
              password: true
            }
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
      const { name, providerIp, dnsGateway, speed, cost, notes, meshDevices, switchDevices, companyId } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
      }
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
          company: companyId ? { connect: { id: companyId } } : undefined,
        },
      });

      res.status(200).json(updatedProvider);
    } catch (error: any) {
      console.error('Error updating network provider:', error);
      if (error.code === 'P2025') {
        if (error.meta?.cause?.includes('Company') || error.meta?.cause?.includes('company')) {
          return res.status(400).json({ error: 'La compañía especificada no existe.', details: error.message });
        }
        return res.status(404).json({ error: 'Proveedor de red no encontrado.' });
      }
      if (error.code === 'P2002') {
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

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting network provider:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Proveedor de red no encontrado.' });
      }
      if (error.code === 'P2003') {
        return res.status(409).json({ error: 'No se puede eliminar el proveedor porque tiene dispositivos de red asociados o está referenciado por una compañía. Desasócialos primero.' });
      }
      res.status(500).json({ error: 'Error interno del servidor al eliminar el proveedor.', details: error.message });
    }
  }
}