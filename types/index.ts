export type Category = "competitor" | "top_creator" | "influencer";

export type Creator = {
  id: string;
  name: string;
  linkedin_url: string;
  category: Category | null;
  avatar_url: string | null;
  follower_count: number | null;
  last_scraped_at: string | null;
  created_at: string;
};

export type CreatorWithCount = Creator & {
  post_count: number;
};

export type ScrapedPost = {
  id: string;
  creator_id: string;
  content: string;
  published_at: string | null;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number | null;
  hook_type: string | null;
  format: string | null;
  themes: string[];
  post_url: string | null;
  created_at: string;
};

export type Insight = {
  id: string;
  best_hooks: unknown[];
  best_formats: unknown[];
  best_themes: unknown[];
  best_posting_times: unknown[];
  updated_at: string;
};

export type PostStatus = "draft" | "validated" | "scheduled" | "published";

export type GeneratedPost = {
  id: string;
  content: string;
  hook: string | null;
  cta: string | null;
  subject: string | null;
  format: string | null;
  status: PostStatus;
  scheduled_date: string | null;
  calendar_position: number | null;
  created_at: string;
};

export type CreatorProfile = {
  id: string;
  niche: string | null;
  tone: string | null;
  target_audience: string | null;
  goals: string[];
  posting_frequency: number;
  context: string | null;
  updated_at: string;
};
