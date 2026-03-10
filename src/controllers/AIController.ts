import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { EquipmentStatus, MaintenanceStatus } from '../../generated/prisma/index.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AI_MODELS = [
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.1-8b-instruct:free',
    'deepseek/deepseek-chat:free',
    'mistralai/mistral-7b-instruct:free',
];

interface OpenAIResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

const callOpenAI = async (
    messages: { role: string; content: string }[],
    temperature = 0.5
): Promise<OpenAIResponse> => {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY no está configurada en las variables de entorno.');
    }

    for (const model of AI_MODELS) {
        try {
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
                    'X-Title': 'Dashboard AI',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: 2000 }),
            });

            if (!response.ok) {
                const err = await response.json() as any;
                console.warn(`⚠️ Modelo ${model} falló:`, err.error?.message);
                continue;
            }

            console.log(`✅ Modelo usado: ${model}`);
            return response.json() as Promise<OpenAIResponse>;

        } catch (err) {
            console.warn(`⚠️ Error con modelo ${model}, intentando siguiente...`);
            continue;
        }
    }

    throw new Error('Todos los modelos AI fallaron. Intenta más tarde.');
};

const cleanAIResponse = (raw: string): string => {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) return jsonMatch[0];
    return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
};

export class AIController {

    private async getPersonEquipmentDetails(companyId: string): Promise<any[]> {
        try {
            const persons = await prisma.person.findMany({
                where: { companyId },
                include: {
                    department: { select: { name: true } },
                },
            });

            const personEquipmentList: any[] = [];

            for (const person of persons) {
                const equipments = await prisma.equipment.findMany({
                    where: {
                        companyId,
                        assignedToPersonId: person.id,
                    },
                });

                const hasLaptop = equipments.some((eq) => eq.type?.toLowerCase().includes('laptop'));
                const hasMonitor = equipments.some((eq) => eq.type?.toLowerCase().includes('monitor'));
                const hasMouse = equipments.some((eq) => eq.type?.toLowerCase().includes('mouse'));
                const hasKeyboard = equipments.some((eq) => eq.type?.toLowerCase().includes('keyboard'));

                personEquipmentList.push({
                    id: person.id,
                    fullName: person.fullName || 'Desconocido',
                    department: person.department?.name || 'Sin departamento',
                    position: person.position,
                    status: person.status,
                    equipments: equipments.map((eq) => ({
                        type: eq.type,
                        brand: eq.brand,
                        model: eq.model,
                        serialNumber: eq.serialNumber,
                        cost: eq.cost,
                        status: eq.status,
                    })),
                    totalEquipmentCount: equipments.length,
                    totalEquipmentCost: equipments.reduce((sum, eq) => sum + (Number(eq.cost) || 0), 0),
                    hasLaptop,
                    hasMonitor,
                    hasMouse,
                    hasKeyboard,
                });
            }

            return personEquipmentList;
        } catch (error) {
            console.error('Error obteniendo detalles de equipos por persona:', error);
            return [];
        }
    }

    private async getDashboardContext(companyId: string) {
        try {
            const [
                totalEquipment,
                activeEquipment,
                inMaintenance,
                totalPersons,
                expenses,
                equipmentGrouped,
                equipmentByStatus,
                allPersons,
                allEquipment,
                departments,
            ] = await Promise.all([
                prisma.equipment.count({ where: { companyId } }),
                prisma.equipment.count({ where: { companyId, status: EquipmentStatus.ACTIVE } }),
                prisma.maintenance.count({
                    where: { companyId, status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] } },
                }),
                prisma.person.count({ where: { companyId } }),
                prisma.annualSoftwareExpense.findMany({ orderBy: { annualCost: 'desc' }, take: 5 }),
                prisma.equipment.groupBy({ by: ['type'], where: { companyId }, _count: { type: true } }),
                prisma.equipment.groupBy({ by: ['status'], where: { companyId }, _count: { status: true } }),
                prisma.person.findMany({
                    where: { companyId },
                    include: {
                        department: { select: { name: true } },
                    },
                }),
                prisma.equipment.findMany({
                    where: { companyId },
                    include: {
                        assignedToPerson: { select: { fullName: true } },
                    },
                }),
                prisma.department.findMany({
                    where: { companyId },
                    include: {
                        persons: true,
                    },
                }),
            ]);

            const personEquipmentDetails = await this.getPersonEquipmentDetails(companyId);

            const equipmentByPerson = new Map<string, any[]>();
            allEquipment.forEach((eq: any) => {
                if (eq.assignedToPersonId) {
                    if (!equipmentByPerson.has(eq.assignedToPersonId)) {
                        equipmentByPerson.set(eq.assignedToPersonId, []);
                    }
                    equipmentByPerson.get(eq.assignedToPersonId)!.push(eq);
                }
            });

            const personsWithEquipment = equipmentByPerson.size;
            const personsWithoutEquipment = totalPersons - personsWithEquipment;

            const personsWithoutMonitor: string[] = [];
            const personsWithoutLaptop: string[] = [];
            const personsWithoutEquipmentList: string[] = [];

            for (const detail of personEquipmentDetails) {
                if (detail.equipments.length > 0 && !detail.hasMonitor) {
                    personsWithoutMonitor.push(
                        `${detail.fullName} (${detail.equipments.map((e: any) => e.type).join(', ')})`
                    );
                }
                if (detail.equipments.length > 0 && !detail.hasLaptop) {
                    personsWithoutLaptop.push(
                        `${detail.fullName} (${detail.equipments.map((e: any) => e.type).join(', ')})`
                    );
                }
                if (detail.equipments.length === 0) {
                    personsWithoutEquipmentList.push(detail.fullName);
                }
            }

            const topPersonsArray: any[] = [];
            for (const detail of personEquipmentDetails) {
                topPersonsArray.push({
                    name: detail.fullName,
                    count: detail.totalEquipmentCount,
                    cost: detail.totalEquipmentCost,
                    equipments: detail.equipments
                        .map((e: any) => `${e.type} (${e.brand} ${e.model})`)
                        .join(', '),
                });
            }

            const topPersons = topPersonsArray
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            const totalCost = allEquipment.reduce((sum: number, eq: any) => sum + (Number(eq.cost) || 0), 0);
            const totalExpensesCost = expenses.reduce((sum, item) => sum + item.annualCost, 0);

            const deptStats = departments.map((dept: any) => ({
                name: dept.name,
                personCount: dept.persons.length,
                equipmentCount: allEquipment.filter((eq: any) => 
                    allPersons.find((p: any) => p.id === eq.assignedToPersonId)?.departmentId === dept.id
                ).length,
                persons: dept.persons.map((p: any) => {
                    const details = personEquipmentDetails.find((d: any) => d.id === p.id);
                    return {
                        name: p.fullName,
                        equipmentCount: details?.totalEquipmentCount || 0,
                        equipments: details?.equipments || [],
                    };
                }),
            }));

            return {
                totalEquipment,
                activeEquipment,
                inMaintenance,
                totalPersons,
                personsWithEquipment,
                personsWithoutEquipment,
                personsWithoutMonitor,
                personsWithoutLaptop,
                personsWithoutEquipmentList,
                topPersons,
                totalEquipmentCost: totalCost,
                totalSoftwareCost: totalExpensesCost,
                monthlySoftwareCost: totalExpensesCost / 12,
                equipmentTypes: equipmentGrouped.map((e: any) => `${e.type}: ${e._count.type}`).join(', '),
                equipmentByStatus: equipmentByStatus.map((e: any) => `${e.status}: ${e._count.status}`).join(', '),
                softwareExpenses: expenses.map((e: any) => `${e.applicationName}: $${e.annualCost}`).join(', '),
                departments: deptStats,
                personEquipmentDetails,
            };
        } catch (error) {
            console.error('Error obteniendo contexto del dashboard:', error);
            return null;
        }
    }

    async generateDashboardInsights(req: Request, res: Response) {
        console.log('🔹 [AI] Generando insights...');
        try {
            const { companyId } = req.body;
            if (!companyId) return res.status(400).json({ error: 'Falta companyId.' });

            const context = await this.getDashboardContext(companyId);
            if (!context) {
                return res.status(500).json({ error: 'No se pudo obtener contexto del dashboard.' });
            }

            const prompt = `Eres un analista experto en gestión de TI. Analiza estos datos completos de la empresa:

EQUIPOS:
- Total: ${context.totalEquipment}
- Activos: ${context.activeEquipment}
- En Mantenimiento: ${context.inMaintenance}
- Costo Total: $${context.totalEquipmentCost}
- Tipos: ${context.equipmentTypes}
- Estado: ${context.equipmentByStatus}

PERSONAS Y ASIGNACIONES DETALLADAS:
- Total: ${context.totalPersons}
- Con Equipos: ${context.personsWithEquipment}
- Sin Equipos: ${context.personsWithoutEquipment} ${context.personsWithoutEquipmentList.length > 0 ? `(${context.personsWithoutEquipmentList.join(', ')})` : ''}
- Sin Monitor: ${context.personsWithoutMonitor.length} ${context.personsWithoutMonitor.length > 0 ? `(${context.personsWithoutMonitor.join('; ')})` : ''}
- Sin Laptop: ${context.personsWithoutLaptop.length} ${context.personsWithoutLaptop.length > 0 ? `(${context.personsWithoutLaptop.join('; ')})` : ''}

TOP 5 PERSONAS POR EQUIPOS:
${context.topPersons.map((p: any) => `- ${p.name}: ${p.count} equipos ($${p.cost}) → ${p.equipments}`).join('\n')}

SOFTWARE:
- Costo Mensual: $${context.monthlySoftwareCost.toFixed(0)}
- Costo Anual: $${context.totalSoftwareCost.toFixed(0)}
- Principales: ${context.softwareExpenses}

DEPARTAMENTOS:
${context.departments.map((d: any) => `- ${d.name}: ${d.personCount} personas, ${d.equipmentCount} equipos`).join('\n')}

Genera 4 insights estratégicos en JSON. Máximo 20 palabras por insight:
[
  {"type":"summary","title":"Resumen Ejecutivo","content":"...","priority":"medium","icon":"📊"},
  {"type":"alert","title":"Alerta Crítica","content":"...","priority":"high","icon":"⚠️"},
  {"type":"recommendation","title":"Recomendación","content":"...","priority":"medium","icon":"💡"},
  {"type":"optimization","title":"Oportunidad de Ahorro","content":"...","priority":"low","icon":"💰"}
]`;

            const completion = await callOpenAI([{ role: 'user', content: prompt }], 0.5);
            const rawContent = completion.choices?.[0]?.message?.content ?? '';
            const cleaned = cleanAIResponse(rawContent);

            let insights;
            try {
                insights = JSON.parse(cleaned);
            } catch {
                console.error('❌ Error parseando JSON:', rawContent);
                insights = [{ type: 'alert', title: 'Error', content: 'No se pudo procesar. Intenta de nuevo.', priority: 'high', icon: '⚠️' }];
            }

            return res.status(200).json({ insights, generatedAt: new Date(), context });

        } catch (error: any) {
            console.error('❌ [AI Controller Error]:', error);
            return res.status(500).json({ error: 'Error interno del servidor AI.', details: error.message });
        }
    }

    async generateEquipmentSummary(req: Request, res: Response) {
        try {
            const { equipment } = req.body;
            if (!equipment) return res.status(400).json({ error: 'Faltan datos del equipo.' });

            const prompt = `Resume en 2 frases profesionales el estado de este equipo:
Tipo: ${equipment.type}, Marca: ${equipment.brand}, Modelo: ${equipment.model}
Serie: ${equipment.serialNumber}, Estado: ${equipment.status}.
Responde directamente sin introducción.`;

            const completion = await callOpenAI([{ role: 'user', content: prompt }], 0.3);
            const summary = completion.choices?.[0]?.message?.content ?? 'No se pudo generar resumen.';

            return res.status(200).json({ summary });

        } catch (error: any) {
            console.error('❌ [AI Equipment Summary Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async analyzeExpenses(req: Request, res: Response) {
        try {
            const { companyId } = req.body;
            if (!companyId) return res.status(400).json({ error: 'Falta companyId.' });

            const expenses = await prisma.annualSoftwareExpense.findMany({ 
                orderBy: { annualCost: 'desc' },
            });

            if (expenses.length === 0) {
                return res.status(200).json({ analysis: 'No hay gastos de software registrados.' });
            }

            const totalAnual = expenses.reduce((sum, e) => sum + e.annualCost, 0);
            const expenseList = expenses
                .map(e => `- ${e.applicationName} (${e.category}): $${e.annualCost}/año, ${e.numberOfUsers} usuarios`)
                .join('\n');

            const prompt = `Analista financiero de TI. Analiza estos gastos de software:
${expenseList}
Total Anual: $${totalAnual.toFixed(0)}
Promedio Mensual: $${(totalAnual / 12).toFixed(0)}

Proporciona:
1) Resumen ejecutivo del gasto
2) Software con mejor/peor relación costo-usuario
3) 2 recomendaciones de optimización
4) Oportunidades de consolidación

Máximo 200 palabras.`;

            const completion = await callOpenAI([{ role: 'user', content: prompt }], 0.4);
            const analysis = completion.choices?.[0]?.message?.content ?? 'No se pudo analizar.';

            return res.status(200).json({ 
                analysis, 
                totalAnual, 
                monthlyAverage: totalAnual / 12,
                totalSoftware: expenses.length 
            });

        } catch (error: any) {
            console.error('❌ [AI Expenses Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async chat(req: Request, res: Response) {
        try {
            const { messages, systemPrompt, companyId } = req.body;
            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'Messages son requeridos.' });
            }

            let context = '';
            let contextData: any = null;

            if (companyId) {
                contextData = await this.getDashboardContext(companyId);
                if (contextData) {
                    const personDetailsList: string[] = [];
                    for (const detail of contextData.personEquipmentDetails) {
                        const equipmentList = detail.equipments.length > 0
                            ? detail.equipments
                                .map((e: any) => `${e.type} (${e.brand} ${e.model}, $${e.cost})`)
                                .join('; ')
                            : 'Sin equipos asignados';
                        personDetailsList.push(`${detail.fullName} (${detail.department}): ${equipmentList}`);
                    }
                    const personDetails = personDetailsList.join('\n');

                    context = `

CONTEXTO DEL SISTEMA (Información actual de la empresa):

INVENTARIO DE EQUIPOS:
- Total: ${contextData.totalEquipment} equipos
- Activos: ${contextData.activeEquipment}
- En Mantenimiento: ${contextData.inMaintenance}
- Costo Total: $${contextData.totalEquipmentCost.toLocaleString()}
- Tipos: ${contextData.equipmentTypes}
- Estado: ${contextData.equipmentByStatus}

PERSONAL Y ASIGNACIONES ESPECÍFICAS:
- Total de Personas: ${contextData.totalPersons}
- Con Equipos: ${contextData.personsWithEquipment}
- Sin Equipos: ${contextData.personsWithoutEquipment} ${contextData.personsWithoutEquipmentList.length > 0 ? `(${contextData.personsWithoutEquipmentList.join(', ')})` : ''}

DETALLES POR PERSONA:
${personDetails}

ALERTAS:
${contextData.personsWithoutMonitor.length > 0 ? `- Sin Monitor: ${contextData.personsWithoutMonitor.join(', ')}\n` : ''}
${contextData.personsWithoutLaptop.length > 0 ? `- Sin Laptop: ${contextData.personsWithoutLaptop.join(', ')}\n` : ''}

GASTOS DE SOFTWARE:
- Costo Mensual: $${contextData.monthlySoftwareCost.toFixed(0)}
- Costo Anual: $${contextData.totalSoftwareCost.toFixed(0)}
- Principales: ${contextData.softwareExpenses}

DEPARTAMENTOS:
${contextData.departments.map((d: any) => `- ${d.name}: ${d.personCount} personas, ${d.equipmentCount} equipos`).join('\n')}
`;
                }
            }

            const enhancedSystemPrompt = `${systemPrompt}${context}

Basándote en esta información específica de equipos asignados a cada persona, responde preguntas sobre asignaciones, personas, equipos y estrategia de TI.
Sé específico y usa los datos proporcionados. Cuando alguien pregunte "¿Qué tiene Carlos?", consulta la lista de asignaciones específicas.`;

            const completion = await callOpenAI(
                [{ role: 'system', content: enhancedSystemPrompt }, ...messages],
                0.4
            );

            return res.status(200).json({ 
                ...completion,
                contextIncluded: !!contextData
            });

        } catch (error: any) {
            console.error('❌ [AI Chat Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}