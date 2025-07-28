// src/auth/auth.controller.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export class UserController {

    async Create(req: Request, res: Response) {
    }

    async Delete(req: Request, res: Response) {
    }

    async Edit(req: Request, res: Response) {
    }

    async get(req: Request, res: Response) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.params.id }
            });
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener el usuario.' });

        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const users = await prisma.user.findMany();
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los usuarios.' });
        }
    }

    async getProfile(req: Request, res: Response) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.params.id },
                include: {
                    person: true,
                },
            });

            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }

            res.json(user);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener el perfil del usuario.' });
        }
    }

    async getAllWithPerson(req: Request, res: Response) {
        try {
            const users = await prisma.user.findMany({
                include: {
                    person: true,
                },
            });
            res.json(users);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener los usuarios.' });
        }
    }

}
