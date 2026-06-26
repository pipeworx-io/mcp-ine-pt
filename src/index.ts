interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Statistics Portugal (INE) JSON indicator MCP.
 *
 * Wraps the keyless INE indicator API at https://www.ine.pt/ine/json_indicador.
 *
 * IMPORTANT: INE has NO public indicator-search API. There is no endpoint to
 * look up an indicator by keyword. Callers MUST already know the indicator code
 * (varcd) from INE's website/catalog at https://www.ine.pt (e.g. via the
 * BDDXplorer database browser). Both tools require a varcd.
 *
 * Workflow: call `indicator_meta` first to discover an indicator's dimensions
 * and their valid dimension-value codes, then call `get_indicator` passing those
 * codes as a `dims` map (Dim1/Dim2/...) to select the slice you want.
 */


const BASE = 'https://www.ine.pt/ine/json_indicador';
const UA = 'pipeworx-mcp-ine-pt/1.0 (+https://pipeworx.io)';

const VARCD_NOTE =
  'INE indicator code (varcd), e.g. "0008273". INE has no keyword search API — find the varcd on https://www.ine.pt (BDDXplorer database browser) first.';

const tools: McpToolExport['tools'] = [
  {
    name: 'indicator_meta',
    description:
      'Metadata for an INE (Statistics Portugal) indicator: title, periodicity, unit, time range, and the full list of dimensions with their valid dimension-value codes. Call this BEFORE get_indicator so you know which Dim1/Dim2/... codes are valid. Requires the indicator code (varcd) — INE has no keyword/search endpoint, so look the code up on https://www.ine.pt first.',
    inputSchema: {
      type: 'object',
      properties: {
        varcd: { type: 'string', description: VARCD_NOTE },
        lang: { type: 'string', enum: ['EN', 'PT'], description: 'Response language. Default EN.' },
      },
      required: ['varcd'],
    },
  },
  {
    name: 'get_indicator',
    description:
      'Fetch data values for an INE (Statistics Portugal) indicator. Pass the indicator code (varcd) and optionally a `dims` object mapping dimension slots ("Dim1","Dim2",...) to dimension-value codes to select a slice (codes come from indicator_meta). Omit a Dim slot to return all of its values. Requires varcd — INE has no keyword/search endpoint, so look the code up on https://www.ine.pt first.',
    inputSchema: {
      type: 'object',
      properties: {
        varcd: { type: 'string', description: VARCD_NOTE },
        dims: {
          type: 'object',
          description:
            'Dimension selections, e.g. {"Dim1":"S7A2021","Dim3":"1"}. Keys are Dim1..DimN (matching the dim_num from indicator_meta); values are dimension-value codes. May also be passed as an array, treated as [Dim1, Dim2, ...].',
        },
        lang: { type: 'string', enum: ['EN', 'PT'], description: 'Response language. Default EN.' },
      },
      required: ['varcd'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'indicator_meta': {
      const varcd = reqVarcd(args);
      const params = new URLSearchParams({ varcd, lang: lang(args) });
      return ineGet(`/pindicaMeta.jsp?${params.toString()}`);
    }
    case 'get_indicator': {
      const varcd = reqVarcd(args);
      const params = new URLSearchParams({ op: '2', varcd, lang: lang(args) });
      for (const [slot, value] of dimEntries(args.dims)) params.set(slot, value);
      return ineGet(`/pindica.jsp?${params.toString()}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function ineGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`INE Portugal: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const data = (await res.json()) as unknown;
  // INE returns HTTP 200 with a {Sucesso:{Falso:[{Msg,...}]}} envelope for
  // unknown/invalid indicator codes — surface that as an error.
  const fail = findFailure(data);
  if (fail) throw new Error(`INE Portugal: ${fail.slice(0, 200)}`);
  return data;
}

function findFailure(data: unknown): string | null {
  const first = Array.isArray(data) ? data[0] : data;
  if (!first || typeof first !== 'object') return null;
  const sucesso = (first as Record<string, unknown>).Sucesso;
  if (!sucesso || typeof sucesso !== 'object') return null;
  const falso = (sucesso as Record<string, unknown>).Falso;
  const entry = Array.isArray(falso) ? falso[0] : undefined;
  if (entry && typeof entry === 'object') {
    const msg = (entry as Record<string, unknown>).Msg;
    if (typeof msg === 'string') return msg;
    return 'indicator request failed';
  }
  return null;
}

/** Normalize a `dims` arg into [["Dim1","value"], ...] entries. */
function dimEntries(dims: unknown): Array<[string, string]> {
  if (dims == null) return [];
  if (Array.isArray(dims)) {
    return dims
      .map((v, i) => [`Dim${i + 1}`, String(v)] as [string, string])
      .filter(([, v]) => v.trim() !== '');
  }
  if (typeof dims === 'object') {
    return Object.entries(dims as Record<string, unknown>)
      .filter(([k]) => /^Dim\d+$/.test(k))
      .map(([k, v]) => [k, String(v)] as [string, string])
      .filter(([, v]) => v.trim() !== '');
  }
  throw new Error('"dims" must be an object like {"Dim1":"S7A2021"} or an array [Dim1, Dim2, ...].');
}

function reqVarcd(args: Record<string, unknown>): string {
  const v = args.varcd;
  if (typeof v !== 'string' || !v.trim())
    throw new Error(
      'Required argument "varcd" is missing. INE has no keyword/search API — find the indicator code on https://www.ine.pt (BDDXplorer) and pass it, e.g. varcd="0008273".'
    );
  return v.trim();
}

function lang(args: Record<string, unknown>): string {
  const l = typeof args.lang === 'string' ? args.lang.toUpperCase() : '';
  return l === 'PT' ? 'PT' : 'EN';
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
