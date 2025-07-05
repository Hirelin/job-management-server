import z from "zod";

export const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company name is required"),
  location: z.string().optional(),
  type: z.enum([
    "fullTime",
    "partTime",
    "contract",
    "internship",
    "freelance",
    "temporary",
    "volunteer",
    "remote",
    "onSite",
    "hybrid",
  ]),
  description: z.string().min(1, "Job description is required"),
  contact: z.string().email("Invalid email address"),
  address: z.string(),
  // requiremetsFile: z.any().optional(), // Note the spelling "requiremets" vs "requirements"
});
