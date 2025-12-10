import { Request, Response } from 'express';
import csvParser from 'csv-parser';
import formidable from 'formidable';
import { prisma } from '../../lib/prisma.js';

export class InventoryController {

    // ============================================
    // ⭐ CREAR INVENTARIO (companyId viene por params)
    // ============================================
    async createInventory(req: Request, res: Response): Promise<void> {
        console.log("📌 CREATE INVENTORY INICIADO (params)");
        console.log("Body recibido:", req.body);
        console.log("Params recibidos:", req.params);

        const { companyId } = req.params;
        const {
            brand,
            model,
            serialNumber,
            plateNumber,
            location,
            cost,
            operatingSystem,
            endUser,
            type
        } = req.body;

        // Validaciones mínimas
        if (!companyId) {
            console.log("❌ companyId no proporcionado en params");
            res.status(400).json({ message: "companyId es obligatorio en params" });
            return;
        }
        if (!serialNumber || !type) {
            console.log("❌ Faltan campos obligatorios en body");
            res.status(400).json({ message: "serialNumber y type son obligatorios en body" });
            return;
        }

        try {
            console.log("🔍 Buscando empresa por id:", companyId);
            const company = await prisma.company.findUnique({
                where: { id: companyId }
            });

            if (!company) {
                console.log("❌ Empresa no encontrada:", companyId);
                res.status(404).json({ message: `Empresa con id ${companyId} no encontrada` });
                return;
            }

            console.log("🏗️ Insertando equipo en BD para companyId:", companyId);

            const newEquipment = await prisma.equipment.create({
                data: {
                    brand: brand ?? "",
                    model: model ?? "",
                    serialNumber,
                    plateNumber: plateNumber ?? null,
                    location: location ?? null,
                    cost: cost ? Number(cost) : 0,
                    operatingSystem: operatingSystem ?? null,
                    endUser: endUser ?? null,
                    type,
                    companyId, // <- viene de params
                },
            });

            console.log("✔️ Equipo creado con ID:", newEquipment.id);
            res.status(201).json(newEquipment);

        } catch (error) {
            console.log("❌ ERROR al crear equipo:", error);
            res.status(500).json({
                message: "Error al crear equipo",
                error,
            });
        }
    }

    async updateInventory(req: Request, res: Response): Promise<void> {
        console.log("📌 UPDATE INVENTORY");

        const { companyId, id } = req.params;
        const updateData = req.body;

        console.log("companyId:", companyId, "id:", id);
        console.log("updateData:", updateData);

        try {
            const company = await prisma.company.findUnique({
                where: { id: companyId }
            });

            if (!company) {
                res.status(404).json({ message: `Empresa con id ${companyId} no encontrada` });
                return;
            }

            const updated = await prisma.equipment.update({
                where: { id },
                data: updateData,
            });

            res.status(200).json(updated);

        } catch (error) {
            console.log("❌ Error al actualizar:", error);
            res.status(500).json({ message: 'Error al actualizar el equipo', error });
        }
    }

    async deleteInventory(req: Request, res: Response): Promise<void> {
        console.log("📌 DELETE INVENTORY");

        const { companyId, id } = req.params;

        console.log("companyId:", companyId, "id:", id);

        try {
            const company = await prisma.company.findUnique({
                where: { id: companyId }
            });

            if (!company) {
                res.status(404).json({ message: `Empresa con id ${companyId} no encontrada` });
                return;
            }

            await prisma.equipment.delete({
                where: { id },
            });

            res.status(200).json({ message: 'Equipo eliminado correctamente' });

        } catch (error) {
            console.log("❌ Error al eliminar:", error);
            res.status(500).json({ message: 'Error al eliminar el equipo', error });
        }
    }


    async importCSV(req: Request, res: Response): Promise<void> {
        console.log("🌟 IMPORT CSV INICIADO");
        const { companyId } = req.params;

        const company = await prisma.company.findUnique({ where: { id: companyId } });
        console.log("Empresa encontrada:", company);

        if (!company) {
            console.log("❌ Empresa no encontrada");
            res.status(404).json({ message: `Empresa con id ${companyId} no encontrada` });
            return;
        }

        const form = formidable({ multiples: false, keepExtensions: true });
        console.log("⏳ Parseando formulario...");

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.log("❌ Error parseando form:", err);
                res.status(400).json({ message: "Error parsing form", error: err });
                return;
            }

            console.log("Fields:", fields);
            console.log("Files:", files);

            const csvFile = Array.isArray((files as any).csvFile)
                ? (files as any).csvFile[0]
                : (files as any).csvFile;

            console.log("csvFile:", csvFile);

            if (!csvFile?.filepath) {
                console.log("❌ No llegó archivo CSV");
                res.status(400).json({ message: "Archivo CSV no proporcionado" });
                return;
            }

            console.log("📄 Leyendo archivo desde:", csvFile.filepath);

            const results: any[] = [];
            const errors: { row: number; serialNumber?: string; message: string }[] = [];
            let rowIndex = 1;

            import("fs").then((fs) => {
                console.log("⏳ Iniciando csvParser con separador COMA");

                const stream = fs.createReadStream(csvFile.filepath);

                stream
                    .pipe(csvParser({ separator: "," }))
                    .on("headers", (headers) => {
                        console.log("📌 Encabezados detectados por csv-parser:", headers);
                    })
                    .on("data", (row) => {
                        console.log(`➡️ FILA ${rowIndex} cruda:`, row);

                        if (!row["Tipo"]) {
                            errors.push({
                                row: rowIndex,
                                serialNumber: row["Numero de Serie"],
                                message: "'Tipo' es obligatorio"
                            });
                        }
                        if (!row["Numero de Serie"]) {
                            errors.push({
                                row: rowIndex,
                                message: "'Numero de Serie' es obligatorio"
                            });
                        }

                        results.push({ ...row, originalRow: rowIndex });
                        rowIndex++;
                    })
                    .on("error", (error) => {
                        console.log("❌ ERROR en csvParser:", error);
                        res.status(400).json({
                            message: "Error parseando CSV",
                            error: error.message
                        });
                    })
                    .on("end", async () => {
                        console.log("✅ Parsing finalizado");
                        console.log("Total filas leídas:", results.length);
                        console.log("Errores detectados:", errors);

                        const validRows = results.filter(
                            (row) => !errors.find((e) => e.row === row.originalRow)
                        );

                        console.log("Filas válidas:", validRows.length);

                        const inserted = [];
                        const skipped: { row: number; serialNumber: string; reason: string }[] = [];

                        for (const row of validRows) {
                            console.log("➡️ Insertando fila:", row);

                            try {
                                // Verificar si ya existe el número de serie
                                const existingEquipment = await prisma.equipment.findUnique({
                                    where: { serialNumber: row["Numero de Serie"] }
                                });

                                if (existingEquipment) {
                                    console.log(`⚠️ Serial duplicado en fila ${row.originalRow}: ${row["Numero de Serie"]}`);
                                    skipped.push({
                                        row: row.originalRow,
                                        serialNumber: row["Numero de Serie"],
                                        reason: "Número de serie duplicado - ya existe en la base de datos"
                                    });
                                    continue;
                                }

                                const record = await prisma.equipment.create({
                                    data: {
                                        brand: row["Marca"] || "",
                                        model: row["Modelo"] || "",
                                        serialNumber: row["Numero de Serie"] || "",
                                        plateNumber: row["Numero de Placa"] || null,
                                        location: row["Ubicacion"] || null,
                                        cost: Number(row["Costos"]) || 0,
                                        operatingSystem: row["Sistema Operativo"] || null,
                                        endUser: row["Usuario Final"] || null,
                                        type: row["Tipo"],
                                        companyId,
                                    },
                                });

                                console.log("✔️ Insertado:", record.id);
                                inserted.push(record);
                            } catch (err: any) {
                                console.log("❌ Error insertando fila:", err);

                                let errorMessage = err.message;

                                // Manejar errores específicos de Prisma
                                if (err.code === 'P2002') {
                                    errorMessage = `Número de serie duplicado: ${row["Numero de Serie"]}`;
                                }

                                errors.push({
                                    row: row.originalRow,
                                    serialNumber: row["Numero de Serie"],
                                    message: errorMessage,
                                });
                            }
                        }

                        console.log("📦 RESUMEN FINAL");
                        console.log("Insertados:", inserted.length);
                        console.log("Omitidos:", skipped.length);
                        console.log("Errores:", errors.length);

                        // Si no se insertó nada y hay errores, devolver status 400
                        const statusCode = inserted.length > 0 ? 201 : (errors.length > 0 || skipped.length > 0) ? 400 : 201;

                        res.status(statusCode).json({
                            success: inserted.length > 0,
                            inserted: inserted.length,
                            skipped: skipped.length,
                            errors: errors.length,
                            totalRows: results.length,
                            details: {
                                insertedRecords: inserted.map(i => i.serialNumber),
                                skippedRecords: skipped,
                                errorRecords: errors
                            }
                        });
                    });
            });
        });
    }

    // ============================================
    // OBTENER POR EMPRESA
    // ============================================
    async getInventoryByCompanyCode(req: Request, res: Response): Promise<void> {
        const { companyId } = req.params;

        try {
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company) {
                res.status(404).json({ message: `Empresa con código ${companyId} no encontrada` });
                return;
            }

            const inventory = await prisma.equipment.findMany({
                where: { companyId: company.id },
                include: {
                    assignedToUser: true,
                    maintenances: true,
                    documents: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (inventory.length === 0) {
                res.status(200).json({ message: "No hay equipos registrados en inventario" });
                return;
            }
            res.status(200).json(inventory);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener el inventario', error });
        }
    }

    async getInventory(req: Request, res: Response): Promise<void> {
        try {
            const inventory = await prisma.equipment.findMany({
                include: {
                    company: true,
                    assignedToUser: true,
                    maintenances: true,
                    documents: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (inventory.length === 0) {
                res.status(200).json({ message: "No hay equipos registrados en inventario" });
                return;
            }
            res.status(200).json(inventory);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener el inventario', error });
        }
    }
}
