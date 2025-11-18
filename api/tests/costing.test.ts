import { buildCostingInputs, calculateCost } from '../src/lib/questionnaire/costing';
import { calculateCostForQuote } from '../src/services/quoteCosting';
import { prisma } from '../src/prisma';

// Mock Prisma calls used by buildCostingInputs & calculateCostForQuote
describe('Questionnaire Costing (Mocked Prisma)', () => {
  const tenantId = 't1';
  const quoteId = 'q1';
  const responseId = 'r1';

  const fields = [
    { id: 'f_height', costingInputKey: 'door_height_mm', type: 'NUMBER' },
    { id: 'f_width', costingInputKey: 'door_width_mm', type: 'NUMBER' },
    { id: 'f_qty', costingInputKey: 'quantity', type: 'NUMBER' },
  ];
  const answersFull = [
    { id: 'a1', fieldId: 'f_height', value: 2000, field: fields[0] },
    { id: 'a2', fieldId: 'f_width', value: 800, field: fields[1] },
    { id: 'a3', fieldId: 'f_qty', value: 2, field: fields[2] },
  ];

  beforeEach(() => {
    jest.spyOn(prisma.quote, 'findFirst').mockResolvedValue({ id: quoteId, tenantId, meta: null } as any);
    jest.spyOn(prisma.quote, 'update').mockResolvedValue({ id: quoteId } as any);
    jest.spyOn(prisma.questionnaireResponse, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.quoteId === quoteId) {
        return { id: responseId, quoteId, tenantId, answers: answersFull } as any;
      }
      if (args.where.id === responseId) {
        return { id: responseId, quoteId, tenantId } as any;
      }
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('buildCostingInputs maps numeric answers', async () => {
    const inputs = await buildCostingInputs(quoteId, tenantId);
    expect(inputs).toEqual({ door_height_mm: 2000, door_width_mm: 800, quantity: 2 });
  });

  test('calculateCost derives expected cost', async () => {
    const inputs = await buildCostingInputs(quoteId, tenantId);
    const result = await calculateCost(inputs, tenantId);
    expect(result.estimatedCost).toBe(4200); // (500 + 1600) * 2
    expect(result.breakdown).toEqual({ base: 1000, area: 3200 });
  });

  test('calculateCostForQuote returns breakdown & updates', async () => {
    const out = await calculateCostForQuote(quoteId, tenantId, { requiredKeys: ['door_height_mm', 'door_width_mm', 'quantity'] });
    expect(out.estimatedCost).toBe(4200);
    expect(out.breakdown).toEqual({ base: 1000, area: 3200 });
    expect(out.updated).toBe(true);
  });

  test('calculateCostForQuote reports missing required key', async () => {
    // Mock response missing width
    jest.spyOn(prisma.questionnaireResponse, 'findUnique').mockResolvedValue({
      id: responseId,
      quoteId,
      tenantId,
      answers: answersFull.filter(a => a.fieldId !== 'f_width'),
    } as any);
    const out = await calculateCostForQuote(quoteId, tenantId, { requiredKeys: ['door_height_mm', 'door_width_mm', 'quantity'] });
    expect(out.missingRequired).toContain('door_width_mm');
    expect(out.updated).toBe(false);
  });
});
