import { ChartBar, Cpu, Search, BookOpen, Building2, Film, type LucideIcon } from "lucide-react";

export type ContentTypeOption = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

export const CONTENT_TYPES: ContentTypeOption[] = [
  {
    id: "business_finance",
    icon: ChartBar,
    title: "Business & Finance",
    description: "Company stories, market analysis, financial exposés",
  },
  {
    id: "tech_innovation",
    icon: Cpu,
    title: "Tech & Innovation",
    description: "Startups, products, the future of technology",
  },
  {
    id: "true_crime",
    icon: Search,
    title: "True Crime & Investigation",
    description: "Scandals, cover-ups, systemic failures",
  },
  {
    id: "history_culture",
    icon: BookOpen,
    title: "History & Culture",
    description: "Events, movements, the stories behind the world",
  },
  {
    id: "brand_company",
    icon: Building2,
    title: "Brand & Company Stories",
    description: "Origin stories, turnarounds, case studies",
  },
  {
    id: "general_doc",
    icon: Film,
    title: "General Documentary",
    description: "Broad topics, mixed subject matter",
  },
];

export const EDITING_STYLES: { id: string; label: string }[] = [
  { id: "cinematic", label: "Cinematic & Deliberate" },
  { id: "fast_informative", label: "Fast & Informative" },
  { id: "systems_scale", label: "Systems & Scale" },
  { id: "investigative", label: "Investigative & Cold" },
  { id: "archival", label: "Archival & Textural" },
  { id: "raw_urgent", label: "Raw & Urgent" },
  { id: "escalating", label: "Escalating Arc" },
];
