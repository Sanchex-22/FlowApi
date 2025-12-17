import { Router } from "express"
import { AssignedUserController } from "../controllers/AssignedUserController.js"

const AssignedUserRouter = Router()
const controller = new AssignedUserController()

AssignedUserRouter.post("/create", controller.create.bind(controller))
AssignedUserRouter.delete("/delete/:id", controller.delete.bind(controller))

export default AssignedUserRouter
