import { isValidObjectId } from "mongoose";
import { CourseModel, type Course } from "../models/course.model.js";
import { HttpError } from "../middleware/error-handler.js";

/**
 * All database access for courses lives here. Controllers stay thin: they read
 * the request, call a service, and shape the response.
 */

export interface ListOptions {
  page: number;
  limit: number;
  published?: boolean;
  search?: string;
}

export async function listCourses({ page, limit, published, search }: ListOptions) {
  const filter: Record<string, unknown> = {};
  if (published !== undefined) filter.isPublished = published;
  if (search) filter.title = { $regex: search, $options: "i" };

  const [items, total] = await Promise.all([
    CourseModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseModel.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getCourseById(id: string) {
  // Mongoose throws a CastError on a malformed id; a 404 is the honest answer.
  if (!isValidObjectId(id)) throw new HttpError(404, "Course not found");

  const course = await CourseModel.findById(id);
  if (!course) throw new HttpError(404, "Course not found");
  return course;
}

export async function createCourse(input: Partial<Course>) {
  const existing = await CourseModel.exists({ slug: input.slug });
  if (existing) throw new HttpError(409, `Slug "${input.slug}" is already taken`);

  return CourseModel.create(input);
}

export async function updateCourse(id: string, input: Partial<Course>) {
  const course = await getCourseById(id);
  course.set(input);
  return course.save();
}

export async function deleteCourse(id: string) {
  const course = await getCourseById(id);
  await course.deleteOne();
}
