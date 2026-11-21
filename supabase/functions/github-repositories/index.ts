import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return response({ error: "Sign in is required." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    if (!githubToken) {
      return response({ error: "GitHub connection is not configured on the server yet." }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return response({ error: "Your session is invalid. Please sign in again." }, 401);
    }

    const githubResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ALI-HUB",
        },
      },
    );

    if (!githubResponse.ok) {
      const details = await githubResponse.text();
      console.error("GitHub API error:", githubResponse.status, details);
      return response({
        error: githubResponse.status === 401
          ? "GitHub token is invalid or expired."
          : githubResponse.status === 403
          ? "GitHub access denied. Check token permissions or API rate limit."
          : `GitHub API returned status ${githubResponse.status}.`,
      }, 502);
    }

    const repositories = await githubResponse.json();

    return response({
      count: repositories.length,
      repositories: repositories.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        visibility: repo.visibility,
        private: repo.private,
        default_branch: repo.default_branch,
        archived: repo.archived,
        updated_at: repo.updated_at,
      })),
    });
  } catch (error) {
    console.error("github-repositories error:", error);
    return response({ error: "Unexpected server error while loading GitHub repositories." }, 500);
  }
});
