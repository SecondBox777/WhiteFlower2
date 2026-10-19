// Static previews and intermediary failures can return plain text or HTML.
// Never display those response bodies or JSON parser errors to users.
export async function readApiResponse(response, fallback) {
  let data;
  try { data = await response.json(); } catch { throw Error(fallback); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(fallback);
  return data;
}
