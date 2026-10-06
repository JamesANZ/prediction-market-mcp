import superagent from "superagent";

export type HttpQuery = Record<string, string | number | boolean | undefined>;

export type HttpGet = (url: string, query?: HttpQuery) => Promise<unknown>;

const USER_AGENT = "prediction-markets/1.0";

export async function getJson(url: string, query?: HttpQuery): Promise<unknown> {
  let request = superagent
    .get(url)
    .set("User-Agent", USER_AGENT)
    .set("accept", "application/json")
    .timeout({ response: 15000, deadline: 20000 });

  if (query) {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params[key] = value;
    }
    request = request.query(params);
  }

  const response = await request;
  return response.body;
}
