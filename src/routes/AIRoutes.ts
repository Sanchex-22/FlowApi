import { Router } from 'express';
import { AIController } from '../controllers/AIController.js';

const AIrouter = Router();
const aiController = new AIController();

// ✅ Todos POST — reciben body con companyId u otros datos
AIrouter.post('/generate-insights', aiController.generateDashboardInsights.bind(aiController));
AIrouter.post('/equipment-summary', aiController.generateEquipmentSummary.bind(aiController));
AIrouter.post('/analyze-expenses', aiController.analyzeExpenses.bind(aiController));
AIrouter.post('/chat', aiController.chat.bind(aiController));

export default AIrouter;