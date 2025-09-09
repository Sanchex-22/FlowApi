// src/controllers/NetworkProvidersController.ts
import { PrismaClient } from '@prisma/client';

import { Request, Response } from 'express';
const prisma = new PrismaClient();

export class NetworkProvidersController {

  async create(req: Request, res: Response) {
    try {
      const { name, providerIp, dnsGateway, speed, cost, notes, meshDevices, switchDevices } = req.body;

      const newProvider = await prisma.networkProvider.create({
        data: {
          name,
          providerIp,
          dnsGateway,
          speed,
          cost: cost ? parseFloat(cost) : 0, // Asegúrate de parsear a Decimal
          notes,
          meshDevices,
          switchDevices,
        },
      });

      res.status(201).json(newProvider);
    } catch (error: any) {
      console.error('Error creating network provider:', error);
      res.status(500).json({ error: 'Failed to create network provider', details: error.message });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const providers = await prisma.networkProvider.findMany();
      res.status(200).json(providers);
    } catch (error: any) {
      console.error('Error fetching network providers:', error);
      res.status(500).json({ error: 'Failed to fetch network providers', details: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const provider = await prisma.networkProvider.findUnique({
        where: { id },
        include: { networks: true }, // Incluye las redes asociadas al proveedor
      });

      if (!provider) {
        return res.status(404).json({ error: 'Network provider not found' });
      }

      res.status(200).json(provider);
    } catch (error: any) {
      console.error('Error fetching network provider by ID:', error);
      res.status(500).json({ error: 'Failed to fetch network provider', details: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, providerIp, dnsGateway, speed, cost, notes, meshDevices, switchDevices } = req.body;

      const updatedProvider = await prisma.networkProvider.update({
        where: { id },
        data: {
          name,
          providerIp,
          dnsGateway,
          speed,
          cost: cost ? parseFloat(cost) : 0,
          notes,
          meshDevices,
          switchDevices,
        },
      });

      res.status(200).json(updatedProvider);
    } catch (error: any) {
      console.error('Error updating network provider:', error);
      res.status(500).json({ error: 'Failed to update network provider', details: error.message });
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
      res.status(500).json({ error: 'Failed to delete network provider', details: error.message });
    }
  }
}