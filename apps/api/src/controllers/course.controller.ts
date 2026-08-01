import type { Request, Response } from "express";
import { z } from "zod";
import * as courseService from "../services/course.service.js";
import { validated } from "../middleware/validate.js";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  published: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  search: z.string().trim().min(1).optional(),
});

export const createCourseSchema = z.object({
  title: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug may contain lowercase letters, digits and dashes"),
  description: z.string().default(""),
  instructor: z.string().trim().min(1),
  price: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100).default(0),
  isFree: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const updateCourseSchema = createCourseSchema.partial();

export async function list(_req: Request, res: Response) {
  const query = validated(res, listQuerySchema);
  res.json(await courseService.listCourses(query));
}

export async function getOne(req: Request, res: Response) {
  res.json(await courseService.getCourseById(req.params.id as string));
}

export async function create(_req: Request, res: Response) {
  const body = validated(res, createCourseSchema);
  const course = await courseService.createCourse(body);
  res.status(201).json(course);
}

export async function update(req: Request, res: Response) {
  const body = validated(res, updateCourseSchema);
  res.json(await courseService.updateCourse(req.params.id as string, body));
}

export async function remove(req: Request, res: Response) {
  await courseService.deleteCourse(req.params.id as string);
  res.status(204).end();
}
