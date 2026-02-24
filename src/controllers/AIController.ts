import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { EquipmentStatus, MaintenanceStatus } from '../../generated/prisma/index.js';

// ✅ OpenAI en lugar de OpenRouter
const AI_MODEL = 'gpt-4o-mini'; // Rápido y barato — también puedes usar 'gpt-4o'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

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
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno.');
    }

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: AI_MODEL, messages, temperature, max_tokens: 1500 }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`OpenAI error: ${JSON.stringify(err)}`);
    }

    return response.json() as Promise<OpenAIResponse>;
};

const cleanAIResponse = (raw: string): string => {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) return jsonMatch[0];
    return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
};

export class AIController {

    async generateDashboardInsights(req: Request, res: Response) {
        console.log('🔹 [AI] Generando insights...');
        try {
            const { companyId } = req.body;
            if (!companyId) return res.status(400).json({ error: 'Falta companyId.' });

            const [
                totalEquipment, activeEquipment, inMaintenance,
                totalPersons, expenses, equipmentGrouped,
            ] = await Promise.all([
                prisma.equipment.count({ where: { companyId } }),
                prisma.equipment.count({ where: { companyId, status: EquipmentStatus.ACTIVE } }),
                prisma.maintenance.count({
                    where: { companyId, status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] } },
                }),
                prisma.user.count({ where: { companies: { some: { companyId } }, isActive: true } }),
                prisma.annualSoftwareExpense.findMany({ orderBy: { annualCost: 'desc' }, take: 5 }),
                prisma.equipment.groupBy({ by: ['type'], where: { companyId }, _count: { type: true } }),
            ]);

            const totalExpensesCost = expenses.reduce((sum, item) => sum + item.annualCost, 0);
            const monthlyCost       = totalExpensesCost / 12;
            const topExpenseName    = expenses.length > 0 ? expenses[0].applicationName : 'N/A';
            const equipmentSummary  = equipmentGrouped.map(e => `${e.type}: ${e._count.type}`).join(', ');

            const prompt = `Analiza estos datos de inventario tecnológico:
- Equipos: ${totalEquipment} (Activos: ${activeEquipment}, Mtto: ${inMaintenance})
- Usuarios: ${totalPersons}
- Tipos: ${equipmentSummary || 'Sin datos'}
- Gasto Software Mensual: $${monthlyCost.toFixed(0)}
- App más costosa: ${topExpenseName}

Responde SOLO con JSON válido. Cada "content" máximo 20 palabras. Sin texto extra:
[
  {"type":"summary","title":"Resumen General","content":"...","priority":"medium","icon":"📊"},
  {"type":"alert","title":"Punto de Atención","content":"...","priority":"high","icon":"⚠️"},
  {"type":"recommendation","title":"Recomendación","content":"...","priority":"medium","icon":"💡"},
  {"type":"optimization","title":"Ahorro","content":"...","priority":"low","icon":"💰"}
]`;

            const completion = await callOpenAI([{ role: 'user', content: prompt }], 0.5);
            const rawContent = completion.choices?.[0]?.message?.content ?? '';
            const cleaned    = cleanAIResponse(rawContent);

            let insights;
            try {
                insights = JSON.parse(cleaned);
            } catch {
                console.error('❌ Error parseando JSON:', rawContent);
                insights = [{ type: 'alert', title: 'Error', content: 'No se pudo procesar. Intenta de nuevo.', priority: 'high', icon: '⚠️' }];
            }

            return res.status(200).json({ insights, generatedAt: new Date() });

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
            const summary    = completion.choices?.[0]?.message?.content ?? 'No se pudo generar resumen.';

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

            const expenses = await prisma.annualSoftwareExpense.findMany({ orderBy: { annualCost: 'desc' } });

            if (expenses.length === 0) {
                return res.status(200).json({ analysis: 'No hay gastos de software registrados.' });
            }

            const totalAnual  = expenses.reduce((sum, e) => sum + e.annualCost, 0);
            const expenseList = expenses
                .map(e => `- ${e.applicationName} (${e.category}): $${e.annualCost}/año, ${e.numberOfUsers} usuarios`)
                .join('\n');

            const prompt = `Analista financiero de TI. Analiza estos gastos:
${expenseList}
Total Anual: $${totalAnual.toFixed(0)}
Da: 1) Resumen del gasto 2) Mejor/peor relación costo/usuario 3) 2 recomendaciones. Máximo 150 palabras.`;

            const completion = await callOpenAI([{ role: 'user', content: prompt }], 0.4);
            const analysis   = completion.choices?.[0]?.message?.content ?? 'No se pudo analizar.';

            return res.status(200).json({ analysis, totalAnual, totalSoftware: expenses.length });

        } catch (error: any) {
            console.error('❌ [AI Expenses Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async chat(req: Request, res: Response) {
        try {
            const { messages, systemPrompt } = req.body;
            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'Messages son requeridos.' });
            }

            const completion = await callOpenAI(
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