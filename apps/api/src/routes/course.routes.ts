import { Router } from "express";
import * as controller from "../controllers/course.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { validate } from "../middleware/validate.js";

export const courseRouter: Router = Router();

courseRouter.get(
  "/",
  validate(controller.listQuerySchema, "query"),
  asyncHandler(controller.list),
);

courseRouter.get("/:id", asyncHandler(controller.getOne));

courseRouter.post(
  "/",
  validate(controller.createCourseSchema),
  asyncHandler(controller.create),
);

courseRouter.patch(
  "/:id",
  validate(controller.updateCourseSchema),
  asyncHandler(controller.update),
);

courseRouter.delete("/:id", asyncHandler(controller.remove));
