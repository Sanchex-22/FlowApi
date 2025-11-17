import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController.js';

const InventoryRouter = Router();
const inventoryController = new InventoryController();
InventoryRouter.get('/inventory', inventoryController.getInventory.bind(inventoryController));
InventoryRouter.put('/:companyId/inventory/:id', inventoryController.updateInventory.bind(inventoryController));
InventoryRouter.delete('/:companyId/inventory/:id', inventoryController.deleteInventory.bind(inventoryController));
InventoryRouter.post('/:companyId/inventory/import', inventoryController.importCSV.bind(inventoryController));
InventoryRouter.get('/:companyId/inventory/all', inventoryController.getInventoryByCompanyCode.bind(inventoryController));
InventoryRouter.post('/:companyId/inventory/create', inventoryController.createInventory.bind(inventoryController));
export default InventoryRouter;
