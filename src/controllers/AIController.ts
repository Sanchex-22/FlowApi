import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { EquipmentStatus, MaintenanceStatus } from '../../generated/prisma/index.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = 'google/gemini-3.1-pro-preview';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Helper reutilizable para llamar a OpenRouter
// Agrega esta interfaz arriba del archivo
interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

// Helper tipado
const callOpenRouter = async (
    messages: { role: string; content: string }[],
    temperature = 0.5
): Promise<OpenRouterResponse> => {
    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'Dashboard AI',
        },
        body: JSON.stringify({ model: AI_MODEL, messages, temperature, max_tokens: 1500 }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`OpenRouter error: ${JSON.stringify(err)}`);
    }

    return response.json() as Promise<OpenRouterResponse>;
};

// Helper para limpiar respuesta JSON de la IA
const cleanAIResponse = (raw: string): string => {
    // Extrae solo el contenido entre [ ] ignorando todo lo demás
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) return jsonMatch[0];
    
    // Fallback: limpieza básica
    return raw
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
};

export class AIController {

    // POST /api/ai/generate-insights
    async generateDashboardInsights(req: Request, res: Response) {
        console.log('🔹 [AI] Generando insights...');
        try {
            const { companyId } = req.body;

            if (!companyId) {
                return res.status(400).json({ error: 'Falta companyId en el cuerpo de la petición.' });
            }

            // Consultas en paralelo para máxima velocidad
            const [
                totalEquipment,
                activeEquipment,
                inMaintenance,
                totalPersons,
                expenses,
                equipmentGrouped,
            ] = await Promise.all([
                prisma.equipment.count({ where: { companyId } }),
                prisma.equipment.count({ where: { companyId, status: EquipmentStatus.ACTIVE } }),
                prisma.maintenance.count({
                    where: {
                        companyId,
                        status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] },
                    },
                }),
                prisma.user.count({
                    where: { companies: { some: { companyId } }, isActive: true },
                }),
                prisma.annualSoftwareExpense.findMany({
                    orderBy: { annualCost: 'desc' },
                    take: 5,
                }),
                prisma.equipment.groupBy({
                    by: ['type'],
                    where: { companyId },
                    _count: { type: true },
                }),
            ]);

            const totalExpensesCost = expenses.reduce((sum, item) => sum + item.annualCost, 0);
            const monthlyCost = totalExpensesCost / 12;
            const topExpenseName = expenses.length > 0 ? expenses[0].applicationName : 'N/A';
            const equipmentSummary = equipmentGrouped.map(e => `${e.type}: ${e._count.type}`).join(', ');

            const prompt = `Analiza estos datos de inventario tecnológico de una empresa:

            - Total Equipos: ${totalEquipment} (Activos: ${activeEquipment}, En Mantenimiento: ${inMaintenance})
            - Usuarios Activos: ${totalPersons}
            - Distribución: ${equipmentSummary || 'Sin datos'}
            - Gasto Software Mensual: $${monthlyCost.toFixed(0)}
            - App más costosa: ${topExpenseName}

            Responde SOLO con este JSON, sin texto antes ni después, sin markdown, sin explicaciones:
            [
            {"type":"summary","title":"Resumen General","content":"aquí tu análisis","priority":"medium","icon":"📊"},
            {"type":"alert","title":"Punto de Atención","content":"aquí tu alerta","priority":"high","icon":"⚠️"},
            {"type":"recommendation","title":"Recomendación","content":"aquí tu recomendación","priority":"medium","icon":"💡"},
            {"type":"optimization","title":"Oportunidad de Ahorro","content":"aquí tu sugerencia","priority":"low","icon":"💰"}
            ]`;

            const completion = await callOpenRouter([{ role: 'user', content: prompt }], 0.5);
            const rawContent = completion.choices?.[0]?.message?.content ?? '';
            console.log('🤖 Raw AI response:', rawContent); // ← agrega esto temporalmente
            const cleaned = cleanAIResponse(rawContent);
            console.log('🧹 Cleaned response:', cleaned);

            let insights;
            try {
                insights = JSON.parse(cleaned);
            } catch {
                console.error('❌ Error parseando JSON de IA:', rawContent);
                insights = [{
                    type: 'alert', title: 'Error de Análisis',
                    content: 'La IA no pudo procesar los datos en este momento. Intenta de nuevo.',
                    priority: 'high', icon: '⚠️',
                }];
            }

            console.log('✅ [AI] Insights generados correctamente.');
            return res.status(200).json({ insights, generatedAt: new Date() });

        } catch (error: any) {
            console.error('❌ [AI Controller Error]:', error);
            return res.status(500).json({ error: 'Error interno del servidor AI.', details: error.message });
        }
    }

    // POST /api/ai/equipment-summary
    async generateEquipmentSummary(req: Request, res: Response) {
        try {
            const { equipment } = req.body;
            if (!equipment) return res.status(400).json({ error: 'Faltan datos del equipo.' });

            const prompt = `Resume en 2 frases profesionales y concisas el estado de este equipo de TI:
            Tipo: ${equipment.type}, Marca: ${equipment.brand}, Modelo: ${equipment.model}
            Número de Serie: ${equipment.serialNumber}, Estado: ${equipment.status}.
            Responde directamente sin introducción.`;

            const completion = await callOpenRouter([{ role: 'user', content: prompt }], 0.3);
            const summary = completion.choices?.[0]?.message?.content ?? 'No se pudo generar un resumen.';

            return res.status(200).json({ summary });

        } catch (error: any) {
            console.error('❌ [AI Equipment Summary Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // POST /api/ai/analyze-expenses
    async analyzeExpenses(req: Request, res: Response) {
        try {
            const { companyId } = req.body;
            if (!companyId) return res.status(400).json({ error: 'Falta companyId.' });

            const expenses = await prisma.annualSoftwareExpense.findMany({
                orderBy: { annualCost: 'desc' },
            });

            if (expenses.length === 0) {
                return res.status(200).json({ analysis: 'No hay gastos de software registrados para analizar.' });
            }

            const totalAnual = expenses.reduce((sum, e) => sum + e.annualCost, 0);
            const expenseList = expenses
                .map(e => `- ${e.applicationName} (${e.category}): $${e.annualCost}/año, ${e.numberOfUsers} usuarios`)
                .join('\n');

            const prompt = `Eres un analista financiero de TI. Analiza estos gastos de software:

            ${expenseList}

            Total Anual: $${totalAnual.toFixed(0)}

            Proporciona:
            1. Un resumen del gasto total
            2. El software con mejor y peor relación costo/usuario
            3. 2 recomendaciones concretas de optimización

            Sé conciso y directo. Máximo 150 palabras.`;

            const completion = await callOpenRouter([{ role: 'user', content: prompt }], 0.4);
            const analysis = completion.choices?.[0]?.message?.content ?? 'No se pudo analizar.';

            return res.status(200).json({ analysis, totalAnual, totalSoftware: expenses.length });

        } catch (error: any) {
            console.error('❌ [AI Expenses Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // POST /api/ai/chat — Proxy para el chat del dashboard
    async chat(req: Request, res: Response) {
        try {
            const { messages, systemPrompt } = req.body;

            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'Messages son requeridos.' });
            }

            const completion = await callOpenRouter(
                [{ role: 'system', content: systemPrompt }, ...messages],
                0.4
            );

            return res.status(200).json(completion);

        } catch (error: any) {
            console.error('❌ [AI Chat Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}