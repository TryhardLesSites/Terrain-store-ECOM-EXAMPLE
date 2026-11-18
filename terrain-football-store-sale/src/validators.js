import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(10).max(100),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60)
});

export const loginSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(1).max(100)
});

export const productSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(3000),
  categoryId: z.number().int().positive(),
  priceCents: z.number().int().min(0).max(10000000),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().max(1000).refine(value => value.startsWith("/uploads/") || /^https:\/\//.test(value), "Image locale ou URL HTTPS requise."),
  sizes: z.array(z.enum(["XS","S","M","L","XL","XXL","3XL"])).min(1).max(7),
  stock: z.number().int().min(0).max(100000),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  conditionLabel: z.string().trim().min(2).max(40).default("Neuf")
});

export const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    size: z.string().min(1).max(5),
    quantity: z.number().int().min(1).max(10)
  })).min(1).max(30),
  customerEmail: z.string().email().max(180)
});
